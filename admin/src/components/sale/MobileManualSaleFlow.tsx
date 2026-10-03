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
  Minus,
  Trash2,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  CreditCard,
  QrCode,
  Banknote,
  Truck,
  Sparkles,
  Phone,
  MapPin,
  RotateCcw,
  Check,
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

export interface MobileManualSaleFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleSuccess: () => void;
  companyId?: string;
  preSelectedFlavorId?: string | null;
  preSelectedGroup?: any;
  defaultIsNational?: boolean;
}

type SaleStep = "CLIENT" | "PRODUCTS" | "PAYMENT" | "SUCCESS";

export function MobileManualSaleFlow({
  isOpen,
  onClose,
  onSaleSuccess,
  companyId: propCompanyId,
  preSelectedFlavorId,
  defaultIsNational = false,
}: MobileManualSaleFlowProps) {
  const { company } = useAuth();
  const companyId = propCompanyId || company?.id || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

  // Fluxo em Etapas Progressivas
  const [currentStep, setCurrentStep] = useState<SaleStep>("CLIENT");

  // Dados do Catálogo e Clientes
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);

  // ETAPA 1: CLIENTE
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [isNoWhatsApp, setIsNoWhatsApp] = useState(false);
  const [shippingAddress, setShippingAddress] = useState("");
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);

  // ETAPA 2: PRODUTOS E CARRINHO
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

  const [selectedModelKey, setSelectedModelKey] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [selectedFlavorId, setSelectedFlavorId] = useState("");
  const [flavorSearch, setFlavorSearch] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<string>("");

  // ETAPA 3: PAGAMENTO & ENTREGA
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "DINHEIRO" | "CARTAO">("PIX");
  const [shippingFee, setShippingFee] = useState<string>("0");
  const [shippingCost, setShippingCost] = useState<string>("0");
  const [autoAddToMarketingList, setAutoAddToMarketingList] = useState(true);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Venda Nacional (Correios / Fora de SP)
  const [isNationalSale, setIsNationalSale] = useState(defaultIsNational);
  const [nationalState, setNationalState] = useState("RJ");
  const [nationalCity, setNationalCity] = useState("");
  const [nationalStreetAddress, setNationalStreetAddress] = useState("");
  const [nationalTrackingCode, setNationalTrackingCode] = useState("");

  // Estados de Processamento e Resposta
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successInfo, setSuccessInfo] = useState<{
    clientName: string;
    totalAmount: number;
    itemsCount: number;
    paymentMethod: string;
  } | null>(null);

  // Carregar produtos e clientes do Supabase
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoadingInitialData(true);
      setErrorMessage("");
      try {
        const isOfficialStore = !companyId || companyId === "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

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
          const validClients = dbClients.filter((c: any) => {
            if (!c || !c.id || !c.name) return false;
            const p = (c.phone || "").trim();
            const n = (c.name || "").trim().toLowerCase();
            return !p.startsWith("__SYSTEM_") && !n.includes("system") && !n.includes("config");
          });
          setClientsList(validClients);
        }
      } catch (err) {
        console.error("Erro ao carregar dados para MobileManualSaleFlow:", err);
      } finally {
        setLoadingInitialData(false);
      }
    };

    loadData();
  }, [isOpen, companyId]);

  // Se houver sabor pré-selecionado (ex: vindo de um card do Estoque Mobile)
  useEffect(() => {
    if (preSelectedFlavorId && productsList.length > 0) {
      const prod = productsList.find((p) => p.id === preSelectedFlavorId);
      if (prod) {
        const key = `${prod.brand}__${prod.name}`.toLowerCase();
        setSelectedModelKey(key);
        setSelectedFlavorId(prod.id);
        setCustomPrice(prod.price ? String(prod.price) : "");
        setItemQuantity(1);
      }
    }
  }, [preSelectedFlavorId, productsList]);

  // Modelos únicos disponíveis
  const availableModels = useMemo(() => {
    const map = new Map<string, { label: string; key: string; brand: string; name: string; totalStock: number; flavorCount: number }>();
    productsList.forEach((p) => {
      const key = `${p.brand}__${p.name}`.toLowerCase();
      const label = `${p.brand} ${p.name}`.trim();
      const st = Number(p.stock) || 0;
      if (!map.has(key)) {
        map.set(key, { label, key, brand: p.brand, name: p.name, totalStock: st, flavorCount: 1 });
      } else {
        const existing = map.get(key)!;
        existing.totalStock += st;
        existing.flavorCount += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [productsList]);

  // Filtragem de Modelos na busca
  const filteredModels = useMemo(() => {
    const q = normalizeText(modelSearch);
    if (!q) return availableModels;
    return availableModels.filter(
      (m) => normalizeText(m.label).includes(q) || normalizeText(m.brand).includes(q)
    );
  }, [availableModels, modelSearch]);

  // Sabores do Modelo Selecionado
  const availableFlavors = useMemo(() => {
    if (!selectedModelKey) return [];
    return productsList.filter((p) => {
      const key = `${p.brand}__${p.name}`.toLowerCase();
      return key === selectedModelKey;
    });
  }, [productsList, selectedModelKey]);

  // Filtragem de Sabores do Modelo Selecionado
  const filteredFlavors = useMemo(() => {
    if (!selectedModelKey) return [];
    const q = normalizeText(flavorSearch);
    if (!q) return availableFlavors;
    return availableFlavors.filter((f) => normalizeText(f.flavor || "").includes(q));
  }, [availableFlavors, flavorSearch, selectedModelKey]);

  // Objeto do sabor atualmente em seleção
  const currentSelectedFlavorProd = useMemo(() => {
    if (!selectedFlavorId) return null;
    return productsList.find((p) => p.id === selectedFlavorId) || null;
  }, [selectedFlavorId, productsList]);

  // Atualizar preço padrão ao trocar sabor selecionado
  useEffect(() => {
    if (currentSelectedFlavorProd) {
      setCustomPrice(currentSelectedFlavorProd.price ? String(currentSelectedFlavorProd.price) : "");
      setItemQuantity(1);
    }
  }, [currentSelectedFlavorProd]);

  // Busca Inteligente de Clientes (Pesquisa e Rankeamento)
  const rankedClients = useMemo(() => {
    const rawQuery = clientSearchQuery.trim();
    if (!rawQuery) return [];

    const qText = normalizeText(rawQuery);
    const qDigits = rawQuery.replace(/\D/g, "");

    const scored: Array<{ client: any; score: number }> = [];

    for (const c of clientsList) {
      const cName = normalizeText(c.name || "");
      const cDigits = (c.phone || "").replace(/\D/g, "");
      const cLocalDigits = cDigits.length >= 12 && cDigits.startsWith("55") ? cDigits.slice(2) : cDigits;
      const cNumberWithoutDdd = cLocalDigits.length >= 10 ? cLocalDigits.slice(2) : cLocalDigits;

      let score = 0;

      // 1. Match por Nome
      if (qText) {
        if (cName === qText) {
          score = Math.max(score, 100);
        } else if (cName.startsWith(qText)) {
          score = Math.max(score, 85);
        } else if (cName.split(/\s+/).some((w) => w.startsWith(qText))) {
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
      }

      if (score > 0) {
        scored.push({ client: c, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.client.name || "").localeCompare(b.client.name || "", "pt-BR");
    });

    return scored.map((item) => item.client);
  }, [clientsList, clientSearchQuery]);

  // Selecionar Cliente Existente do CRM
  const handleSelectClient = (c: any) => {
    setSelectedCustomerId(c.id);
    setClientName(c.name || "");
    setClientSearchQuery("");
    setIsCreatingNewClient(false);

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

  // Limpar seleção do cliente
  const handleClearClient = () => {
    setSelectedCustomerId(null);
    setClientName("");
    setClientPhone("");
    setIsNoWhatsApp(false);
    setShippingAddress("");
    setClientSearchQuery("");
    setIsCreatingNewClient(false);
  };

  // Confirmar adição de item ao carrinho
  const handleAddItemToCart = () => {
    if (!currentSelectedFlavorProd) {
      setErrorMessage("Selecione um modelo e sabor antes de adicionar.");
      return;
    }

    const unitPrice = parseFloat(customPrice.replace(",", ".")) || Number(currentSelectedFlavorProd.price) || 0;
    const maxStock = Number(currentSelectedFlavorProd.stock) || 0;

    if (itemQuantity <= 0) {
      setErrorMessage("A quantidade deve ser de no mínimo 1 unidade.");
      return;
    }

    if (maxStock > 0 && itemQuantity > maxStock) {
      setErrorMessage(`Estoque insuficiente! Disponível: ${maxStock} un.`);
      return;
    }

    const existingIdx = items.findIndex((i) => i.productId === currentSelectedFlavorProd.id);
    if (existingIdx >= 0) {
      const updated = [...items];
      const newQty = updated[existingIdx].quantity + itemQuantity;
      if (maxStock > 0 && newQty > maxStock) {
        setErrorMessage(`Não é possível ultrapassar o estoque total de ${maxStock} un.`);
        return;
      }
      updated[existingIdx].quantity = newQty;
      updated[existingIdx].price = unitPrice;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: currentSelectedFlavorProd.id,
          brand: currentSelectedFlavorProd.brand,
          modelName: currentSelectedFlavorProd.name,
          flavor: currentSelectedFlavorProd.flavor || "",
          quantity: itemQuantity,
          price: unitPrice,
          costPrice: Number(currentSelectedFlavorProd.cost_price) || 0,
          maxStock: maxStock,
          image_url: currentSelectedFlavorProd.image_url,
        },
      ]);
    }

    // Resetar campos de seleção
    setSelectedFlavorId("");
    setFlavorSearch("");
    setItemQuantity(1);
    setCustomPrice("");
    setErrorMessage("");
  };

  // Alterar quantidade de item no carrinho
  const handleUpdateItemQuantity = (index: number, delta: number) => {
    const updated = [...items];
    const item = updated[index];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    if (item.maxStock > 0 && newQty > item.maxStock) {
      setErrorMessage(`Estoque máximo para este sabor é de ${item.maxStock} un.`);
      return;
    }

    item.quantity = newQty;
    setItems(updated);
    setErrorMessage("");
  };

  // Remover item do carrinho
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculos Financeiros
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [items]);

  const totalCost = useMemo(() => {
    return items.reduce((acc, item) => acc + item.costPrice * item.quantity, 0);
  }, [items]);

  const totalPodsCount = useMemo(() => {
    return items.reduce((acc, item) => acc + item.quantity, 0);
  }, [items]);

  const numericShippingFee = parseFloat(shippingFee.replace(",", ".")) || 0;
  const numericShippingCost = parseFloat(shippingCost.replace(",", ".")) || 0;
  const grandTotal = subtotal + numericShippingFee;
  const estimatedProfit = subtotal - totalCost + (numericShippingFee - numericShippingCost);

  // Validação para avançar do Passo 1 para o Passo 2
  const handleProceedToProducts = () => {
    setErrorMessage("");
    if (!clientName.trim()) {
      setErrorMessage("Por favor, informe ou selecione o cliente.");
      return;
    }
    setCurrentStep("PRODUCTS");
  };

  // Validação para avançar do Passo 2 para o Passo 3
  const handleProceedToPayment = () => {
    setErrorMessage("");
    // Se o operador selecionou um sabor mas não clicou explicitamente em 'Adicionar'
    if (items.length === 0) {
      if (currentSelectedFlavorProd) {
        handleAddItemToCart();
      } else {
        setErrorMessage("Adicione pelo menos 1 pod ao pedido para prosseguir.");
        return;
      }
    }
    setCurrentStep("PAYMENT");
  };

  // FINALIZAR VENDA MANUAL
  const handleSubmitSale = async () => {
    setErrorMessage("");

    if (items.length === 0) {
      setErrorMessage("Por favor, adicione ao menos um pod ao pedido.");
      return;
    }

    if (!clientName.trim()) {
      setErrorMessage("Por favor, preencha o nome do cliente.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Processar dados de contato
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

      // 2. Preservar customer_id ou cadastrar novo cliente em smoking_clients
      let finalCustomerId: string | null = selectedCustomerId;

      try {
        if (finalCustomerId) {
          // Cliente existente selecionado: atualiza apenas os campos necessários SEM duplicar
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
            console.warn("[MobileManualSaleFlow] Aviso ao atualizar cliente existente:", clientErr.message);
          }
        } else {
          // Novo cliente digitado manualmente
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
            console.warn("[MobileManualSaleFlow] Aviso ao cadastrar novo cliente:", newClientErr.message);
          }
        }
      } catch (custErr) {
        console.error("❌ Exceção ao salvar cliente no CRM:", custErr);
        clientSaveWarning = "Não foi possível sincronizar o cadastro do cliente.";
      }

      // 3. Formatar itens do pedido no padrão smoking_orders
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
          ...(isNationalSale && {
            is_national: true,
            national_state: nationalState,
            national_city: nationalCity.trim() || undefined,
            tracking_code: nationalTrackingCode.trim().toUpperCase() || undefined,
            shipping_cost_real: numericShippingCost || undefined,
          }),
        };
      });

      // Mapear método de pagamento para as constraints do Supabase ('PIX' | 'CREDITO_LINK')
      const safePaymentMethod = paymentMethod === "CARTAO" ? "CREDITO_LINK" : "PIX";

      // 4. Inserir Pedido Pago em smoking_orders
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

      let { error: orderErr } = await supabase
        .from("smoking_orders")
        .insert(payload)
        .select("id")
        .single();

      if (orderErr) {
        if (orderErr.message?.includes("delivery_status")) {
          payload.delivery_status = "PREPARANDO";
        }
        if (orderErr.message?.includes("payment_method")) {
          payload.payment_method = "PIX";
        }

        const retryRes = await supabase
          .from("smoking_orders")
          .insert(payload)
          .select("id")
          .single();
        orderErr = retryRes.error;
      }

      if (orderErr) {
        throw new Error(`Erro ao salvar pedido: ${orderErr.message}`);
      }

      // 5. Abater estoque em smoking_products para cada item vendido
      for (const item of items) {
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

            console.log(`[MobileManualSaleFlow] Baixa de estoque ${item.modelName} - ${item.flavor}: ${currentStock} -> ${newStock}`);
          }
        } catch (stockErr) {
          console.error("Erro ao abater estoque do produto:", stockErr);
        }
      }

      // 6. Lista de Transmissão de Marketing (se habilitado)
      if (autoAddToMarketingList && cleanPhone && !isNoWhatsApp && !formattedPhone.startsWith("INSTA_")) {
        try {
          await ensureBuyerInBroadcastList({
            companyId,
            clientName: clientName.trim(),
            clientPhone: formattedPhone,
          });
        } catch (mktErr) {
          console.warn("Aviso ao incluir cliente na lista de marketing:", mktErr);
        }
      }

      // 7. Notificação Push Celular dos Sócios (Fire-and-Forget)
      void notifyMobileSale({
        companyId,
        clientName: clientName.trim(),
        items,
        totalAmount: grandTotal,
        estimatedProfit,
        paymentMethod,
        isNationalSale,
        nationalState: isNationalSale ? nationalState : undefined,
      });

      // 8. Gravar resumo e mudar para a tela de Sucesso
      setSuccessInfo({
        clientName: clientName.trim(),
        totalAmount: grandTotal,
        itemsCount: totalPodsCount,
        paymentMethod: paymentMethod === "CARTAO" ? "Cartão" : paymentMethod === "DINHEIRO" ? "Dinheiro" : "PIX",
      });

      setCurrentStep("SUCCESS");
      onSaleSuccess();
    } catch (err: any) {
      console.error("Erro ao finalizar venda manual mobile:", err);
      setErrorMessage(err.message || "Ocorreu um erro ao registrar a venda.");
    } finally {
      setSubmitting(false);
    }
  };

  // Resetar tudo para iniciar uma nova venda
  const handleResetForNewSale = () => {
    setCurrentStep("CLIENT");
    setItems([]);
    setSelectedCustomerId(null);
    setClientName("");
    setClientPhone("");
    setIsNoWhatsApp(false);
    setShippingAddress("");
    setClientSearchQuery("");
    setIsCreatingNewClient(false);
    setSelectedModelKey("");
    setModelSearch("");
    setSelectedFlavorId("");
    setFlavorSearch("");
    setItemQuantity(1);
    setCustomPrice("");
    setPaymentMethod("PIX");
    setShippingFee("0");
    setShippingCost("0");
    setIsNationalSale(false);
    setSuccessInfo(null);
    setErrorMessage("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0d0d0f] text-white flex flex-col h-[100dvh] w-full overflow-hidden select-none animate-in fade-in duration-200">
      {/* ========================================================
          CABEÇALHO FIXO FULLSCREEN MOBILE COM ETAPAS
         ======================================================== */}
      <header className="shrink-0 bg-[#121215] border-b border-white/10 px-4 pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {currentStep !== "CLIENT" && currentStep !== "SUCCESS" ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === "PRODUCTS") setCurrentStep("CLIENT");
                  if (currentStep === "PAYMENT") setCurrentStep("PRODUCTS");
                }}
                className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform"
                aria-label="Voltar"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <div className="size-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShoppingCart className="size-4" />
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight">
                {currentStep === "CLIENT" && "Registrar Venda • Cliente"}
                {currentStep === "PRODUCTS" && "Registrar Venda • Pods"}
                {currentStep === "PAYMENT" && "Registrar Venda • Pagamento"}
                {currentStep === "SUCCESS" && "Venda Concluída"}
              </h1>
              <p className="text-[11px] text-zinc-400 font-medium leading-none mt-0.5">
                {currentStep === "CLIENT" && "Passo 1 de 3"}
                {currentStep === "PRODUCTS" && `Passo 2 de 3 • ${totalPodsCount} pod(s)`}
                {currentStep === "PAYMENT" && `Passo 3 de 3 • R$ ${grandTotal.toFixed(2)}`}
                {currentStep === "SUCCESS" && "Estoque e CRM atualizados"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white active:scale-95 transition-all"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Indicador de Progresso (Passos) */}
        {currentStep !== "SUCCESS" && (
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentStep === "CLIENT" || currentStep === "PRODUCTS" || currentStep === "PAYMENT"
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  : "bg-white/10"
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentStep === "PRODUCTS" || currentStep === "PAYMENT"
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  : "bg-white/10"
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentStep === "PAYMENT"
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  : "bg-white/10"
              }`}
            />
          </div>
        )}
      </header>

      {/* ========================================================
          CORPO ROLÁVEL COM CONTEÚDO DA ETAPA ATUAL
         ======================================================== */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
        {/* Mensagem de Erro Geral */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <span className="size-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <p className="flex-1 leading-snug">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="text-rose-400 hover:text-white p-1"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================
            ETAPA 1: CLIENTE (Pesquisa Inteligente & Novo Cadastro)
           ======================================================== */}
        {currentStep === "CLIENT" && (
          <div className="space-y-4">
            {/* Se um cliente já estiver selecionado */}
            {clientName && selectedCustomerId ? (
              <div className="bg-[#151518] border border-emerald-500/30 rounded-2xl p-4 space-y-3 shadow-[0_0_20px_rgba(16,185,129,0.06)] animate-in fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <User className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block mb-1">
                        Cliente Selecionado (CRM)
                      </span>
                      <h3 className="text-base font-bold text-white truncate leading-tight">
                        {clientName}
                      </h3>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">
                        {isNoWhatsApp ? "Instagram / Sem WhatsApp" : formatDisplayPhone(clientPhone)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearClient}
                    className="shrink-0 text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 border border-white/10 px-3 py-2 rounded-xl active:scale-95 transition-all"
                  >
                    Trocar
                  </button>
                </div>

                {shippingAddress && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-xs text-zinc-400">
                    <MapPin className="size-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate">{shippingAddress}</span>
                  </div>
                )}
              </div>
            ) : isCreatingNewClient ? (
              /* Formulário Limpo de Novo Cliente */
              <div className="bg-[#151518] border border-white/10 rounded-2xl p-4 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">
                    Novo Cliente
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewClient(false)}
                    className="text-xs text-zinc-400 hover:text-white py-1 px-2 rounded-lg bg-white/5"
                  >
                    Voltar para Busca
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Nome do Cliente <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ex: Lucas Ferreira"
                      className="w-full bg-[#1c1c20] border border-white/10 rounded-xl px-3.5 py-3 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                      autoFocus
                    />
                  </div>

                  {!isNoWhatsApp && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        WhatsApp (com DDD)
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="Ex: 11 99999-8888"
                        className="w-full bg-[#1c1c20] border border-white/10 rounded-xl px-3.5 py-3 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isNoWhatsApp}
                      onChange={(e) => setIsNoWhatsApp(e.target.checked)}
                      className="size-5 rounded-md accent-emerald-500 bg-[#1c1c20] border-white/20"
                    />
                    <span className="text-xs text-zinc-300 font-medium">
                      Cliente veio do Instagram (Sem WhatsApp)
                    </span>
                  </label>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Endereço / Bairro (Opcional)
                    </label>
                    <input
                      type="text"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="Ex: Itaim Bibi, SP ou Balcão"
                      className="w-full bg-[#1c1c20] border border-white/10 rounded-xl px-3.5 py-3 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Busca Inteligente no CRM */
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    placeholder="Digite o nome ou telefone do cliente..."
                    className="w-full bg-[#151518] border border-white/10 rounded-2xl pl-10 pr-10 py-3.5 text-base text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                  {clientSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setClientSearchQuery("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 size-6 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Lista de Resultados Encontrados */}
                {clientSearchQuery.trim() ? (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                      Clientes encontrados ({rankedClients.length})
                    </span>

                    {rankedClients.length > 0 ? (
                      <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1 custom-scrollbar">
                        {rankedClients.slice(0, 15).map((client) => (
                          <div
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className="bg-[#151518] active:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 shrink-0">
                                <User className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-white truncate leading-tight">
                                  {client.name}
                                </h4>
                                <p className="text-xs text-zinc-400 truncate mt-0.5">
                                  {formatDisplayPhone(client.phone)}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="size-4 text-zinc-500 shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-[#151518] border border-white/10 rounded-2xl p-5 text-center space-y-3">
                        <p className="text-xs text-zinc-400">
                          Nenhum cliente cadastrado com o termo "{clientSearchQuery}".
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setClientName(clientSearchQuery.trim());
                            setIsCreatingNewClient(true);
                            setClientSearchQuery("");
                          }}
                          className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-all"
                        >
                          <Plus className="size-4" />
                          <span>Cadastrar "{clientSearchQuery.trim()}"</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Sugestões Recentes ou Botão de Novo Cliente */
                  <div className="space-y-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewClient(true)}
                      className="w-full bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-2xl p-4 flex items-center justify-center gap-2.5 text-zinc-300 font-semibold text-xs active:scale-98 transition-all"
                    >
                      <Plus className="size-4 text-emerald-400" />
                      <span>Cadastrar Novo Cliente Manualmente</span>
                    </button>

                    {clientsList.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                          Clientes Cadastrados Recentes
                        </span>
                        <div className="space-y-1.5 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar">
                          {clientsList.slice(0, 5).map((client) => (
                            <div
                              key={client.id}
                              onClick={() => handleSelectClient(client)}
                              className="bg-[#151518]/70 border border-white/5 hover:border-white/15 p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer active:scale-98 transition-all"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate leading-tight">
                                  {client.name}
                                </p>
                                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                  {formatDisplayPhone(client.phone)}
                                </p>
                              </div>
                              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                Selecionar
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            ETAPA 2: PRODUTOS & SABORES (Seleção Compacta + Carrinho)
           ======================================================== */}
        {currentStep === "PRODUCTS" && (
          <div className="space-y-4">
            {/* Resumo do Cliente Selecionado */}
            <div className="bg-[#151518] border border-white/10 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <User className="size-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-white truncate">
                  {clientName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep("CLIENT")}
                className="text-[11px] text-zinc-400 hover:text-white shrink-0 font-medium underline"
              >
                Alterar
              </button>
            </div>

            {/* SELEÇÃO DO MODELO */}
            <div className="bg-[#151518] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-400 flex items-center gap-2">
                  <Package className="size-3.5 text-emerald-400" />
                  1. Modelo do Pod
                </span>
                {selectedModelKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModelKey("");
                      setSelectedFlavorId("");
                      setFlavorSearch("");
                    }}
                    className="text-[11px] text-zinc-400 hover:text-white font-medium"
                  >
                    Trocar modelo
                  </button>
                )}
              </div>

              {!selectedModelKey ? (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="Buscar modelo (ex: Ignite, Elfbar, Life)..."
                      className="w-full bg-[#1c1c20] border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                    {filteredModels.map((m) => (
                      <div
                        key={m.key}
                        onClick={() => {
                          setSelectedModelKey(m.key);
                          setSelectedFlavorId("");
                          setFlavorSearch("");
                        }}
                        className="bg-[#1c1c20] border border-white/5 hover:border-emerald-500/40 p-3 rounded-xl flex items-center justify-between cursor-pointer active:scale-98 transition-all"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-white leading-tight">
                            {m.label}
                          </h4>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {m.flavorCount} sabores • {m.totalStock} un. em estoque
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-zinc-500" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Modelo Selecionado com destaque */
                <div className="bg-[#1c1c20] border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Modelo Selecionado
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5">
                      {availableModels.find((m) => m.key === selectedModelKey)?.label}
                    </h4>
                  </div>
                  <Check className="size-4 text-emerald-400" />
                </div>
              )}
            </div>

            {/* SELEÇÃO DO SABOR (Apenas após o modelo estar selecionado) */}
            {selectedModelKey && (
              <div className="bg-[#151518] border border-white/10 rounded-2xl p-4 space-y-3 animate-in fade-in">
                <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-400 flex items-center gap-2">
                  <Sparkles className="size-3.5 text-emerald-400" />
                  2. Escolha o Sabor
                </span>

                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={flavorSearch}
                      onChange={(e) => setFlavorSearch(e.target.value)}
                      placeholder="Filtrar sabor..."
                      className="w-full bg-[#1c1c20] border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[32vh] overflow-y-auto pr-1 custom-scrollbar">
                    {filteredFlavors.map((flavor) => {
                      const isSelected = selectedFlavorId === flavor.id;
                      const stockNum = Number(flavor.stock) || 0;
                      const isOutOfStock = stockNum <= 0;

                      return (
                        <div
                          key={flavor.id}
                          onClick={() => {
                            if (isOutOfStock) return;
                            setSelectedFlavorId(flavor.id);
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                            isOutOfStock
                              ? "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"
                              : isSelected
                              ? "bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)] cursor-pointer"
                              : "bg-[#1c1c20] border-white/5 hover:border-white/20 active:scale-98 cursor-pointer"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <h5 className="text-xs font-bold text-white truncate leading-tight">
                              {flavor.flavor || "Sabor Único"}
                            </h5>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isOutOfStock
                                    ? "bg-rose-500/10 text-rose-400"
                                    : "bg-emerald-500/10 text-emerald-400"
                                }`}
                              >
                                {isOutOfStock ? "Esgotado" : `${stockNum} un.`}
                              </span>
                              <span className="text-[11px] font-semibold text-zinc-300">
                                R$ {Number(flavor.price || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {isSelected ? (
                            <div className="size-6 rounded-full bg-emerald-500 flex items-center justify-center text-black shrink-0">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="size-6 rounded-full border border-white/20 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Painel de Quantidade & Preço após selecionar o sabor */}
                {currentSelectedFlavorProd && (
                  <div className="pt-3 border-t border-white/10 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-3 items-end">
                      {/* Stepper de Quantidade (44px min touch) */}
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                          Quantidade
                        </label>
                        <div className="flex items-center bg-[#1c1c20] border border-white/10 rounded-xl overflow-hidden h-11">
                          <button
                            type="button"
                            onClick={() => setItemQuantity((prev) => Math.max(1, prev - 1))}
                            disabled={itemQuantity <= 1}
                            className="size-11 flex items-center justify-center text-white hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="size-4" />
                          </button>
                          <span className="flex-1 text-center font-extrabold text-sm text-white">
                            {itemQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const max = Number(currentSelectedFlavorProd.stock) || 999;
                              setItemQuantity((prev) => (prev < max ? prev + 1 : prev));
                            }}
                            disabled={itemQuantity >= (Number(currentSelectedFlavorProd.stock) || 1)}
                            className="size-11 flex items-center justify-center text-white hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>

                      {/* Preço Unitário Editável */}
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                          Preço Un. (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value)}
                          placeholder="0,00"
                          className="w-full bg-[#1c1c20] border border-white/10 rounded-xl px-3 h-11 text-base font-bold text-white focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItemToCart}
                      className="w-full h-12 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
                    >
                      <Plus className="size-4 text-emerald-400" />
                      <span>Adicionar Pod ao Pedido</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CARRINHO DE ITENS ADICIONADOS */}
            {items.length > 0 && (
              <div className="bg-[#151518] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <ShoppingCart className="size-3.5" />
                    Carrinho ({totalPodsCount} pods)
                  </span>
                  <span className="text-xs font-black text-white">
                    Subtotal: R$ {subtotal.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                  {items.map((item, idx) => (
                    <div
                      key={`${item.productId}-${idx}`}
                      className="bg-[#1c1c20] border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <h5 className="text-xs font-bold text-white truncate leading-tight">
                          {item.brand} {item.modelName}
                        </h5>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {item.flavor} • R$ {item.price.toFixed(2)} un.
                        </p>
                        <p className="text-xs font-black text-emerald-400 mt-1">
                          R$ {(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>

                      {/* Controles de Quantidade no Carrinho */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center bg-black/40 border border-white/10 rounded-lg overflow-hidden h-9">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQuantity(idx, -1)}
                            className="size-9 flex items-center justify-center text-zinc-400 hover:text-white"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="px-2 text-xs font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQuantity(idx, 1)}
                            className="size-9 flex items-center justify-center text-zinc-400 hover:text-white"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="size-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 hover:text-rose-300"
                          aria-label="Remover item"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            ETAPA 3: PAGAMENTO & FINALIZAÇÃO
           ======================================================== */}
        {currentStep === "PAYMENT" && (
          <div className="space-y-4">
            {/* Resumo do Pedido */}
            <div className="bg-[#151518] border border-white/10 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-[11px] uppercase font-bold tracking-wider text-zinc-400">
                  Cliente
                </span>
                <span className="text-xs font-bold text-white truncate max-w-[180px]">
                  {clientName}
                </span>
              </div>

              <div className="space-y-1.5 py-1">
                <span className="text-[11px] uppercase font-bold tracking-wider text-zinc-400 block">
                  Itens Selecionados ({totalPodsCount} un.)
                </span>
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 truncate max-w-[200px]">
                      {item.quantity}x {item.modelName} ({item.flavor})
                    </span>
                    <span className="font-semibold text-white">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* SELEÇÃO DA FORMA DE PAGAMENTO (Grandes Touch Targets) */}
            <div className="bg-[#151518] border border-white/10 rounded-2xl p-4 space-y-3">
              <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-400 block">
                Forma de Pagamento
              </span>

              <div className="grid grid-cols-3 gap-2.5">
                {/* PIX */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("PIX")}
                  className={`min-h-[58px] rounded-2xl border p-2.5 flex flex-col items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "PIX"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      : "bg-[#1c1c20] border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <QrCode className="size-5" />
                  <span className="text-xs font-bold">PIX</span>
                </button>

                {/* DINHEIRO */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("DINHEIRO")}
                  className={`min-h-[58px] rounded-2xl border p-2.5 flex flex-col items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "DINHEIRO"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      : "bg-[#1c1c20] border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Banknote className="size-5" />
                  <span className="text-xs font-bold">Dinheiro</span>
                </button>

                {/* CARTÃO */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CARTAO")}
                  className={`min-h-[58px] rounded-2xl border p-2.5 flex flex-col items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "CARTAO"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      : "bg-[#1c1c20] border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <CreditCard className="size-5" />
                  <span className="text-xs font-bold">Cartão</span>
                </button>
              </div>
            </div>

            {/* MAIS OPÇÕES: FRETE & VENDA NACIONAL (Acordeão Retrátil) */}
            <div className="bg-[#151518] border border-white/10 rounded-2xl overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setShowMoreOptions((prev) => !prev)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Truck className="size-4 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      Mais Opções: Frete & Venda Nacional
                    </h4>
                    <p className="text-[10px] text-zinc-400">
                      {numericShippingFee > 0 || isNationalSale
                        ? `Frete: R$ ${numericShippingFee.toFixed(2)}${isNationalSale ? ` • Nacional (${nationalState})` : ""}`
                        : "Taxa motoboy, custo real ou envio Correios"}
                    </p>
                  </div>
                </div>
                {showMoreOptions ? (
                  <ChevronUp className="size-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="size-4 text-zinc-400" />
                )}
              </button>

              {showMoreOptions && (
                <div className="p-4 pt-1 border-t border-white/5 space-y-3.5 bg-black/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        Frete Cobrado (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={shippingFee}
                        onChange={(e) => setShippingFee(e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-[#1c1c20] border border-white/10 rounded-xl px-3 py-2.5 text-base text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        Custo do Frete (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={shippingCost}
                        onChange={(e) => setShippingCost(e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-[#1c1c20] border border-white/10 rounded-xl px-3 py-2.5 text-base text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>

                  {/* Venda Nacional Toggle */}
                  <label className="flex items-center gap-3 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isNationalSale}
                      onChange={(e) => setIsNationalSale(e.target.checked)}
                      className="size-5 rounded-md accent-emerald-500 bg-[#1c1c20] border-white/20"
                    />
                    <span className="text-xs text-zinc-300 font-semibold">
                      Venda Nacional (Fora de SP / Correios)
                    </span>
                  </label>

                  {isNationalSale && (
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                            Estado (UF)
                          </label>
                          <select
                            value={nationalState}
                            onChange={(e) => setNationalState(e.target.value)}
                            className="w-full bg-[#1c1c20] border border-white/10 rounded-xl px-3 py-2.5 text-base text-white focus:outline-none focus:border-emerald-500/50"
                          >
                            {BRAZILIAN_STATES.map((st) => (
                              <option key={st.uf} value={st.uf}>
                                {st.uf} - {st.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                            Cidade
                          </label>
                          <input
                            type="text"
                            value={nationalCity}
                            onChange={(e) => setNationalCity(e.target.value)}
                            placeholder="Ex: Niterói"
                            className="w-full bg-[#1c1c20] border border-white/10 rounded-xl px-3 py-2.5 text-base text-white focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                          Código de Rastreio (Opcional)
                        </label>
                        <input
                          type="text"
                          value={nationalTrackingCode}
                          onChange={(e) => setNationalTrackingCode(e.target.value)}
                          placeholder="Ex: BR123456789BR"
                          className="w-full bg-[#1c1c20] border border-white/10 rounded-xl px-3 py-2.5 text-base text-white uppercase focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TOTAL & LUCRO ESTIMADO */}
            <div className="bg-[#151518] border border-emerald-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Subtotal Produtos</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {numericShippingFee > 0 && (
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Frete Cobrado</span>
                  <span>+ R$ {numericShippingFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-2 border-t border-white/10">
                <span className="text-sm font-extrabold text-white">TOTAL A COBRAR</span>
                <span className="text-2xl font-black text-emerald-400">
                  R$ {grandTotal.toFixed(2)}
                </span>
              </div>
              {estimatedProfit > 0 && (
                <div className="text-[11px] text-zinc-500 text-right font-medium">
                  Margem de lucro est.: R$ {estimatedProfit.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            ETAPA 4: SUCESSO & RECIBO
           ======================================================== */}
        {currentStep === "SUCCESS" && successInfo && (
          <div className="py-8 px-2 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="size-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
              <CheckCircle2 className="size-10" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-white tracking-tight">
                Venda Registrada com Sucesso!
              </h2>
              <p className="text-xs text-zinc-400 max-w-[260px] mx-auto">
                Estoque abatido automaticamente e cliente atualizado no CRM.
              </p>
            </div>

            {/* Card com Detalhes da Venda */}
            <div className="bg-[#151518] border border-white/10 rounded-2xl p-4 w-full max-w-sm text-left space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Cliente</span>
                <span className="font-bold text-white truncate max-w-[170px]">
                  {successInfo.clientName}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Quantidade</span>
                <span className="font-bold text-white">
                  {successInfo.itemsCount} pod(s)
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Pagamento</span>
                <span className="font-bold text-emerald-400">
                  {successInfo.paymentMethod}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                <span className="font-extrabold text-white">Total Pago</span>
                <span className="font-black text-emerald-400">
                  R$ {successInfo.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Ações pós-venda */}
            <div className="w-full max-w-sm space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleResetForNewSale}
                className="w-full h-12 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <Plus className="size-4 text-emerald-400" />
                <span>Registrar Outra Venda</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSaleSuccess();
                  onClose();
                }}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-98 transition-all"
              >
                Concluir e Voltar
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          BARRA DE AÇÃO FIXA INFERIOR (Safe-Area & Botões Grandes)
         ======================================================== */}
      {currentStep !== "SUCCESS" && (
        <footer className="shrink-0 bg-[#121215]/95 backdrop-blur-md border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {currentStep === "CLIENT" && (
            <button
              type="button"
              onClick={handleProceedToProducts}
              disabled={!clientName.trim()}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:pointer-events-none text-black font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-98 transition-all"
            >
              <span>Avançar para Pods</span>
              <ChevronRight className="size-4" />
            </button>
          )}

          {currentStep === "PRODUCTS" && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={items.length === 0 && !currentSelectedFlavorProd}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:pointer-events-none text-black font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-98 transition-all"
              >
                <span>
                  {items.length > 0
                    ? `Ir para Pagamento (R$ ${subtotal.toFixed(2)})`
                    : "Adicionar Pod e Prosseguir"}
                </span>
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}

          {currentStep === "PAYMENT" && (
            <button
              type="button"
              disabled={submitting || items.length === 0}
              onClick={handleSubmitSale}
              className="w-full h-13 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-40 disabled:pointer-events-none text-black font-black text-sm rounded-xl flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-98 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-5 animate-spin text-black" />
                  <span>Finalizando e Baixando Estoque...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5" />
                  <span>Concluir Venda (R$ {grandTotal.toFixed(2)})</span>
                </>
              )}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
