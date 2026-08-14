import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  ShoppingCart,
  User,
  Package,
  CheckCircle2,
  X,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

interface ManualSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleSuccess: () => void;
  companyId?: string;
  preSelectedFlavorId?: string | null;
  preSelectedGroup?: any;
}

export function ManualSaleModal({
  isOpen,
  onClose,
  onSaleSuccess,
  companyId = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5",
  preSelectedFlavorId,
  preSelectedGroup,
}: ManualSaleModalProps) {
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);

  // Dados do Cliente
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [shippingFee, setShippingFee] = useState<string>("0"); // Cobrado do cliente
  const [shippingCost, setShippingCost] = useState<string>("0"); // Custo real pago ao motoboy/Uber

  // Lista de Itens no Pedido
  const [items, setItems] = useState<
    Array<{
      productId: string;
      brand: string;
      modelName: string;
      flavor: string;
      quantity: number;
      price: number;
      costPrice: number;
      maxStock: number;
      image_url?: string;
    }>
  >([]);

  // Seletores do formulário de adição de item (Modelo -> Sabor)
  const [selectedModelKey, setSelectedModelKey] = useState("");
  const [selectedFlavorId, setSelectedFlavorId] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Carregar produtos e clientes limpos do Supabase
  useEffect(() => {
    if (!isOpen) return;

    const loadInitialData = async () => {
      setLoadingProducts(true);
      setErrorMessage("");
      setSuccessMessage("");
      try {
        // 1. Buscar Produtos Ativos
        const { data: prods, error: pErr } = await supabase
          .from("smoking_products")
          .select("*")
          .eq("is_active", true)
          .or(`company_id.eq.${companyId},company_id.is.null`)
          .order("brand", { ascending: true });

        if (!pErr && prods) {
          setProductsList(prods);
        }

        // 2. Buscar Clientes Reais (Filtrando qualquer configuracao de sistema)
        const { data: orders } = await supabase
          .from("smoking_orders")
          .select("client_name, client_phone, shipping_address")
          .order("created_at", { ascending: false })
          .limit(100);

        if (orders) {
          const uniqueClients = new Map<string, any>();
          orders.forEach((o) => {
            const phone = (o.client_phone || "").trim();
            const name = (o.client_name || "").trim();

            if (
              phone &&
              !phone.startsWith("__SYSTEM_") &&
              !name.toLowerCase().includes("system") &&
              !name.toLowerCase().includes("config")
            ) {
              if (!uniqueClients.has(phone)) {
                uniqueClients.set(phone, {
                  client_name: name,
                  client_phone: phone,
                  shipping_address: o.shipping_address || "",
                });
              }
            }
          });
          setClientsList(Array.from(uniqueClients.values()));
        }
      } catch (err) {
        console.error("Erro ao carregar catálogo para venda manual:", err);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadInitialData();
  }, [isOpen, companyId]);

  // Lista Simplificada de Todos os Modelos (ex: "ELFBAR ICE KING")
  const availableModels = useMemo(() => {
    const map = new Map<string, { label: string; key: string }>();
    productsList.forEach((p) => {
      const key = `${p.brand}__${p.name}`.toLowerCase();
      const label = `${p.brand} ${p.name}`.trim();
      if (!map.has(key)) {
        map.set(key, { label, key });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [productsList]);

  // Sabores filtrados por Modelo selecionado
  const availableFlavors = useMemo(() => {
    if (!selectedModelKey) return [];
    return productsList.filter((p) => {
      const key = `${p.brand}__${p.name}`.toLowerCase();
      return key === selectedModelKey;
    });
  }, [productsList, selectedModelKey]);

  // Preencher valor do produto ao selecionar o sabor
  useEffect(() => {
    if (selectedFlavorId) {
      const prod = productsList.find((p) => p.id === selectedFlavorId);
      if (prod) {
        setCustomPrice(prod.price ? String(prod.price) : "");
      }
    }
  }, [selectedFlavorId, productsList]);

  // Item ativo no formulário (caso o usuário tenha selecionado nos dropdowns mas não tenha clicado no botão adicional)
  const activeFormItem = useMemo(() => {
    if (!selectedFlavorId) return null;
    const prod = productsList.find((p) => p.id === selectedFlavorId);
    if (!prod) return null;

    const unitPrice = parseFloat(customPrice.replace(",", ".")) || Number(prod.price) || 0;
    return {
      productId: prod.id,
      brand: prod.brand,
      modelName: prod.name,
      flavor: prod.flavor || "Padrão",
      quantity: itemQuantity,
      price: unitPrice,
      costPrice: Number(prod.cost_price) || 0,
      maxStock: Number(prod.stock) || 0,
      image_url: prod.image_url,
    };
  }, [selectedFlavorId, itemQuantity, customPrice, productsList]);

  // Lista Efetiva de Itens no Pedido (se a lista de itens estiver vazia mas houver um pod selecionado no formulário, inclui automaticamente)
  const effectiveItems = useMemo(() => {
    if (items.length > 0) return items;
    return activeFormItem ? [activeFormItem] : [];
  }, [items, activeFormItem]);

  // Adicionar Pod Adicional (para pedidos com múltiplos pods)
  const handleAddAnotherItem = () => {
    if (!activeFormItem) {
      setErrorMessage("Por favor, selecione um sabor disponível antes de adicionar outro.");
      return;
    }

    const existingIdx = items.findIndex((i) => i.productId === activeFormItem.productId);
    if (existingIdx >= 0) {
      const updated = [...items];
      updated[existingIdx].quantity += activeFormItem.quantity;
      updated[existingIdx].price = activeFormItem.price;
      setItems(updated);
    } else {
      setItems([...items, activeFormItem]);
    }

    setSelectedFlavorId("");
    setItemQuantity(1);
    setCustomPrice("");
    setErrorMessage("");
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculos do Pedido
  const subtotal = useMemo(() => {
    return effectiveItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [effectiveItems]);

  const totalCost = useMemo(() => {
    return effectiveItems.reduce((acc, item) => acc + item.costPrice * item.quantity, 0);
  }, [effectiveItems]);

  const numericShippingFee = parseFloat(shippingFee.replace(",", ".")) || 0;
  const numericShippingCost = parseFloat(shippingCost.replace(",", ".")) || 0;
  const grandTotal = subtotal + numericShippingFee;
  
  // Lucro nos Produtos (Preço de Venda - Custo do Pod)
  const productProfit = subtotal - totalCost;
  // Lucro no Frete (Taxa cobrada do cliente - Custo real pago ao motoboy)
  const shippingProfit = numericShippingFee - numericShippingCost;
  // Lucro Total Líquido
  const estimatedProfit = productProfit + shippingProfit;

  // Preencher dados ao selecionar cliente recente
  const handleSelectExistingClient = (phone: string) => {
    const found = clientsList.find((c) => c.client_phone === phone);
    if (found) {
      setClientName(found.client_name || "");
      setClientPhone(found.client_phone || "");
      setShippingAddress(found.shipping_address || "");
    }
  };

  // Finalizar e Registrar Venda
  const handleSubmitSale = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (effectiveItems.length === 0) {
      setErrorMessage("Por favor, selecione um modelo e sabor de pod para a venda.");
      return;
    }

    if (!clientName.trim()) {
      setErrorMessage("Por favor, preencha o nome do cliente.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Inserir/Atualizar Cliente no CRM (smoking_customers)
      const rawPhone = clientPhone.trim();
      const cleanPhone = rawPhone.replace(/\D/g, "");
      const formattedPhone = cleanPhone ? (cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`) : "5511999999999";

      try {
        await supabase.from("smoking_customers").upsert(
          {
            phone: formattedPhone,
            name: clientName.trim(),
            address: shippingAddress.trim() || "Atendimento Balcão / WhatsApp",
            company_id: companyId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "phone" }
        );
      } catch (custErr) {
        // Ignora caso tabela nao tenha constraint de conflito
      }

      // 2. Formatar Itens do Pedido no padrão smoking_orders
      const orderItems = effectiveItems.map((item) => {
        const modelKey = `${item.brand}__${item.modelName}`.toLowerCase();
        return {
          id: item.productId,
          product_id: item.productId,
          name: item.modelName,
          brand: item.brand,
          flavor: item.flavor,
          quantity: item.quantity,
          price: item.price,
          unit_price: item.price,
          modelKey: modelKey,
        };
      });

      // 3. Inserir Pedido PAGO e CONCLUIDO em smoking_orders (order_source = MANUAL)
      let insertedOrderId: string | null = null;
      
      const payload: any = {
        client_name: clientName.trim(),
        client_phone: formattedPhone,
        shipping_address: shippingAddress.trim() || "Atendimento Balcão / WhatsApp",
        items: orderItems,
        total_amount: grandTotal,
        shipping_fee: numericShippingFee,
        payment_status: "PAGO",
        delivery_status: "CONCLUIDO",
        order_source: "MANUAL",
        payment_method: paymentMethod,
        company_id: companyId,
      };

      let { data: insertedData, error: orderErr } = await supabase
        .from("smoking_orders")
        .insert(payload)
        .select("id")
        .single();

      if (orderErr && orderErr.message?.includes("smoking_orders_delivery_status_check")) {
        // Fallback para constraint legada do Supabase
        payload.delivery_status = "ENTREGUE";
        delete payload.order_source;
        const fallbackRes = await supabase
          .from("smoking_orders")
          .insert(payload)
          .select("id")
          .single();
        orderErr = fallbackRes.error;
        insertedData = fallbackRes.data;
      }

      if (orderErr) {
        throw new Error(`Erro ao salvar pedido: ${orderErr.message}`);
      }

      if (insertedData?.id) {
        insertedOrderId = insertedData.id;
        try {
          const completedIds = JSON.parse(localStorage.getItem('smoking_completed_order_ids') || '[]');
          if (!completedIds.includes(insertedOrderId)) {
            completedIds.push(insertedOrderId);
            localStorage.setItem('smoking_completed_order_ids', JSON.stringify(completedIds));
          }
        } catch {}
      }

      // 4. A baixa de estoque em smoking_products é realizada automaticamente
      // pela Trigger SQL no Supabase (decrement_stock_on_payment) ao inserir o pedido com payment_status = 'PAGO'.
      // Não fazemos segundo update em JS para evitar baixa duplicada!

      setSuccessMessage("✅ Venda registrada com sucesso! Estoque abatido, ranking e CRM atualizados.");

      setTimeout(() => {
        onSaleSuccess();
        onClose();
        // Limpar formulário
        setItems([]);
        setClientName("");
        setClientPhone("");
        setShippingAddress("");
        setSelectedModelKey("");
        setSelectedFlavorId("");
        setSuccessMessage("");
      }, 1000);
    } catch (err: any) {
      console.error("Erro ao registrar venda manual:", err);
      setErrorMessage(err.message || "Ocorreu um erro ao registrar a venda.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#111113] border border-white/15 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-auto text-white">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShoppingCart className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>⚡ Registrar Venda Manual</span>
                <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Atendimento
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Atualiza estoque, ranking de vendas, financeiro e CRM automaticamente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {loadingProducts ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="size-8 animate-spin text-amber-400 mx-auto" />
            <p className="text-xs text-muted-foreground">Carregando catálogo de produtos...</p>
          </div>
        ) : (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
            {/* Feedback Messages */}
            {errorMessage && (
              <div className="bg-red-500/15 border border-red-500/30 text-red-400 p-3.5 rounded-2xl text-xs font-semibold">
                ⚠️ {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* 1. DADOS DO CLIENTE */}
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                  <User className="size-3.5" /> 1. Dados do Cliente
                </span>
                {clientsList.length > 0 && (
                  <select
                    onChange={(e) => handleSelectExistingClient(e.target.value)}
                    className="bg-black/60 border border-white/10 rounded-lg text-xs text-muted-foreground px-2.5 py-1 focus:outline-none focus:border-amber-400/50 cursor-pointer"
                  >
                    <option value="">-- Selecionar Cliente Existente --</option>
                    {clientsList.map((c) => (
                      <option key={c.client_phone} value={c.client_phone}>
                        {c.client_name} ({c.client_phone})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-silver font-medium block mb-1">Nome do Cliente *</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Samuel"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-400/50 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-silver font-medium block mb-1">WhatsApp (DDD + Número)</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ex: 11943856234"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-400/50 font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 2. SELEÇÃO DE PODS (MODELO -> SABOR SIMPLIFICADO) */}
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-xs uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                <Package className="size-3.5" /> 2. Selecionar Modelo & Sabor
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Dropdown 1: Modelo */}
                <div>
                  <label className="text-[11px] text-silver font-medium block mb-1">Modelo do Pod</label>
                  <select
                    value={selectedModelKey}
                    onChange={(e) => {
                      setSelectedModelKey(e.target.value);
                      setSelectedFlavorId("");
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400/50 font-semibold cursor-pointer"
                  >
                    <option value="">-- Selecione o Modelo --</option>
                    {availableModels.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dropdown 2: Sabor Disponível */}
                <div>
                  <label className="text-[11px] text-silver font-medium block mb-1">Sabor Disponível</label>
                  <select
                    disabled={!selectedModelKey}
                    value={selectedFlavorId}
                    onChange={(e) => setSelectedFlavorId(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400/50 disabled:opacity-40 font-semibold cursor-pointer"
                  >
                    <option value="">-- Selecione o Sabor --</option>
                    {availableFlavors.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.flavor || "Padrão"} ({p.stock} un em estoque)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantidade e Preço Unitário */}
              {selectedFlavorId && (
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 animate-in fade-in duration-150">
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-[10px] text-silver font-medium block mb-1">Qtd Vendida</label>
                      <input
                        type="number"
                        min="1"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-center text-white focus:outline-none focus:border-amber-400/50 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-silver font-medium block mb-1">Preço Unit. (R$)</label>
                      <input
                        type="text"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        placeholder="89,90"
                        className="w-28 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-400/50"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddAnotherItem}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/10 cursor-pointer"
                  >
                    <Plus className="size-3.5 text-amber-400" />
                    <span>+ Outro Pod neste Pedido</span>
                  </button>
                </div>
              )}

              {/* Lista de Itens no Pedido (para pedidos com múltiplos pods) */}
              {items.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                    Pods Adicionados no Pedido ({items.length}):
                  </span>
                  <div className="space-y-1.5">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs"
                      >
                        <div>
                          <p className="font-bold text-white">
                            {item.brand} {item.modelName}
                          </p>
                          <p className="text-[10px] text-emerald-400 font-medium">
                            Sabor: {item.flavor}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <span className="font-bold text-white">
                            {item.quantity}x R$ {item.price.toFixed(2).replace(".", ",")}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. PAGAMENTO, FRETE E MARGEM */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3.5">
              {/* Seletor de Forma de Pagamento */}
              <div>
                <label className="text-[11px] text-silver font-semibold block mb-1.5">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "PIX", label: "Pix" },
                    { id: "DINHEIRO", label: "Dinheiro" },
                    { id: "CARTAO", label: "Cartão" },
                  ].map((method) => {
                    const isSelected = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center flex items-center justify-center ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                            : "bg-black/40 border-white/10 text-white/60 hover:text-white hover:border-white/20"
                        }`}
                      >
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inputs de Frete Cobrado vs Custo Real do Motoboy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/5">
                <div>
                  <label className="text-[11px] text-silver font-medium block mb-1">
                    Frete Cobrado do Cliente (R$)
                  </label>
                  <input
                    type="text"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-emerald-400 focus:outline-none focus:border-emerald-400/50 font-bold"
                  />
                  <span className="text-[9px] text-white/40 block mt-1">
                    Taxa paga pelo comprador
                  </span>
                </div>

                <div>
                  <label className="text-[11px] text-silver font-medium block mb-1">
                    Custo Real do Motoboy/Uber (R$)
                  </label>
                  <input
                    type="text"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-amber-300 focus:outline-none focus:border-amber-400/50 font-bold"
                  />
                  <span className="text-[9px] text-white/40 block mt-1">
                    Gasto que você terá na entrega
                  </span>
                </div>
              </div>
            </div>

            {/* RESUMO DO PEDIDO E MARGEM DE LUCRO */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-silver">Subtotal dos Pods:</span>
                <span className="font-bold text-white">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              {numericShippingFee > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-silver">Taxa de Frete (Cliente):</span>
                  <span className="font-bold text-white">R$ {numericShippingFee.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm pt-2 border-t border-amber-500/20">
                <span className="font-bold text-white uppercase tracking-wider">TOTAL DO PEDIDO:</span>
                <span className="font-extrabold text-lg text-emerald-400">
                  R$ {grandTotal.toFixed(2).replace(".", ",")}
                </span>
              </div>

              {/* Detalhamento de Lucro Real */}
              <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[11px]">
                <div className="flex items-center gap-2 text-white/60">
                  {numericShippingCost > 0 && (
                    <span>
                      Margem no Frete:{" "}
                      <strong className={shippingProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {shippingProfit >= 0 ? "+" : ""}R$ {shippingProfit.toFixed(2).replace(".", ",")}
                      </strong>
                    </span>
                  )}
                </div>
                <div className="text-right w-full sm:w-auto font-medium">
                  Lucro Líquido Estimado:{" "}
                  <span className={`font-extrabold text-xs ${estimatedProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    R$ {estimatedProfit.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé do Modal */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting || effectiveItems.length === 0}
            onClick={handleSubmitSale}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black text-xs font-extrabold transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin text-black" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <span>Concluir Venda & Dar Baixa no Estoque</span>
          </button>
        </div>
      </div>
    </div>
  );
}
