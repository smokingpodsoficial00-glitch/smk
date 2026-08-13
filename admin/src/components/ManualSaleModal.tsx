import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  ShoppingCart,
  User,
  Phone,
  Package,
  DollarSign,
  CreditCard,
  Truck,
  CheckCircle2,
  X,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  MapPin
} from "lucide-react";

interface ManualSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleSuccess: () => void;
  preSelectedFlavorId?: string | null;
  preSelectedGroup?: any | null;
  companyId?: string;
}

export function ManualSaleModal({
  isOpen,
  onClose,
  onSaleSuccess,
  preSelectedFlavorId,
  preSelectedGroup,
  companyId = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5",
}: ManualSaleModalProps) {
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);

  // Dados da Venda
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [shippingFee, setShippingFee] = useState<string>("0");

  // Lista de Itens do Pedido
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

  // Item sendo adicionado no formulário atual
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModelKey, setSelectedModelKey] = useState("");
  const [selectedFlavorId, setSelectedFlavorId] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Carregar produtos e clientes do Supabase ao abrir
  useEffect(() => {
    if (!isOpen) return;

    const loadInitialData = async () => {
      setLoadingProducts(true);
      try {
        // 1. Buscar Todos os Produtos Ativos
        const { data: prods, error: pErr } = await supabase
          .from("smoking_products")
          .select("*")
          .eq("is_active", true)
          .or(`company_id.eq.${companyId},company_id.is.null`)
          .order("brand", { ascending: true });

        if (!pErr && prods) {
          setProductsList(prods);
        }

        // 2. Buscar Clientes Recentes para Auto-completar
        const { data: orders } = await supabase
          .from("smoking_orders")
          .select("client_name, client_phone, shipping_address")
          .neq("client_phone", "__SYSTEM_SMK_BEST_SELLERS__")
          .order("created_at", { ascending: false })
          .limit(50);

        if (orders) {
          const uniqueClients = new Map<string, any>();
          orders.forEach((o) => {
            if (o.client_phone && !uniqueClients.has(o.client_phone)) {
              uniqueClients.set(o.client_phone, o);
            }
          });
          setClientsList(Array.from(uniqueClients.values()));
        }
      } catch (err) {
        console.error("Erro ao carregar dados para venda manual:", err);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadInitialData();
  }, [isOpen, companyId]);

  // Se houver pre-selecao por sabor/grupo enviado pelo componente pai
  useEffect(() => {
    if (!isOpen || productsList.length === 0) return;

    if (preSelectedFlavorId) {
      const foundProd = productsList.find((p) => p.id === preSelectedFlavorId);
      if (foundProd) {
        setItems([
          {
            productId: foundProd.id,
            brand: foundProd.brand,
            modelName: foundProd.name,
            flavor: foundProd.flavor || "Padrão",
            quantity: 1,
            price: Number(foundProd.price) || 0,
            costPrice: Number(foundProd.cost_price) || 0,
            maxStock: Number(foundProd.stock) || 0,
            image_url: foundProd.image_url,
          },
        ]);
        return;
      }
    }

    if (preSelectedGroup && preSelectedGroup.flavors && preSelectedGroup.flavors.length > 0) {
      const firstFlavor = preSelectedGroup.flavors[0];
      const foundProd = productsList.find((p) => p.id === firstFlavor.id) || firstFlavor;
      if (foundProd) {
        setItems([
          {
            productId: foundProd.id,
            brand: preSelectedGroup.brand || foundProd.brand,
            modelName: preSelectedGroup.name || foundProd.name,
            flavor: foundProd.flavor || "Padrão",
            quantity: 1,
            price: Number(preSelectedGroup.price || foundProd.price) || 0,
            costPrice: Number(preSelectedGroup.cost_price || foundProd.cost_price) || 0,
            maxStock: Number(foundProd.stock) || 0,
            image_url: preSelectedGroup.image_url || foundProd.image_url,
          },
        ]);
      }
    }
  }, [isOpen, preSelectedFlavorId, preSelectedGroup, productsList]);

  // Lista de Marcas Disponíveis
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    productsList.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set).sort();
  }, [productsList]);

  // Modelos filtrados por Marca selecionada
  const availableModels = useMemo(() => {
    if (!selectedBrand) return [];
    const map = new Map<string, { modelName: string; key: string }>();
    productsList
      .filter((p) => p.brand?.toLowerCase() === selectedBrand.toLowerCase())
      .forEach((p) => {
        const key = `${p.brand}__${p.name}`.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { modelName: p.name, key });
        }
      });
    return Array.from(map.values());
  }, [productsList, selectedBrand]);

  // Sabores filtrados por Modelo selecionado
  const availableFlavors = useMemo(() => {
    if (!selectedModelKey) return [];
    return productsList.filter((p) => {
      const key = `${p.brand}__${p.name}`.toLowerCase();
      return key === selectedModelKey;
    });
  }, [productsList, selectedModelKey]);

  // Quando o sabor selecionado mudar no dropdown
  useEffect(() => {
    if (selectedFlavorId) {
      const prod = productsList.find((p) => p.id === selectedFlavorId);
      if (prod) {
        setCustomPrice(prod.price ? String(prod.price) : "");
      }
    }
  }, [selectedFlavorId, productsList]);

  // Adicionar item ao pedido
  const handleAddItem = () => {
    if (!selectedFlavorId) {
      setErrorMessage("Por favor, selecione um sabor de pod.");
      return;
    }

    const prod = productsList.find((p) => p.id === selectedFlavorId);
    if (!prod) return;

    const unitPrice = parseFloat(customPrice.replace(",", ".")) || Number(prod.price) || 0;

    // Checar se ja existe no carrinho do pedido
    const existingIdx = items.findIndex((i) => i.productId === prod.id);

    if (existingIdx >= 0) {
      const updated = [...items];
      updated[existingIdx].quantity += itemQuantity;
      updated[existingIdx].price = unitPrice;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: prod.id,
          brand: prod.brand,
          modelName: prod.name,
          flavor: prod.flavor || "Padrão",
          quantity: itemQuantity,
          price: unitPrice,
          costPrice: Number(prod.cost_price) || 0,
          maxStock: Number(prod.stock) || 0,
          image_url: prod.image_url,
        },
      ]);
    }

    // Resetar campos de selecao parcial
    setSelectedFlavorId("");
    setItemQuantity(1);
    setCustomPrice("");
    setErrorMessage("");
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculos da Venda
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [items]);

  const totalCost = useMemo(() => {
    return items.reduce((acc, item) => acc + item.costPrice * item.quantity, 0);
  }, [items]);

  const numericShippingFee = parseFloat(shippingFee.replace(",", ".")) || 0;
  const grandTotal = subtotal + numericShippingFee;
  const estimatedProfit = grandTotal - totalCost;

  // Selecionar Cliente Existente
  const handleSelectExistingClient = (phone: string) => {
    const found = clientsList.find((c) => c.client_phone === phone);
    if (found) {
      setClientName(found.client_name || "");
      setClientPhone(found.client_phone || "");
      setShippingAddress(found.shipping_address || "");
    }
  };

  // Finalizar e Registrar a Venda no Supabase DB
  const handleSubmitSale = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (items.length === 0) {
      setErrorMessage("Adicione pelo menos 1 pod ao pedido antes de finalizar.");
      return;
    }

    if (!clientName.trim()) {
      setErrorMessage("Por favor, preencha o nome do cliente.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Montar array de itens no formato padrao do smoking_orders
      const orderItems = items.map((item) => {
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

      // 2. Inserir Pedido Concluído em smoking_orders
      const { error: orderErr } = await supabase.from("smoking_orders").insert({
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || "5511999999999",
        shipping_address: shippingAddress.trim() || "Atendimento Balcão / WhatsApp",
        items: orderItems,
        total_amount: grandTotal,
        shipping_fee: numericShippingFee,
        payment_status: "PAGO",
        delivery_status: "ENTREGUE",
        payment_method: paymentMethod,
        company_id: companyId,
      });

      if (orderErr) {
        throw new Error(`Erro ao salvar pedido: ${orderErr.message}`);
      }

      // 3. Dar baixa no Estoque em smoking_products para cada item
      for (const item of items) {
        // Buscar estoque atual em tempo real para evitar saldo negativo
        const { data: pData } = await supabase
          .from("smoking_products")
          .select("stock")
          .eq("id", item.productId)
          .single();

        const currentStock = pData ? Number(pData.stock) || 0 : item.maxStock;
        const newStock = Math.max(0, currentStock - item.quantity);

        const { error: stockErr } = await supabase
          .from("smoking_products")
          .update({ stock: newStock })
          .eq("id", item.productId);

        if (stockErr) {
          console.warn(`Aviso ao dar baixa no estoque do pod ${item.productId}:`, stockErr.message);
        }
      }

      setSuccessMessage("✅ Venda registrada com sucesso! Estoque abatido e ranking atualizado.");

      setTimeout(() => {
        onSaleSuccess();
        onClose();
        // Resetar Modal
        setItems([]);
        setClientName("");
        setClientPhone("");
        setShippingAddress("");
        setSuccessMessage("");
      }, 1200);
    } catch (err: any) {
      console.error("Erro ao registrar venda manual:", err);
      setErrorMessage(err.message || "Ocorreu um erro ao processar a venda.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#111113] border border-white/15 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-auto text-white">
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
                  Baixa Real
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Atualiza estoque, ranking de vendas, financeiro e CRM em 1 clique.
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
            {/* Mensagens de Feedback */}
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

            {/* 1. SEÇÃO DO CLIENTE (CRM) */}
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                  <User className="size-3.5" /> 1. Dados do Cliente
                </span>
                {clientsList.length > 0 && (
                  <select
                    onChange={(e) => handleSelectExistingClient(e.target.value)}
                    className="bg-black/60 border border-white/10 rounded-lg text-xs text-muted-foreground px-2 py-1 focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="">-- Cliente Recente --</option>
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
                    placeholder="Ex: João Silva"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-silver font-medium block mb-1">WhatsApp (DDD + Número)</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ex: 11999998888"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>
            </div>

            {/* 2. SEÇÃO DE ADICIONAR PODS AO PEDIDO */}
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-xs uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                <Package className="size-3.5" /> 2. Selecionar Pods & Sabores Vendidos
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Marca */}
                <div>
                  <label className="text-[11px] text-silver font-medium block mb-1">Marca</label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => {
                      setSelectedBrand(e.target.value);
                      setSelectedModelKey("");
                      setSelectedFlavorId("");
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="">-- Selecione Marca --</option>
                    {availableBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Modelo */}
                <div>
                  <label className="text-[11px] text-silver font-medium block mb-1">Modelo</label>
                  <select
                    disabled={!selectedBrand}
                    value={selectedModelKey}
                    onChange={(e) => {
                      setSelectedModelKey(e.target.value);
                      setSelectedFlavorId("");
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400/50 disabled:opacity-40"
                  >
                    <option value="">-- Selecione Modelo --</option>
                    {availableModels.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.modelName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sabor */}
                <div>
                  <label className="text-[11px] text-silver font-medium block mb-1">Sabor Disponível</label>
                  <select
                    disabled={!selectedModelKey}
                    value={selectedFlavorId}
                    onChange={(e) => setSelectedFlavorId(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400/50 disabled:opacity-40"
                  >
                    <option value="">-- Selecione Sabor --</option>
                    {availableFlavors.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.flavor || "Padrão"} ({p.stock} un em estoque)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantidade e Preço Customizado */}
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
                        className="w-20 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-center text-white focus:outline-none focus:border-amber-400/50"
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
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)] cursor-pointer self-end"
                  >
                    <Plus className="size-4" />
                    <span>Adicionar Pod</span>
                  </button>
                </div>
              )}

              {/* Tabela de Itens Adicionados no Pedido */}
              {items.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                    Itens no Pedido ({items.length}):
                  </span>
                  <div className="space-y-1.5">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="size-7 rounded-lg object-cover border border-white/10" />
                          ) : (
                            <div className="size-7 rounded-lg bg-elevated border border-white/10 flex items-center justify-center text-muted-foreground">
                              <Package className="size-3.5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">
                              {item.brand} {item.modelName}
                            </p>
                            <p className="text-[10px] text-emerald-400 font-medium">
                              Sabor: {item.flavor}
                            </p>
                          </div>
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

            {/* 3. PAGAMENTO E FRETE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <div>
                <label className="text-[11px] text-silver font-medium block mb-1">Forma de Pagamento</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {["PIX", "DINHEIRO", "CARTAO"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentMethod === method
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                          : "bg-black/40 border-white/10 text-muted-foreground hover:text-white"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-silver font-medium block mb-1">Taxa de Entrega / Frete (R$)</label>
                <input
                  type="text"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>

            {/* RESUMO E BOTÃO DE FINALIZAR */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-silver">Subtotal dos Pods:</span>
                <span className="font-bold text-white">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              {numericShippingFee > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-silver">Taxa de Frete:</span>
                  <span className="font-bold text-white">R$ {numericShippingFee.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm pt-2 border-t border-amber-500/20">
                <span className="font-bold text-white uppercase tracking-wider">Total do Pedido:</span>
                <span className="font-extrabold text-lg text-emerald-400">
                  R$ {grandTotal.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground text-right font-medium">
                Lucro estimado nesta venda: <span className="text-emerald-400 font-bold">R$ {estimatedProfit.toFixed(2).replace(".", ",")}</span>
              </p>
            </div>
          </div>
        )}

        {/* Rodapé de Ações */}
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
            disabled={submitting || items.length === 0}
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
