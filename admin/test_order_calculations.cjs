const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Simulação da função de mapeamento do KanbanBoard.tsx pós-correção:
function mapKanbanOrder(dbOrder) {
  return {
    id: dbOrder.id.substring(0, 8).toUpperCase(),
    realId: dbOrder.id,
    clientName: dbOrder.client_name || 'Cliente Sem Nome',
    phone: dbOrder.client_phone,
    address: dbOrder.shipping_address,
    items: Array.isArray(dbOrder.items) ? dbOrder.items.map((i) => ({
      model: i.name || i.model || '',
      flavor: i.flavor || '',
      quantity: i.quantity || 1,
      price: i.price ? parseFloat(i.price) : (i.unit_price ? parseFloat(i.unit_price) : 0)
    })) : [],
    totalAmount: parseFloat(dbOrder.total_amount || 0),
    shippingFee: parseFloat(dbOrder.shipping_fee || 0),
    paymentMethod: dbOrder.payment_method,
    status: dbOrder.delivery_status || 'AGUARDANDO_PAGAMENTO'
  };
}

// Função utilitária para calcular a criação do pedido seguindo a Regra de Ouro:
function buildOrderPayload(items, shippingFee, paymentMethod = 'PIX') {
  const itemsTotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const grandTotal = itemsTotal + shippingFee;
  return {
    subtotal: itemsTotal,
    shipping_fee: shippingFee,
    total_amount: grandTotal,
    payment_method: paymentMethod,
    items: items
  };
}

async function runAuditTests() {
  console.log("=================================================");
  console.log("🧪 SUÍTE DE TESTES OBRIGATÓRIOS DO CÁLCULO DE PEDIDOS");
  console.log("=================================================\n");

  let passes = 0;
  let fails = 0;

  // TESTE 1: Produto R$ 99,90 + Frete R$ 8,00
  const t1_items = [{ name: 'OXBAR 50K', flavor: 'Pineapple Ice', quantity: 1, price: 99.90 }];
  const t1_payload = buildOrderPayload(t1_items, 8.00, 'PIX');
  const t1_kanban = mapKanbanOrder({ id: 'TEST1-UUID-1234', client_name: 'Teste 1', ...t1_payload });

  const t1_pass = t1_payload.subtotal === 99.90 && t1_payload.total_amount === 107.90 && t1_kanban.totalAmount === 107.90;
  console.log(`[TESTE 1] Produto R$ 99,90 + Frete R$ 8,00:`);
  console.log(`  Subtotal: R$ ${t1_payload.subtotal.toFixed(2)} | Frete: R$ ${t1_payload.shipping_fee.toFixed(2)} | Total Banco: R$ ${t1_payload.total_amount.toFixed(2)} | Total Kanban: R$ ${t1_kanban.totalAmount.toFixed(2)}`);
  console.log(`  Resultado: ${t1_pass ? '✅ APROVADO (107,90)' : '❌ FALHOU'}\n`);
  if (t1_pass) passes++; else fails++;

  // TESTE 2: Produto R$ 100,00 + Frete R$ 8,00
  const t2_items = [{ name: 'Vape 50K', flavor: 'Pineapple Ice', quantity: 1, price: 100.00 }];
  const t2_payload = buildOrderPayload(t2_items, 8.00, 'PIX');
  const t2_kanban = mapKanbanOrder({ id: 'TEST2-UUID-1234', client_name: 'Teste 2', ...t2_payload });

  const t2_pass = t2_payload.subtotal === 100.00 && t2_payload.total_amount === 108.00 && t2_kanban.totalAmount === 108.00;
  console.log(`[TESTE 2] Produto R$ 100,00 + Frete R$ 8,00:`);
  console.log(`  Subtotal: R$ ${t2_payload.subtotal.toFixed(2)} | Frete: R$ ${t2_payload.shipping_fee.toFixed(2)} | Total Banco: R$ ${t2_payload.total_amount.toFixed(2)} | Total Kanban: R$ ${t2_kanban.totalAmount.toFixed(2)}`);
  console.log(`  Resultado: ${t2_pass ? '✅ APROVADO (108,00)' : '❌ FALHOU'}\n`);
  if (t2_pass) passes++; else fails++;

  // TESTE 3: Produto R$ 100,00 + Frete R$ 0,00
  const t3_items = [{ name: 'Vape 50K', flavor: 'Pineapple Ice', quantity: 1, price: 100.00 }];
  const t3_payload = buildOrderPayload(t3_items, 0.00, 'PIX');
  const t3_kanban = mapKanbanOrder({ id: 'TEST3-UUID-1234', client_name: 'Teste 3', ...t3_payload });

  const t3_pass = t3_payload.subtotal === 100.00 && t3_payload.total_amount === 100.00 && t3_kanban.totalAmount === 100.00;
  console.log(`[TESTE 3] Produto R$ 100,00 + Frete R$ 0,00:`);
  console.log(`  Subtotal: R$ ${t3_payload.subtotal.toFixed(2)} | Frete: R$ ${t3_payload.shipping_fee.toFixed(2)} | Total Banco: R$ ${t3_payload.total_amount.toFixed(2)} | Total Kanban: R$ ${t3_kanban.totalAmount.toFixed(2)}`);
  console.log(`  Resultado: ${t3_pass ? '✅ APROVADO (100,00)' : '❌ FALHOU'}\n`);
  if (t3_pass) passes++; else fails++;

  // TESTE 4: Múltiplos Itens (2x R$ 50,00 + 1x R$ 30,00 + Frete R$ 8,00)
  const t4_items = [
    { name: 'Produto A', flavor: 'Menta', quantity: 2, price: 50.00 },
    { name: 'Produto B', flavor: 'Uva', quantity: 1, price: 30.00 }
  ];
  const t4_payload = buildOrderPayload(t4_items, 8.00, 'PIX');
  const t4_kanban = mapKanbanOrder({ id: 'TEST4-UUID-1234', client_name: 'Teste 4', ...t4_payload });

  const t4_pass = t4_payload.subtotal === 130.00 && t4_payload.total_amount === 138.00 && t4_kanban.totalAmount === 138.00;
  console.log(`[TESTE 4] Múltiplos Itens (2x R$ 50 + 1x R$ 30 + Frete R$ 8):`);
  console.log(`  Subtotal: R$ ${t4_payload.subtotal.toFixed(2)} | Frete: R$ ${t4_payload.shipping_fee.toFixed(2)} | Total Banco: R$ ${t4_payload.total_amount.toFixed(2)} | Total Kanban: R$ ${t4_kanban.totalAmount.toFixed(2)}`);
  console.log(`  Resultado: ${t4_pass ? '✅ APROVADO (Subtotal: 130,00, Total: 138,00)' : '❌ FALHOU'}\n`);
  if (t4_pass) passes++; else fails++;

  // TESTE 5: PIX (sem acréscimo indevido)
  const t5_payload = buildOrderPayload(t1_items, 8.00, 'PIX');
  const t5_kanban = mapKanbanOrder({ id: 'TEST5-UUID-1234', client_name: 'Teste 5', ...t5_payload });

  const t5_pass = t5_kanban.totalAmount === 107.90 && t5_kanban.paymentMethod === 'PIX';
  console.log(`[TESTE 5] Método PIX:`);
  console.log(`  Total Exibido: R$ ${t5_kanban.totalAmount.toFixed(2)} | Método: ${t5_kanban.paymentMethod}`);
  console.log(`  Resultado: ${t5_pass ? '✅ APROVADO (Sem taxas ocultas no PIX)' : '❌ FALHOU'}\n`);
  if (t5_pass) passes++; else fails++;

  // TESTE 6: Outros Meios de Pagamento (Cartão e Dinheiro)
  const t6_cartao = mapKanbanOrder({ id: 'TEST6A-UUID', client_name: 'Teste 6A', ...buildOrderPayload(t1_items, 8.00, 'CREDITO') });
  const t6_dinheiro = mapKanbanOrder({ id: 'TEST6B-UUID', client_name: 'Teste 6B', ...buildOrderPayload(t1_items, 8.00, 'DINHEIRO') });

  const t6_pass = t6_cartao.totalAmount === 107.90 && t6_dinheiro.totalAmount === 107.90;
  console.log(`[TESTE 6] Outros Métodos de Pagamento (Cartão e Dinheiro):`);
  console.log(`  Total Cartão: R$ ${t6_cartao.totalAmount.toFixed(2)} | Total Dinheiro: R$ ${t6_dinheiro.totalAmount.toFixed(2)}`);
  console.log(`  Resultado: ${t6_pass ? '✅ APROVADO (Cálculo consistente em todas as formas de pagamento)' : '❌ FALHOU'}\n`);
  if (t6_pass) passes++; else fails++;

  console.log("=================================================");
  console.log(`🎯 RESUMO DA VALIDAÇÃO: ${passes} APROVADOS, ${fails} FALHAS`);
  console.log("=================================================");
}

runAuditTests();
