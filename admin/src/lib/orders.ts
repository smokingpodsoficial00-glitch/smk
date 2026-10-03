import { supabase } from './supabase';

export interface DeleteOrderResult {
  success: boolean;
  restoredItemsCount?: number;
  error?: string;
}

/**
 * Exclui um pedido do banco de dados (smoking_orders) e restaura
 * automaticamente a quantidade de cada produto vendido de volta ao estoque (smoking_products).
 * Funciona globalmente para qualquer empresa/tenant.
 */
// Trava em memória para impedir execuções simultâneas/duplicadas sobre o mesmo pedido
const activeOrderDeletions = new Set<string>();

/**
 * Exclui um pedido do banco de dados (smoking_orders) e restaura
 * garantidamente a quantidade de cada produto vendido de volta ao estoque (smoking_products).
 * Suporta fallback inteligente por modelo/sabor se o ID direto não for encontrado,
 * bloqueia requisições duplicadas e aborta com erro explícito caso o estoque não possa ser restaurado.
 */
export async function deleteOrderWithStockRestoration(
  orderId: string,
  options?: {
    restoreStock?: boolean;
    deleteClientIfNoOrders?: boolean;
    companyId?: string;
  }
): Promise<DeleteOrderResult> {
  const shouldRestoreStock = options?.restoreStock !== false;
  const shouldDeleteClientIfNoOrders = options?.deleteClientIfNoOrders ?? false;

  // 🛡️ TRAVA DE CONCORRÊNCIA: impede devolução duplicada por cliques múltiplos
  if (activeOrderDeletions.has(orderId)) {
    return { success: false, error: 'A exclusão deste pedido já está em andamento.' };
  }
  activeOrderDeletions.add(orderId);

  try {
    // 1. Buscar o pedido para ler os itens e informações do cliente
    let fetchQuery = supabase
      .from('smoking_orders')
      .select('*')
      .eq('id', orderId);

    if (options?.companyId) {
      // Suporta empresa vinculada ou legado com company_id null da loja oficial
      fetchQuery = fetchQuery.or(`company_id.eq.${options.companyId},company_id.is.null`);
    }

    const { data: order, error: fetchErr } = await fetchQuery.maybeSingle();

    if (fetchErr) {
      console.error('[deleteOrder] Erro ao buscar pedido:', fetchErr);
      return { success: false, error: fetchErr.message };
    }

    if (!order) {
      return { success: false, error: 'Pedido não encontrado no banco de dados ou já excluído.' };
    }

    let restoredCount = 0;

    // 2. Restaurar o estoque em smoking_products se solicitado
    if (shouldRestoreStock && Array.isArray(order.items) && order.items.length > 0) {
      // Pré-carregar catálogo de produtos da empresa para resolução segura de fallback se necessário
      let cachedCompanyProducts: any[] | null = null;

      for (const item of order.items) {
        const qtyToRestore = Number(item.quantity) || 1;
        if (qtyToRestore <= 0) continue;

        let targetProductId: string | null = null;
        let currentStock = 0;
        let resolvedProductName = item.name || item.model || 'Produto';
        let resolvedProductFlavor = item.flavor || '';

        // TENTATIVA 1: Busca direta por UUID (item.product_id, item.productId ou item.id)
        const rawId = item.product_id || item.productId || item.id;
        const isValidUuid = typeof rawId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

        if (isValidUuid) {
          const { data: prodData, error: prodFetchErr } = await supabase
            .from('smoking_products')
            .select('id, stock, name, flavor')
            .eq('id', rawId)
            .maybeSingle();

          if (!prodFetchErr && prodData) {
            targetProductId = prodData.id;
            currentStock = typeof prodData.stock === 'number' 
              ? prodData.stock 
              : parseInt(String(prodData.stock || '0'), 10);
            resolvedProductName = prodData.name || resolvedProductName;
            resolvedProductFlavor = prodData.flavor || resolvedProductFlavor;
          }
        }

        // TENTATIVA 2: Fallback resiliente por modelo/marca e sabor (padrão de segurança stockSync)
        if (!targetProductId) {
          const targetFlavor = (item.flavor || '').trim().toLowerCase();
          const targetName = (item.name || item.model || item.brand || '').trim().toLowerCase();

          if (!cachedCompanyProducts) {
            let prodsQuery = supabase
              .from('smoking_products')
              .select('id, name, brand, flavor, stock, company_id');

            if (order.company_id || options?.companyId) {
              const cId = order.company_id || options?.companyId;
              prodsQuery = prodsQuery.or(`company_id.eq.${cId},company_id.is.null`);
            }

            const { data: prods } = await prodsQuery;
            cachedCompanyProducts = prods || [];
          }

          if (cachedCompanyProducts.length > 0 && targetFlavor && targetName) {
            // Busca apenas candidatos com correspondência de modelo E sabor
            const matchingCandidates = cachedCompanyProducts.filter((p) => {
              const pFlavor = (p.flavor || '').trim().toLowerCase();
              const pName = (p.name || '').trim().toLowerCase();
              const pBrand = (p.brand || '').trim().toLowerCase();

              const flavorMatch =
                pFlavor === targetFlavor ||
                pFlavor.includes(targetFlavor) ||
                targetFlavor.includes(pFlavor);

              const modelMatch =
                pName.includes(targetName) ||
                pBrand.includes(targetName) ||
                targetName.includes(pName) ||
                targetName.includes(pBrand);

              return Boolean(flavorMatch && modelMatch);
            });

            if (matchingCandidates.length === 1) {
              const resolved = matchingCandidates[0];
              targetProductId = resolved.id;
              currentStock = typeof resolved.stock === 'number'
                ? resolved.stock
                : parseInt(String(resolved.stock || '0'), 10);
              resolvedProductName = resolved.name || resolvedProductName;
              resolvedProductFlavor = resolved.flavor || resolvedProductFlavor;
              console.log(`[deleteOrder] Produto localizado por fallback unívoco (modelo + sabor): ${resolvedProductName} - ${resolvedProductFlavor} (${resolved.id})`);
            } else if (matchingCandidates.length > 1) {
              console.error(`[deleteOrder] Ambiguidade: ${matchingCandidates.length} produtos encontrados para "${targetName} - ${targetFlavor}".`);
              return {
                success: false,
                error: `Identificação ambígua: foram encontrados ${matchingCandidates.length} produtos compatíveis com "${resolvedProductName} (${resolvedProductFlavor})". Restauração cancelada para impedir devolução no produto errado.`
              };
            }
          }
        }

        // 🛡️ TRAVA CRÍTICA: Se o produto não foi localizado de forma alguma, NÃO deletar silenciosamente!
        if (!targetProductId) {
          console.error('[deleteOrder] Falha crítica: produto não localizado no estoque para restauração:', item);
          return {
            success: false,
            error: `Não foi possível localizar no estoque o produto "${resolvedProductName}" (${resolvedProductFlavor || 'sem sabor'}). A exclusão foi abortada para impedir perda de estoque.`
          };
        }

        // Incrementa o estoque do produto localizado
        const newStock = currentStock + qtyToRestore;
        const { error: updErr } = await supabase
          .from('smoking_products')
          .update({ stock: newStock })
          .eq('id', targetProductId);

        if (updErr) {
          console.error(`[deleteOrder] Erro ao atualizar estoque do produto ${targetProductId}:`, updErr);
          return {
            success: false,
            error: `Falha ao devolver itens ao estoque (${updErr.message}). O pedido não foi excluído.`
          };
        }

        restoredCount += qtyToRestore;
        console.log(`[deleteOrder] Estoque restaurado com sucesso para ${resolvedProductName} (${resolvedProductFlavor}): ${currentStock} -> ${newStock} (+${qtyToRestore})`);
      }
    }

    // 3. Deletar o pedido de smoking_orders SOMENTE após o estoque ser restaurado com sucesso
    let delQuery = supabase
      .from('smoking_orders')
      .delete()
      .eq('id', orderId);

    if (options?.companyId) {
      delQuery = delQuery.or(`company_id.eq.${options.companyId},company_id.is.null`);
    }

    const { error: delErr } = await delQuery;

    if (delErr) {
      console.error('[deleteOrder] Erro ao deletar pedido:', delErr);
      return { success: false, error: delErr.message };
    }

    // 4. Se expressamente solicitado e o cliente não tiver mais nenhum pedido, limpar exclusivamente por customer_id
    if (shouldDeleteClientIfNoOrders && order.customer_id) {
      try {
        const { count, error: countErr } = await supabase
          .from('smoking_orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', order.customer_id);

        if (!countErr && count === 0) {
          let clientDelQuery = supabase
            .from('smoking_clients')
            .delete()
            .eq('id', order.customer_id);

          if (order.company_id) {
            clientDelQuery = clientDelQuery.eq('company_id', order.company_id);
          }

          const { error: clientDelErr } = await clientDelQuery;
          if (!clientDelErr) {
            console.log(`[deleteOrder] Cliente sem outros pedidos removido por ID: ${order.customer_id}`);
          }
        }
      } catch (cleanClientErr) {
        console.warn('[deleteOrder] Falha ao verificar/limpar cliente sem pedidos:', cleanClientErr);
      }
    }

    return {
      success: true,
      restoredItemsCount: restoredCount
    };
  } catch (err: any) {
    console.error('[deleteOrder] Exceção inesperada:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao excluir pedido.' };
  } finally {
    // Libera a trava do pedido ao finalizar
    activeOrderDeletions.delete(orderId);
  }
}

/**
 * Remove um cliente do cadastro de smoking_clients EXCLUSIVAMENTE pelo ID primário (customer.id).
 * NUNCA remove por telefone.
 */
export async function deleteClientRecord(
  clientId: string,
  companyId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!clientId) {
      return { success: false, error: 'Identificador (ID) do cliente não informado.' };
    }

    let query = supabase
      .from('smoking_clients')
      .delete()
      .eq('id', clientId);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao remover cliente.' };
  }
}
