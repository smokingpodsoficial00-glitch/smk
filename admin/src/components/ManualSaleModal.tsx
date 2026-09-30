import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { ensureBuyerInBroadcastList } from "@/lib/marketingLists";
import { BRAZILIAN_STATES } from "@/lib/nationalSales";
import { notifyMobileSale } from "@/lib/saleNotifications";
import {
  ShoppingCart,
  User,
  Package,
  CheckCircle2,
  X,
  Loader2,
  Plus,
  Trash2,
  Megaphone,
  Globe,
  Search,
  ChevronDown,
  Phone,
} from "lucide-react";

const normalizeText = (str: string) =>
  (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatDisplayPhone = (rawPhone: string) => {
  if (!rawPhone) return "Sem número";
  if (
    rawPhone.startsWith("INSTA_") ||
    rawPhone.startsWith("SEM_WPP_") ||
    rawPhone.toLowerCase().includes("instagram")
  ) {
    return "Instagram / Sem WhatsApp";
  }
  const digits = rawPhone.replace(/\D/g, "");
  const local = digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return rawPhone;
};

interface ManualSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleSuccess: () => void;
  companyId?: string;
  preSelectedFlavorId?: string | null;
  preSelectedGroup?: any;
  defaultIsNational?: boolean;
}

export function ManualSaleModal({
  isOpen,
  onClose,
  onSaleSuccess,
  companyId: propCompanyId,
  preSelectedFlavorId,
  preSelectedGroup,
  defaultIsNational = false,
}: ManualSaleModalProps) {
  const { company } = useAuth();
  const companyId = propCompanyId || company?.id || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);

  // Estados do Cliente e Autocomplete Inteligente no Campo de Nome
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [highlightedClientIdx, setHighlightedClientIdx] = useState(0);
  const clientPickerRef = useRef<HTMLDivElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [shippingFee, setShippingFee] = useState<string>("0"); // Cobrado do cliente
  const [shippingCost, setShippingCost] = useState<string>("0"); // Custo real pago ao motoboy/Uber
  const [autoAddToMarketingList, setAutoAddToMarketingList] = useState(true);
  const [isNoWhatsApp, setIsNoWhatsApp] = useState(false);

  // Venda Nacional (Fora de SP / Correios)
  const [isNationalSale, setIsNationalSale] = useState(defaultIsNational);
  const [nationalState, setNationalState] = useState("RJ");
  const [nationalCity, setNationalCity] = useState("");
  const [nationalStreetAddress, setNationalStreetAddress] = useState("");
  const [nationalTrackingCode, setNationalTrackingCode] = useState("");

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

  // Fechar dropdown de clientes ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientPickerRef.current && !clientPickerRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Carregar produtos e clientes limpos do Supabase
  useEffect(() => {
    if (!isOpen) return;

    const loadInitialData = async () => {
      setLoadingProducts(true);
      setErrorMessage("");
      setSuccessMessage("");
      try {
        const isOfficialStore = !companyId || companyId === "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

        // 1. Buscar Produtos Ativos
        let prodsQuery = supabase
          .from("smoking_products")
          .select("*")
          .eq("is_active", true)
          .order("brand", { ascending: true });

        if (isOfficialStore) {
          prodsQuery = prodsQuery.or(`company_id.eq.${companyId},company_id.is.null`);
        } else {
          prodsQuery = prodsQuery.eq("company_id", companyId);
        }

        // 2. Buscar EXCLUSIVAMENTE Clientes Oficiais de smoking_clients (Fonte Única da Verdade)
        let clientsQuery = supabase
          .from("smoking_clients")
          .select("id, name, phone, address, company_id")
          .order("name", { ascending: true });

        if (isOfficialStore) {
          clientsQuery = clientsQuery.or(`company_id.eq.${companyId},company_id.is.null`);
        } else {
          clientsQuery = clientsQuery.eq("company_id", companyId);
        }

        const [{ data: prods, error: pErr }, { data: dbClients, error: cErr }] = await Promise.all([
          prodsQuery,
          clientsQuery,
        ]);

        if (!pErr && prods) {
          setProductsList(prods);
        }

        if (!cErr && dbClients) {
          // Filtrar registros de sistema e manter clientes reais com ID
          const validClients = dbClients.filter((c: any) => {
            if (!c || !c.id || !c.name) return false;
            const p = (c.phone || "").trim();
            const n = (c.name || "").trim().toLowerCase();
            return !p.startsWith("__SYSTEM_") && !n.includes("system") && !n.includes("config");
          });
          setClientsList(validClients);
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

  // Ao selecionar um modelo, auto-seleciona o primeiro sabor disponível e carrega o preço de venda imediatamente
  useEffect(() => {
    if (selectedModelKey && availableFlavors.length > 0) {
      // Se ainda não tem sabor selecionado ou o sabor atual não pertence a este modelo
      const currentValid = availableFlavors.some(f => f.id === selectedFlavorId);
      if (!selectedFlavorId || !currentValid) {
        const firstFlavor = availableFlavors[0];
        setSelectedFlavorId(firstFlavor.id);
        setCustomPrice(firstFlavor.price ? String(firstFlavor.price) : "");
      }
    }
  }, [selectedModelKey, availableFlavors, selectedFlavorId]);

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

  // Cliente Selecionado a partir de smoking_clients
  const selectedClient = useMemo(() => {
    if (!selectedCustomerId) return null;
    return clientsList.find((c) => c.id === selectedCustomerId) || null;
  }, [clientsList, selectedCustomerId]);

  // Busca Inteligente Dinâmica enquanto o Operador digita no Campo de Nome
  const filteredAndRankedClients = useMemo(() => {
    const rawQuery = clientName.trim();
    if (!rawQuery || selectedCustomerId) return [];

    const qText = normalizeText(rawQuery);
    const qDigits = rawQuery.replace(/\D/g, "");

    const scored: Array<{ client: any; score: number }> = [];

    for (const c of clientsList) {
      const cName = normalizeText(c.name || "");
      const cPhoneRaw = (c.phone || "").toLowerCase();
      const cDigits = (c.phone || "").replace(/\D/g, "");
      const cLocalDigits = cDigits.length >= 12 && cDigits.startsWith("55") ? cDigits.slice(2) : cDigits;
      const cNumberWithoutDdd = cLocalDigits.length >= 10 ? cLocalDigits.slice(2) : cLocalDigits;

      let score = 0;

      // 1. Match por Nome (tolerante para sugestões, mas seleção é sempre explícita)
      if (qText) {
        if (cName === qText) {
          score = Math.max(score, 100);
        } else if (cName.startsWith(qText)) {
          score = Math.max(score, 85);
        } else if (cName.split(/\s+/).some((word: string) => word.startsWith(qText))) {
          score = Math.max(score, 70);
        } else if (cName.includes(qText)) {
          score = Math.max(score, 45);
        }
      }

      // 2. Match por Telefone / Dígitos
      if (qDigits) {
        if (cLocalDigits === qDigits || cDigits === qDigits || cNumberWithoutDdd === qDigits) {
          score = Math.max(score, 100);
        } else if (
          cLocalDigits.startsWith(qDigits) ||
          cNumberWithoutDdd.startsWith(qDigits) ||
          cDigits.startsWith(qDigits)
        ) {
          score = Math.max(score, 80);
        } else if (cDigits.includes(qDigits) || cLocalDigits.includes(qDigits)) {
          score = Math.max(score, 55);
        }
      } else if (qText && cPhoneRaw.includes(qText)) {
        score = Math.max(score, 35);
      }

      if (score > 0) {
        scored.push({ client: c, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.client.name || "").localeCompare(b.client.name || "", "pt-BR", {
        sensitivity: "base",
      });
    });

    return scored.map((item) => item.client);
  }, [clientsList, clientName, selectedCustomerId]);

  // Preencher dados ao selecionar cliente existente explicitamente
  const handleSelectExistingClient = (c: any) => {
    if (!c || !c.id) return;

    setSelectedCustomerId(c.id);
    setClientName(c.name || "");
    setIsClientDropdownOpen(false);
    setHighlightedClientIdx(0);

    const rawPhone = (c.phone || "").trim();
    if (
      rawPhone.startsWith("INSTA_") ||
      rawPhone.startsWith("SEM_WPP_") ||
      rawPhone.toLowerCase().includes("instagram")
    ) {
      setIsNoWhatsApp(true);
      setClientPhone("");
      setAutoAddToMarketingList(false);
    } else {
      setIsNoWhatsApp(false);
      setClientPhone(rawPhone);
    }

    const rawAddr = c.address || "";
    const match = rawAddr.match(/\[(?:ENVIO )?NACIONAL:\s*([A-Za-z]{2})(?:\s*-\s*([^\]]+))?\]/i);
    if (match) {
      setIsNationalSale(true);
      if (match[1]) setNationalState(match[1].toUpperCase());
      if (match[2]) setNationalCity(match[2].trim());
      const clean = rawAddr
        .replace(/\[(?:ENVIO )?NACIONAL:[^\]]+\]\s*/gi, "")
        .replace(/\|\s*Rastreio:[^|]+$/gi, "")
        .trim();
      setNationalStreetAddress(clean);
      setShippingAddress(clean);
    } else {
      setShippingAddress(rawAddr);
    }
  };

  // Limpar seleção explícita e voltar ao estado de pesquisa limpo
  const handleClearSelectedClient = () => {
    setSelectedCustomerId(null);
    setClientName("");
    setClientPhone("");
    setIsNoWhatsApp(false);
    setShippingAddress("");
    setIsClientDropdownOpen(false);
    setHighlightedClientIdx(0);
    setTimeout(() => clientInputRef.current?.focus(), 50);
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
      // 1. Inserir/Atualizar Cliente no CRM (smoking_clients)
      const rawPhone = clientPhone.trim();
      const cleanPhone = rawPhone.replace(/\D/g, "");
      
      let formattedPhone = "";
      if (isNoWhatsApp || (!cleanPhone && !rawPhone)) {
        const cleanSlug = clientName.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "cliente";
        formattedPhone = `INSTA_${cleanSlug}_${Date.now().toString().slice(-6)}`;
      } else {
        formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      }

      let clientSaveWarning: string | null = null;
      const finalAddress = isNationalSale
        ? `[ENVIO NACIONAL: ${nationalState} - ${nationalCity.trim() || "Destino"}] ${nationalStreetAddress.trim() || shippingAddress.trim() || "Envio Correios"}${nationalTrackingCode.trim() ? ` | Rastreio: ${nationalTrackingCode.trim().toUpperCase()}` : ""}`
        : (shippingAddress.trim() || "Atendimento Balcão / WhatsApp");

      const clientAddressToSave = isNationalSale
        ? `${nationalCity.trim() || "Nacional"} - ${nationalState}`
        : (shippingAddress.trim() || "Atendimento Balcão / WhatsApp");

      // 1. Identificar ou Cadastrar Cliente Oficialmente em smoking_clients (SEM onConflict: 'phone'!)
      let finalCustomerId: string | null = selectedCustomerId;

      try {
        if (finalCustomerId) {
          // Atualizar dados cadastrais do cliente selecionado EXCLUSIVAMENTE pelo ID (customer.id)
          let clientUpdQuery = supabase
            .from("smoking_clients")
            .update({
              name: clientName.trim(),
              ...(cleanPhone.length >= 10 && !isNoWhatsApp ? { phone: formattedPhone } : {}),
              address: clientAddressToSave,
              updated_at: new Date().toISOString(),
            })
            .eq("id", finalCustomerId);

          if (companyId) {
            clientUpdQuery = clientUpdQuery.eq("company_id", companyId);
          }

          const { error: clientErr } = await clientUpdQuery;
          if (clientErr) {
            console.warn("Aviso ao atualizar cliente por ID:", clientErr.message);
          }
        } else {
          // Operador NÃO selecionou cliente existente -> cadastrar NOVO cliente em smoking_clients
          const newClientPayload: any = {
            name: clientName.trim(),
            phone: cleanPhone.length >= 10 && !isNoWhatsApp ? formattedPhone : null,
            address: clientAddressToSave,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (companyId) newClientPayload.company_id = companyId;

          const { data: newClientData, error: newClientErr } = await supabase
            .from("smoking_clients")
            .insert(newClientPayload)
            .select("id")
            .single();

          if (!newClientErr && newClientData?.id) {
            finalCustomerId = newClientData.id;
          } else if (newClientErr) {
            console.warn("Aviso ao cadastrar novo cliente em smoking_clients:", newClientErr.message);
          }
        }
      } catch (custErr) {
        console.error("❌ Exceção ao salvar cliente em smoking_clients:", custErr);
        clientSaveWarning = "Não foi possível atualizar o cadastro do cliente.";
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
          ...(isNationalSale && {
            is_national: true,
            national_state: nationalState,
            national_city: nationalCity.trim() || undefined,
            tracking_code: nationalTrackingCode.trim().toUpperCase() || undefined,
            shipping_cost_real: numericShippingCost || undefined,
          }),
        };
      });

      // 3. Inserir Pedido PAGO e CONCLUIDO em smoking_orders
      let insertedOrderId: string | null = null;
      
      // Mapear método de pagamento para a constraint do Supabase ('PIX' | 'CREDITO_LINK')
      const safePaymentMethod = paymentMethod === "CARTAO" ? "CREDITO_LINK" : "PIX";

      const payload: any = {
        customer_id: finalCustomerId,
        client_name: clientName.trim(),
        client_phone: formattedPhone,
        shipping_address: finalAddress,
        items: orderItems,
        total_amount: grandTotal,
        shipping_fee: numericShippingFee,
        payment_status: "PAGO",
        delivery_status: "PREPARANDO",
        payment_method: safePaymentMethod,
        company_id: companyId,
      };

      let { data: insertedData, error: orderErr } = await supabase
        .from("smoking_orders")
        .insert(payload)
        .select("id")
        .single();

      if (orderErr) {
        // Se houver erro de delivery_status constraint
        if (orderErr.message?.includes("delivery_status")) {
          payload.delivery_status = "PREPARANDO";
        }
        // Se houver erro de payment_method constraint
        if (orderErr.message?.includes("payment_method")) {
          payload.payment_method = "PIX";
        }

        const retryRes = await supabase
          .from("smoking_orders")
          .insert(payload)
          .select("id")
          .single();
        orderErr = retryRes.error;
        insertedData = retryRes.data;
      }

      if (orderErr) {
        throw new Error(`Erro ao salvar pedido: ${orderErr.message}`);
      }

      if (insertedData?.id) {
        insertedOrderId = insertedData.id;
      }

      // 4. Abater estoque diretamente em smoking_products para cada item vendido
      for (const item of effectiveItems) {
        if (!item.productId) continue;
        try {
          const { data: pData } = await supabase
            .from("smoking_products")
            .select("stock")
            .eq("id", item.productId)
            .single();

          if (pData) {
            const currentStock = typeof pData.stock === "number" ? pData.stock : parseInt(String(pData.stock || "0"), 10);
            const qtyToDeduct = Number(item.quantity) || 1;
            const newStock = Math.max(0, currentStock - qtyToDeduct);

            await supabase
              .from("smoking_products")
              .update({ stock: newStock })
              .eq("id", item.productId);

            console.log(`[ManualSaleModal] Baixa de estoque para ${item.modelName} - ${item.flavor}: ${currentStock} -> ${newStock}`);
          }
        } catch (stockErr) {
          console.error("Erro ao abater estoque do produto no Supabase:", stockErr);
        }
      }

      // 5. Inserir automaticamente na Lista de Transmissão de Compradores do Marketing
      let marketingListNote = "";
      if (autoAddToMarketingList && cleanPhone && !isNoWhatsApp && !formattedPhone.startsWith("INSTA_")) {
        try {
          const mktRes = await ensureBuyerInBroadcastList({
            companyId,
            clientName: clientName.trim(),
            clientPhone: formattedPhone,
          });
          if (mktRes.success) {
            marketingListNote = ` e ${mktRes.listName}`;
          }
        } catch (mktErr) {
          console.warn("Aviso ao incluir cliente na lista de marketing:", mktErr);
        }
      }

      // 6. Disparar Notificação Push no Celular dos Sócios (100% isolado e não-bloqueante)
      void notifyMobileSale({
        companyId,
        clientName: clientName.trim(),
        items: effectiveItems,
        totalAmount: grandTotal,
        estimatedProfit,
        paymentMethod,
        isNationalSale,
        nationalState: isNationalSale ? nationalState : undefined,
      });

      if (clientSaveWarning) {
        setSuccessMessage(`✅ Venda registrada com sucesso! (${clientSaveWarning})`);
      } else {
        setSuccessMessage(`✅ Venda registrada com sucesso! Estoque abatido, ranking, CRM${marketingListNote} atualizados.`);
      }

      setTimeout(() => {
        onSaleSuccess();
        onClose();
        // Limpar formulário
        setItems([]);
        setClientName("");
        setClientPhone("");
        setSelectedCustomerId(null);
        setIsClientDropdownOpen(false);
        setHighlightedClientIdx(0);
        setIsNoWhatsApp(false);
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
            <div className="size-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <ShoppingCart className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Registrar Venda
              </h3>
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
            <Loader2 className="size-8 animate-spin text-emerald-400 mx-auto" />
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

            {/* DADOS DO CLIENTE */}
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase font-bold text-white tracking-wider">
                  Dados do Cliente
                </span>
              </div>

              {/* CARD DE CLIENTE SELECIONADO OU BUSCA INTEGRADA DIRETO NO CAMPO DE NOME */}
              {selectedCustomerId && selectedClient ? (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm shrink-0 border border-emerald-500/40">
                      <CheckCircle2 className="size-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span className="truncate">{selectedClient.name}</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                          Cliente CRM
                        </span>
                      </div>
                      <div className="text-[11px] text-white/60 font-mono truncate">
                        {isNoWhatsApp ? "Sem WhatsApp / Instagram" : formatDisplayPhone(clientPhone || selectedClient.phone)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelectedClient}
                    className="text-xs text-zinc-300 hover:text-white font-semibold px-3 py-1.5 rounded-xl border border-white/20 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  >
                    Alterar cliente
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Campo Inteligente de Nome com Dropdown Flutuante */}
                  <div ref={clientPickerRef} className="relative">
                    <label className="text-[11px] text-silver font-medium block mb-1">
                      Nome do Cliente *
                    </label>
                    <div className="relative">
                      <input
                        ref={clientInputRef}
                        type="text"
                        value={clientName}
                        onFocus={() => {
                          if (filteredAndRankedClients.length > 0) setIsClientDropdownOpen(true);
                        }}
                        onChange={(e) => {
                          setClientName(e.target.value);
                          setIsClientDropdownOpen(true);
                          setHighlightedClientIdx(0);
                        }}
                        onKeyDown={(e) => {
                          if (!isClientDropdownOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                            if (filteredAndRankedClients.length > 0) {
                              setIsClientDropdownOpen(true);
                              return;
                            }
                          }
                          if (isClientDropdownOpen) {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setHighlightedClientIdx((prev) =>
                                Math.min(prev + 1, Math.max(0, filteredAndRankedClients.length - 1))
                              );
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setHighlightedClientIdx((prev) => Math.max(0, prev - 1));
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              const target =
                                filteredAndRankedClients[highlightedClientIdx] || filteredAndRankedClients[0];
                              if (target) {
                                handleSelectExistingClient(target);
                              }
                            } else if (e.key === "Escape") {
                              setIsClientDropdownOpen(false);
                            }
                          }
                        }}
                        placeholder="Digite o nome do cliente..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/40 font-semibold"
                      />
                      {clientName && (
                        <button
                          type="button"
                          onClick={() => {
                            setClientName("");
                            setIsClientDropdownOpen(false);
                            clientInputRef.current?.focus();
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1 transition-colors"
                          title="Limpar nome"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Dropdown Flutuante de Sugestões de Clientes do CRM */}
                    {isClientDropdownOpen && filteredAndRankedClients.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#16161a] border border-white/15 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-3 py-2 bg-black/50 border-b border-white/10 flex items-center justify-between text-[10px] text-white/50">
                          <span>
                            {filteredAndRankedClients.length} cliente(s) no CRM
                          </span>
                          <span className="text-zinc-400 font-semibold hidden sm:inline">
                            Clique ou Enter ↵
                          </span>
                        </div>

                        <div className="max-h-60 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                          {filteredAndRankedClients.map((c, idx) => {
                            const isHighlighted = idx === highlightedClientIdx;
                            const displayPhone = formatDisplayPhone(c.phone);
                            const initials = (c.name || "CL")
                              .trim()
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part: string) => part[0]?.toUpperCase() || "")
                              .join("");

                            return (
                              <button
                                key={c.id}
                                type="button"
                                onMouseEnter={() => setHighlightedClientIdx(idx)}
                                onClick={() => handleSelectExistingClient(c)}
                                className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                  isHighlighted
                                    ? "bg-white/10 text-white"
                                    : "hover:bg-white/5 text-white/85"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`size-8 rounded-xl flex items-center justify-center text-[11px] font-extrabold shrink-0 border ${
                                      idx === 0
                                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                        : "bg-white/5 text-white/70 border-white/10"
                                    }`}
                                  >
                                    {initials || "CL"}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-white whitespace-normal break-words">
                                        {c.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-white/50 font-mono truncate">
                                      <Phone className="size-2.5 text-emerald-400 shrink-0" />
                                      <span>{displayPhone}</span>
                                    </div>
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 transition-all ${
                                    isHighlighted
                                      ? "bg-white text-black border-white font-extrabold"
                                      : "bg-white/5 text-white/50 border-white/10"
                                  }`}
                                >
                                  Selecionar
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Campo WhatsApp */}
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[17px]">
                      <label className="text-[11px] text-silver font-medium">WhatsApp</label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = !isNoWhatsApp;
                          setIsNoWhatsApp(nextState);
                          if (nextState) {
                            setClientPhone("");
                            setAutoAddToMarketingList(false);
                          }
                        }}
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
                          isNoWhatsApp
                            ? "bg-zinc-800 text-white border-zinc-600 shadow-sm"
                            : "bg-white/5 text-zinc-400 border-white/10 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${isNoWhatsApp ? "bg-emerald-400" : "bg-zinc-500"}`} />
                        <span>Sem WhatsApp (Insta)</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      disabled={isNoWhatsApp}
                      value={isNoWhatsApp ? "(Venda Instagram / Sem WhatsApp)" : clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="Número do WhatsApp..."
                      className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/40 font-semibold ${
                        isNoWhatsApp ? "opacity-50 cursor-not-allowed italic text-white/60 bg-white/5" : ""
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Checkbox: Adicionar automaticamente à Lista de Compradores */}
              <div className="pt-1">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-white/90 cursor-pointer select-none bg-black/40 border border-white/10 hover:border-emerald-500/40 p-2.5 rounded-xl transition-all">
                  <input
                    type="checkbox"
                    checked={autoAddToMarketingList}
                    onChange={(e) => setAutoAddToMarketingList(e.target.checked)}
                    className="size-4 rounded accent-emerald-500 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Megaphone className="size-3.5 text-emerald-400" />
                    Incluir automaticamente na Lista de Compradores (Marketing)
                  </span>
                </label>
              </div>
            </div>

            {/* CARD: VENDA NACIONAL */}
            <div
              className={`border rounded-2xl p-4 transition-all space-y-3 ${
                isNationalSale
                  ? "bg-emerald-500/[0.06] border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isNationalSale}
                    onChange={(e) => setIsNationalSale(e.target.checked)}
                    className="size-4 rounded accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <Globe className={`size-4 ${isNationalSale ? "text-emerald-400" : "text-white/60"}`} />
                    <span className={`text-xs font-bold ${isNationalSale ? "text-white" : "text-white/90"}`}>
                      Venda Nacional
                    </span>
                  </div>
                </label>
                {isNationalSale && (
                  <span className="text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full shrink-0">
                    Correios / BR
                  </span>
                )}
              </div>

              {/* Card de Região e Destino */}
              {isNationalSale && (
                <div className="pt-3 border-t border-white/10 space-y-3 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-silver font-medium block mb-1">
                        Estado de Destino (UF) *
                      </label>
                      <select
                        value={nationalState}
                        onChange={(e) => setNationalState(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 font-semibold cursor-pointer"
                      >
                        {BRAZILIAN_STATES.map((st) => (
                          <option key={st.uf} value={st.uf}>
                            {st.uf} - {st.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-silver font-medium block mb-1">
                        Cidade de Destino *
                      </label>
                      <input
                        type="text"
                        value={nationalCity}
                        onChange={(e) => setNationalCity(e.target.value)}
                        placeholder="Ex: Rio de Janeiro, Curitiba..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-400 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-silver font-medium block mb-1">
                      Endereço Completo & CEP (Destino dos Correios)
                    </label>
                    <input
                      type="text"
                      value={nationalStreetAddress}
                      onChange={(e) => setNationalStreetAddress(e.target.value)}
                      placeholder="Ex: Av. Atlântica, 1500, Apto 402 - Copacabana, CEP 22021-001"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-400/50"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-silver font-medium block mb-1">
                      Código de Rastreio dos Correios (Opcional)
                    </label>
                    <input
                      type="text"
                      value={nationalTrackingCode}
                      onChange={(e) => setNationalTrackingCode(e.target.value.toUpperCase())}
                      placeholder="Ex: QC123456789BR"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-400 font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SELEÇÃO DE PODS (MODELO -> SABOR) */}
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-xs uppercase font-bold text-white tracking-wider">
                Selecionar Modelo & Sabor
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
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/30 font-semibold cursor-pointer hover:border-white/20 transition-all"
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
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/30 disabled:opacity-40 font-semibold cursor-pointer hover:border-white/20 transition-all"
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
                        className="w-20 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-center text-white focus:outline-none focus:border-white/30 font-bold"
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-all border border-white/10 cursor-pointer"
                  >
                    <Plus className="size-3.5 text-emerald-400" />
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
                    {isNationalSale ? "Custo Real Envio Correios (R$)" : "Custo Real do Motoboy/Uber (R$)"}
                  </label>
                  <input
                    type="text"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30 font-bold"
                  />
                  <span className="text-[9px] text-white/40 block mt-1">
                    {isNationalSale ? "Gasto real com postagem/PAC/Sedex" : "Gasto que você terá na entrega"}
                  </span>
                </div>
              </div>
            </div>

            {/* RESUMO DO PEDIDO E MARGEM DE LUCRO */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2.5">
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
              <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
                <span className="font-bold text-white uppercase tracking-wider text-xs">TOTAL DO PEDIDO:</span>
                <span className="font-extrabold text-xl text-emerald-400">
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
