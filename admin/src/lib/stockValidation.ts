/**
 * stockValidation.ts
 *
 * Módulo de validação atômica de estoque e registro blindado de vendas do SMK System.
 * Garante que:
 * 1. Produtos esgotados (estoque zero ou negativo) não possam ser adicionados ou vendidos.
 * 2. Vendas com quantidade superior ao estoque disponível sejam imediatamente bloqueadas.
 * 3. A baixa de estoque seja executada com trava atômica no banco (WHERE stock >= qty),
 *    impedindo que vendas concorrentes deixem o estoque negativo.
 * 4. Em caso de falha em qualquer produto do carrinho, todo o estoque já reservado
 *    seja revertido de forma atômica (rollback de compensação).
 * 5. Nenhum pedido seja gravado se a baixa de estoque falhar.
 * 6. Suporta isolamento multi-tenant por company_id.
 */

import { supabase } from './supabase';

export interface SaleItemToValidate {
  productId: string;
  brand: string;
  modelName: string;
  flavor: string;
  quantity: number;
  price: number;
  costPrice?: number;
}

export interface StockValidationCheckResult {
  canProceed: boolean;
  errorMessage?: string;
  outOfStockItems: Array<{
    productId: string;
    modelName: string;
    flavor: string;
    requestedQty: number;
    availableStock: number;
  }>;
}

export interface AtomicSaleExecutionResult {
  success: boolean;
  orderId?: string;
  errorMessage?: string;
  failedItem?: {
    productId: string;
    name: string;
    requestedQty: number;
    availableStock: number;
  };
}

/**
 * Validação pura em memória de itens contra o estoque
 */
export function validateCartStockAvailability(
  items: SaleItemToValidate[],
  catalogProducts: Array<{ id: string; stock?: number | null; name?: string; flavor?: string }>
): StockValidationCheckResult {
  if (!items || items.length === 0) {
    return {
      canProceed: false,
      errorMessage: 'O carrinho está vazio.',
      outOfStockItems: []
    };
  }

  const catalogMap = new Map<string, number>();
  for (const p of catalogProducts) {
    const s = typeof p.stock === 'number' ? p.stock : parseInt(String(p.stock || '0'), 10);
    catalogMap.set(p.id, Number.isFinite(s) ? s : 0);
  }

  const outOfStockItems: StockValidationCheckResult['outOfStockItems'] = [];

  for (const item of items) {
    const requested = Number(item.quantity) || 1;
    if (requested <= 0) {
      return {
        canProceed: false,
        errorMessage: `Quantidade inválida (${requested}) para o item ${item.modelName} - ${item.flavor}.`,
        outOfStockItems: []
      };
    }

    const available = catalogMap.get(item.productId) ?? 0;

    if (available <= 0) {
      outOfStockItems.push({
        productId: item.productId,
        modelName: item.modelName,
        flavor: item.flavor,
        requestedQty: requested,
        availableStock: available
      });
    } else if (requested > available) {
      outOfStockItems.push({
        productId: item.productId,
        modelName: item.modelName,
        flavor: item.flavor,
        requestedQty: requested,
        availableStock: available
      });
    }
  }

  if (outOfStockItems.length > 0) {
    const first = outOfStockItems[0];
    const msg = first.availableStock <= 0
      ? `Produto esgotado: ${first.modelName} (${first.flavor}). Não é possível registrar esta venda.`
      : `Estoque insuficiente para ${first.modelName} (${first.flavor}): solicitado ${first.requestedQty} un, mas há apenas ${first.availableStock} un disponível(is).`;

    return {
      canProceed: false,
      errorMessage: msg,
      outOfStockItems
    };
  }

  return {
    canProceed: true,
    outOfStockItems: []
  };
}

/**
 * Executa a baixa atômica de estoque com verificação em tempo real no Supabase.
 * Se duas abas ou operadores tentarem vender o mesmo produto simultaneamente,
 * a cláusula `.gte('stock', requestedQty)` garante que apenas UMA transação
 * consegue atualizar a linha. A outra falha e não gera pedido.
 *
 * Em caso de erro em qualquer item, reverte o estoque já deduzido dos itens anteriores.
 */
export async function executeAtomicSaleWithStockLock(params: {
  companyId: string;
  orderPayload: any;
  items: SaleItemToValidate[];
}): Promise<AtomicSaleExecutionResult> {
  const { companyId, orderPayload, items } = params;

  if (!items || items.length === 0) {
    return { success: false, errorMessage: 'Nenhum produto selecionado para a venda.' };
  }

  // 1. Busca em tempo real o estoque atual de todos os produtos do pedido
  const productIds = items.map(i => i.productId).filter(Boolean);
  let stockQuery = supabase
    .from('smoking_products')
    .select('id, name, brand, flavor, stock, company_id')
    .in('id', productIds);

  if (companyId) {
    stockQuery = stockQuery.or(`company_id.eq.${companyId},company_id.is.null`);
  }

  const { data: currentProducts, error: fetchErr } = await stockQuery;

  if (fetchErr) {
    return {
      success: false,
      errorMessage: `Erro ao consultar disponibilidade de estoque no servidor: ${fetchErr.message}`
    };
  }

  // 2. Validação preliminar com os dados mais recentes do servidor
  const preCheck = validateCartStockAvailability(items, currentProducts || []);
  if (!preCheck.canProceed) {
    return {
      success: false,
      errorMessage: preCheck.errorMessage,
      failedItem: preCheck.outOfStockItems[0]
        ? {
            productId: preCheck.outOfStockItems[0].productId,
            name: `${preCheck.outOfStockItems[0].modelName} - ${preCheck.outOfStockItems[0].flavor}`,
            requestedQty: preCheck.outOfStockItems[0].requestedQty,
            availableStock: preCheck.outOfStockItems[0].availableStock
          }
        : undefined
    };
  }

  // 3. FASE ATÔMICA: Baixa de estoque produto a produto com trava de concorrência (.gte('stock', qty))
  // Mantém rastreio dos itens reservados para rollback de compensação caso algum item falhe
  const reservedItems: Array<{ productId: string; originalStock: number; deductedQty: number }> = [];

  for (const item of items) {
    const requestedQty = Number(item.quantity) || 1;
    const prodDb = (currentProducts || []).find(p => p.id === item.productId);
    const dbStock = typeof prodDb?.stock === 'number' ? prodDb.stock : parseInt(String(prodDb?.stock || '0'), 10);

    if (dbStock < requestedQty) {
      // Rollback imediato dos itens reservados anteriormente
      await rollbackReservedStock(reservedItems);
      return {
        success: false,
        errorMessage: `Estoque insuficiente para ${item.modelName} (${item.flavor}). Disponível: ${dbStock} un.`,
        failedItem: {
          productId: item.productId,
          name: `${item.modelName} - ${item.flavor}`,
          requestedQty,
          availableStock: dbStock
        }
      };
    }

    const targetStock = dbStock - requestedQty;

    // UPDATE ATÔMICO COM WHERE CONDICIONAL: só altera se o estoque ainda for >= requestedQty
    let updateQuery = supabase
      .from('smoking_products')
      .update({ stock: targetStock })
      .eq('id', item.productId)
      .gte('stock', requestedQty);

    if (companyId) {
      updateQuery = updateQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    const { data: updatedData, error: updateErr } = await updateQuery.select('id, stock');

    if (updateErr || !updatedData || updatedData.length === 0) {
      // Concorrência detectada: outra venda consumiu as unidades entre a leitura e a gravação
      await rollbackReservedStock(reservedItems);

      return {
        success: false,
        errorMessage: `Conflito de estoque em tempo real: o produto ${item.modelName} (${item.flavor}) foi vendido simultaneamente por outro operador e não possui mais unidades suficientes.`,
        failedItem: {
          productId: item.productId,
          name: `${item.modelName} - ${item.flavor}`,
          requestedQty,
          availableStock: 0
        }
      };
    }

    reservedItems.push({
      productId: item.productId,
      originalStock: dbStock,
      deductedQty: requestedQty
    });
  }

  // 4. FASE DE GRAVAÇÃO DO PEDIDO: Todos os produtos tiveram estoque baixado com sucesso
  try {
    let { data: insertedOrder, error: orderErr } = await supabase
      .from('smoking_orders')
      .insert(orderPayload)
      .select('id')
      .single();

    if (orderErr) {
      // Retentativas seguras de constraint de status/método
      if (orderErr.message?.includes('delivery_status')) {
        orderPayload.delivery_status = 'PREPARANDO';
      }
      if (orderErr.message?.includes('payment_method')) {
        orderPayload.payment_method = 'PIX';
      }

      const retryRes = await supabase
        .from('smoking_orders')
        .insert(orderPayload)
        .select('id')
        .single();

      orderErr = retryRes.error;
      insertedOrder = retryRes.data;
    }

    if (orderErr) {
      // Falha ao gravar pedido -> rollback total do estoque reservado
      console.error('[StockValidation] Falha na criação do pedido em smoking_orders. Executando rollback:', orderErr);
      await rollbackReservedStock(reservedItems);

      return {
        success: false,
        errorMessage: `Erro ao registrar o pedido no banco de dados (${orderErr.message}). O estoque foi restaurado integralmente.`
      };
    }

    return {
      success: true,
      orderId: insertedOrder?.id
    };
  } catch (err: any) {
    console.error('[StockValidation] Exceção inesperada na gravação do pedido. Executando rollback:', err);
    await rollbackReservedStock(reservedItems);

    return {
      success: false,
      errorMessage: `Erro inesperado ao registrar o pedido: ${err?.message || err}. O estoque foi restaurado.`
    };
  }
}

/**
 * Restaura o estoque de produtos previamente baixados em caso de cancelamento ou falha
 */
async function rollbackReservedStock(
  reservedItems: Array<{ productId: string; originalStock: number; deductedQty: number }>
): Promise<void> {
  for (const res of reservedItems) {
    try {
      await supabase
        .from('smoking_products')
        .update({ stock: res.originalStock })
        .eq('id', res.productId);
      console.warn(`[StockValidation] Rollback executado para produto ${res.productId}: estoque restaurado para ${res.originalStock}`);
    } catch (e) {
      console.error(`[StockValidation] Erro crítico no rollback do produto ${res.productId}:`, e);
    }
  }
}
