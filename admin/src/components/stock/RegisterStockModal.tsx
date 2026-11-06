import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  PackagePlus,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Boxes,
  Sparkles,
  Loader2,
  Check,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { updateProductCost } from "@/lib/productCosts";
import {
  createStockRepurchase,
  fetchStockRepurchases,
  enrichStockRepurchasesList,
  type EnrichedStockRepurchase,
} from "@/lib/stockRepurchases";
import { broadcastLiveCatalogSync } from "@/lib/categories";
import { invalidateSaleCatalogCache } from "@/components/ManualSaleModal";
import { invalidateFinanceCache } from "@/components/FinanceDashboard";

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

export interface SelectedFlavorItem {
  flavor: string;
  qty: number;
  productId?: string;
  currentStock: number;
  isCustom?: boolean;
}

interface RegisterStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
  products: any[];
  costsMap?: Record<string, number>;
  onSuccess: () => void;
}

const getItemIdentityKey = (brand: string, model: string, flavor: string, productId?: string) => {
  if (productId) return `id:${productId}`;
  return `key:${brand.trim().toLowerCase()}__${model.trim().toLowerCase()}__${flavor.trim().toLowerCase()}`;
};

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

  // Sabores selecionados para o modelo atual (permite múltiplos sabores simultâneos)
  const [selectedFlavors, setSelectedFlavors] = useState<SelectedFlavorItem[]>([]);
  const [bulkDefaultQty, setBulkDefaultQty] = useState<string>("1");
  const [customFlavorName, setCustomFlavorName] = useState<string>("");
  const [customFlavorQty, setCustomFlavorQty] = useState<string>("1");
  const [addedBatchNotification, setAddedBatchNotification] = useState<string | null>(null);

  const [unitCostInput, setUnitCostInput] = useState<string>("");
  const [unitSellInput, setUnitSellInput] = useState<string>("");
  const [previousCost, setPreviousCost] = useState<number | null>(null);
  const [isNewProductMode, setIsNewProductMode] = useState(false);

  // Campos gerais da remessa
  const [supplierNotes, setSupplierNotes] = useState("");
  const [freightAmountInput, setFreightAmountInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingPriceOnly, setIsUpdatingPriceOnly] = useState(false);
  const isSubmittingRef = useRef(false);

  const [successModalData, setSuccessModalData] = useState<{
    totalUnits: number;
    totalInvested: number;
    projectedProfit: number;
  } | null>(null);

  const [lastRepurchase, setLastRepurchase] = useState<EnrichedStockRepurchase | null>(null);

  // Resetar 100% do estado sempre que o modal abrir ou fechar para impedir que itens
  // de uma compra anterior fiquem retidos na memória e sejam somados novamente!
  const resetModalState = () => {
    setItems([]);
    setSearchModelQuery("");
    setSelectedBrand("");
    setSelectedModel("");
    setSelectedFlavors([]);
    setBulkDefaultQty("1");
    setCustomFlavorName("");
    setCustomFlavorQty("1");
    setAddedBatchNotification(null);
    setUnitCostInput("");
    setUnitSellInput("");
    setPreviousCost(null);
    setIsNewProductMode(false);
    setSupplierNotes("");
    setFreightAmountInput("");
    setIsSubmitting(false);
    setIsUpdatingPriceOnly(false);
    isSubmittingRef.current = false;
    setSuccessModalData(null);
  };

  useEffect(() => {
    if (!isOpen) {
      resetModalState();
      return;
    }
    let active = true;
    fetchStockRepurchases(targetCompanyId)
      .then((list) => {
        if (!active) return;
        const enriched = enrichStockRepurchasesList(list, products);
        setLastRepurchase(enriched.length > 0 ? enriched[0] : null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, targetCompanyId, products]);

  // Agrupamento dos produtos existentes para sugestão inteligente
  const modelCatalog = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        brand: string;
        model: string;
        flavors: { id: string; flavor: string; stock: number; price: number; cost: number }[];
        defaultPrice: number;
        defaultCost: number;
      }
    >();

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

  // Quando o operador seleciona um modelo da lista existente
  const handleSelectModel = (modelData: (typeof modelCatalog)[0]) => {
    setSelectedBrand(modelData.brand);
    setSelectedModel(modelData.model);
    setSearchModelQuery(`${modelData.brand} ${modelData.model}`);
    setIsNewProductMode(false);

    // Custo anterior e preço de venda atual
    const cost = modelData.defaultCost > 0 ? modelData.defaultCost : null;
    setPreviousCost(cost);
    setUnitCostInput(cost ? String(cost) : "");
    setUnitSellInput(modelData.defaultPrice > 0 ? String(modelData.defaultPrice) : "");

    // Se tiver apenas 1 sabor, já pré-seleciona com quantidade 1
    if (modelData.flavors.length === 1) {
      setSelectedFlavors([
        {
          flavor: modelData.flavors[0].flavor,
          qty: parseInt(bulkDefaultQty) || 1,
          productId: modelData.flavors[0].id,
          currentStock: modelData.flavors[0].stock
        }
      ]);
    } else {
      setSelectedFlavors([]);
    }
  };

  // Quando o operador escolhe criar um modelo novo
  const handleCreateNewModel = () => {
    const q = searchModelQuery.trim();
    if (!q) return;

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
    setSelectedFlavors([]);
    setPreviousCost(null);
    setUnitCostInput("");
    setUnitSellInput("");
  };

  // Alternar seleção de um sabor (Adicionar/Remover do lote do modelo)
  const handleToggleFlavor = (flavorName: string, productId?: string, currentStock: number = 0) => {
    setSelectedFlavors((prev) => {
      const exists = prev.some((f) => f.flavor.toLowerCase() === flavorName.toLowerCase());
      if (exists) {
        return prev.filter((f) => f.flavor.toLowerCase() !== flavorName.toLowerCase());
      } else {
        const defaultQ = parseInt(bulkDefaultQty) || 1;
        // Se este sabor já foi adicionado na lista da compra abaixo, carrega a quantidade atual dele
        const existingInBatch = items.find(
          (it) =>
            (productId && it.productId === productId) ||
            (it.brand.toLowerCase() === selectedBrand.toLowerCase() &&
              it.model.toLowerCase() === selectedModel.toLowerCase() &&
              it.flavor.toLowerCase() === flavorName.toLowerCase())
        );
        return [
          ...prev,
          {
            flavor: flavorName,
            qty: existingInBatch ? existingInBatch.qty : defaultQ,
            productId,
            currentStock
          }
        ];
      }
    });
  };

  // Selecionar todos os sabores disponíveis com a quantidade padrão (1)
  const handleSelectAllFlavors = () => {
    if (availableFlavorsForModel.length === 0) return;
    const defaultQ = parseInt(bulkDefaultQty) || 1;
    const map = new Map<string, SelectedFlavorItem>();
    selectedFlavors.forEach((f) => map.set(f.flavor.toLowerCase(), f));

    availableFlavorsForModel.forEach((f) => {
      const k = f.flavor.toLowerCase();
      if (!map.has(k)) {
        map.set(k, {
          flavor: f.flavor,
          qty: defaultQ,
          productId: f.id,
          currentStock: f.stock
        });
      }
    });

    setSelectedFlavors(Array.from(map.values()));
  };

  // Limpar sabores selecionados do modelo
  const handleClearFlavors = () => {
    setSelectedFlavors([]);
  };

  // Atualizar a quantidade de um sabor selecionado
  const handleUpdateFlavorQty = (flavorName: string, deltaOrValue: number | string, isDirectValue = false) => {
    setSelectedFlavors((prev) =>
      prev.map((f) => {
        if (f.flavor.toLowerCase() !== flavorName.toLowerCase()) return f;
        let newQty = f.qty;
        if (isDirectValue) {
          newQty = parseInt(String(deltaOrValue)) || 1;
        } else {
          newQty = Math.max(1, f.qty + Number(deltaOrValue));
        }
        return { ...f, qty: Math.max(1, newQty) };
      })
    );
  };

  // Aplicar quantidade para todos os sabores selecionados de uma vez só
  const handleApplyBulkQtyToAll = () => {
    const q = parseInt(bulkDefaultQty) || 1;
    setSelectedFlavors((prev) => prev.map((f) => ({ ...f, qty: q })));
  };

  // Adicionar um sabor novo que não estava no catálogo
  const handleAddCustomFlavor = () => {
    const name = customFlavorName.trim();
    if (!name) return;
    const qty = parseInt(customFlavorQty) || 1;
    const exists = selectedFlavors.some((f) => f.flavor.toLowerCase() === name.toLowerCase());
    if (exists) {
      handleUpdateFlavorQty(name, qty, true);
    } else {
      setSelectedFlavors((prev) => [
        ...prev,
        {
          flavor: name,
          qty,
          currentStock: 0,
          isCustom: true
        }
      ]);
    }
    setCustomFlavorName("");
  };

  // Cálculos dinâmicos dos valores
  const parsedUnitCost = parseFloat(unitCostInput.replace(",", ".")) || 0;
  const parsedUnitSell = parseFloat(unitSellInput.replace(",", ".")) || 0;
  const unitProfit = parsedUnitSell > 0 && parsedUnitCost > 0 ? parsedUnitSell - parsedUnitCost : 0;
  const markupPercent = parsedUnitCost > 0 ? (unitProfit / parsedUnitCost) * 100 : 0;
  const costDiff = previousCost !== null && parsedUnitCost > 0 ? parsedUnitCost - previousCost : null;
  const costDiffPercent = previousCost && previousCost > 0 && costDiff !== null ? (costDiff / previousCost) * 100 : null;

  // Total de unidades e valores para os sabores selecionados do modelo atual
  const totalSelectedUnits = useMemo(
    () => selectedFlavors.reduce((acc, f) => acc + (f.qty || 0), 0),
    [selectedFlavors]
  );
  const totalModelSubtotal = totalSelectedUnits * parsedUnitCost;

  // Atualizar APENAS o custo e o preço de venda do modelo selecionado no catálogo, SEM adicionar estoque e SEM criar recompra
  const handleUpdateOnlyModelPrices = async () => {
    if (!selectedModel.trim() || isNewProductMode) return;
    if (parsedUnitCost <= 0 || parsedUnitSell <= 0) {
      alert("Informe um Custo Unitário e Preço de Venda válidos maiores que zero.");
      return;
    }

    setIsUpdatingPriceOnly(true);
    try {
      const brandNorm = selectedBrand.trim();
      const modelNorm = selectedModel.trim();
      const groupKey = `${brandNorm.toLowerCase()}__${modelNorm.toLowerCase()}`;

      const { data: allModelVariants, error: fetchErr } = await supabase
        .from("smoking_products")
        .select("id")
        .eq("company_id", targetCompanyId)
        .ilike("brand", brandNorm)
        .ilike("name", modelNorm);

      if (fetchErr) throw fetchErr;

      const variantIds = (allModelVariants || []).map((v: any) => v.id);
      if (variantIds.length === 0) {
        alert("Nenhuma variante encontrada para este modelo no banco de dados.");
        return;
      }

      const { error: updErr } = await supabase
        .from("smoking_products")
        .update({
          cost_price: parsedUnitCost,
          price: parsedUnitSell
        })
        .in("id", variantIds)
        .eq("company_id", targetCompanyId);

      if (updErr) throw updErr;

      // Se houver itens desse mesmo modelo já na lista abaixo, sincroniza o custo/preço deles também
      setItems((prev) =>
        prev.map((it) =>
          it.brand.toLowerCase() === brandNorm.toLowerCase() &&
          it.model.toLowerCase() === modelNorm.toLowerCase()
            ? { ...it, unitCost: parsedUnitCost, unitSell: parsedUnitSell }
            : it
        )
      );

      try {
        await updateProductCost({
          modelKey: groupKey,
          productIds: variantIds,
          costPrice: parsedUnitCost,
          companyId: targetCompanyId
        });
      } catch (costErr) {
        console.warn("Aviso ao sincronizar custo do modelo:", costErr);
      }

      try {
        await broadcastLiveCatalogSync({
          type: "STOCK_UPDATED",
          company_id: targetCompanyId
        });
      } catch (e) {}

      try {
        invalidateSaleCatalogCache(targetCompanyId);
        invalidateFinanceCache();
      } catch (e) {}

      setPreviousCost(parsedUnitCost);
      setAddedBatchNotification(
        `Preços de ${brandNorm} ${modelNorm} atualizados (Custo: R$ ${parsedUnitCost.toFixed(2)} | Venda: R$ ${parsedUnitSell.toFixed(2)}) sem alterar a quantidade em estoque!`
      );
      setTimeout(() => setAddedBatchNotification(null), 5000);
      onSuccess();
    } catch (err: any) {
      console.error("Erro ao atualizar apenas preço/custo do modelo:", err);
      alert(`Erro ao atualizar preços: ${err.message || "Tente novamente."}`);
    } finally {
      setIsUpdatingPriceOnly(false);
    }
  };

  // Adicionar todos os sabores selecionados deste modelo à lista de mercadorias da compra (SEM duplicar sabores já na lista)
  const handleAddSelectedFlavorsToBatch = () => {
    if (!selectedModel.trim()) {
      alert("Por favor, selecione ou digite o modelo do produto.");
      return;
    }
    if (selectedFlavors.length === 0) {
      alert("Selecione ou adicione ao menos um sabor que chegou nesta remessa.");
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

    const brandNorm = selectedBrand.trim() || "Outros";
    const modelNorm = selectedModel.trim();

    const newItems: StockEntryItem[] = selectedFlavors.map((f) => ({
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productId: f.productId,
      brand: brandNorm,
      model: modelNorm,
      flavor: f.flavor.trim(),
      qty: Math.max(1, Number(f.qty) || 1),
      unitCost: parsedUnitCost,
      previousCost: previousCost,
      unitSell: parsedUnitSell,
      currentStock: f.currentStock,
      isNewProduct: isNewProductMode || !f.productId
    }));

    // Mescla de forma inteligente: se o mesmo sabor já estiver na lista `items`,
    // atualiza a quantidade e preço em vez de criar uma linha duplicada!
    // Também sincroniza o custo e preço de venda para outros sabores do mesmo modelo na lista.
    setItems((prev) => {
      const updatedPrev = prev.map((existing) => {
        if (
          existing.brand.toLowerCase() === brandNorm.toLowerCase() &&
          existing.model.toLowerCase() === modelNorm.toLowerCase()
        ) {
          return {
            ...existing,
            unitCost: parsedUnitCost,
            unitSell: parsedUnitSell
          };
        }
        return existing;
      });

      const mergedMap = new Map<string, StockEntryItem>();
      // Insere primeiro os novos/atualizados no topo
      for (const ni of newItems) {
        const key = getItemIdentityKey(ni.brand, ni.model, ni.flavor, ni.productId);
        mergedMap.set(key, ni);
      }
      // Mantém os anteriores que não colidem com os sabores recém-adicionados
      for (const oldItem of updatedPrev) {
        const key = getItemIdentityKey(oldItem.brand, oldItem.model, oldItem.flavor, oldItem.productId);
        if (!mergedMap.has(key)) {
          mergedMap.set(key, oldItem);
        }
      }
      return Array.from(mergedMap.values());
    });

    setAddedBatchNotification(
      `${newItems.length} sabor(es) (${totalSelectedUnits} un) de ${brandNorm} ${modelNorm} na lista de compra!`
    );
    setTimeout(() => setAddedBatchNotification(null), 4000);

    // Limpa a seleção de sabores para poder adicionar outros modelos ou fechar
    setSelectedFlavors([]);
  };

  // Remover item individual da lista de compras
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Alterar quantidade direto na lista de compras
  const handleUpdateItemQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((it) => (it.id === id ? { ...it, qty: it.qty + delta } : it))
        .filter((it) => it.qty > 0)
    );
  };

  // Cálculos do Lote Total da Compra
  const totalUnits = useMemo(() => items.reduce((acc, it) => acc + it.qty, 0), [items]);
  const totalCost = useMemo(() => items.reduce((acc, it) => acc + it.qty * it.unitCost, 0), [items]);
  const totalProjectedRevenue = useMemo(() => items.reduce((acc, it) => acc + it.qty * it.unitSell, 0), [items]);
  const parsedFreight = parseFloat(freightAmountInput.replace(",", ".")) || 0;
  const totalInvestedWithFreight = totalCost + parsedFreight;
  const totalProjectedProfit = totalProjectedRevenue - totalInvestedWithFreight;
  const totalMarkup = totalInvestedWithFreight > 0 ? (totalProjectedProfit / totalInvestedWithFreight) * 100 : 0;

  // Concluir Entrada de Estoque no Supabase
  const handleConfirmStockEntry = async () => {
    if (isSubmittingRef.current || isSubmitting) return;

    if (items.length === 0) {
      alert("Adicione pelo menos um item à compra antes de confirmar.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const nowIso = new Date().toISOString();

      // 0. Consolida itens por identidade única (brand + model + flavor / productId)
      // garantindo que jamais o mesmo sabor seja processado 2x no mesmo lote
      const consolidatedMap = new Map<string, StockEntryItem>();
      for (const rawItem of items) {
        const key = getItemIdentityKey(rawItem.brand, rawItem.model, rawItem.flavor, rawItem.productId);
        if (!consolidatedMap.has(key)) {
          consolidatedMap.set(key, { ...rawItem });
        } else {
          const prev = consolidatedMap.get(key)!;
          prev.qty = prev.qty + rawItem.qty;
          prev.unitCost = rawItem.unitCost;
          prev.unitSell = rawItem.unitSell;
        }
      }
      const batchItems = Array.from(consolidatedMap.values());
      const batchTotalUnits = batchItems.reduce((acc, it) => acc + it.qty, 0);
      const batchTotalCost = batchItems.reduce((acc, it) => acc + it.qty * it.unitCost, 0);
      const batchTotalInvested = batchTotalCost + parsedFreight;
      const batchTotalRevenue = batchItems.reduce((acc, it) => acc + it.qty * it.unitSell, 0);
      const batchProjectedProfit = batchTotalRevenue - batchTotalInvested;

      // 1. Processa cada item único do lote
      for (const item of batchItems) {
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
          // Busca o estoque atual real no banco para somar com precisão
          const { data: currentProd } = await supabase
            .from("smoking_products")
            .select("stock")
            .eq("id", existingId)
            .single();

          const dbStock = Number(currentProd?.stock) || 0;
          const nextStock = dbStock + item.qty;

          const { error: updErr } = await supabase
            .from("smoking_products")
            .update({
              stock: nextStock,
              cost_price: item.unitCost,
              price: item.unitSell,
              is_active: true,
              created_at: nowIso // Reseta o timer de estoque parado na entrada de novo lote
            })
            .eq("id", existingId)
            .eq("company_id", targetCompanyId);

          if (updErr) throw updErr;
        } else {
          // Herda imagem/puffs de outra variante do mesmo modelo se existir
          const { data: sibling } = await supabase
            .from("smoking_products")
            .select("image_url, puffs")
            .eq("company_id", targetCompanyId)
            .ilike("brand", item.brand)
            .ilike("name", item.model)
            .limit(1);

          const inheritedImage = sibling && sibling[0]?.image_url ? sibling[0].image_url : "";
          const inheritedPuffs = sibling && sibling[0]?.puffs ? sibling[0].puffs : 15000;

          const { error: insErr } = await supabase.from("smoking_products").insert({
            company_id: targetCompanyId,
            brand: item.brand,
            name: item.model,
            flavor: item.flavor,
            stock: item.qty,
            cost_price: item.unitCost,
            price: item.unitSell,
            puffs: inheritedPuffs,
            image_url: inheritedImage,
            is_active: true,
            created_at: nowIso
          });

          if (insErr) throw insErr;
        }

        // Propaga o novo custo e preço de venda para TODAS as variantes do mesmo modelo (marca + modelo)
        const groupKey = `${item.brand.toLowerCase()}__${item.model.toLowerCase()}`;
        const { data: allModelVariants } = await supabase
          .from("smoking_products")
          .select("id")
          .eq("company_id", targetCompanyId)
          .ilike("brand", item.brand)
          .ilike("name", item.model);

        const variantIds = (allModelVariants || []).map((v: any) => v.id);

        if (variantIds.length > 0) {
          await supabase
            .from("smoking_products")
            .update({
              cost_price: item.unitCost,
              price: item.unitSell
            })
            .in("id", variantIds)
            .eq("company_id", targetCompanyId);
        }

        // Sincroniza custo oficial no metastore e cache de custos
        try {
          await updateProductCost({
            modelKey: groupKey,
            productIds: variantIds,
            costPrice: item.unitCost,
            companyId: targetCompanyId
          });
        } catch (costErr) {
          console.warn("Aviso ao sincronizar custo do modelo:", costErr);
        }
      }

      // Sincroniza em tempo real com o catálogo digital
      try {
        await broadcastLiveCatalogSync({
          type: "STOCK_UPDATED",
          company_id: targetCompanyId
        });
      } catch (broadcastErr) {
        console.warn("Aviso ao emitir live sync:", broadcastErr);
      }

      // 2. Gravar o registro histórico de recompra em smoking_stock_repurchases (apenas se houve unidades compradas)
      if (batchTotalUnits > 0 && batchTotalCost > 0) {
        try {
          const repurchaseNotes = supplierNotes.trim()
            ? `${supplierNotes} (${batchTotalUnits} un, ${batchItems.length} itens)`
            : `Entrada rápida de estoque: ${batchTotalUnits} un (${batchItems.length} itens)`;

          const batchMarkupPct = batchTotalInvested > 0 ? (batchProjectedProfit / batchTotalInvested) * 100 : 0;
          const batchMarginPct = batchTotalRevenue > 0 ? (batchProjectedProfit / batchTotalRevenue) * 100 : 0;

          await createStockRepurchase({
            companyId: targetCompanyId,
            stock_purchase_amount: batchTotalCost,
            freight_amount: parsedFreight,
            purchase_date: nowIso.split("T")[0],
            notes: repurchaseNotes,
            meta: {
              units: batchTotalUnits,
              projectedRevenue: Number(batchTotalRevenue.toFixed(2)),
              projectedProfit: Number(batchProjectedProfit.toFixed(2)),
              markupPct: Number(batchMarkupPct.toFixed(1)),
              marginPct: Number(batchMarginPct.toFixed(1)),
              items: batchItems.map((it) => ({
                brand: it.brand,
                model: it.model,
                flavor: it.flavor,
                qty: it.qty,
                unitCost: it.unitCost,
                previousCost: it.previousCost ?? null,
                unitSell: it.unitSell,
              })),
            },
          });
        } catch (repurchaseErr) {
          console.warn("Aviso ao salvar histórico de recompra:", repurchaseErr);
        }
      }

      // 3. Limpar imediatamente a lista de itens para impedir qualquer re-execução acidental!
      setItems([]);
      setSelectedFlavors([]);
      setSearchModelQuery("");
      setSelectedBrand("");
      setSelectedModel("");
      setFreightAmountInput("");
      setSupplierNotes("");

      // 4. Exibir Modal de Sucesso
      setSuccessModalData({
        totalUnits: batchTotalUnits,
        totalInvested: batchTotalInvested,
        projectedProfit: batchProjectedProfit
      });

      // Invalida o cache do catálogo de vendas manuais e do financeiro para refletir estoque novo imediatamente
      try {
        invalidateSaleCatalogCache(targetCompanyId);
        invalidateFinanceCache();
      } catch (e) {}

      // Atualiza a tela de estoque
      onSuccess();
    } catch (err: any) {
      console.error("Erro ao registrar entrada de estoque:", err);
      alert(`Erro ao processar entrada de estoque: ${err.message || "Tente novamente."}`);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Topo do Modal */}
        <div className="px-5 sm:px-7 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <PackagePlus className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Reposição de Estoque
                </span>
                <span className="text-[10px] text-white/40">Entrada Rápida</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                Registrar Compra de Mercadorias
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              resetModalState();
              onClose();
            }}
            className="size-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Notificação Temporária de Lote Adicionado */}
        {addedBatchNotification && (
          <div className="px-5 py-2.5 bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>{addedBatchNotification}</span>
            </div>
            <span className="text-[11px] text-emerald-400/80">Confira abaixo ↓</span>
          </div>
        )}

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 space-y-6">
          {/* 1. SEÇÃO: Adição Inteligente de Mercadoria */}
          <div className="bg-[#141417] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-400" />
                <span>Adicionar Produto Comprado</span>
              </span>
              {selectedModel && (
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="size-3.5" /> Encaixado no Catálogo
                </span>
              )}
            </div>

            {/* Linha 1: Pesquisa Inteligente de Modelo */}
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
                      setSelectedFlavors([]);
                    }
                  }}
                  placeholder="Digite a marca ou modelo (Ex: Elfbar BC15K, Lost Mary, Ignite...)"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-semibold"
                />

                {/* Dropdown de Sugestões de Modelos do Catálogo */}
                {!selectedModel && searchModelQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-[#141418] border border-white/15 rounded-2xl shadow-2xl p-2 max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                    {filteredModels.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => handleSelectModel(m)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center justify-between text-xs cursor-pointer transition-colors"
                      >
                        <div>
                          <span className="font-bold text-white block">
                            {m.brand} {m.model}
                          </span>
                          <span className="text-[10px] text-white/50">
                            {m.flavors.length} sabores no catálogo •{" "}
                            {m.flavors.reduce((a, b) => a + b.stock, 0)} un em estoque
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-mono text-emerald-400 font-bold block">
                            {m.defaultCost > 0
                              ? `Último Custo: R$ ${m.defaultCost.toFixed(2)}`
                              : "Sem custo"}
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

            {/* Linha 2: MÚLTIPLOS SABORES DO MESMO PRODUTO */}
            {selectedModel && (
              <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="size-3 text-emerald-400" />
                      <span>Sabores que Chegaram no Lote</span>
                    </label>
                    <span className="text-[10px] text-white/50">
                      Clique nos sabores para marcar quantos de cada um chegaram
                    </span>
                  </div>

                  {availableFlavorsForModel.length > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllFlavors}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <Check className="size-3" />
                        <span>Selecionar Todos ({availableFlavorsForModel.length})</span>
                      </button>
                      {selectedFlavors.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearFlavors}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[11px] cursor-pointer"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Pílulas de Seleção Rápida dos Sabores */}
                {availableFlavorsForModel.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                    {availableFlavorsForModel.map((f) => {
                      const isSelected = selectedFlavors.some(
                        (sf) => sf.flavor.toLowerCase() === f.flavor.toLowerCase()
                      );
                      const selectedItem = selectedFlavors.find(
                        (sf) => sf.flavor.toLowerCase() === f.flavor.toLowerCase()
                      );
                      const alreadyInBatchItem = items.find(
                        (it) =>
                          (f.id && it.productId === f.id) ||
                          (it.brand.toLowerCase() === selectedBrand.toLowerCase() &&
                            it.model.toLowerCase() === selectedModel.toLowerCase() &&
                            it.flavor.toLowerCase() === f.flavor.toLowerCase())
                      );

                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleToggleFlavor(f.flavor, f.id, f.stock)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                            isSelected
                              ? "bg-emerald-500 text-black font-extrabold shadow-md shadow-emerald-500/25 border border-emerald-400 scale-[1.02]"
                              : alreadyInBatchItem
                              ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40"
                              : "bg-[#18181b] hover:bg-white/10 text-white/80 border border-white/10"
                          }`}
                        >
                          <span>{f.flavor}</span>
                          {isSelected ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-black/30 text-black font-mono text-[10px] font-black">
                              {selectedItem?.qty} un ✓
                            </span>
                          ) : alreadyInBatchItem ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                              Na lista: +{alreadyInBatchItem.qty} un
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/40 font-mono">
                              ({f.stock} un)
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Grade de Quantidades por Sabor Selecionado */}
                {selectedFlavors.length > 0 && (
                  <div className="bg-[#101013] border border-emerald-500/30 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-400">
                          {selectedFlavors.length}{" "}
                          {selectedFlavors.length === 1 ? "sabor marcado" : "sabores marcados"}
                        </span>
                        <span className="text-white/40 text-xs">•</span>
                        <span className="text-xs font-mono font-bold text-white">
                          Total: {totalSelectedUnits} unidades
                        </span>
                      </div>

                      {/* Definir quantidade padrão em lote */}
                      {selectedFlavors.length > 1 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-white/50 text-[11px]">Colocar em todos:</span>
                          <input
                            type="number"
                            min="1"
                            value={bulkDefaultQty}
                            onChange={(e) => setBulkDefaultQty(e.target.value)}
                            className="w-14 px-2 py-0.5 bg-black/60 border border-white/15 rounded-lg text-white font-mono text-center text-xs focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={handleApplyBulkQtyToAll}
                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold rounded-lg cursor-pointer transition-colors"
                          >
                            Aplicar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Linhas de cada sabor com Stepper [-] [qty] [+] */}
                    <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                      {selectedFlavors.map((sf) => (
                        <div
                          key={sf.flavor}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-white text-xs truncate block">
                              {sf.flavor}
                            </span>
                            <span className="text-[10px] text-white/40 font-mono">
                              Estoque atual: {sf.currentStock} un ➔ Ficará:{" "}
                              {sf.currentStock + sf.qty} un
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Stepper [-] [input] [+] */}
                            <div className="flex items-center bg-black/60 border border-white/15 rounded-xl overflow-hidden">
                              <button
                                type="button"
                                onClick={() => handleUpdateFlavorQty(sf.flavor, -1)}
                                className="px-2.5 py-1 text-white/70 hover:text-white hover:bg-white/10 cursor-pointer font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={sf.qty}
                                onChange={(e) =>
                                  handleUpdateFlavorQty(sf.flavor, e.target.value, true)
                                }
                                className="w-12 text-center text-xs font-mono font-bold text-white bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateFlavorQty(sf.flavor, 1)}
                                className="px-2.5 py-1 text-white/70 hover:text-white hover:bg-white/10 cursor-pointer font-bold"
                              >
                                +
                              </button>
                            </div>

                            {/* Botão rápido +5 */}
                            <button
                              type="button"
                              onClick={() => handleUpdateFlavorQty(sf.flavor, 5)}
                              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-mono cursor-pointer"
                              title="Adicionar +5 un"
                            >
                              +5
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleFlavor(sf.flavor)}
                              className="p-1 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                              title="Remover este sabor"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Adicionar Sabor Não Listado (Custom Flavor) */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-dashed border-white/10 space-y-2">
                  <span className="text-[11px] text-white/60 font-semibold block">
                    + Chegou algum sabor novo que não está na lista acima?
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customFlavorName}
                      onChange={(e) => setCustomFlavorName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomFlavor();
                        }
                      }}
                      placeholder="Nome do sabor (Ex: Blueberry Ice, Menthol...)"
                      className="flex-1 px-3 py-1.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-white/40">Qtd:</span>
                      <input
                        type="number"
                        min="1"
                        value={customFlavorQty}
                        onChange={(e) => setCustomFlavorQty(e.target.value)}
                        className="w-14 px-2 py-1.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono text-center focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomFlavor}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer transition-colors shrink-0"
                    >
                      + Adicionar Sabor
                    </button>
                  </div>
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
                            ▲ Pagou +R$ {costDiff.toFixed(2)} mais caro nesta compra (
                            {costDiffPercent?.toFixed(1)}%)
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="size-3.5 text-emerald-400" />
                          <span>
                            ▼ Pagou -R$ {Math.abs(costDiff).toFixed(2)} mais barato nesta compra (
                            {Math.abs(costDiffPercent || 0).toFixed(1)}%)
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

            {/* Subtotal do Produto, Atualização só de Preço e Botão de Adicionar à Compra */}
            {selectedModel && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5">
                <div className="text-xs font-mono text-white/60">
                  {totalSelectedUnits > 0 && parsedUnitCost > 0 ? (
                    <span>
                      Subtotal deste produto:{" "}
                      <strong className="text-white">
                        {totalSelectedUnits} un × R$ {parsedUnitCost.toFixed(2)}
                      </strong>{" "}
                      = <strong className="text-emerald-400">R$ {totalModelSubtotal.toFixed(2)}</strong>
                    </span>
                  ) : (
                    <span>Marque os sabores acima ou atualize apenas o custo/preço do modelo.</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  {!isNewProductMode && parsedUnitCost > 0 && parsedUnitSell > 0 && (
                    <button
                      type="button"
                      onClick={handleUpdateOnlyModelPrices}
                      disabled={isUpdatingPriceOnly || isSubmitting}
                      className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      title="Atualiza apenas o Custo e Preço de Venda de todos os sabores deste modelo sem somar unidades ao estoque"
                    >
                      {isUpdatingPriceOnly ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5 text-emerald-400" />
                      )}
                      <span>Salvar Só Custo/Preço (0 un)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleAddSelectedFlavorsToBatch}
                    disabled={selectedFlavors.length === 0}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-black text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95"
                  >
                    <Plus className="size-4 stroke-[3]" />
                    {selectedFlavors.length === 0 ? (
                      <span>Selecione os sabores acima</span>
                    ) : selectedFlavors.length === 1 ? (
                      <span>
                        Adicionar {selectedFlavors[0].flavor} ({selectedFlavors[0].qty} un) à Compra
                      </span>
                    ) : (
                      <span>
                        Adicionar {selectedFlavors.length} Sabores ({totalSelectedUnits} un) à Compra
                      </span>
                    )}
                  </button>
                </div>
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
                          <span>
                            Custo: <strong className="text-white">R$ {item.unitCost.toFixed(2)}</strong>
                          </span>
                          {diff !== null && diff !== 0 && (
                            <span
                              className={
                                diff > 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"
                              }
                            >
                              ({diff > 0 ? `+R$ ${diff.toFixed(2)}` : `-R$ ${Math.abs(diff).toFixed(2)}`})
                            </span>
                          )}
                          <span>•</span>
                          <span>
                            Preço Venda:{" "}
                            <strong className="text-white">R$ {item.unitSell.toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                        {/* Stepper direto na lista de compras */}
                        <div className="flex items-center bg-black/60 border border-white/15 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.id, -1)}
                            className="px-2 py-0.5 text-white/70 hover:text-white hover:bg-white/10 font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-12 text-center font-mono font-bold text-white text-xs">
                            {item.qty} un
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.id, 1)}
                            className="px-2 py-0.5 text-white/70 hover:text-white hover:bg-white/10 font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                            Subtotal
                          </span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            R$ {subtotal.toFixed(2)}
                          </span>
                        </div>

                        <div className="text-left sm:text-right hidden sm:block">
                          <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                            Lucro Previsto
                          </span>
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
                  <span className="text-[10px] text-white/50 uppercase block">
                    Faturamento Previsto
                  </span>
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

              {/* Comparativo Ao Vivo com a Recompra Passada */}
              {lastRepurchase && (
                <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-purple-400" />
                      <span>
                        Comparativo com a Recompra Passada (
                        {new Date(lastRepurchase.purchase_date + "T00:00:00").toLocaleDateString("pt-BR")}
                        )
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-white/50">
                      Passada: {lastRepurchase.units} un • R$ {lastRepurchase.total_repurchase_amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-white/5 text-[11px]">
                    <div>
                      <span className="text-white/50">Investimento vs Passada: </span>
                      <strong
                        className={
                          totalInvestedWithFreight >= lastRepurchase.total_repurchase_amount
                            ? "text-amber-300 font-mono"
                            : "text-emerald-400 font-mono"
                        }
                      >
                        {totalInvestedWithFreight - lastRepurchase.total_repurchase_amount >= 0 ? "+" : ""}
                        R$ {(totalInvestedWithFreight - lastRepurchase.total_repurchase_amount).toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-white/50">Lucro vs Passada (+R$ {lastRepurchase.projectedProfit.toFixed(2)}): </span>
                      <strong
                        className={
                          totalProjectedProfit >= lastRepurchase.projectedProfit
                            ? "text-emerald-400 font-mono"
                            : "text-amber-300 font-mono"
                        }
                      >
                        {totalProjectedProfit - lastRepurchase.projectedProfit >= 0 ? "▲ +R$ " : "▼ -R$ "}
                        {Math.abs(totalProjectedProfit - lastRepurchase.projectedProfit).toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-white/50">Nossa Taxa (ROI): </span>
                      <strong className="text-emerald-300 font-mono">
                        +{totalMarkup.toFixed(1)}% (Passada: +{lastRepurchase.markupPct.toFixed(1)}%)
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com Botão Principal de Conclusão */}
        <div className="px-5 sm:px-7 py-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.02]">
          <div className="text-xs text-white/50 text-center sm:text-left">
            {items.length > 0 ? (
              <span>
                Pronto para atualizar o estoque de <strong>{totalUnits} unidades</strong> e
                sincronizar preços.
              </span>
            ) : (
              <span>Adicione itens para liberar a confirmação de entrada.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                resetModalState();
                onClose();
              }}
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
                Todas as mercadorias foram somadas ao estoque e os custos/preços foram sincronizados
                no sistema.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-white/40 block">Peças</span>
                <strong className="text-white font-mono text-sm">
                  {successModalData.totalUnits} un
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block">Investido</span>
                <strong className="text-emerald-400 font-mono text-sm">
                  R$ {successModalData.totalInvested.toFixed(2)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block">Lucro Previsto</span>
                <strong className="text-emerald-400 font-mono text-sm">
                  +R$ {successModalData.projectedProfit.toFixed(2)}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                resetModalState();
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
