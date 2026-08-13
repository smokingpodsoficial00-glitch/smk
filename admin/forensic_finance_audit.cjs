const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://ocbgqflkhevrbvyjxzes.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEFAULT_MODEL_COSTS = {
  "elfbar__ice king": 70,
  "lost mary__dura 35k": 65,
  "elfbar__bc15k": 48,
  "oxbar__50k": 65,
  "oxbar__g30k pro": 58,
  "ignite__v50": 65,
  "ignite__v80 ultra slim": 55,
  "ignite__frozen 20k": 65,
  "ignite__v250": 68,
  "elfbar__duke": 70,
  "elfbar__te30k": 65,
};

async function runForensicAudit() {
  console.log("==========================================================================");
  console.log("🕵️ AUDITORIA FORENSE COMPLETA DO MÓDULO FINANCEIRO");
  console.log("==========================================================================\n");

  const targetCompanyId = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

  // 1. Fetch persisted costs map
  let persistedCosts = {};
  const { data: configData } = await supabase
    .from("store_config")
    .select("product_costs")
    .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
    .limit(1);

  if (configData && configData.length > 0 && configData[0].product_costs) {
    persistedCosts = configData[0].product_costs;
  }

  console.log("📌 1. Mapa de Custos Persistidos (`store_config`):", JSON.stringify(persistedCosts, null, 2));

  // 2. Fetch all orders from `smoking_orders`
  const { data: rawOrders, error: ordersErr } = await supabase
    .from("smoking_orders")
    .select("*")
    .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
    .neq("delivery_status", "CANCELADO");

  if (ordersErr) {
    console.error("Erro pedidos:", ordersErr);
    return;
  }

  console.log(`\n📌 2. Total de Pedidos Retornados da Query (não cancelados): ${rawOrders.length}`);

  // Filter valid customer orders (same filter as FinanceDashboard.tsx lines 122-127)
  const validOrders = (rawOrders || []).filter(
    (o) =>
      o.client_phone !== "__SYSTEM_SMK_BEST_SELLERS__" &&
      (!o.client_phone || !o.client_phone.startsWith("__SYSTEM_")) &&
      (!o.client_name || !o.client_name.toLowerCase().includes("system config"))
  );

  console.log(`📌 3. Total de Pedidos VÁLIDOS Considerados no Financeiro: ${validOrders.length}\n`);

  console.log("--------------------------------------------------------------------------");
  console.log("📋 RECONCILIAÇÃO INDIVIDUAL DE CADA PEDIDO VÁLIDO");
  console.log("--------------------------------------------------------------------------");

  let totalRevenueCalculated = 0;
  let totalShippingCalculated = 0;
  let totalCmvCalculated = 0;
  let totalPodsSoldCalculated = 0;
  const brandSalesMap = {};
  const modelProfitsMap = {};

  validOrders.forEach((o, index) => {
    const orderTotal = parseFloat(o.total_amount || 0);
    const shippingFee = parseFloat(o.shipping_fee || 0);
    totalRevenueCalculated += orderTotal;
    totalShippingCalculated += shippingFee;

    const items = Array.isArray(o.items) ? o.items : [];
    let orderCmv = 0;
    let orderPodsCount = 0;
    const itemDetails = [];

    items.forEach((item) => {
      const qty = Number(item.quantity) || 1;
      const brand = (item.brand || "OUTROS").toUpperCase();
      const modelName = (item.name || "POD").toUpperCase();
      const itemPrice = Number(item.price || item.unit_price) || 0;
      const modelKey = (item.modelKey || `${brand}__${modelName}`).toLowerCase();

      let itemCost = Number(item.cost_price || item.costPrice) || 0;
      let costSource = "item.cost_price";

      if (!itemCost && item.product_id && persistedCosts[item.product_id]) {
        itemCost = persistedCosts[item.product_id];
        costSource = "store_config[product_id]";
      }
      if (!itemCost && modelKey && DEFAULT_MODEL_COSTS[modelKey]) {
        itemCost = DEFAULT_MODEL_COSTS[modelKey];
        costSource = "DEFAULT_MODEL_COSTS[modelKey]";
      }
      if (!itemCost) {
        itemCost = 65;
        costSource = "Fallback R$ 65.00";
      }

      const itemTotalRevenue = qty * itemPrice;
      const itemTotalCost = qty * itemCost;

      orderCmv += itemTotalCost;
      orderPodsCount += qty;

      itemDetails.push({
        name: modelName,
        flavor: item.flavor || '',
        qty,
        unitPrice: itemPrice,
        totalPrice: itemTotalRevenue,
        unitCost: itemCost,
        costSource,
        totalCost: itemTotalCost
      });

      // Brand Map
      if (!brandSalesMap[brand]) brandSalesMap[brand] = { count: 0, revenue: 0 };
      brandSalesMap[brand].count += qty;
      brandSalesMap[brand].revenue += itemTotalRevenue;

      // Model Map
      if (!modelProfitsMap[modelKey]) {
        modelProfitsMap[modelKey] = { brand, name: modelName, unitsSold: 0, revenue: 0, totalCost: 0 };
      }
      modelProfitsMap[modelKey].unitsSold += qty;
      modelProfitsMap[modelKey].revenue += itemTotalRevenue;
      modelProfitsMap[modelKey].totalCost += itemTotalCost;
    });

    totalCmvCalculated += orderCmv;
    totalPodsSoldCalculated += orderPodsCount;

    console.log(`\n📦 [PEDIDO #${index + 1}] ID: #${o.id.substring(0,8).toUpperCase()} (${o.id})`);
    console.log(`   Cliente: ${o.client_name} (${o.client_phone})`);
    console.log(`   Status Entrega: ${o.delivery_status} | Status Pagamento: ${o.payment_status} | Método: ${o.payment_method}`);
    console.log(`   Data Criação: ${o.created_at}`);
    console.log(`   total_amount no Banco: R$ ${orderTotal.toFixed(2)}`);
    console.log(`   shipping_fee no Banco: R$ ${shippingFee.toFixed(2)}`);
    console.log(`   Itens do Pedido:`);
    itemDetails.forEach(it => {
      console.log(`     • ${it.qty}x ${it.name} (${it.flavor}) | Preço: R$ ${it.unitPrice.toFixed(2)} | Custo Unitário CMV: R$ ${it.unitCost.toFixed(2)} (Origem: ${it.costSource}) | Custo Total: R$ ${it.totalCost.toFixed(2)}`);
    });
    console.log(`   CMV Deste Pedido: R$ ${orderCmv.toFixed(2)}`);
  });

  const netProfitCalculated = totalRevenueCalculated - totalCmvCalculated - totalShippingCalculated;
  const profitMarginCalculated = totalRevenueCalculated > 0 ? (netProfitCalculated / totalRevenueCalculated) * 100 : 0;

  console.log("\n==========================================================================");
  console.log("📊 RESULTADO CONSOLIDADOS DA AUDITORIA MATEMÁTICA");
  console.log("==========================================================================");
  console.log(`🟢 FATURAMENTO BRUTO REAL : R$ ${totalRevenueCalculated.toFixed(2)} (Exibido na Tela: R$ 388,69)`);
  console.log(`🔴 CUSTO DE REPOSIÇÃO (CMV): R$ ${totalCmvCalculated.toFixed(2)} (Exibido na Tela: R$ 263,00)`);
  console.log(`🟧 FRETE TOTAL (LOGÍSTICA)  : R$ ${totalShippingCalculated.toFixed(2)} (Exibido na Tela: R$ 54,00)`);
  console.log(`💎 LUCRO LÍQUIDO REAL     : R$ ${netProfitCalculated.toFixed(2)} (Exibido na Tela: R$ 71,69)`);
  console.log(`📈 MARGEM LÍQUIDA REAL     : ${profitMarginCalculated.toFixed(1)}% (Exibida na Tela: 18,4%)`);
  console.log(`📦 TOTAL DE PEDIDOS        : ${validOrders.length} pedidos`);
  console.log(`📦 TOTAL DE PODS VENDIDOS  : ${totalPodsSoldCalculated} pods`);
  console.log(`🏷️ VENDAS POR MARCA        :`, JSON.stringify(brandSalesMap, null, 2));
  console.log("==========================================================================\n");
}

runForensicAudit();
