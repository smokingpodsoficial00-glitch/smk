const supabaseUrl = "https://ocbgqflkhevrbvyjxzes.supabase.co/rest/v1/smoking_orders";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmdxZmxraGV2cmJ2eWp4emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTA0NjAsImV4cCI6MjA5Nzk4NjQ2MH0.IhoGg_aJgg98owxUFKGui51xmY4iG3cCq8M35K33O7M";

const names = [
  "Carlos Eduardo", "Fernanda Lima", "Gabriel Souza", "Lucas Oliveira", 
  "Mariana Costa", "Rodrigo Alves", "Beatriz Santos", "Thiago Martins", 
  "Camila Ribeiro", "Rafael Mendes"
];

const flavors = [
  { name: "Ignite V50", flavor: "Watermelon Ice", price: 90.00 },
  { name: "Ignite V50", flavor: "Blueberry Ice", price: 90.00 },
  { name: "Elf Bar BC5000", flavor: "Blue Razz Ice", price: 85.00 },
  { name: "Elf Bar BC5000", flavor: "Strawberry Kiwi", price: 85.00 },
  { name: "Lost Mary OS5000", flavor: "Grape Ice", price: 95.00 }
];

const addresses = [
  "Av. Paulista, 1000 - Bela Vista, SP",
  "Rua Augusta, 450 - Consolação, SP",
  "Rua Oscar Freire, 1200 - Pinheiros, SP",
  "Av. Brigadeiro Faria Lima, 2200 - Itaim Bibi, SP",
  "Rua Haddock Lobo, 800 - Jardins, SP",
  "Av. Rebouças, 1500 - Pinheiros, SP",
  "Rua Vergueiro, 3000 - Vila Mariana, SP",
  "Av. Santo Amaro, 900 - Vila Nova Conceição, SP",
  "Rua Pamplona, 500 - Jardim Paulista, SP",
  "Av. das Nações Unidas, 14000 - Chácara Santo Antônio, SP"
];

async function seedOrders() {
  console.log("🚀 Inserindo 10 pedidos de teste em 'PREPARANDO' via REST API...");
  
  const newOrders = [];

  for (let i = 0; i < 10; i++) {
    const name = names[i];
    const phone = `55119${Math.floor(10000000 + Math.random() * 90000000)}`;
    const address = addresses[i];

    const numItems = Math.floor(Math.random() * 3) + 1;
    const items = [];
    let total = 0;

    for (let j = 0; j < numItems; j++) {
      const item = flavors[Math.floor(Math.random() * flavors.length)];
      const qty = Math.floor(Math.random() * 2) + 1;
      items.push({
        name: item.name,
        flavor: item.flavor,
        quantity: qty,
        price: item.price
      });
      total += item.price * qty;
    }

    newOrders.push({
      client_phone: phone,
      client_name: name,
      items: items,
      total_amount: total + 15.00,
      shipping_fee: 15.00,
      shipping_address: address,
      payment_status: 'PAGO',
      delivery_status: 'PREPARANDO',
      payment_method: Math.random() > 0.3 ? 'PIX' : 'CREDITO_LINK',
      created_at: new Date(Date.now() - Math.floor(Math.random() * 3600000 * 3)).toISOString()
    });
  }

  try {
    const res = await fetch(supabaseUrl, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(newOrders)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("❌ Erro ao inserir:", errText);
    } else {
      const inserted = await res.json();
      console.log(`✅ Sucesso! Inseridos ${inserted.length} pedidos em 'PREPARANDO'.`);
    }
  } catch (err) {
    console.error("❌ Erro na requisição:", err);
  }
}

seedOrders();
