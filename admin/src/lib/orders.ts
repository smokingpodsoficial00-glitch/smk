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
export async function deleteOrderWithStockRestoration(
  orderId: string,
  options?: {
    restoreStock?: boolean;
    deleteClientIfNoOrders?: boolean;
    companyId?: string;
  }
): Promise<DeleteOrderResult> {
  const shouldRestoreStock = options?.restoreStock !== false;
  const shouldDeleteClientIfNoOrders = options?.deleteClientIfNoOrders ?? true;

  try {
    // 1. Buscar o pedido para ler os itens e informações do cliente
    const { data: order, error: fetchErr } = await supabase
      .from('smoking_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[deleteOrder] Erro ao buscar pedido:', fetchErr);
      return { success: false, error: fetchErr.message };
    }

    if (!order) {
      return { success: false, error: 'Pedido não encontrado no banco de dados.' };
    }

    let restoredCount = 0;

    // 2. Restaurar o estoque em smoking_products se solicitado
    if (shouldRestoreStock && Array.isArray(order.items) && order.items.length > 0) {
      for (const item of order.items) {
        const prodId = item.product_id || item.productId || item.id;
        const qtyToRestore = Number(item.quantity) || 1;

        if (!prodId) continue;

        try {
          const { data: prodData } = await supabase
            .from('smoking_products')
            .select('id, stock')
            .eq('id', prodId)
            .maybeSingle();

          if (prodData) {
            const currentStock = typeof prodData.stock === 'number' 
              ? prodData.stock 
              : parseInt(String(prodData.stock || '0'), 10);
            const newStock = currentStock + qtyToRestore;

            const { error: updErr } = await supabase
              .from('smoking_products')
              .update({ stock: newStock })
              .eq('id', prodId);

            if (!updErr) {
              restoredCount += qtyToRestore;
              console.log(`[deleteOrder] Estoque restaurado para produto ${prodId}: ${currentStock} -> ${newStock} (+${qtyToRestore})`);
            } else {
              console.warn(`[deleteOrder] Erro ao atualizar estoque do produto ${prodId}:`, updErr.message);
            }
          }
        } catch (stockErr) {
          console.warn(`[deleteOrder] Falha ao processar devolução de item:`, stockErr);
        }
      }
    }

    // 3. Deletar o pedido de smoking_orders
    const { error: delErr } = await supabase
      .from('smoking_orders')
      .delete()
      .eq('id', orderId);

    if (delErr) {
      console.error('[deleteOrder] Erro ao deletar pedido:', delErr);
      return { success: false, error: delErr.message };
    }

    // 4. Se solicitado e o cliente não tiver mais nenhum pedido no histórico, remover cliente órfão/acidental
    if (shouldDeleteClientIfNoOrders && order.client_phone) {
      try {
        const { count, error: countErr } = await supabase
          .from('smoking_orders')
          .select('id', { count: 'exact', head: true })
          .eq('client_phone', order.client_phone);

        if (!countErr && count === 0) {
          // Cliente não possui mais nenhum pedido! Se for cliente com telefone de Instagram gerado ou sem compras
          let clientDelQuery = supabase
            .from('smoking_clients')
            .delete()
            .eq('phone', order.client_phone);

          if (order.company_id) {
            clientDelQuery = clientDelQuery.eq('company_id', order.company_id);
          }

          const { error: clientDelErr } = await clientDelQuery;
          if (!clientDelErr) {
            console.log(`[deleteOrder] Cliente sem outros pedidos removido automaticamente: ${order.client_phone}`);
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
  }
}

/**
 * Remove um cliente do cadastro de smoking_clients
 */
export async function deleteClientRecord(
  clientPhone: string,
  companyId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let query = supabase
      .from('smoking_clients')
      .delete()
      .eq('phone', clientPhone);

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
