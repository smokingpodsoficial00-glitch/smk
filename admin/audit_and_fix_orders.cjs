const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function auditOrders(applyFix = false) {
  console.log("==========================================================================");
  console.log(`🔎 AUDITORIA DE PEDIDOS EM SMOKING_ORDERS (applyFix = ${applyFix})`);
  console.log("==========================================================================\n");

  // 1. Buscar todos os pedidos não cancelados
  const { data: orders, error } = await supabase
    .from('smoking_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("❌ Erro ao consultar smoking_orders:", error);
    return;
  }

  console.log(`📦 Total de pedidos na base: ${orders.length}`);

  let totalAnalyzed = 0;
  let totalNonCompleted = 0;
  let totalCompletedOrCancelled = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let fixedCount = 0;

  const incorrectOrdersReport = [];
  const auditLogs = [];

  for (const order of orders) {
    totalAnalyzed++;
    const isCompletedOrCancelled = order.delivery_status === 'CONCLUIDO' || order.delivery_status === 'CANCELADO';

    if (isCompletedOrCancelled) {
      totalCompletedOrCancelled++;
    } else {
      totalNonCompleted++;
    }

    // Calcular subtotal dos itens usando os preços históricos armazenados no próprio pedido
    const items = Array.isArray(order.items) ? order.items : [];
    let itemsSubtotal = 0;
    const itemBreakdown = [];

    for (const item of items) {
      const qty = Number(item.quantity) || 1;
      const unitPrice = item.price ? Number(item.price) : (item.unit_price ? Number(item.unit_price) : 0);
      const subtotalItem = qty * unitPrice;
      itemsSubtotal += subtotalItem;
      itemBreakdown.push({
        name: item.name || item.flavor || 'Pod',
        flavor: item.flavor || '',
        quantity: qty,
        unitPrice: unitPrice,
        subtotal: subtotalItem
      });
    }

    const shippingFee = parseFloat(order.shipping_fee || 0);
    const expectedTotal = parseFloat((itemsSubtotal + shippingFee).toFixed(2));
    const currentTotal = parseFloat(parseFloat(order.total_amount || 0).toFixed(2));
    const diff = parseFloat((currentTotal - expectedTotal).toFixed(2));

    const isCorrect = Math.abs(diff) < 0.01;

    if (isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;

      // Identificar o padrão do erro:
      let reason = 'Outro erro de cálculo';
      if (Math.abs(diff - shippingFee) < 0.01) {
        reason = `Frete duplicado (+R$ ${shippingFee.toFixed(2)})`;
      } else if (Math.abs(currentTotal - itemsSubtotal) < 0.01) {
        reason = `total_amount salvo como apenas Subtotal (faltou somar o Frete R$ ${shippingFee.toFixed(2)})`;
      } else if (Math.abs(diff + shippingFee) < 0.01) {
        reason = `Frete subtraído incorretamente (-R$ ${shippingFee.toFixed(2)})`;
      }

      const reportEntry = {
        id: order.id,
        shortId: order.id.substring(0, 8).toUpperCase(),
        clientName: order.client_name || 'Desconhecido',
        clientPhone: order.client_phone || '',
        status: order.delivery_status || 'DESCONHECIDO',
        isNonCompleted: !isCompletedOrCancelled,
        itemsSubtotal,
        shippingFee,
        currentTotal,
        expectedTotal,
        diff,
        reason,
        items: itemBreakdown
      };

      incorrectOrdersReport.push(reportEntry);

      if (applyFix) {
        // Atualizar SOMENTE o campo total_amount para o valor correto no Supabase
        const { error: updateErr } = await supabase
          .from('smoking_orders')
          .update({ total_amount: expectedTotal })
          .eq('id', order.id);

        if (updateErr) {
          console.error(`❌ Erro ao atualizar pedido #${reportEntry.shortId}:`, updateErr.message);
        } else {
          fixedCount++;
          auditLogs.push({
            id: order.id,
            shortId: reportEntry.shortId,
            oldTotal: currentTotal,
            newTotal: expectedTotal,
            reason
          });
        }
      }
    }
  }

  console.log("\n==========================================================================");
  console.log("📊 RELATÓRIO GERAL DA AUDITORIA DO BANCO DE DADOS");
  console.log("==========================================================================");
  console.log(`- Total de Pedidos Analisados: ${totalAnalyzed}`);
  console.log(`  - Pedidos Não Concluídos (Abertos/Ativos): ${totalNonCompleted}`);
  console.log(`  - Pedidos Concluídos/Cancelados: ${totalCompletedOrCancelled}`);
  console.log(`- Pedidos com total_amount CORRETO: ${correctCount}`);
  console.log(`- Pedidos com total_amount INCORRETO: ${incorrectCount}`);
  if (applyFix) {
    console.log(`- Pedidos CORRIGIDOS com sucesso no banco: ${fixedCount}`);
  }

  console.log("\n==========================================================================");
  console.log("🚨 DETALHAMENTO DOS PEDIDOS INCORRETOS ENCONTRADOS");
  console.log("==========================================================================\n");

  incorrectOrdersReport.forEach((r, idx) => {
    console.log(`--- [PEDIDO ${idx + 1}] ID: #${r.shortId} (${r.id}) ---`);
    console.log(`Cliente: ${r.clientName} (${r.clientPhone})`);
    console.log(`Status: ${r.status} ${r.isNonCompleted ? '[NÃO CONCLUÍDO]' : '[CONCLUÍDO/CANCELADO]'}`);
    console.log(`Itens:`, r.items.map(i => `${i.quantity}x ${i.name} (${i.flavor}) @ R$ ${i.unitPrice.toFixed(2)} = R$ ${i.subtotal.toFixed(2)}`).join(' | '));
    console.log(`Subtotal dos Itens: R$ ${r.itemsSubtotal.toFixed(2)}`);
    console.log(`Frete (shipping_fee): R$ ${r.shippingFee.toFixed(2)}`);
    console.log(`Total Atualmente Salvo: R$ ${r.currentTotal.toFixed(2)}`);
    console.log(`Total Correto Esperado: R$ ${r.expectedTotal.toFixed(2)}`);
    console.log(`Diferença: R$ ${r.diff.toFixed(2)}`);
    console.log(`Motivo: ${r.reason}`);
    console.log(`--------------------------------------------------------------------------\n`);
  });

  if (applyFix && auditLogs.length > 0) {
    console.log("==========================================================================");
    console.log("✅ REGISTRO DE ALTERAÇÕES EXECUTADAS NO BANCO DE DADOS");
    console.log("==========================================================================");
    auditLogs.forEach(l => {
      console.log(`Pedido #${l.shortId} | De R$ ${l.oldTotal.toFixed(2)} ---> Para R$ ${l.newTotal.toFixed(2)} | Motivo: ${l.reason}`);
    });
  }
}

// Primeiro rodar apenas a auditoria (sem aplicar alterações)
const mode = process.argv[2];
auditOrders(mode === '--apply');
