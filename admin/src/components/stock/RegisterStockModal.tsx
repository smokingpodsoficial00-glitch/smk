import React, { useState, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  PackagePlus,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Boxes,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Info
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { updateProductCost, fetchProductCostsMap } from "@/lib/productCosts";
import { createStockRepurchase } from "@/lib/stockRepurchases";

export interface StockEntryItem {
  id: string;
  productId?: string; // id existente em smoking_products se houver
  brand: string;
  model: string;
  flavor: string;
  qty: number;
  unitCost: number;
  previousCost: number | null;
  unitSell: number;
  currentStock: number;
  isNewProduct?: boolean;
}

interface RegisterStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
  products: any[];
  costsMap?: Record<string, number>;
  onSuccess: () => void;
}

export function RegisterStockModal({
  isOpen,
  onClose,
  companyId,
  products = [],
  costsMap = {},
  onSuccess
}: RegisterStockModalProps) {
  const targetCompanyId = companyId || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

  // Lista de mercadorias que estão sendo registradas nesta remessa de compra
  const [items, setItems] = useState<StockEntryItem[]>([]);

  // Campos do formulário de adição rápida
  const [searchModelQuery, setSearchModelQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedFlavor, setSelectedFlavor] = useState("");
  const [customFlavorInput, setCustomFlavorInput] = useState("");
  const [quantity, setQuantity] = useState<string>("5");
  const [unitCostInput, setUnitCostInput] = useState<string>("");
  const [unitSellInput, setUnitSellInput] = useState<string>("");
  const [matchedProductId, setMatchedProductId] = useState<string | null>(null);
  const [previousCost, setPreviousCost] = useState<number | null>(null);
  const [currentStockForFlavor, setCurrentStockForFlavor] = useState<number>(0);
  const [isNewProductMode, setIsNewProductMode] = useState(false);

  // Campos gerais da remessa
  const [supplierNotes, setSupplierNotes] = useState("");
  const [freightAmountInput, setFreightAmountInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    totalUnits: number;
    totalInvested: number;
    projectedProfit: number;
  } | null>(null);

  // Agrupamento dos produtos existentes para sugestão inteligente
  const modelCatalog = useMemo(() => {
    const map = new Map<string, {
      key: string;
      brand: string;
      model: string;
      flavors: { id: string; flavor: string; stock: number; price: number; cost: number }[];
      defaultPrice: number;
      defaultCost: number;
    }>();

    products.forEach((p) => {
      const brand = (p.brand || "").trim();
      const model = (p.name || "").trim();
      if (!model || brand === "__STORE_CONFIG__") return;

      const groupKey = `${brand.toLowerCase()}__${model.toLowerCase()}`;
      const costKey = `${brand.toLowerCase()}-${model.toLowerCase()}`;
      const rawCost = costsMap[p.id] || costsMap[costKey] || parseFloat(p.cost_price) || 0;
      const price = parseFloat(p.price) || 0;
      const stock = parseInt(p.stock) || 0;
      const flavor = (p.flavor || "").trim();

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          brand,
          model,
          flavors: [],
          defaultPrice: price,
          defaultCost: rawCost
        });
      }

      const entry = map.get(groupKey)!;
      if (flavor) {
        entry.flavors.push({
          id: p.id,
          flavor,
          stock,
          price,
          cost: rawCost
        });
      }
      if (price > 0 && entry.defaultPrice === 0) entry.defaultPrice = price;
      if (rawCost > 0 && entry.defaultCost === 0) entry.defaultCost = rawCost;
    });

    return Array.from(map.values());
  }, [products, costsMap]);

  // Modelos filtrados na pesquisa inteligente
  const filteredModels = useMemo(() => {
    const q = searchModelQuery.trim().toLowerCase();
    if (!q) return modelCatalog.slice(0, 8);
    return modelCatalog
      .filter((m) => `${m.brand} ${m.model}`.toLowerCase().includes(q))
      .slice(0, 10);
  }, [searchModelQuery, modelCatalog]);

  // Quando o operador seleciona um modelo da lista existente
  const handleSelectModel = (modelData: typeof modelCatalog[0]) => {
    setSelectedBrand(modelData.brand);
    setSelectedModel(modelData.model);
    setSearchModelQuery(`${modelData.brand} ${modelData.model}`);
    setIsNewProductMode(false);

    // Custo anterior e preço de venda atual
    const cost = modelData.defaultCost > 0 ? modelData.defaultCost : null;
    setPreviousCost(cost);
    setUnitCostInput(cost ? String(cost) : "");
    setUnitSellInput(modelData.defaultPrice > 0 ? String(modelData.defaultPrice) : "");

    // Se tiver apenas 1 sabor, já seleciona
    if (modelData.flavors.length === 1) {
      setSelectedFlavor(modelData.flavors[0].flavor);
      setMatchedProductId(modelData.flavors[0].id);
      setCurrentStockForFlavor(modelData.flavors[0].stock);
    } else {
      setSelectedFlavor("");
      setMatchedProductId(null);
      setCurrentStockForFlavor(0);
    }
  };

  // Quando o operador escolhe criar um modelo novo
  const handleCreateNewModel = () => {
    const q = searchModelQuery.trim();
    if (!q) return;

    // Tenta separar a primeira palavra como marca se houver espaço
    const parts = q.split(" ");
    let brand = "Outros";
    let model = q;
    if (parts.length > 1) {
      brand = parts[0];
      model = parts.slice(1).join(" ");
    }

    setSelectedBrand(brand);
    setSelectedModel(model);
    setIsNewProductMode(true);
    setSelectedFlavor("");
    setMatchedProductId(null);
    setPreviousCost(null);
    setUnitCostInput("");
    setUnitSellInput("");
    setCurrentStockForFlavor(0);
  };

  // Quando escolhe um sabor existente do modelo
  const handleSelectFlavor = (flavorName: string) => {
    setSelectedFlavor(flavorName);
    setCustomFlavorInput("");

    const currentModelEntry = modelCatalog.find(
      (m) =>
        m.brand.toLowerCase() === selectedBrand.toLowerCase() &&
        m.model.toLowerCase() === selectedModel.toLowerCase()
    );

    if (currentModelEntry) {
      const flv = currentModelEntry.flavors.find(
        (f) => f.flavor.toLowerCase() === flavorName.toLowerCase()
      );
      if (flv) {
        setMatchedProductId(flv.id);
        setCurrentStockForFlavor(flv.stock);
        if (flv.price > 0 && !unitSellInput) setUnitSellInput(String(flv.price));
        if (flv.cost > 0 && !unitCostInput) setUnitCostInput(String(flv.cost));
        return;
      }
    }
    setMatchedProductId(null);
    setCurrentStockForFlavor(0);
  };

  // Sabores disponíveis para o modelo atualmente selecionado
  const availableFlavorsForModel = useMemo(() => {
    if (!selectedBrand || !selectedModel) return [];
    const entry = modelCatalog.find(
      (m) =>
        m.brand.toLowerCase() === selectedBrand.toLowerCase() &&
        m.model.toLowerCase() === selectedModel.toLowerCase()
    );
    return entry ? entry.flavors : [];
  }, [selectedBrand, selectedModel, modelCatalog]);

  // Cálculos dinâmicos da peça no formulário
  const parsedUnitCost = parseFloat(unitCostInput.replace(",", ".")) || 0;
  const parsedUnitSell = parseFloat(unitSellInput.replace(",", ".")) || 0;
  const parsedQty = parseInt(quantity) || 0;
  const unitProfit = parsedUnitSell > 0 && parsedUnitCost > 0 ? parsedUnitSell - parsedUnitCost : 0;
  const markupPercent = parsedUnitCost > 0 ? (unitProfit / parsedUnitCost) * 100 : 0;
  const costDiff = previousCost !== null && parsedUnitCost > 0 ? parsedUnitCost - previousCost : null;
  const costDiffPercent = previousCost && previousCost > 0 && costDiff !== null ? (costDiff / previousCost) * 100 : null;

  // Adicionar item ao lote da compra
  const handleAddItem = () => {
    if (!selectedModel.trim()) {
      alert("Por favor, selecione ou digite o modelo do produto.");
      return;
    }
    const finalFlavor = selectedFlavor.trim() || customFlavorInput.trim() || "Sabor Padrão";
    if (parsedQty <= 0) {
      alert("Informe uma quantidade válida maior que zero.");
      return;
    }
    if (parsedUnitCost <= 0) {
      alert("Informe o custo unitário pago nesta compra.");
      return;
    }
    if (parsedUnitSell <= 0) {
      alert("Informe o preço de venda para este produto.");
      return;
    }

    const newItem: StockEntryItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productId: matchedProductId || undefined,
      brand: selectedBrand.trim() || "Outros",
      model: selectedModel.trim(),
      flavor: finalFlavor,
      qty: parsedQty,
      unitCost: parsedUnitCost,
      previousCost: previousCost,
      unitSell: parsedUnitSell,
      currentStock: currentStockForFlavor,
      isNewProduct: isNewProductMode || !matchedProductId
    };

    setItems((prev) => [newItem, ...prev]);

    // Reseta apenas os campos de sabor e quantidade, mantendo o modelo caso queira adicionar outro sabor do mesmo pod
    setSelectedFlavor("");
    setCustomFlavorInput("");
    setQuantity("5");
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Cálculos do Lote Total
  const totalUnits = useMemo(() => items.reduce((acc, it) => acc + it.qty, 0), [items]);
  const totalCost = useMemo(() => items.reduce((acc, it) => acc + it.qty * it.unitCost, 0), [items]);
  const totalProjectedRevenue = useMemo(() => items.reduce((acc, it) => acc + it.qty * it.unitSell, 0), [items]);
  const parsedFreight = parseFloat(freightAmountInput.replace(",", ".")) || 0;
  const totalInvestedWithFreight = totalCost + parsedFreight;
  const totalProjectedProfit = totalProjectedRevenue - totalInvestedWithFreight;
  const totalMarkup = totalInvestedWithFreight > 0 ? (totalProjectedProfit / totalInvestedWithFreight) * 100 : 0;

  // Concluir Entrada de Estoque no Supabase
  const handleConfirmStockEntry = async () => {
    if (items.length === 0) {
      alert("Adicione pelo menos um item à compra antes de confirmar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();

      // 1. Processa cada item do lote
      for (const item of items) {
        // A) Se o produto/sabor já existe no Supabase (pelo ID ou pela combinação de marca+modelo+sabor)
        let existingId = item.productId;

        if (!existingId) {
          const { data: found } = await supabase
            .from("smoking_products")
            .select("id, stock")
            .eq("company_id", targetCompanyId)
            .ilike("brand", item.brand)
            .ilike("name", item.model)
            .ilike("flavor", item.flavor)
            .limit(1);

          if (found && found.length > 0) {
            existingId = found[0].id;
          }
        }

        if (existingId) {
          // Busca o estoque atual do banco para garantir soma correta e atômica
          const { data: currentDbRow } = await supabase
            .from("smoking_products")
            .select("stock")
            .eq("id", existingId)
            .single();

          const dbStock = parseInt(currentDbRow?.stock || "0") || 0;
          const newStock = dbStock + item.qty;

          await supabase
            .from("smoking_products")
            .update({
              stock: newStock,
              price: item.unitSell,
              cost_price: item.unitCost,
              created_at: nowIso, // renova data de entrada para zerar "dias parado"
              is_active: true
            })
            .eq("id", existingId)
            .eq("company_id", targetCompanyId);
        } else {
          // B) Produto ou sabor novo -> Inserir novo registro em smoking_products
          await supabase.from("smoking_products").insert({
            company_id: targetCompanyId,
            brand: item.brand,
            name: item.model,
            flavor: item.flavor,
            stock: item.qty,
            price: item.unitSell,
            cost_price: item.unitCost,
            puffs: 10000,
            is_active: true,
            created_at: nowIso
          });
        }

        // C) Atualiza o custo unitário oficial da loja
        try {
          const modelKey = `${item.brand.toLowerCase()}__${item.model.toLowerCase()}`;
          await updateProductCost({
            modelKey,
            productIds: existingId ? [existingId] : [],
            costPrice: item.unitCost,
            companyId: targetCompanyId
          });
        } catch (costErr) {
          console.warn("Aviso ao sincronizar custo:", costErr);
        }
      }

      // 2. Gravar o registro histórico de recompra em smoking_stock_repurchases
      try {
        const repurchaseNotes = supplierNotes.trim()
          ? `${supplierNotes} (${totalUnits} un, ${items.length} itens)`
          : `Entrada rápida de estoque: ${totalUnits} un (${items.length} itens)`;

        await createStockRepurchase({
          companyId: targetCompanyId,
          stock_purchase_amount: totalCost,
          freight_amount: parsedFreight,
          purchase_date: nowIso.split("T")[0],
          notes: repurchaseNotes
        });
      } catch (repurchaseErr) {
        console.warn("Aviso ao salvar histórico de recompra:", repurchaseErr);
      }

      // 3. Exibir Modal de Sucesso
      setSuccessModalData({
        totalUnits,
        totalInvested: totalInvestedWithFreight,
        projectedProfit: totalProjectedProfit
      });

      // Atualiza a tela de estoque
      onSuccess();
    } catch (err: any) {
      console.error("Erro ao registrar entrada de estoque:", err);
      alert(`Erro ao processar entrada de estoque: ${err.message || "Tente novamente."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e0e10] border border-white/15 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-white/10 flex items-center justify-between gap-4 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
              <PackagePlus className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Reposição de Estoque
                </span>
                <span className="text-xs text-white/40">Entrada Rápida</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                Registrar Compra de Mercadorias
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-5 sm:p-7 overflow-y-auto custom-scrollbar space-y-6 flex-1 text-white">

          {/* 1. SEÇÃO: Adicionar Mercadoria ao Lote */}
          <div className="bg-[#121215] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-400" />
                <span>Adicionar Produto Comprado</span>
              </span>
              {selectedModel && (
                <span className="text-[11px] text-emerald-400 font-semibold">
                  {isNewProductMode ? "✨ Produto Novo" : "✓ Encaixado no Catálogo"}
                </span>
              )}
            </div>

            {/* Linha 1: Pesquisa Inteligente de Produto / Modelo */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-white/70 block">
                Pesquisar ou Criar Produto / Modelo:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchModelQuery}
                  onChange={(e) => {
                    setSearchModelQuery(e.target.value);
                    if (selectedModel && e.target.value !== `${selectedBrand} ${selectedModel}`) {
                      setSelectedModel("");
                    }
                  }}
                  placeholder="Ex: Elfbar Ice King 40K, Ignite V50, Lost Mary..."
                  className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                />

                {/* Dropdown de Resultados da Pesquisa Inteligente */}
                {searchModelQuery.trim() && !selectedModel && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto bg-[#16161a] border border-white/15 rounded-2xl shadow-2xl p-1.5 space-y-1">
                    {filteredModels.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => handleSelectModel(m)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between text-xs cursor-pointer group"
                      >
                        <div>
                          <span className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {m.brand} {m.model}
                          </span>
                          <span className="text-[10px] text-white/40 block mt-0.5">
                            {m.flavors.length} sabores cadastrados
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-mono text-emerald-400 font-bold block">
                            {m.defaultCost > 0 ? `Último Custo: R$ ${m.defaultCost.toFixed(2)}` : "Sem custo"}
                          </span>
                          <span className="text-[10px] text-white/40">
                            Venda: R$ {m.defaultPrice.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    ))}

                    {/* Opção de Criar Novo Produto */}
                    <button
                      type="button"
                      onClick={handleCreateNewModel}
                      className="w-full text-left px-3 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Plus className="size-3.5" />
                      <span>Cadastrar novo produto: "{searchModelQuery.trim()}"</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Linha 2: Seleção de Sabor & Quantidade */}
            {selectedModel && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in">
                {/* Sabores */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-white/70 block">
                    Sabor que Chegou:
                  </label>
                  {availableFlavorsForModel.length > 0 && !customFlavorInput ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar p-1">
                        {availableFlavorsForModel.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleSelectFlavor(f.flavor)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              selectedFlavor === f.flavor
                                ? "bg-emerald-500 text-black shadow-md font-bold"
                                : "bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                            }`}
                          >
                            {f.flavor} ({f.stock} un)
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFlavor("");
                          setCustomFlavorInput(" ");
                        }}
                        className="text-[11px] text-emerald-400 hover:underline font-semibold cursor-pointer block"
                      >
                        + Digitar um sabor diferente
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customFlavorInput}
                        onChange={(e) => setCustomFlavorInput(e.target.value)}
                        placeholder="Nome do sabor (Ex: Melancia Ice, Menta...)"
                        className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                      {availableFlavorsForModel.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCustomFlavorInput("")}
                          className="px-2.5 py-1 text-xs text-white/50 hover:text-white cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Quantidade Comprada */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-white/70 block">
                      Quantidade Comprada:
                    </label>
                    {currentStockForFlavor > 0 && (
                      <span className="text-[10px] text-white/50 font-mono">
                        Estoque atual: {currentStockForFlavor} un
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Ex: 5, 10, 20"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Linha 3: Valores Financeiros (Custo Pago, Comparador e Preço de Venda) */}
            {selectedModel && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5 animate-in fade-in">
                {/* Custo Unitário Pago Nesta Compra */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-white/70 block">
                      Custo Unitário Desta Compra (R$):
                    </label>
                    {previousCost !== null && (
                      <span className="text-[10px] text-white/40 font-mono">
                        Último pago: R$ {previousCost.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={unitCostInput}
                    onChange={(e) => setUnitCostInput(e.target.value)}
                    placeholder="Ex: 80,00"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />

                  {/* Comparativo Inteligente com a Recompra Passada */}
                  {costDiff !== null && costDiff !== 0 && (
                    <div
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                        costDiff > 0
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      {costDiff > 0 ? (
                        <>
                          <TrendingUp className="size-3.5 text-amber-400" />
                          <span>
                            ▲ Pagou +R$ {costDiff.toFixed(2)} mais caro nesta compra ({costDiffPercent?.toFixed(1)}%)
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="size-3.5 text-emerald-400" />
                          <span>
                            ▼ Pagou -R$ {Math.abs(costDiff).toFixed(2)} mais barato nesta compra ({Math.abs(costDiffPercent || 0).toFixed(1)}%)
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Preço de Venda Sugerido / Atual */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-white/70 block">
                      Preço de Venda da Loja (R$):
                    </label>
                    {unitProfit > 0 && (
                      <span className="text-[10px] text-emerald-400 font-bold">
                        Lucro: R$ {unitProfit.toFixed(2)} ({markupPercent.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={unitSellInput}
                    onChange={(e) => setUnitSellInput(e.target.value)}
                    placeholder="Ex: 110,00"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-white/40">
                    💡 Ajuste o preço se pagou mais caro para garantir o lucro da loja.
                  </p>
                </div>
              </div>
            )}

            {/* Botão de Adicionar à Lista */}
            {selectedModel && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
                >
                  <Plus className="size-4" />
                  <span>Adicionar à Compra</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. SEÇÃO: Grade de Mercadorias Compradas no Lote */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Boxes className="size-3.5 text-emerald-400" />
                <span>Mercadorias Desta Compra ({items.length} itens)</span>
              </span>
              {totalUnits > 0 && (
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {totalUnits} unidades adicionadas
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center space-y-2">
                <PackagePlus className="size-8 text-white/20 mx-auto" />
                <p className="text-xs text-white/40">
                  Nenhuma mercadoria adicionada ainda. Pesquise e adicione os produtos comprados acima.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const subtotal = item.qty * item.unitCost;
                  const itemProfit = item.qty * (item.unitSell - item.unitCost);
                  const diff = item.previousCost !== null ? item.unitCost - item.previousCost : null;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-[#121215] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {item.brand} {item.model}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/70 text-[10px] font-semibold">
                            {item.flavor}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-white/50">
                          <span>Quantidade: <strong className="text-white">{item.qty} un</strong></span>
                          <span>•</span>
                          <span>Custo: <strong className="text-white">R$ {item.unitCost.toFixed(2)}</strong></span>
                          {diff !== null && diff !== 0 && (
                            <span className={diff > 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                              ({diff > 0 ? `+R$ ${diff.toFixed(2)}` : `-R$ ${Math.abs(diff).toFixed(2)}`})
                            </span>
                          )}
                          <span>•</span>
                          <span>Preço Venda: <strong className="text-white">R$ {item.unitSell.toFixed(2)}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-white/40 uppercase tracking-wider block">Subtotal</span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            R$ {subtotal.toFixed(2)}
                          </span>
                        </div>

                        <div className="text-left sm:text-right hidden sm:block">
                          <span className="text-[10px] text-white/40 uppercase tracking-wider block">Lucro Previsto</span>
                          <span className="font-mono font-semibold text-white/90 text-xs">
                            +R$ {itemProfit.toFixed(2)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Remover mercadoria"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. SEÇÃO: Campos Adicionais (Frete e Observações) */}
          {items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-white/70 block">
                  Frete / Despesa de Envio do Fornecedor (Opcional):
                </label>
                <input
                  type="text"
                  value={freightAmountInput}
                  onChange={(e) => setFreightAmountInput(e.target.value)}
                  placeholder="Ex: 50,00"
                  className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-white/70 block">
                  Fornecedor / Nota da Compra (Opcional):
                </label>
                <input
                  type="text"
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  placeholder="Ex: Lote Paraguai / Fornecedor Pedro"
                  className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* 4. SEÇÃO: Resumo Financeiro da Compra Total */}
          {items.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-500/10 via-black to-[#121215] border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
              <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider font-bold block">
                Resumo Geral Desta Compra de Estoque
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-[10px] text-white/50 uppercase block">Total de Peças</span>
                  <span className="text-lg sm:text-xl font-black text-white font-mono mt-0.5 block">
                    {totalUnits} un
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-[10px] text-white/50 uppercase block">Total Investido</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono mt-0.5 block">
                    R$ {totalInvestedWithFreight.toFixed(2)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-[10px] text-white/50 uppercase block">Faturamento Previsto</span>
                  <span className="text-lg sm:text-xl font-black text-white font-mono mt-0.5 block">
                    R$ {totalProjectedRevenue.toFixed(2)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-[10px] text-white/50 uppercase block">Lucro Projetado</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono mt-0.5 block">
                    +R$ {totalProjectedProfit.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-white/40 block mt-0.5 font-mono">
                    Markup: +{totalMarkup.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Rodapé com Botão Principal de Conclusão */}
        <div className="px-5 sm:px-7 py-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.02]">
          <div className="text-xs text-white/50 text-center sm:text-left">
            {items.length > 0 ? (
              <span>
                Pronto para atualizar o estoque de <strong>{totalUnits} unidades</strong> e sincronizar preços.
              </span>
            ) : (
              <span>Adicione itens para liberar a confirmação de entrada.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer w-full sm:w-auto"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={items.length === 0 || isSubmitting}
              onClick={handleConfirmStockEntry}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-black text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Dando Entrada no Estoque...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Concluir Entrada & Atualizar Estoque</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Modal de Conclusão e Sucesso */}
      {successModalData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#121215] border border-emerald-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="size-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white tracking-tight">
                Estoque Atualizado com Sucesso!
              </h3>
              <p className="text-xs text-white/60">
                Todas as mercadorias foram somadas ao estoque e os custos/preços foram sincronizados no sistema.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-white/40 block">Peças</span>
                <strong className="text-white font-mono text-sm">{successModalData.totalUnits} un</strong>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block">Investido</span>
                <strong className="text-emerald-400 font-mono text-sm">R$ {successModalData.totalInvested.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block">Lucro Previsto</span>
                <strong className="text-emerald-400 font-mono text-sm">+R$ {successModalData.projectedProfit.toFixed(2)}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSuccessModalData(null);
                onClose();
              }}
              className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm transition-all shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
            >
              Fechar & Ver Estoque
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
