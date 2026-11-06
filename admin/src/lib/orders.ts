import { supabase } from './supabase';
import { invalidateLiveClientsCache } from './crm';
import { invalidateSalesHistoryCache } from './salesHistory';

export interface DeleteOrderResult {
  success: boolean;
  restoredItemsCount?: number;
  error?: string;
}

// Trava em memória para impedir execuções simultâneas/duplicadas sobre o mesmo pedido
const activeOrderDeletions = new Set<string>();

/**
 * Exclui um pedido do banco de dados (smoking_orders) e restaura
 * garantidamente a quantidade de cada produto vendido de volta ao estoque (smoking_products).
 *
 * Blindado contra:
 * 1. Dupla devolução caso a trigger PostgreSQL `trg_stock_on_order_delete` esteja ativa no banco:
 *    calcula `expectedStock = stockBeforeDelete + totalQtyToRestore` antes do DELETE e reconcilia
 *    imediatamente após o DELETE para garantir incremento único exato (+1x, nunca +2x).
 * 2. Múltiplos itens do mesmo `productId` no mesmo pedido (agrupa quantidades por produto).
 * 3. Cliques múltiplos simultâneos (trava `activeOrderDeletions`).
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
    const stockReconciliationPlan = new Map<
      string,
      {
        productId: string;
        initialStock: number;
        qtyToRestore: number;
        expectedFinalStock: number;
        name: string;
        flavor: string;
      }
    >();

    // 2. Resolver produtos e calcular estoque exato antes da exclusão
    if (shouldRestoreStock && Array.isArray(order.items) && order.items.length > 0) {
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
        const isValidUuid =
          typeof rawId === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

        if (isValidUuid) {
          const { data: prodData, error: prodFetchErr } = await supabase
            .from('smoking_products')
            .select('id, stock, name, flavor')
            .eq('id', rawId)
            .maybeSingle();

          if (!prodFetchErr && prodData) {
            targetProductId = prodData.id;
            currentStock =
              typeof prodData.stock === 'number'
                ? prodData.stock
                : parseInt(String(prodData.stock || '0'), 10);
            resolvedProductName = prodData.name || resolvedProductName;
            resolvedProductFlavor = prodData.flavor || resolvedProductFlavor;
          }
        }

        // TENTATIVA 2: Fallback resiliente por modelo/marca e sabor
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
              currentStock =
                typeof resolved.stock === 'number'
                  ? resolved.stock
                  : parseInt(String(resolved.stock || '0'), 10);
              resolvedProductName = resolved.name || resolvedProductName;
              resolvedProductFlavor = resolved.flavor || resolvedProductFlavor;
            } else if (matchingCandidates.length > 1) {
              console.error(
                `[deleteOrder] Ambiguidade: ${matchingCandidates.length} produtos encontrados para "${targetName} - ${targetFlavor}".`
              );
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

        if (!stockReconciliationPlan.has(targetProductId)) {
          stockReconciliationPlan.set(targetProductId, {
            productId: targetProductId,
            initialStock: Number.isFinite(currentStock) ? currentStock : 0,
            qtyToRestore: qtyToRestore,
            expectedFinalStock: (Number.isFinite(currentStock) ? currentStock : 0) + qtyToRestore,
            name: resolvedProductName,
            flavor: resolvedProductFlavor
          });
        } else {
          const existingPlan = stockReconciliationPlan.get(targetProductId)!;
          existingPlan.qtyToRestore += qtyToRestore;
          existingPlan.expectedFinalStock = existingPlan.initialStock + existingPlan.qtyToRestore;
        }
      }

      // Aplica a devolução de estoque verificando permissão de escrita antes de apagar o pedido
      for (const plan of stockReconciliationPlan.values()) {
        const { error: updErr } = await supabase
          .from('smoking_products')
          .update({ stock: plan.expectedFinalStock })
          .eq('id', plan.productId);

        if (updErr) {
          console.error(`[deleteOrder] Erro ao atualizar estoque do produto ${plan.productId}:`, updErr);
          return {
            success: false,
            error: `Falha ao devolver itens ao estoque (${updErr.message}). O pedido não foi excluído.`
          };
        }

        restoredCount += plan.qtyToRestore;
      }
    }

    // 3. Deletar o pedido de smoking_orders SOMENTE após o estoque ser validado e restaurado com sucesso
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
      // Rollback do estoque caso a exclusão do pedido tenha falhado
      for (const plan of stockReconciliationPlan.values()) {
        try {
          await supabase
            .from('smoking_products')
            .update({ stock: plan.initialStock })
            .eq('id', plan.productId);
        } catch (rbErr) {}
      }
      return { success: false, error: delErr.message };
    }

    // 3.1 RECONCILIAÇÃO PÓS-DELETE (Anti-Dupla Restauração por Trigger SQL trg_stock_on_order_delete):
    // Se a trigger do banco tiver somado +qty novamente durante o DELETE FROM smoking_orders,
    // forçamos o estoque de volta ao valor exato esperado (initialStock + qtyToRestore).
    for (const plan of stockReconciliationPlan.values()) {
      try {
        await supabase
          .from('smoking_products')
          .update({ stock: plan.expectedFinalStock })
          .eq('id', plan.productId);
        console.log(
          `[deleteOrder] Estoque reconciliado com sucesso para ${plan.name} (${plan.flavor}): ${plan.initialStock} -> ${plan.expectedFinalStock} (+${plan.qtyToRestore})`
        );
      } catch (reconcileErr) {
        console.warn(`[deleteOrder] Aviso ao reconciliar estoque do produto ${plan.productId}:`, reconcileErr);
      }
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

    const targetTenant = order?.company_id || options?.companyId;
    invalidateLiveClientsCache(targetTenant);
    invalidateSalesHistoryCache(targetTenant);

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

    invalidateLiveClientsCache(companyId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao remover cliente.' };
  }
}
