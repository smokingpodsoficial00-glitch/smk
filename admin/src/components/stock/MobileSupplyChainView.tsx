import React, { useState, useMemo, useRef } from "react";
import {
  PackageSearch, Plus, Minus, Search, Copy, Edit3, Check, X,
  Boxes, MoreVertical, Trash2, AlertCircle, Clock, Upload,
  ImagePlus, Loader2, Sparkles, ChevronDown, CheckCircle2
} from "lucide-react";
import { formatBRL } from "@/lib/cart";

export interface MobileSKUGroup {
  groupKey: string;
  brand: string;
  name: string;
  puffs: number;
  price: number;
  cost_price: number;
  image_url: string;
  totalStock: number;
  flavors: any[];
  realFlavors: any[];
  outOfStockFlavors: any[];
  lowStockFlavors: any[];
  inStockFlavors: any[];
}

interface MobileSupplyChainViewProps {
  products: any[];
  skuGroups: MobileSKUGroup[];
  totalProducts: number;
  totalStockUnits: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterTab: "TODOS" | "EM_ESTOQUE" | "BAIXO_ESTOQUE" | "SEM_ESTOQUE";
  setFilterTab: (tab: "TODOS" | "EM_ESTOQUE" | "BAIXO_ESTOQUE" | "SEM_ESTOQUE") => void;
  activeMainView: "ESTOQUE" | "PARADOS";
  setActiveMainView: (view: "ESTOQUE" | "PARADOS") => void;
  onOpenReplenishmentPlanner: () => void;
  onCopyAvailableStock: () => void;
  copiedStockFeedback: boolean;
  onUpdateStock: (id: string, newStock: number) => void;
  onSaveAllStockChanges: () => Promise<boolean>;
  onDiscardStockChanges: () => Promise<void>;
  pendingStockChanges: Record<string, number>;
  isSavingStock: boolean;
  onAddFlavorSubmit: (group: any, flavorName: string, initialStock: number) => Promise<boolean>;
  onSaveFullProductEdit: (payload: {
    group: any;
    brand: string;
    name: string;
    puffs: number;
    price: number;
    cost_price: number | null;
    imageFile: File | null;
  }) => Promise<boolean>;
  onDeleteGroup: (group: any) => Promise<void>;
  onDeleteProduct: (id: string, flavorName: string) => Promise<void>;
  onOpenNewProductModal: () => void;
  // Produtos Parados props
  rawOrdersList?: any[];
  companyId?: string;
  onStockUpdated?: () => void;
  stagnantComponent?: React.ReactNode;
}

export function MobileSupplyChainView({
  products,
  skuGroups,
  totalProducts,
  totalStockUnits,
  searchQuery,
  setSearchQuery,
  filterTab,
  setFilterTab,
  activeMainView,
  setActiveMainView,
  onOpenReplenishmentPlanner,
  onCopyAvailableStock,
  copiedStockFeedback,
  onUpdateStock,
  onSaveAllStockChanges,
  onDiscardStockChanges,
  pendingStockChanges,
  isSavingStock,
  onAddFlavorSubmit,
  onSaveFullProductEdit,
  onDeleteGroup,
  onDeleteProduct,
  onOpenNewProductModal,
  stagnantComponent,
}: MobileSupplyChainViewProps) {
  // Bottom Sheet States
  const [flavorsSheetGroup, setFlavorsSheetGroup] = useState<MobileSKUGroup | null>(null);
  const [addFlavorSheetGroup, setAddFlavorSheetGroup] = useState<MobileSKUGroup | null>(null);
  const [newFlavorName, setNewFlavorName] = useState("");
  const [newFlavorStock, setNewFlavorStock] = useState("0");
  const [isSubmittingFlavor, setIsSubmittingFlavor] = useState(false);

  // Edit Product Sheet State
  const [editSheetGroup, setEditSheetGroup] = useState<MobileSKUGroup | null>(null);
  const [editBrand, setEditBrand] = useState("");
  const [editName, setEditName] = useState("");
  const [editPuffs, setEditPuffs] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Menu Sheet State (3 dots)
  const [menuSheetGroup, setMenuSheetGroup] = useState<MobileSKUGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

  // Sabor Delete Confirmation State
  const [confirmDeleteFlavorId, setConfirmDeleteFlavorId] = useState<string | null>(null);

  const pendingCount = Object.keys(pendingStockChanges).length;

  // Sync active group data when products change
  const currentFlavorsGroup = useMemo(() => {
    if (!flavorsSheetGroup) return null;
    return skuGroups.find(g => g.groupKey === flavorsSheetGroup.groupKey) || flavorsSheetGroup;
  }, [skuGroups, flavorsSheetGroup]);

  // Open Edit Product Sheet
  const handleOpenEdit = (group: MobileSKUGroup) => {
    setEditSheetGroup(group);
    setEditBrand(group.brand || "");
    setEditName(group.name || "");
    setEditPuffs(group.puffs?.toString() || "");
    setEditPrice(group.price?.toString().replace(".", ",") || "");
    setEditCostPrice(group.cost_price ? group.cost_price.toString().replace(".", ",") : "");
    setEditImageFile(null);
    setEditImagePreview(group.image_url || "");
    setMenuSheetGroup(null);
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setEditImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSheetGroup || isSavingProduct) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      alert("Por favor, preencha o nome do modelo.");
      return;
    }

    const priceClean = editPrice.replace(/\s/g, '').replace(',', '.');
    const parsedPrice = parseFloat(priceClean);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      alert("Por favor, informe um Preço de Venda válido (ex: 85,00).");
      return;
    }

    let parsedCost: number | null = null;
    if (editCostPrice.trim()) {
      const costClean = editCostPrice.replace(/\s/g, '').replace(',', '.');
      const val = parseFloat(costClean);
      if (!isNaN(val) && val >= 0) parsedCost = val;
    }

    setIsSavingProduct(true);
    try {
      const success = await onSaveFullProductEdit({
        group: editSheetGroup,
        brand: editBrand.trim() || "Genérico",
        name: trimmedName,
        puffs: parseInt(editPuffs) || 5000,
        price: parsedPrice,
        cost_price: parsedCost,
        imageFile: editImageFile,
      });
      if (success) {
        setEditSheetGroup(null);
      }
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Add Flavor Submit
  const handleAddFlavor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFlavorSheetGroup || isSubmittingFlavor) return;
    const trimmed = newFlavorName.trim();
    if (!trimmed) {
      alert("Por favor, digite o nome do sabor.");
      return;
    }

    const stockVal = parseInt(newFlavorStock) || 0;
    setIsSubmittingFlavor(true);
    try {
      const ok = await onAddFlavorSubmit(addFlavorSheetGroup, trimmed, stockVal);
      if (ok) {
        setAddFlavorSheetGroup(null);
        setNewFlavorName("");
        setNewFlavorStock("0");
      }
    } finally {
      setIsSubmittingFlavor(false);
    }
  };

  // Delete Group
  const handleDeleteGroupClick = async (group: MobileSKUGroup) => {
    if (confirmDeleteGroupId !== group.groupKey) {
      setConfirmDeleteGroupId(group.groupKey);
      return;
    }
    setIsDeletingGroup(true);
    try {
      await onDeleteGroup(group);
      setMenuSheetGroup(null);
      setFlavorsSheetGroup(null);
    } finally {
      setIsDeletingGroup(false);
      setConfirmDeleteGroupId(null);
    }
  };

  // Delete Flavor
  const handleDeleteFlavorClick = async (flavorId: string, flavorName: string) => {
    if (confirmDeleteFlavorId !== flavorId) {
      setConfirmDeleteFlavorId(flavorId);
      return;
    }
    try {
      await onDeleteProduct(flavorId, flavorName);
      setConfirmDeleteFlavorId(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-[calc(100vh-48px-64px)] pb-28 pt-2 px-3.5 space-y-3.5 text-white">
      {/* ━━━ 1. HEADER MOBILE COMPACTO ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-white shrink-0">ESTOQUE</h1>
          <span className="text-xs font-semibold text-muted-foreground truncate">
            {totalProducts} {totalProducts === 1 ? "modelo" : "modelos"} · {totalStockUnits} un.
          </span>
        </div>

        {/* Alternador Compacto Estoque / Parados */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => setActiveMainView("ESTOQUE")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainView === "ESTOQUE"
                ? "bg-white text-black shadow-sm"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            Estoque
          </button>
          <button
            type="button"
            onClick={() => setActiveMainView("PARADOS")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeMainView === "PARADOS"
                ? "bg-amber-400 text-black shadow-sm"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <Clock className="size-3" />
            <span>Parados</span>
          </button>
        </div>
      </div>

      {/* ━━━ SE VISÃO PARADOS ATIVA: RENDERIZA PRODUTOS PARADOS ━━━ */}
      {activeMainView === "PARADOS" && (
        <div className="space-y-3 animate-fadeIn">
          {stagnantComponent}
        </div>
      )}

      {/* ━━━ SE VISÃO ESTOQUE ATIVA: RENDERIZA CONTROLES DE ESTOQUE ━━━ */}
      {activeMainView === "ESTOQUE" && (
        <>
          {/* ━━━ 2. AÇÕES PRINCIPAIS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="space-y-2">
            {/* Botão Primário de Destaque */}
            <button
              type="button"
              onClick={onOpenNewProductModal}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus className="size-4 stroke-[3]" />
              <span>Novo Produto</span>
            </button>

            {/* Linha de Ações Secundárias Compactas */}
            <div className="grid grid-cols-2 gap-2">
              {/* Botão Copiar Estoque com Feedback Refinado */}
              <button
                type="button"
                onClick={onCopyAvailableStock}
                className={`h-9 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
                  copiedStockFeedback
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-white/5 hover:bg-white/10 border-white/10 text-white/90"
                }`}
                title="Copiar lista de estoque disponível"
              >
                {copiedStockFeedback ? (
                  <>
                    <Check className="size-3.5 text-emerald-400 shrink-0" />
                    <span className="font-bold truncate">Estoque copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">Copiar Estoque</span>
                  </>
                )}
              </button>

              {/* Botão Planejador de Recompra */}
              <button
                type="button"
                onClick={onOpenReplenishmentPlanner}
                className="h-9 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
              >
                <PackageSearch className="size-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">Recompra</span>
              </button>
            </div>
          </div>

          {/* ━━━ 3. BUSCA E FILTROS RÁPIDOS ━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="space-y-2">
            {/* Input de Busca */}
            <div className="relative">
              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar produto ou sabor..."
                className="w-full h-11 bg-[#141414] border border-white/10 rounded-xl pl-10 pr-9 text-base text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-white"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Chips de Status (Horizontal Scrollable) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
              <button
                type="button"
                onClick={() => setFilterTab("TODOS")}
                className={`h-8 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  filterTab === "TODOS"
                    ? "bg-white text-black shadow-sm"
                    : "bg-white/5 text-muted-foreground hover:text-white border border-white/5"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("EM_ESTOQUE")}
                className={`h-8 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  filterTab === "EM_ESTOQUE"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-white/5 text-muted-foreground hover:text-white border border-white/5"
                }`}
              >
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Em estoque
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("BAIXO_ESTOQUE")}
                className={`h-8 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  filterTab === "BAIXO_ESTOQUE"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-white/5 text-muted-foreground hover:text-white border border-white/5"
                }`}
              >
                <span className="size-1.5 rounded-full bg-amber-400" />
                Baixo estoque
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("SEM_ESTOQUE")}
                className={`h-8 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  filterTab === "SEM_ESTOQUE"
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "bg-white/5 text-muted-foreground hover:text-white border border-white/5"
                }`}
              >
                <span className="size-1.5 rounded-full bg-red-400" />
                Sem estoque
              </button>
            </div>
          </div>

          {/* ━━━ 4. LISTA DE MODELOS (CARDS COMPACTOS) ━━━━━━━━━ */}
          <div className="space-y-2.5">
            {skuGroups.length === 0 ? (
              <div className="bg-[#141414] border border-white/10 rounded-2xl p-8 text-center space-y-2">
                <PackageSearch className="size-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold text-white">Nenhum produto encontrado</p>
                <p className="text-xs text-muted-foreground">Tente alterar os termos de busca ou filtros.</p>
              </div>
            ) : (
              skuGroups.map((group) => {
                const isOutOfStock = group.totalStock <= 0;
                const isLowStock = group.totalStock > 0 && group.totalStock < 5;
                const topFlavors = group.flavors.slice(0, 3);
                const hasMoreFlavors = group.flavors.length > 3;

                return (
                  <div
                    key={group.groupKey}
                    className={`bg-[#141414] border rounded-2xl p-3.5 space-y-2.5 transition-all ${
                      isOutOfStock
                        ? "border-red-500/20 opacity-90"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    {/* Linha Superior: Imagem + Marca/Modelo/Preço + Badge de Estoque */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Imagem do Produto */}
                        {group.image_url ? (
                          <img
                            src={group.image_url}
                            alt={group.name}
                            className="size-11 rounded-xl object-contain bg-black/60 p-1 border border-white/10 shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-muted-foreground font-bold text-[11px]">
                            {group.brand?.substring(0, 2).toUpperCase() || "POD"}
                          </div>
                        )}

                        {/* Textos: Marca, Modelo, Preço */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">
                              {group.brand}
                            </span>
                            {group.puffs ? (
                              <span className="text-[10px] text-white/40">· {group.puffs} puffs</span>
                            ) : null}
                          </div>
                          <h3 className="font-bold text-white text-sm truncate leading-tight mt-0.5">
                            {group.name}
                          </h3>
                          <div className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                            {formatBRL(group.price)}
                          </div>
                        </div>
                      </div>

                      {/* Badge de Estoque Total do Modelo */}
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                            isOutOfStock
                              ? "bg-red-500/15 text-red-400 border border-red-500/30"
                              : isLowStock
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              isOutOfStock ? "bg-red-400" : isLowStock ? "bg-amber-400" : "bg-emerald-400"
                            }`}
                          />
                          {group.totalStock} un.
                        </span>
                      </div>
                    </div>

                    {/* ━━━ SABORES COMPACTOS (Até 3 itens) ━━━ */}
                    <div className="bg-black/40 border border-white/5 rounded-xl p-2 space-y-1">
                      {topFlavors.map((f: any) => {
                        const stock = typeof f.stock === "number" ? f.stock : parseInt(f.stock) || 0;
                        const out = stock <= 0;
                        return (
                          <div
                            key={f.id}
                            className="flex items-center justify-between text-xs py-0.5 px-1 rounded"
                          >
                            <span
                              className={`truncate mr-2 ${
                                out
                                  ? "text-white/40 line-through decoration-white/20"
                                  : "text-white/90"
                              }`}
                            >
                              {f.flavor}
                            </span>
                            <span
                              className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                out
                                  ? "bg-red-500/10 text-red-400/90"
                                  : stock < 3
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-white/10 text-white"
                              }`}
                            >
                              ×{stock}
                            </span>
                          </div>
                        );
                      })}

                      {/* Botão para ver todos os sabores */}
                      {hasMoreFlavors && (
                        <button
                          type="button"
                          onClick={() => setFlavorsSheetGroup(group)}
                          className="w-full text-center text-[11px] font-bold text-emerald-400 hover:text-emerald-300 pt-1.5 border-t border-white/5 cursor-pointer block"
                        >
                          Ver todos os {group.flavors.length} sabores →
                        </button>
                      )}
                    </div>

                    {/* ━━━ BARRA DE AÇÕES DO CARD ━━━ */}
                    <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => setFlavorsSheetGroup(group)}
                        className="flex-1 h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Boxes className="size-3.5 text-emerald-400" />
                        <span>Sabores ({group.flavors.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(group)}
                        className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Edit3 className="size-3.5 text-muted-foreground" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMenuSheetGroup(group)}
                        className="size-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white flex items-center justify-center active:scale-[0.98] transition-all cursor-pointer"
                        title="Mais opções"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ━━━ BARRA FIXA FLUTUANTE DE ALTERAÇÕES PENDENTES DE ESTOQUE ━━━ */}
      {pendingCount > 0 && (
        <div className="fixed bottom-16 left-3 right-3 z-40 bg-[#161616] border border-amber-500/40 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 animate-slideUp">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-white truncate">
              {pendingCount} {pendingCount === 1 ? "alteração pendente" : "alterações pendentes"}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDiscardStockChanges}
              disabled={isSavingStock}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white transition-colors cursor-pointer"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={onSaveAllStockChanges}
              disabled={isSavingStock}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              {isSavingStock ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5 stroke-[3]" />
                  <span>Salvar</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ━━━ BOTTOM SHEET: GERENCIAR SABORES DO MODELO ━━━━━━━━━ */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {currentFlavorsGroup && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fadeIn">
          {/* Backdrop click to close */}
          <div className="flex-1" onClick={() => setFlavorsSheetGroup(null)} />

          <div className="bg-[#141414] border-t border-white/15 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden animate-slideUp shadow-2xl">
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />

            {/* Header da Gaveta */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  {currentFlavorsGroup.brand}
                </span>
                <h2 className="text-base font-extrabold text-white truncate">
                  {currentFlavorsGroup.name}
                </h2>
                <span className="text-xs text-emerald-400 font-semibold">
                  Estoque Total: {currentFlavorsGroup.totalStock} un.
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAddFlavorSheetGroup(currentFlavorsGroup);
                    setNewFlavorName("");
                    setNewFlavorStock("0");
                  }}
                  className="h-8 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <Plus className="size-3.5" />
                  <span>Sabor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlavorsSheetGroup(null)}
                  className="size-8 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Lista de Sabores com Controles Touch [ - ] QTD [ + ] */}
            <div className="overflow-y-auto p-4 space-y-2.5 flex-1 custom-scrollbar">
              {currentFlavorsGroup.flavors.map((flavor: any) => {
                const stock = typeof flavor.stock === "number" ? flavor.stock : parseInt(flavor.stock) || 0;
                const isDeletingThis = confirmDeleteFlavorId === flavor.id;

                return (
                  <div
                    key={flavor.id}
                    className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-2.5"
                  >
                    {/* Info do Sabor */}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-sm truncate">
                        {flavor.flavor}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {stock <= 0 ? (
                          <span className="text-red-400 font-semibold">Esgotado</span>
                        ) : (
                          <span className="text-white/70">{stock} un. em estoque</span>
                        )}
                      </div>
                    </div>

                    {/* Controles de Quantidade Confortáveis para Polegar (44px min) */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-black/40 border border-white/10 rounded-xl p-1">
                      {/* Botão [ - ] */}
                      <button
                        type="button"
                        onClick={() => onUpdateStock(flavor.id, Math.max(0, stock - 1))}
                        disabled={stock <= 0}
                        className={`size-10 rounded-lg flex items-center justify-center font-bold text-base transition-all active:scale-90 cursor-pointer ${
                          stock <= 0
                            ? "bg-white/5 text-white/20 cursor-not-allowed"
                            : "bg-white/10 hover:bg-white/15 text-white"
                        }`}
                      >
                        <Minus className="size-4 stroke-[2.5]" />
                      </button>

                      {/* Contador Numérico */}
                      <span className="w-10 text-center font-mono font-extrabold text-base text-white">
                        {stock}
                      </span>

                      {/* Botão [ + ] */}
                      <button
                        type="button"
                        onClick={() => onUpdateStock(flavor.id, stock + 1)}
                        className="size-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center font-bold text-base transition-all active:scale-90 cursor-pointer"
                      >
                        <Plus className="size-4 stroke-[3]" />
                      </button>
                    </div>

                    {/* Botão de Excluir Sabor SEPARADO dos Controles de Quantidade */}
                    <div className="pl-1 shrink-0">
                      {isDeletingThis ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteFlavorClick(flavor.id, flavor.flavor)}
                            className="h-9 px-2 rounded-lg bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFlavorId(null)}
                            className="size-9 rounded-lg bg-white/10 text-white flex items-center justify-center cursor-pointer"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteFlavorId(flavor.id)}
                          className="size-9 rounded-xl bg-white/5 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 border border-white/5 flex items-center justify-center transition-colors cursor-pointer"
                          title="Excluir sabor"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé da Gaveta com Botão de Fechar e Salvar */}
            <div className="p-4 border-t border-white/10 bg-[#161616] flex items-center justify-between gap-3 shrink-0 pb-safe">
              <button
                type="button"
                onClick={() => setFlavorsSheetGroup(null)}
                className="flex-1 h-11 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm flex items-center justify-center cursor-pointer"
              >
                Concluir
              </button>
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await onSaveAllStockChanges();
                  }}
                  disabled={isSavingStock}
                  className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {isSavingStock ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 stroke-[3]" />}
                  <span>Salvar Alterações</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ━━━ BOTTOM SHEET: ADICIONAR SABOR ━━━━━━━━━━━━━━━━━━━━ */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {addFlavorSheetGroup && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="flex-1" onClick={() => setAddFlavorSheetGroup(null)} />

          <div className="bg-[#141414] border-t border-white/15 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden animate-slideUp shadow-2xl">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />

            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  {addFlavorSheetGroup.brand} · {addFlavorSheetGroup.name}
                </span>
                <h2 className="text-base font-extrabold text-white">Adicionar Sabor</h2>
              </div>
              <button
                type="button"
                onClick={() => setAddFlavorSheetGroup(null)}
                className="size-8 rounded-full bg-white/10 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleAddFlavor} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-bold text-white/90 block mb-1.5">
                  Nome do Sabor *
                </label>
                <input
                  type="text"
                  required
                  value={newFlavorName}
                  onChange={(e) => setNewFlavorName(e.target.value)}
                  placeholder="Ex: Watermelon Ice, Blue Razz..."
                  className="w-full h-11 bg-[#1a1a1a] border border-white/10 rounded-xl px-3.5 text-base text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/90 block mb-1.5">
                  Estoque Inicial
                </label>
                <input
                  type="number"
                  min="0"
                  value={newFlavorStock}
                  onChange={(e) => setNewFlavorStock(e.target.value)}
                  className="w-full h-11 bg-[#1a1a1a] border border-white/10 rounded-xl px-3.5 text-base text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="pt-2 pb-safe">
                <button
                  type="submit"
                  disabled={isSubmittingFlavor}
                  className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  {isSubmittingFlavor ? (
                    <Loader2 className="size-4 animate-spin text-black" />
                  ) : (
                    <Plus className="size-4 stroke-[3]" />
                  )}
                  <span>Salvar Sabor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ━━━ BOTTOM SHEET: EDITAR MODELO/PRODUTO ━━━━━━━━━━━━━━ */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {editSheetGroup && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="flex-1" onClick={() => setEditSheetGroup(null)} />

          <div className="bg-[#141414] border-t border-white/15 rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp shadow-2xl">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />

            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Editar Produto
                </span>
                <h2 className="text-base font-extrabold text-white truncate">
                  {editSheetGroup.brand} {editSheetGroup.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditSheetGroup(null)}
                className="size-8 rounded-full bg-white/10 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
              {/* Imagem */}
              <div>
                <label className="text-xs font-bold text-white/90 block mb-1.5">
                  Foto do Produto
                </label>
                <div className="flex items-center gap-3">
                  {editImagePreview ? (
                    <img
                      src={editImagePreview}
                      alt="Preview"
                      className="size-16 rounded-xl object-contain bg-black/60 border border-white/15 p-1 shrink-0"
                    />
                  ) : (
                    <div className="size-16 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center text-muted-foreground shrink-0">
                      <ImagePlus className="size-6" />
                    </div>
                  )}

                  <div className="flex-1">
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="h-10 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/10 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="size-3.5" />
                      <span>Alterar Foto</span>
                    </button>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      JPG, PNG ou WebP.
                    </p>
                  </div>
                </div>
              </div>

              {/* Marca */}
              <div>
                <label className="text-xs font-bold text-white/90 block mb-1">
                  Marca
                </label>
                <input
                  type="text"
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                  placeholder="Ex: Elfbar, Ignite, Oxbar..."
                  className="w-full h-11 bg-[#1a1a1a] border border-white/10 rounded-xl px-3.5 text-base text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Modelo */}
              <div>
                <label className="text-xs font-bold text-white/90 block mb-1">
                  Modelo *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ex: BC15000, V150..."
                  className="w-full h-11 bg-[#1a1a1a] border border-white/10 rounded-xl px-3.5 text-base text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Puffs */}
              <div>
                <label className="text-xs font-bold text-white/90 block mb-1">
                  Puffs
                </label>
                <input
                  type="number"
                  value={editPuffs}
                  onChange={(e) => setEditPuffs(e.target.value)}
                  placeholder="Ex: 15000"
                  className="w-full h-11 bg-[#1a1a1a] border border-white/10 rounded-xl px-3.5 text-base text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Preço de Venda e Custo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-white/90 block mb-1">
                    Preço de Venda (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="Ex: 85,00"
                    className="w-full h-11 bg-[#1a1a1a] border border-white/10 rounded-xl px-3.5 text-base text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/90 block mb-1">
                    Custo Unitário (R$)
                  </label>
                  <input
                    type="text"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    placeholder="Ex: 45,00"
                    className="w-full h-11 bg-[#1a1a1a] border border-white/10 rounded-xl px-3.5 text-base text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="pt-3 pb-safe">
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  {isSavingProduct ? (
                    <Loader2 className="size-4 animate-spin text-black" />
                  ) : (
                    <Check className="size-4 stroke-[3]" />
                  )}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ━━━ BOTTOM SHEET: MENU DO MODELO (3 PONTOS) ━━━━━━━━━━ */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {menuSheetGroup && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="flex-1" onClick={() => setMenuSheetGroup(null)} />

          <div className="bg-[#141414] border-t border-white/15 rounded-t-3xl p-4 space-y-2 animate-slideUp shadow-2xl pb-safe">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-3 shrink-0" />

            <div className="pb-2 border-b border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                {menuSheetGroup.brand}
              </span>
              <h3 className="text-base font-extrabold text-white truncate">
                {menuSheetGroup.name}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => {
                setFlavorsSheetGroup(menuSheetGroup);
                setMenuSheetGroup(null);
              }}
              className="w-full h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm flex items-center gap-3 px-4 transition-colors cursor-pointer"
            >
              <Boxes className="size-4 text-emerald-400" />
              <span>Gerenciar Sabores ({menuSheetGroup.flavors.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleOpenEdit(menuSheetGroup);
              }}
              className="w-full h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm flex items-center gap-3 px-4 transition-colors cursor-pointer"
            >
              <Edit3 className="size-4 text-muted-foreground" />
              <span>Editar Produto</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAddFlavorSheetGroup(menuSheetGroup);
                setMenuSheetGroup(null);
                setNewFlavorName("");
                setNewFlavorStock("0");
              }}
              className="w-full h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm flex items-center gap-3 px-4 transition-colors cursor-pointer"
            >
              <Plus className="size-4 text-emerald-400" />
              <span>Adicionar Sabor</span>
            </button>

            {/* Exclusão do Modelo (com 2 passos de confirmação) */}
            <div className="pt-2 border-t border-white/10">
              {confirmDeleteGroupId === menuSheetGroup.groupKey ? (
                <div className="space-y-2">
                  <p className="text-xs text-red-300 font-semibold text-center">
                    Tem certeza? Isso excluirá o modelo e todos os seus {menuSheetGroup.flavors.length} sabores.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteGroupId(null)}
                      className="h-11 rounded-xl bg-white/10 text-white text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroupClick(menuSheetGroup)}
                      disabled={isDeletingGroup}
                      className="h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/30"
                    >
                      {isDeletingGroup ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      <span>Sim, Excluir</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteGroupId(menuSheetGroup.groupKey)}
                  className="w-full h-12 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-sm flex items-center gap-3 px-4 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-4 text-red-400" />
                  <span>Excluir Modelo Completo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
