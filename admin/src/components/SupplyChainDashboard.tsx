import { useState, useEffect, useRef, useMemo } from "react";
import { 
  PackageSearch, Plus, Minus, Eye, EyeOff, Loader2, ImagePlus, Upload, 
  Trash2, Search, Filter, ArrowUpDown, MoreVertical, Copy, Edit3, DollarSign, 
  CheckCircle2, X, TrendingUp, PieChart, ChevronRight, ChevronDown, ChevronUp, 
  Tag, Box, Camera, Download, FileText, BarChart3, Check, Share2, Smartphone, 
  Monitor, Store, ExternalLink, ListOrdered, Save, Star, ShoppingCart
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/cart";
import { useAuth } from "../contexts/AuthContext";
import { fetchCategories, fetchProductCategoryMappings, updateModelCategories, DEFAULT_CATEGORIES, type Category } from "../lib/categories";
import { fetchProductCostsMap, updateProductCost } from "../lib/productCosts";
import { ManualSaleModal } from "./ManualSaleModal";

// ─── Donut chart colors ───────────────────────────────────
const DONUT_COLORS = ["#34d399", "#60a5fa", "#a78bfa", "#fbbf24", "#f87171", "#f472b6", "#38bdf8"];
const MEDAL_STYLES = [
  { emoji: "🥇", barFrom: "from-amber-400", barTo: "to-yellow-300", text: "text-amber-300" },
  { emoji: "🥈", barFrom: "from-slate-400", barTo: "to-slate-300", text: "text-slate-300" },
  { emoji: "🥉", barFrom: "from-orange-500", barTo: "to-orange-300", text: "text-orange-300" },
];

export function SupplyChainDashboard() {
  const { company } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [topSelling, setTopSelling] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ─── Modal Flutuante Centralizado de Novo Produto ──────
  const [showNewProductModal, setShowNewProductModal] = useState(false);

  // ─── Modal de Registro de Vendas Manuais ──────────────
  const [isManualSaleModalOpen, setIsManualSaleModalOpen] = useState(false);
  const [preSelectedFlavorIdForSale, setPreSelectedFlavorIdForSale] = useState<string | null>(null);
  const [preSelectedGroupForSale, setPreSelectedGroupForSale] = useState<any | null>(null);

  // ─── Estados de Categorias e Destaques (⭐) ─────────────
  const [categoriesList, setCategoriesList] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, { category_ids: string[]; display_order: number }>>({});
  const [editingCategoryGroup, setEditingCategoryGroup] = useState<any | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedDisplayOrder, setSelectedDisplayOrder] = useState<string>("1");
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Form states (Cadastro de Modelo)
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [puffs, setPuffs] = useState("");

  // Upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para upload de imagem no Hover do Modelo
  const [uploadingGroupKey, setUploadingGroupKey] = useState<string | null>(null);

  // Modal para Adicionar Sabor a um Modelo Existente
  const [addingFlavorGroup, setAddingFlavorGroup] = useState<any | null>(null);
  const [newFlavorName, setNewFlavorName] = useState("");
  const [newFlavorStock, setNewFlavorStock] = useState("");
  const [submittingFlavor, setSubmittingFlavor] = useState(false);

  // Filtros ERP Limpos (Marca + Status de Estoque por Sabor)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"TODOS" | "EM_ESTOQUE" | "BAIXO_ESTOQUE" | "SEM_ESTOQUE">("TODOS");

  // Estado para grupos expandidos no Accordion
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>({});

  // Função de validação e conversão monetária (suporta '35', '35.00', '35,00', '89,90')
  const parseMonetaryInput = (val: string): number | null => {
    if (val === null || val === undefined) return null;
    const trimmed = val.toString().trim().replace(/\s/g, '').replace(',', '.');
    if (!trimmed) return null;
    const num = parseFloat(trimmed);
    if (isNaN(num) || !isFinite(num) || num < 0) return null;
    return Math.round(num * 100) / 100;
  };

  // Estado para o menu de 3 pontos do grupo/modelo
  const [activeGroupMenuKey, setActiveGroupMenuKey] = useState<string | null>(null);

  // Estado para Modal de Edição de Preço/Custo em Lote por Grupo
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [batchPrice, setBatchPrice] = useState<string>("");
  const [batchCostPrice, setBatchCostPrice] = useState<string>("");
  const [isSavingBatchPrice, setIsSavingBatchPrice] = useState(false);

  // Estado para Modal de Edição Completa do Produto (Marca, Modelo, Puffs, Preço, Custo, Imagem)
  const [editingFullProduct, setEditingFullProduct] = useState<any | null>(null);
  const [editBrand, setEditBrand] = useState("");
  const [editName, setEditName] = useState("");
  const [editPuffs, setEditPuffs] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState("");
  const [isSavingFullProduct, setIsSavingFullProduct] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Estado para Edição de Preço/Custo de Sabor / Variação Individual
  const [isEditingSingleSkuPrice, setIsEditingSingleSkuPrice] = useState(false);
  const [singleSkuPriceInput, setSingleSkuPriceInput] = useState("");
  const [singleSkuCostInput, setSingleSkuCostInput] = useState("");
  const [isSavingSingleSkuPrice, setIsSavingSingleSkuPrice] = useState(false);

  // Estado para Pop-up de Edição de Estoque por Sabor
  const [editingStockSku, setEditingStockSku] = useState<any | null>(null);
  const [newStockValue, setNewStockValue] = useState<string>("");

  // Estado para Gaveta Lateral (Drawer) de Detalhes do SKU
  const [selectedDrawerSKU, setSelectedDrawerSKU] = useState<any | null>(null);

  // Estado para Modal Card dedicado de Gestão de Sabores por Modelo
  const [viewingFlavorsGroup, setViewingFlavorsGroup] = useState<any | null>(null);

  // Estado para modelo expandido no Ranking de Vendas por Modelo
  const [expandedRankingModelKey, setExpandedRankingModelKey] = useState<string | null>(null);

  // Estado para Alterações Pendentes de Estoque (Botão Salvar no Canto Inferior Direito)
  const [pendingStockChanges, setPendingStockChanges] = useState<Record<string, number>>({});
  const pendingStockChangesRef = useRef<Record<string, number>>({});
  const [isSavingStock, setIsSavingStock] = useState(false);

  useEffect(() => {
    pendingStockChangesRef.current = pendingStockChanges;
  }, [pendingStockChanges]);

  // Estado para Modal de Ranking Completo de Vendas
  const [showFullRankingModal, setShowFullRankingModal] = useState(false);
  const [rankingSearchQuery, setRankingSearchQuery] = useState("");

  // Estado para Modal de Pré-visualização do Catálogo Público (Front do Cliente)
  const [showCatalogPreviewModal, setShowCatalogPreviewModal] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [copiedCatalogLink, setCopiedCatalogLink] = useState(false);

  const catalogUrl = window.location.port === '5174' ? `${window.location.protocol}//${window.location.hostname}:5175` : `${window.location.origin}/catalogo`;

  const handleCopyCatalogLink = () => {
    try {
      navigator.clipboard.writeText(catalogUrl);
      setCopiedCatalogLink(true);
      setTimeout(() => setCopiedCatalogLink(false), 2500);
    } catch (e) {
      console.warn('Erro ao copiar link:', e);
    }
  };

  const handleShareWhatsAppCatalog = () => {
    const text = `Confira nosso catálogo oficial de pods atualizado e faça seu pedido online:\n${catalogUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // ─── Helpers ────────────────────────────────────────────
  const getGroupDisplayName = (brand: string, name: string) => {
    const b = (brand || '').trim();
    const n = (name || '').trim();
    if (!b) return n;
    if (!n) return b;
    if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
    return `${b} ${n}`;
  };

  const compressImage = (file: File, maxWidth = 500, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadProductImage = async (file: File): Promise<string> => {
    try {
      const compressedBase64 = await compressImage(file);
      const blob = await (await fetch(compressedBase64)).blob();
      const fileExt = "jpg";
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `product_images/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("products")
        .upload(filePath, blob, { contentType: "image/jpeg", upsert: true });

      if (uploadErr) return compressedBase64;
      const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(filePath);
      return publicUrlData?.publicUrl || compressedBase64;
    } catch (e) {
      return await compressImage(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
  };
  const handleImageChange = handleFileChange;

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) processSelectedFile(file);
  };

  // ─── Data Fetching ──────────────────────────────────────
  const fetchData = async () => {
    const targetCompanyId = company?.id || 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
    try {
      const { data: prodData } = await supabase
        .from("smoking_products")
        .select("*")
        .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
        .neq("brand", "__STORE_CONFIG__")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });

      const { data: realOrders } = await supabase
        .from("smoking_orders")
        .select("items, delivery_status")
        .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
        .neq("delivery_status", "CANCELADO");

      let realSalesList: any[] = [];
      if (realOrders && realOrders.length > 0) {
        const flavorSalesMap: Record<string, { product_name: string; flavor: string; total_sold: number }> = {};
        realOrders.forEach((ord: any) => {
          if (ord.items && Array.isArray(ord.items)) {
            ord.items.forEach((it: any) => {
              const pName = it.name || it.product_name || 'Pod';
              const fName = it.flavor || '';
              const qty = parseInt(it.quantity) || 1;
              const key = `${pName.toLowerCase()}__${fName.toLowerCase()}`;
              if (!flavorSalesMap[key]) {
                flavorSalesMap[key] = { product_name: pName, flavor: fName, total_sold: 0 };
              }
              flavorSalesMap[key].total_sold += qty;
            });
          }
        });
        realSalesList = Object.values(flavorSalesMap);
      }

      // Carregar Custos Persistidos no Supabase DB
      const costsMap = await fetchProductCostsMap(targetCompanyId);

      if (prodData) {
        const mergedProducts = prodData.map((p: any) => {
          const brandName = (p.brand || "Genérico").trim();
          const modelName = (p.name || "Pod").trim();
          const groupKey = `${brandName.toLowerCase()}__${modelName.toLowerCase()}`;
          const cleanKey = `${brandName.toLowerCase().replace(/\s+/g, '')}__${modelName.toLowerCase().replace(/\s+/g, '')}`;

          let costVal: number | null = null;
          if (p.cost_price !== null && p.cost_price !== undefined && parseFloat(p.cost_price) > 0) {
            costVal = parseFloat(p.cost_price);
          } else if (costsMap[p.id] && costsMap[p.id] > 0) {
            costVal = costsMap[p.id];
          } else if (costsMap[groupKey] && costsMap[groupKey] > 0) {
            costVal = costsMap[groupKey];
          } else if (costsMap[cleanKey] && costsMap[cleanKey] > 0) {
            costVal = costsMap[cleanKey];
          }

          const stagedStock = pendingStockChangesRef.current[p.id];
          return {
            ...p,
            cost_price: costVal,
            stock: stagedStock !== undefined ? stagedStock : p.stock
          };
        });
        setProducts(mergedProducts);
      }
      setTopSelling(realSalesList);

      // Carregar Categorias e Mapeamentos
      const cats = await fetchCategories();
      setCategoriesList(cats);
      const catMapRes = await fetchProductCategoryMappings(targetCompanyId);
      setCategoryMappings(catMapRes.productMap);
    } catch (err) {
      console.error("Erro ao carregar dados do Supabase:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => fetchData(), 3000);
    return () => clearInterval(intervalId);
  }, [company?.id]);

  // ─── Handlers ───────────────────────────────────────────
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedPrice = parseMonetaryInput(price);
    if (parsedPrice === null || parsedPrice <= 0) {
      alert("Por favor, informe um Preço de Venda válido e maior que zero (ex: 104,90).");
      return;
    }

    let parsedCost: number | null = null;
    if (costPrice.trim() !== "") {
      parsedCost = parseMonetaryInput(costPrice);
      if (parsedCost === null) {
        alert("Por favor, informe um Custo de Reposição numérico válido (ex: 35,00).");
        return;
      }
      if (parsedCost < 0) {
        alert("O Custo de Reposição não pode ser um número negativo.");
        return;
      }
    }
    const finalCostVal = parsedCost !== null ? parsedCost : 0;

    if (!name.trim()) {
      alert("Por favor, informe o Modelo do produto.");
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = "";
      if (imageFile) imageUrl = await uploadProductImage(imageFile);

      const newBrandName = brand.trim() || "Genérico";
      const newModelName = name.trim();
      const newPuffsVal = parseInt(puffs) || 5000;
      const targetCompanyId = company?.id || 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
      const groupKey = `${newBrandName.toLowerCase()}__${newModelName.toLowerCase()}`;

      // Persiste o custo no localStorage sob a chave do grupo/modelo
      try {
        localStorage.setItem(`smk_cost_${groupKey}`, finalCostVal.toString());
      } catch (e) {
        console.warn("Erro ao salvar custo localmente:", e);
      }

      let insertPayload: any = {
        name: newModelName, 
        brand: newBrandName, 
        flavor: "Padrão",
        price: parsedPrice, 
        cost_price: finalCostVal, 
        stock: 0,
        puffs: newPuffsVal, 
        image_url: imageUrl, 
        is_active: true,
        company_id: targetCompanyId,
      };

      // Garante que o vínculo company_users existe no Supabase antes de inserir
      if (company?.id) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          try {
            await supabase.from("companies").upsert({
              id: company.id, name: company.name || 'Minha Loja', email: session.user.email || '', onboarding_done: true
            }, { onConflict: 'id' });
          } catch (e) {}

          try {
            await supabase.from("company_users").upsert({
              company_id: company.id, auth_user_id: session.user.id, name: 'Administrador', email: session.user.email || '', role: 'admin'
            }, { onConflict: 'company_id,auth_user_id' });
          } catch (e) {}
        }
      }

      let { data, error } = await supabase.from("smoking_products").insert(insertPayload).select();

      if (error && (error.message?.includes("cost_price") || error.code === "PGRST204")) {
        delete insertPayload.cost_price;
        const fallbackRes = await supabase.from("smoking_products").insert(insertPayload).select();
        data = fallbackRes.data; error = fallbackRes.error;
      }

      if (error) {
        console.error("Erro do Supabase ao cadastrar produto:", error);
        alert("Não foi possível cadastrar o produto no banco de dados. Tente novamente.");
        return;
      }

      const insertedId = (data && data[0]) ? data[0].id : `prod-${Date.now()}`;
      try {
        localStorage.setItem(`smk_cost_${insertedId}`, finalCostVal.toString());
      } catch (e) {}

      const createdProduct = (data && data[0]) ? {
        ...data[0],
        cost_price: finalCostVal
      } : {
        id: insertedId,
        name: newModelName,
        brand: newBrandName,
        flavor: "Padrão",
        price: parsedPrice,
        cost_price: finalCostVal,
        stock: 0,
        puffs: newPuffsVal,
        image_url: imageUrl,
        is_active: true,
        company_id: targetCompanyId,
        created_at: new Date().toISOString()
      };

      setProducts(prev => [createdProduct, ...prev]);

      setName(""); setBrand(""); setPrice(""); setCostPrice(""); setPuffs("");
      setImageFile(null); setImagePreview("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowNewProductModal(false);

      alert("Modelo cadastrado com sucesso.");

      setAddingFlavorGroup({
        brand: newBrandName, name: newModelName, price: parsedPrice,
        cost_price: finalCostVal, puffs: newPuffsVal, image_url: imageUrl,
      });
      setNewFlavorName(""); setNewFlavorStock("");
      await fetchData();
    } catch (err: any) {
      console.error("Erro inesperado ao cadastrar produto:", err);
      alert("Não foi possível cadastrar o produto. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateGroupImage = async (group: any, file: File) => {
    setUploadingGroupKey(group.groupKey);
    try {
      const newImageUrl = await uploadProductImage(file);
      const ids = group.flavors.map((f: any) => f.id);
      setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, image_url: newImageUrl } : p));
      await supabase.from("smoking_products").update({ image_url: newImageUrl }).in("id", ids);
    } catch (err) {
      console.error("Erro ao atualizar imagem do modelo:", err);
      fetchData();
    } finally {
      setUploadingGroupKey(null);
    }
  };

  const handleAddFlavorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingFlavorGroup || !newFlavorName.trim()) {
      alert("Por favor, informe o nome do sabor.");
      return;
    }

    const addedName = newFlavorName.trim();
    const modelName = getGroupDisplayName(addingFlavorGroup.brand, addingFlavorGroup.name);
    const initialStock = parseInt(newFlavorStock) || 0;

    const confirmSave = window.confirm(
      `Deseja salvar o sabor "${addedName}" (${initialStock} un. em estoque) no modelo ${modelName} e atualizar o cardápio digital agora?\n\nClique em [OK] para salvar ou [Cancelar] para descartar.`
    );

    if (!confirmSave) {
      setAddingFlavorGroup(null);
      setNewFlavorName("");
      setNewFlavorStock("");
      return;
    }

    setSubmittingFlavor(true);
    try {
      let insertPayload: any = {
        name: addingFlavorGroup.name, brand: addingFlavorGroup.brand,
        flavor: addedName, price: addingFlavorGroup.price,
        cost_price: addingFlavorGroup.cost_price || 0,
        stock: initialStock, puffs: addingFlavorGroup.puffs || 5000,
        image_url: addingFlavorGroup.image_url || "", is_active: true,
        company_id: company?.id || null,
      };
      let { data, error } = await supabase.from("smoking_products").insert(insertPayload).select();
      if (error && (error.message?.includes("cost_price") || error.code === "PGRST204")) {
        delete insertPayload.cost_price;
        const fallbackRes = await supabase.from("smoking_products").insert(insertPayload).select();
        data = fallbackRes.data; error = fallbackRes.error;
      }

      const createdFlavor = (data && data[0]) ? data[0] : {
        id: `flavor-${Date.now()}`,
        name: addingFlavorGroup.name,
        brand: addingFlavorGroup.brand,
        flavor: addedName,
        price: addingFlavorGroup.price,
        cost_price: addingFlavorGroup.cost_price || 0,
        stock: initialStock,
        puffs: addingFlavorGroup.puffs || 5000,
        image_url: addingFlavorGroup.image_url || "",
        is_active: true,
        company_id: company?.id || null,
        created_at: new Date().toISOString()
      };

      setProducts(prev => [createdFlavor, ...prev]);
      setAddingFlavorGroup(null); 
      setNewFlavorName(""); 
      setNewFlavorStock("");
      alert(`Sabor "${addedName}" salvo com sucesso e atualizado no cardápio digital!`);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao adicionar sabor: " + err.message);
    } finally {
      setSubmittingFlavor(false);
    }
  };

  const handleUpdateStock = (id: string, newStock: number) => {
    if (newStock < 0) return;
    const updated = { ...pendingStockChangesRef.current, [id]: newStock };
    pendingStockChangesRef.current = updated;
    setPendingStockChanges(updated);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p));
    if (selectedDrawerSKU?.id === id) {
      setSelectedDrawerSKU((prev: any) => prev ? { ...prev, stock: newStock } : null);
    }
  };

  const handleSaveAllStockChanges = async () => {
    const entries = Object.entries(pendingStockChangesRef.current);
    if (entries.length === 0) return;
    setIsSavingStock(true);
    try {
      for (const [id, stock] of entries) {
        let query = supabase.from("smoking_products").update({ stock }).eq("id", id);
        if (company?.id) query = query.eq("company_id", company.id);
        const { data, error } = await query.select();
        if (error || !data || data.length === 0) {
          await supabase.from("smoking_products").update({ stock }).eq("id", id);
        }
      }
      pendingStockChangesRef.current = {};
      setPendingStockChanges({});
      alert("Alterações de estoque salvas com sucesso no Supabase e sincronizadas com o cardápio!");
      await fetchData();
    } catch (err) {
      console.error("Erro ao salvar alterações de estoque:", err);
      alert("Ocorreu um erro ao salvar as alterações de estoque.");
    } finally {
      setIsSavingStock(false);
    }
  };

  const handleDiscardStockChanges = async () => {
    pendingStockChangesRef.current = {};
    setPendingStockChanges({});
    await fetchData();
  };

  const handleSaveModalStock = async () => {
    if (!editingStockSku) return;
    const parsed = parseInt(newStockValue);
    if (!isNaN(parsed) && parsed >= 0) handleUpdateStock(editingStockSku.id, parsed);
    setEditingStockSku(null);
  };

  const handleToggleGroupActive = async (group: any) => {
    const ids = group.flavors.map((f: any) => f.id);
    const anyActive = group.flavors.some((f: any) => f.is_active);
    const newActiveState = !anyActive;
    try {
      setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, is_active: newActiveState } : p));
      await supabase.from("smoking_products").update({ is_active: newActiveState }).in("id", ids);
    } catch (err) {
      console.error(err); fetchData();
    }
  };

  const handleDeleteGroup = async (group: any) => {
    const groupName = getGroupDisplayName(group.brand, group.name);
    if (!confirm(`ATENÇÃO: Deseja excluir permanentemente o modelo "${groupName}" e todos os seus ${group.flavors.length} sabores cadastrados?`)) return;
    const ids = group.flavors.map((f: any) => f.id);
    try {
      setProducts(prev => prev.filter(p => !ids.includes(p.id)));
      if (selectedDrawerSKU && ids.includes(selectedDrawerSKU.id)) setSelectedDrawerSKU(null);
      await supabase.from("smoking_products").delete().in("id", ids);
    } catch (err) {
      console.error(err); fetchData();
    }
  };

  const handleSaveBatchGroupEdit = async () => {
    if (!editingGroup || isSavingBatchPrice) return;

    const parsedPrice = parseMonetaryInput(batchPrice);
    const parsedCost = parseMonetaryInput(batchCostPrice);

    if (parsedPrice === null && parsedCost === null) {
      alert("Por favor, insira um valor monetário válido e maior ou igual a zero.");
      return;
    }

    const targetCompanyId = company?.id || 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
    const ids = editingGroup.flavors.map((f: any) => f.id);
    if (!ids || ids.length === 0) {
      alert("Não foi possível identificar os produtos deste modelo.");
      return;
    }

    setIsSavingBatchPrice(true);

    let updatePayload: any = {};
    if (parsedPrice !== null) updatePayload.price = parsedPrice;
    if (parsedCost !== null) updatePayload.cost_price = parsedCost;

    if (parsedCost !== null) {
      try {
        localStorage.setItem(`smk_cost_${editingGroup.groupKey}`, parsedCost.toString());
        ids.forEach((id: string) => localStorage.setItem(`smk_cost_${id}`, parsedCost.toString()));
      } catch (e) {
        console.warn("Erro ao salvar no localStorage:", e);
      }
    }

    try {
      // 1. Atualização Otimista no Estado Local
      setProducts(prev => prev.map(p => ids.includes(p.id) ? { 
        ...p, 
        ...(parsedPrice !== null ? { price: parsedPrice } : {}),
        ...(parsedCost !== null ? { cost_price: parsedCost } : {})
      } : p));

      // 2. Persistência no Supabase estritamente por Empresa e IDs
      let query = supabase.from("smoking_products").update(updatePayload).in("id", ids);
      if (company?.id) query = query.eq("company_id", company.id);
      let { error } = await query;

      // Tratamento para caso a coluna cost_price não exista na tabela do Supabase
      if (error && (error.message?.includes("cost_price") || error.code === "PGRST204")) {
        const fallbackPayload = { ...updatePayload };
        delete fallbackPayload.cost_price;
        if (Object.keys(fallbackPayload).length > 0) {
          let retryQuery = supabase.from("smoking_products").update(fallbackPayload).in("id", ids);
          if (company?.id) retryQuery = retryQuery.eq("company_id", company.id);
          const fallbackRes = await retryQuery;
          error = fallbackRes.error;
        } else {
          error = null;
        }
      }

      if (error) {
        console.error("Erro do Supabase ao atualizar preços:", error);
        alert("Não foi possível atualizar o preço. Tente novamente.");
        await fetchData();
      } else {
        alert("Preço atualizado com sucesso.");
        await fetchData();
        setEditingGroup(null);
      }
    } catch (err: any) {
      console.error("Erro técnico inesperado ao salvar preço:", err);
      alert("Não foi possível atualizar o preço. Tente novamente.");
      await fetchData();
    } finally {
      setIsSavingBatchPrice(false);
    }
  };

  const handleSaveFullProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFullProduct || isSavingFullProduct) return;

    const parsedPrice = parseMonetaryInput(editPrice);
    if (parsedPrice === null || parsedPrice <= 0) {
      alert("Por favor, informe um Preço de Venda válido e maior que zero (ex: 79,90).");
      return;
    }

    let parsedCost: number | null = null;
    if (editCostPrice.trim() !== "") {
      parsedCost = parseMonetaryInput(editCostPrice);
      if (parsedCost === null) {
        alert("Por favor, informe um Custo de Reposição numérico válido (ex: 42,00).");
        return;
      }
      if (parsedCost < 0) {
        alert("O Custo de Reposição não pode ser um número negativo.");
        return;
      }
    }
    const finalCostVal = parsedCost !== null ? parsedCost : 35.00;

    if (!editName.trim()) {
      alert("Por favor, informe o Modelo do produto.");
      return;
    }

    const ids = editingFullProduct.flavors.map((f: any) => f.id);
    if (!ids || ids.length === 0) {
      alert("Não foi possível identificar os produtos deste modelo.");
      return;
    }

    setIsSavingFullProduct(true);

    try {
      let finalImageUrl = editingFullProduct.image_url || "";
      if (editImageFile) {
        finalImageUrl = await uploadProductImage(editImageFile);
      }

      const newBrandName = editBrand.trim() || "Genérico";
      const newModelName = editName.trim();
      const newPuffsVal = parseInt(editPuffs) || 5000;

      // 1. Atualização Otimista estrita no estado local (sem tocar em estoque ou campos não editados)
      setProducts(prev => prev.map(p => ids.includes(p.id) ? {
        ...p,
        brand: newBrandName,
        name: newModelName,
        puffs: newPuffsVal,
        ...(parsedPrice !== null ? { price: parsedPrice } : {}),
        ...(parsedCost !== null ? { cost_price: parsedCost } : {}),
        image_url: finalImageUrl
      } : p));

      const targetCompanyId = company?.id || 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
      const newGroupKey = `${newBrandName.toLowerCase()}__${newModelName.toLowerCase()}`;

      if (parsedCost !== null && parsedCost > 0) {
        await updateProductCost({
          modelKey: newGroupKey,
          productIds: ids,
          costPrice: parsedCost,
          companyId: targetCompanyId
        });
      }

      // 2. Atualizar Supabase enviando ESTRITAMENTE APENAS os campos editados (Partial Update Protegido)
      let updatePayload: any = {
        brand: newBrandName,
        name: newModelName,
        puffs: newPuffsVal,
        image_url: finalImageUrl
      };

      if (parsedPrice !== null) {
        updatePayload.price = parsedPrice;
      }
      if (parsedCost !== null) {
        updatePayload.cost_price = parsedCost;
      }

      let query = supabase.from("smoking_products").update(updatePayload).in("id", ids);
      if (company?.id) query = query.eq("company_id", company.id);
      let { error } = await query;

      if (error && (error.message?.includes("cost_price") || error.code === "PGRST204")) {
        const fallbackPayload = { ...updatePayload };
        delete fallbackPayload.cost_price;
        let retryQuery = supabase.from("smoking_products").update(fallbackPayload).in("id", ids);
        if (company?.id) retryQuery = retryQuery.eq("company_id", company.id);
        const fallbackRes = await retryQuery;
        error = fallbackRes.error;
      }

      if (error) {
        console.error("Erro do Supabase ao atualizar produto completo:", error);
        alert("Não foi possível salvar as alterações no banco de dados. Tente novamente.");
        await fetchData();
      } else {
        alert("Produto atualizado com sucesso.");
        await fetchData();
        setEditingFullProduct(null);
      }
    } catch (err: any) {
      console.error("Erro técnico inesperado ao editar produto:", err);
      alert("Não foi possível salvar as alterações do produto. Tente novamente.");
      await fetchData();
    } finally {
      setIsSavingFullProduct(false);
    }
  };

  const handleSaveSingleSkuPrice = async () => {
    if (!selectedDrawerSKU || isSavingSingleSkuPrice) return;

    const parsedPrice = parseMonetaryInput(singleSkuPriceInput);
    const parsedCost = parseMonetaryInput(singleSkuCostInput);

    if (parsedPrice === null && parsedCost === null) {
      alert("Por favor, insira um valor monetário válido e maior ou igual a zero.");
      return;
    }

    const skuId = selectedDrawerSKU.id;
    setIsSavingSingleSkuPrice(true);

    let updatePayload: any = {};
    if (parsedPrice !== null) updatePayload.price = parsedPrice;
    if (parsedCost !== null) updatePayload.cost_price = parsedCost;

    if (parsedCost !== null) {
      try {
        localStorage.setItem(`smk_cost_${skuId}`, parsedCost.toString());
      } catch (e) {}
    }

    try {
      // 1. Atualização Otimista no Estado Local (somente o SKU selecionado)
      setProducts(prev => prev.map(p => p.id === skuId ? {
        ...p,
        ...(parsedPrice !== null ? { price: parsedPrice } : {}),
        ...(parsedCost !== null ? { cost_price: parsedCost } : {})
      } : p));

      setSelectedDrawerSKU((prev: any) => prev ? {
        ...prev,
        ...(parsedPrice !== null ? { price: parsedPrice } : {}),
        ...(parsedCost !== null ? { cost_price: parsedCost } : {})
      } : null);

      // 2. Persistência no Supabase estritamente por ID da variação e Empresa
      let query = supabase.from("smoking_products").update(updatePayload).eq("id", skuId);
      if (company?.id) query = query.eq("company_id", company.id);
      let { error } = await query;

      if (error && (error.message?.includes("cost_price") || error.code === "PGRST204")) {
        const fallbackPayload = { ...updatePayload };
        delete fallbackPayload.cost_price;
        if (Object.keys(fallbackPayload).length > 0) {
          let retryQuery = supabase.from("smoking_products").update(fallbackPayload).eq("id", skuId);
          if (company?.id) retryQuery = retryQuery.eq("company_id", company.id);
          const fallbackRes = await retryQuery;
          error = fallbackRes.error;
        } else {
          error = null;
        }
      }

      if (error) {
        console.error("Erro do Supabase ao atualizar variação:", error);
        alert("Não foi possível atualizar o preço. Tente novamente.");
        await fetchData();
      } else {
        alert("Preço atualizado com sucesso.");
        await fetchData();
        setIsEditingSingleSkuPrice(false);
      }
    } catch (err: any) {
      console.error("Erro técnico ao salvar variação:", err);
      alert("Não foi possível atualizar o preço. Tente novamente.");
      await fetchData();
    } finally {
      setIsSavingSingleSkuPrice(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
      if (selectedDrawerSKU?.id === id) {
        setSelectedDrawerSKU((prev: any) => prev ? { ...prev, is_active: !currentStatus } : null);
      }
      await supabase.from("smoking_products").update({ is_active: !currentStatus }).eq("id", id);
    } catch (err) { fetchData(); }
  };

  const handleDeleteProduct = async (id: string, flavorName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o SKU "${flavorName}" permanentemente?`)) return;
    try {
      setProducts(prev => prev.filter(p => p.id !== id));
      if (selectedDrawerSKU?.id === id) setSelectedDrawerSKU(null);
      await supabase.from("smoking_products").delete().eq("id", id);
    } catch (err) { fetchData(); }
  };

  const handleDuplicateSKU = async (sku: any) => {
    try {
      const { data, error } = await supabase.from("smoking_products").insert({
        name: `${sku.name} (Cópia)`, brand: sku.brand, flavor: `${sku.flavor} (Cópia)`,
        price: sku.price, cost_price: sku.cost_price || 0, stock: 0,
        puffs: sku.puffs, image_url: sku.image_url, is_active: true,
      }).select();
      if (!error && data) { alert("SKU duplicado com sucesso!"); fetchData(); }
    } catch (err) { console.error(err); }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroupKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Computed Metrics ───────────────────────────────────
  const uniqueModelsCount = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      const key = `${(p.brand || '').toLowerCase().trim()}__${(p.name || '').toLowerCase().trim()}`;
      set.add(key);
    });
    return set.size;
  }, [products]);

  const totalProducts = uniqueModelsCount;
  const totalStockUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalStockValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (parseFloat(p.price) || 0)), 0);
  const totalStockCost = products.reduce((acc, p) => acc + ((p.stock || 0) * (parseFloat(p.cost_price || 0))), 0);
  const estimatedProfit = totalStockValue - totalStockCost;
  const profitMarginPct = totalStockValue > 0 ? Math.round((estimatedProfit / totalStockValue) * 100) : 0;
  const outOfStockCount = products.filter(p => (p.stock || 0) === 0).length;
  const lowStockCount = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < 5).length;
  const lastEntryTime = products.length > 0 && products[0].created_at 
    ? new Date(products[0].created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : "—";

  // Brand distribution for donut
  const brandDistribution = products.reduce((acc: Record<string, number>, p) => {
    const b = p.brand || "Outros";
    acc[b] = (acc[b] || 0) + (p.stock || 0);
    return acc;
  }, {});

  // Available brands for quick filters
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.brand) set.add(p.brand); });
    return Array.from(set).sort();
  }, [products]);

  // Donut chart segments
  const donutSegments = useMemo(() => {
    const entries = Object.entries(brandDistribution).sort((a, b) => b[1] - a[1]);
    let cumulative = 0;
    return entries.map(([brandName, count], idx) => {
      const pct = totalStockUnits > 0 ? (count / totalStockUnits) * 100 : 0;
      const start = cumulative;
      cumulative += pct;
      return { brandName, count, pct: Math.round(pct), start, end: cumulative, color: DONUT_COLORS[idx % DONUT_COLORS.length] };
    });
  }, [brandDistribution, totalStockUnits]);

  const conicGradient = donutSegments.length > 0
    ? `conic-gradient(${donutSegments.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ')})`
    : 'conic-gradient(#333 0% 100%)';

  // ─── Grouping & Filtering Inteligente por Sabor ───────────────────────
  interface SKUGroup {
    groupKey: string; brand: string; name: string; puffs: number;
    price: number; cost_price: number; image_url: string; totalStock: number; 
    flavors: any[];
    realFlavors: any[];
    outOfStockFlavors: any[];
    lowStockFlavors: any[];
    inStockFlavors: any[];
  }

  // Step 1: Pre-filter products by search query and selected brand only
  const baseFilteredProducts = products.filter(p => {
    if (selectedBrand && p.brand !== selectedBrand) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (p.brand || '').toLowerCase().includes(q) ||
             (p.name || '').toLowerCase().includes(q) ||
             (p.flavor || '').toLowerCase().includes(q) ||
             (p.puffs || '').toString().includes(q);
    }
    return true;
  });

  // Step 2: Group all matching products into SKU Groups (Models)
  const groupedMap: Record<string, SKUGroup> = {};
  baseFilteredProducts.forEach(product => {
    const brandName = (product.brand || "Genérico").trim();
    const modelName = (product.name || "Pod").trim();
    const groupKey = `${brandName.toLowerCase()}__${modelName.toLowerCase()}`;

    if (!groupedMap[groupKey]) {
      groupedMap[groupKey] = {
        groupKey, brand: brandName, name: modelName, puffs: product.puffs || 5000,
        price: parseFloat(product.price) || 0, cost_price: parseFloat(product.cost_price) || 0,
        image_url: product.image_url || "", totalStock: 0, 
        flavors: [], realFlavors: [], outOfStockFlavors: [], lowStockFlavors: [], inStockFlavors: []
      };
    } else {
      if (product.price && parseFloat(product.price) > 0) groupedMap[groupKey].price = parseFloat(product.price);
      if (product.cost_price && parseFloat(product.cost_price) > 0) groupedMap[groupKey].cost_price = parseFloat(product.cost_price);
    }

    groupedMap[groupKey].flavors.push(product);
    if (!groupedMap[groupKey].image_url && product.image_url) groupedMap[groupKey].image_url = product.image_url;
  });

  // Step 3: Compute real flavor lists, cost_price & stock counts per model group
  Object.values(groupedMap).forEach(group => {
    const validCostFlavor = group.flavors.find(f => f.cost_price !== null && f.cost_price !== undefined && parseFloat(f.cost_price) > 0);
    if (validCostFlavor) {
      group.cost_price = parseFloat(validCostFlavor.cost_price);
    }

    const specificFlavors = group.flavors.filter((f: any) => {
      const fName = (f.flavor || '').trim().toLowerCase();
      return fName !== 'padrão' && fName !== 'padrao' && fName !== '';
    });

    group.realFlavors = specificFlavors.length > 0 ? specificFlavors : group.flavors;

    group.totalStock = group.realFlavors.reduce((sum, f) => sum + (f.stock || 0), 0);
    group.outOfStockFlavors = group.realFlavors.filter(f => (f.stock || 0) === 0);
    group.lowStockFlavors = group.realFlavors.filter(f => (f.stock || 0) > 0 && (f.stock || 0) < 5);
    group.inStockFlavors = group.realFlavors.filter(f => (f.stock || 0) > 0);
  });

  // Step 4: Apply filterTab based on stock status
  const skuGroups = Object.values(groupedMap)
    .filter(group => {
      if (filterTab === 'SEM_ESTOQUE') return group.totalStock === 0 || group.outOfStockFlavors.length > 0;
      if (filterTab === 'BAIXO_ESTOQUE') return group.lowStockFlavors.length > 0;
      if (filterTab === 'EM_ESTOQUE') return group.totalStock > 0;
      return true; // TODOS
    })
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

  // Step 5: Ranking de Vendas Global por Modelo (Não altera ao filtrar marcas no estoque)
  const globalGroupedMap: Record<string, SKUGroup> = {};
  products.forEach(product => {
    const brandName = (product.brand || "Genérico").trim();
    const modelName = (product.name || "Pod").trim();
    const groupKey = `${brandName.toLowerCase()}__${modelName.toLowerCase()}`;

    if (!globalGroupedMap[groupKey]) {
      globalGroupedMap[groupKey] = {
        groupKey, brand: brandName, name: modelName, puffs: product.puffs || 5000,
        price: parseFloat(product.price) || 0, cost_price: parseFloat(product.cost_price) || 0,
        image_url: product.image_url || "", totalStock: 0, 
        flavors: [], realFlavors: [], outOfStockFlavors: [], lowStockFlavors: [], inStockFlavors: []
      };
    }

    globalGroupedMap[groupKey].flavors.push(product);
    if (!globalGroupedMap[groupKey].image_url && product.image_url) globalGroupedMap[groupKey].image_url = product.image_url;
  });

  Object.values(globalGroupedMap).forEach(group => {
    const specificFlavors = group.flavors.filter((f: any) => {
      const fName = (f.flavor || '').trim().toLowerCase();
      return fName !== 'padrão' && fName !== 'padrao' && fName !== '';
    });
    group.realFlavors = specificFlavors.length > 0 ? specificFlavors : group.flavors;
    group.totalStock = group.realFlavors.reduce((sum, f) => sum + (f.stock || 0), 0);
  });

  const modelRankingMap: Record<string, {
    groupKey: string;
    modelDisplayName: string;
    brand: string;
    name: string;
    image_url: string;
    totalSold: number;
    totalStock: number;
    flavors: Array<{
      id: string;
      flavor: string;
      totalSold: number;
      stock: number;
    }>;
  }> = {};

  Object.values(globalGroupedMap).forEach(group => {
    const displayName = getGroupDisplayName(group.brand, group.name);
    const flavorsList = group.realFlavors.map((f: any) => ({
      id: f.id,
      flavor: f.flavor || 'Padrão',
      totalSold: 0,
      stock: f.stock || 0,
    }));

    modelRankingMap[group.groupKey] = {
      groupKey: group.groupKey,
      modelDisplayName: displayName,
      brand: group.brand,
      name: group.name,
      image_url: group.image_url,
      totalSold: 0,
      totalStock: group.totalStock,
      flavors: flavorsList,
    };
  });

  function isFlavorMatch(f1: string, f2: string): boolean {
    if (!f1 || !f2) return false;
    const s1 = f1.toLowerCase().trim();
    const s2 = f2.toLowerCase().trim();
    if (s1 === s2) return true;

    const isMenthol1 = /menth|menta|mint/i.test(s1);
    const isMenthol2 = /menth|menta|mint/i.test(s2);
    if (isMenthol1 && isMenthol2) return true;

    const isWatermelon1 = /water|melan/i.test(s1);
    const isWatermelon2 = /water|melan/i.test(s2);
    if (isWatermelon1 && isWatermelon2) return true;

    const isApple1 = /apple|maçã|maca/i.test(s1);
    const isApple2 = /apple|maçã|maca/i.test(s2);
    if (isApple1 && isApple2) return true;

    return s1.includes(s2) || s2.includes(s1);
  }

  topSelling.forEach((item: any) => {
    const pName = (item.product_name || item.name || '').toLowerCase().trim();
    const fName = (item.flavor || '').toLowerCase().trim();
    const sold = parseInt(item.total_sold || item.quantity || 0) || 0;

    Object.values(modelRankingMap).forEach(m => {
      const brandLower = m.brand.toLowerCase().trim();
      const nameLower = m.name.toLowerCase().trim();
      const fullDisplayName = m.modelDisplayName.toLowerCase().trim();
      const fullBrandModel = `${brandLower} ${nameLower}`.trim();

      // Corresponde se o nome do item for igual ao nome do modelo (ex: "v50" ou "ignite v50")
      // ou se pName contiver o nome do modelo (ex: "v50") e a marca ("ignite")
      const isModelMatch = pName === fullDisplayName || 
                           pName === fullBrandModel || 
                           (nameLower.length > 1 && pName === nameLower) ||
                           (nameLower.length > 1 && pName.includes(nameLower) && (brandLower.length > 1 ? pName.includes(brandLower) : true));

      if (isModelMatch) {
        m.totalSold += sold;
        const foundFlavor = m.flavors.find(f => isFlavorMatch(f.flavor, fName));
        if (foundFlavor) {
          foundFlavor.totalSold += sold;
        }
      }
    });
  });

  const modelRankingList = Object.values(modelRankingMap)
    .sort((a, b) => b.totalSold - a.totalSold);

  // ─── Loading State ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <Loader2 className="size-8 text-primary animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Carregando catálogo de estoque...</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  //  RENDER — Nova Hierarquia ERP Profissional
  // ═══════════════════════════════════════════════════════
  return (
    <div className="flex-1 overflow-y-auto bg-background custom-scrollbar relative">

      {/* ━━━ STICKY HEADER COM APENAS O BOTÃO NOVO PRODUTO ━━━━━━━━━━━━━━ */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <PackageSearch className="size-5 text-emerald-400" />
                Central de Gestão de Estoque
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Controle unificado de produtos, estoque e reposição
              </p>
            </div>

            {/* Botões Superiores Direitos: Registrar Venda e Novo Produto */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPreSelectedFlavorIdForSale(null);
                  setPreSelectedGroupForSale(null);
                  setIsManualSaleModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(245,158,11,0.35)] cursor-pointer active:scale-[0.97]"
              >
                <ShoppingCart className="size-4 text-black" />
                <span>⚡ Registrar Venda</span>
              </button>

              <button
                onClick={() => setShowNewProductModal(true)}
                className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] cursor-pointer active:scale-[0.97]"
              >
                <Plus className="size-4" />
                <span>Novo Produto</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ CONTEÚDO PRINCIPAL (FULL WIDTH) ━━━━━━━━━━━━━ */}
      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">

        {/* ── KPIs GRUPO PRINCIPAL (4 cards grandes) ─────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Produtos */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Produtos Cadastrados</span>
              <div className="size-8 rounded-lg bg-emerald-500/10 grid place-items-center">
                <Box className="size-4 text-emerald-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white">{totalProducts}</div>
            <span className="text-[10px] text-muted-foreground">modelos ativos no sistema</span>
          </div>

          {/* Valor em Estoque */}
          <div className="bg-card border border-emerald-500/20 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Valor em Estoque</span>
              <div className="size-8 rounded-lg bg-emerald-500/10 grid place-items-center">
                <DollarSign className="size-4 text-emerald-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400">{formatBRL(totalStockValue)}</div>
            <span className="text-[10px] text-emerald-400/60">valor total a preço de venda</span>
          </div>

          {/* Custo Total */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Custo Total</span>
              <div className="size-8 rounded-lg bg-white/5 grid place-items-center">
                <Tag className="size-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-2xl font-bold text-silver">{formatBRL(totalStockCost)}</div>
            <span className="text-[10px] text-muted-foreground">custo de reposição total</span>
          </div>

          {/* Lucro Estimado */}
          <div className="bg-card border border-emerald-500/20 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Lucro Estimado</span>
              <div className="size-8 rounded-lg bg-emerald-500/10 grid place-items-center">
                <TrendingUp className="size-4 text-emerald-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400">{formatBRL(estimatedProfit)}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">{profitMarginPct}%</span>
              <span className="text-[10px] text-muted-foreground">margem bruta</span>
            </div>
          </div>
        </div>

        {/* ── KPIs GRUPO SECUNDÁRIO (4 cards menores) ──── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Unidades</span>
            <span className="text-base font-bold text-silver">{totalStockUnits} un</span>
          </div>
          <div className="bg-card border border-amber-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Estoque Baixo</span>
            <span className="text-base font-bold text-amber-400">{lowStockCount}</span>
          </div>
          <div className="bg-card border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Sem Estoque</span>
            <span className="text-base font-bold text-red-400">{outOfStockCount}</span>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Última Entrada</span>
            <span className="text-xs font-bold text-muted-foreground">{lastEntryTime}</span>
          </div>
        </div>

        {/* ── GRÁFICOS: RANKING + DONUT ────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Ranking Top Modelos de Pods (com Expansão de Sabores e Estoque) */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-400" />
                <span className="text-xs uppercase font-semibold text-silver tracking-wider">Ranking de Vendas por Modelo</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFullRankingModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-400 text-[11px] font-bold transition-all border border-emerald-500/20 cursor-pointer"
              >
                <ListOrdered className="size-3.5" />
                Ver mais modelos
              </button>
            </div>

            <div className="space-y-3">
              {modelRankingList.slice(0, 5).map((modelItem, idx) => {
                const maxSold = modelRankingList[0]?.totalSold || 1;
                const pct = maxSold > 0 ? Math.round((modelItem.totalSold / maxSold) * 100) : 0;
                const medal = MEDAL_STYLES[idx];
                const isExpanded = expandedRankingModelKey === modelItem.groupKey;
                const barColor = medal
                  ? `bg-gradient-to-r ${medal.barFrom} ${medal.barTo}`
                  : "bg-emerald-500/60";

                return (
                  <div key={modelItem.groupKey} className="border border-border/50 rounded-xl overflow-hidden bg-black/20">
                    <div 
                      onClick={() => setExpandedRankingModelKey(isExpanded ? null : modelItem.groupKey)}
                      className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <span className="text-base w-6 text-center shrink-0">
                        {medal ? medal.emoji : `${idx + 1}º`}
                      </span>

                      {modelItem.image_url ? (
                        <img src={modelItem.image_url} alt={modelItem.modelDisplayName} className="size-8 object-cover rounded-lg border border-border shrink-0" />
                      ) : (
                        <div className="size-8 rounded-lg bg-elevated border border-border flex items-center justify-center shrink-0">
                          <Box className="size-4 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold truncate ${medal ? medal.text : "text-white"}`}>
                            {modelItem.modelDisplayName}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold text-emerald-400">
                              {modelItem.totalSold} un vendidas
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              ({modelItem.totalStock} un em estoque)
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct || 5}%` }} />
                        </div>
                      </div>

                      <div className="text-muted-foreground hover:text-white shrink-0 ml-1">
                        {isExpanded ? <ChevronUp className="size-4 text-emerald-400" /> : <ChevronDown className="size-4" />}
                      </div>
                    </div>

                    {/* Detalhamento de Sabores do Modelo Selecionado */}
                    {isExpanded && (
                      <div className="border-t border-border/40 bg-black/40 p-3 space-y-2 text-xs">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2 flex items-center justify-between">
                          <span>Desempenho de Sabores — {modelItem.modelDisplayName}</span>
                          <span>Estoque Atual</span>
                        </div>

                        {modelItem.flavors.length > 0 ? (
                          modelRankingList && modelItem.flavors.map((fItem) => {
                            const flavorStock = fItem.stock;
                            let stockBadgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                            let stockLabel = `${flavorStock} un em estoque`;

                            if (flavorStock === 0) {
                              stockBadgeClass = "bg-red-500/10 text-red-400 border-red-500/20";
                              stockLabel = "Sem estoque";
                            } else if (flavorStock < 5) {
                              stockBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                              stockLabel = `${flavorStock} un restando`;
                            }

                            return (
                              <div key={fItem.id || fItem.flavor} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                <div className="flex items-center gap-2">
                                  <Tag className="size-3 text-emerald-400" />
                                  <span className="font-medium text-white">{fItem.flavor}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-muted-foreground font-mono text-[11px]">
                                    {fItem.totalSold} vendidas
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${stockBadgeClass}`}>
                                    {stockLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-[11px] text-muted-foreground py-1 italic">Nenhum sabor cadastrado para este modelo.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {modelRankingList.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum produto cadastrado no modelo.</p>
              )}
            </div>
          </div>

          {/* Donut Chart — Distribuição por Marca */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <PieChart className="size-4 text-blue-400" />
              <span className="text-xs uppercase font-semibold text-silver tracking-wider">Distribuição por Marca</span>
            </div>

            <div className="flex items-center gap-6">
              {/* Donut visual */}
              <div className="relative size-28 shrink-0">
                <div className="size-full rounded-full" style={{ background: conicGradient }} />
                <div className="absolute inset-[18%] rounded-full bg-card" />
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-sm font-bold text-white">{totalStockUnits}</span>
                  <span className="text-[9px] text-muted-foreground">unidades</span>
                </div>
              </div>

              {/* Legenda */}
              <div className="flex-1 space-y-2.5">
                {donutSegments.map((seg) => (
                  <div key={seg.brandName} className="flex items-center gap-2.5">
                    <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className="text-xs font-medium text-silver truncate">{seg.brandName}</span>
                      <span className="text-[11px] text-muted-foreground ml-2 shrink-0 font-medium">
                        {seg.count} un ({seg.pct}%)
                      </span>
                    </div>
                  </div>
                ))}
                {donutSegments.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum dado disponível.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── PESQUISA + FILTROS DE ESTOQUE SIMPLIFICADOS ───────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          {/* Campo de Busca Destacado */}
          <div className="relative w-full">
            <Search className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por marca, modelo ou sabor..."
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Filtros por Marca */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
            <button
              onClick={() => setSelectedBrand(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                !selectedBrand
                  ? "bg-white text-black shadow"
                  : "bg-elevated/40 text-muted-foreground hover:bg-white/10 hover:text-white"
              }`}
            >
              Todas as Marcas
            </button>
            {availableBrands.map(b => (
              <button
                key={b}
                onClick={() => setSelectedBrand(selectedBrand === b ? null : b)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  selectedBrand === b
                    ? "bg-white text-black shadow"
                    : "bg-elevated/40 text-muted-foreground hover:bg-white/10 hover:text-white"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Filtros de Status de Estoque Estritamente Solicitados (4 Opções Limpas) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar text-xs">
            {[
              { id: "TODOS", label: "Todos" },
              { id: "EM_ESTOQUE", label: "🟢 Em estoque" },
              { id: "BAIXO_ESTOQUE", label: "🟡 Baixo estoque" },
              { id: "SEM_ESTOQUE", label: "🔴 Sem estoque" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  filterTab === tab.id
                    ? "bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                    : "bg-elevated/40 text-muted-foreground hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── LISTA DE PRODUTOS (FULL WIDTH, CARDS MINIMALISTAS E ELEGANTES) ─ */}
        <div className="space-y-4">
          {skuGroups.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-16 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado para os filtros aplicados.
            </div>
          ) : (
            skuGroups.map((group) => {
              const isSearching = searchQuery.trim().length > 0;
              const isFilterActive = filterTab !== 'TODOS';
              // Auto-expand accordion when search or specific status filter is active
              const isExpanded = expandedGroupKeys[group.groupKey] ?? (isSearching || isFilterActive);

              const profit = group.price - group.cost_price;
              const marginPct = group.price > 0 ? Math.round((profit / group.price) * 100) : 0;
              const displayName = getGroupDisplayName(group.brand, group.name);
              const realFlavors = group.realFlavors;
              const isGroupVisible = group.flavors.some((f: any) => f.is_active);
              const isGroupMenuActive = activeGroupMenuKey === group.groupKey;

              // Stock badge label inteligente por Sabor
              let stockBarColor = "bg-emerald-400";
              let stockBadgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
              let stockLabel = `Em estoque (${group.totalStock} un)`;

              if (group.outOfStockFlavors.length > 0) {
                stockBarColor = "bg-red-400";
                stockBadgeClass = "bg-red-500/10 text-red-400 border-red-500/20";
                const numOut = group.outOfStockFlavors.length;
                stockLabel = `${numOut} ${numOut === 1 ? 'sabor esgotado' : 'sabores esgotados'}`;
              } else if (group.lowStockFlavors.length > 0) {
                stockBarColor = "bg-amber-400";
                stockBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                const numLow = group.lowStockFlavors.length;
                stockLabel = `${numLow} ${numLow === 1 ? 'sabor em baixo estoque' : 'sabores em baixo estoque'}`;
              }

              return (
                <div 
                  key={group.groupKey} 
                  className={`bg-card border border-border rounded-2xl shadow-lg transition-all relative ${isGroupMenuActive ? 'z-40' : 'z-10'}`}
                >
                  {/* ── CARD HEADER MINIMALISTA E UNIFORME (SEM EXPANSÃO INLINE) ────────── */}
                  <div className="p-5 space-y-4">
                    {/* Linha Superior: Foto, Nome, Puffs e Ações */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {/* Foto do Modelo */}
                        <div 
                          className="relative size-14 rounded-xl border border-white/10 bg-black/40 overflow-hidden shrink-0 group/img cursor-pointer"
                          title="Clique para alterar a foto deste modelo"
                        >
                          {group.image_url ? (
                            <img src={group.image_url} alt={displayName} className="size-full object-cover" />
                          ) : (
                            <ImagePlus className="size-5 text-muted-foreground/40 absolute inset-0 m-auto" />
                          )}
                          <label 
                            htmlFor={`group-img-upload-${group.groupKey}`}
                            className="absolute inset-0 bg-black/75 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                          >
                            {uploadingGroupKey === group.groupKey ? (
                              <Loader2 className="size-4 animate-spin text-emerald-400" />
                            ) : (
                              <>
                                <Camera className="size-4 text-emerald-400" />
                                <span className="text-[8px] font-bold mt-0.5 uppercase tracking-wider">Trocar</span>
                              </>
                            )}
                          </label>
                          <input
                            id={`group-img-upload-${group.groupKey}`}
                            type="file" accept="image/*" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpdateGroupImage(group, f); }}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="font-bold text-base text-white tracking-tight">{displayName}</h3>
                            <span className="text-[10px] bg-white/5 border border-white/10 text-muted-foreground px-2 py-0.5 rounded-md font-medium">
                              {group.puffs} puffs
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {realFlavors.length} {realFlavors.length === 1 ? 'sabor cadastrado' : 'sabores cadastrados'}
                          </p>
                        </div>
                      </div>

                      {/* Ações do Grupo (Status, Ver Sabores, Olho, 3 Pontos) */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${stockBadgeClass}`}>
                          <div className={`size-1.5 rounded-full ${stockBarColor}`} />
                          {stockLabel}
                        </span>

                        <button
                          type="button"
                          onClick={() => setViewingFlavorsGroup(group)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] cursor-pointer active:scale-95"
                        >
                          <Eye className="size-3.5" />
                          Ver Sabores ({realFlavors.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleGroupActive(group)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isGroupVisible 
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20" 
                              : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20"
                          }`}
                          title={isGroupVisible ? "Visível no Cardápio (Clique para Ocultar)" : "Oculto do Cardápio (Clique para Exibir)"}
                        >
                          {isGroupVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        </button>

                        {/* Botão de Estrela ⭐ para Alternar nos Mais Vendidos (1-Clique Direto na Interface - Sem Janela) */}
                        {(() => {
                          const MAIS_VENDIDOS_ID = "11111111-1111-4111-a111-111111111111";
                          const cleanKey = `${group.brand.toLowerCase().replace(/\s+/g, '')}__${group.name.toLowerCase().replace(/\s+/g, '')}`;

                          // Checagem abrangente da estrela ⭐ para garantir que o acendimento/apagamento seja 100% fiel
                          const isMaisVendido = group.flavors.some((f: any) => {
                            const catIds = categoryMappings[f.id]?.category_ids || [];
                            return catIds.includes(MAIS_VENDIDOS_ID);
                          }) || 
                          (categoryMappings[group.groupKey]?.category_ids?.includes(MAIS_VENDIDOS_ID)) ||
                          (categoryMappings[cleanKey]?.category_ids?.includes(MAIS_VENDIDOS_ID));

                          return (
                            <button
                              type="button"
                              onClick={async () => {
                                const targetCatIds = isMaisVendido ? [] : [MAIS_VENDIDOS_ID];
                                const currentOrder = 1;
                                const pIds = group.flavors.map((f: any) => f.id);

                                // 1. Atualização Otimista Instantânea no Estado do React (Acende ou Apaga a estrela ⭐ no 1-clique sem bolhas!)
                                setCategoryMappings(prev => {
                                  const next = { ...prev };
                                  if (!isMaisVendido) {
                                    next[group.groupKey] = { category_ids: [MAIS_VENDIDOS_ID], display_order: currentOrder };
                                    next[cleanKey] = { category_ids: [MAIS_VENDIDOS_ID], display_order: currentOrder };
                                    pIds.forEach((id: string) => {
                                      next[id] = { category_ids: [MAIS_VENDIDOS_ID], display_order: currentOrder };
                                    });
                                  } else {
                                    delete next[group.groupKey];
                                    delete next[cleanKey];
                                    pIds.forEach((id: string) => delete next[id]);
                                  }
                                  return next;
                                });

                                // 2. Persistir no Supabase DB e localStorage em segundo plano
                                await updateModelCategories({
                                  productIds: pIds,
                                  modelKey: group.groupKey,
                                  categoryIds: targetCatIds,
                                  displayOrder: currentOrder,
                                  companyId: company?.id
                                });
                              }}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                                isMaisVendido
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(251,191,36,0.35)]"
                                  : "bg-elevated hover:bg-white/10 text-slate-400 hover:text-amber-400 border-white/10"
                              }`}
                              title={isMaisVendido ? "Remover dos Mais Vendidos (1-Clique Direto)" : "Adicionar aos Mais Vendidos (1-Clique Direto)"}
                            >
                              <Star className={`size-4 ${isMaisVendido ? "fill-amber-400 text-amber-400" : ""}`} />
                            </button>
                          );
                        })()}

                        {/* Menu 3 Pontos */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveGroupMenuKey(isGroupMenuActive ? null : group.groupKey)}
                            className="p-1.5 rounded-lg bg-elevated hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                          >
                            <MoreVertical className="size-4" />
                          </button>
                          {isGroupMenuActive && (
                            <div className="absolute right-0 top-9 z-50 bg-[#18181b] border border-white/15 rounded-xl shadow-2xl py-1.5 w-56 text-xs font-medium animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  const modelMapping = categoryMappings[group.groupKey];
                                  const firstFlavor = group.flavors[0];
                                  const flavorMapping = firstFlavor ? categoryMappings[firstFlavor.id] : null;

                                  const catIds = (modelMapping && modelMapping.category_ids.length > 0)
                                    ? modelMapping.category_ids
                                    : (flavorMapping?.category_ids || []);
                                  const order = modelMapping?.display_order || flavorMapping?.display_order || 1;

                                  setEditingCategoryGroup(group);
                                  setSelectedCategoryIds(catIds);
                                  setSelectedDisplayOrder(order.toString());
                                  setActiveGroupMenuKey(null);
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-white/15 hover:text-white flex items-center gap-2.5 text-silver transition-colors cursor-pointer"
                              >
                                <Star className="size-3.5 text-amber-400" />
                                Organizar Posição no Topo
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFullProduct(group);
                                  setEditBrand(group.brand || "");
                                  setEditName(group.name || "");
                                  setEditPuffs((group.puffs || 5000).toString());
                                  setEditPrice(group.price.toString());
                                  setEditCostPrice(group.cost_price.toString());
                                  setEditImageFile(null);
                                  setEditImagePreview(group.image_url || "");
                                  setActiveGroupMenuKey(null);
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-white/15 hover:text-white flex items-center gap-2.5 text-silver transition-colors cursor-pointer"
                              >
                                <Edit3 className="size-3.5 text-emerald-400" />
                                Editar Produto
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingGroup(group);
                                  setBatchPrice(group.price.toString());
                                  setBatchCostPrice(group.cost_price.toString());
                                  setActiveGroupMenuKey(null);
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-white/15 hover:text-white flex items-center gap-2.5 text-silver transition-colors cursor-pointer"
                              >
                                <Tag className="size-3.5 text-blue-400" />
                                Editar Preço / Custo em Lote
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const maisVendidosCatId = "11111111-1111-4111-a111-111111111111";
                                  const currentModelMapping = categoryMappings[group.groupKey];
                                  const currentCatIds = currentModelMapping?.category_ids || [];
                                  const isPinned = currentCatIds.includes(maisVendidosCatId);

                                  let newCatIds: string[];
                                  if (isPinned) {
                                    newCatIds = currentCatIds.filter(id => id !== maisVendidosCatId);
                                  } else {
                                    newCatIds = [...currentCatIds, maisVendidosCatId];
                                  }

                                  const pIds = group.flavors.map((f: any) => f.id);
                                  const modelKey = group.groupKey;
                                  const targetCompanyId = company?.id || 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';

                                  await updateModelCategories({
                                    productIds: pIds,
                                    modelKey: modelKey,
                                    categoryIds: newCatIds,
                                    displayOrder: currentModelMapping?.display_order || 1,
                                    companyId: targetCompanyId,
                                  });

                                  setCategoryMappings(prev => ({
                                    ...prev,
                                    [modelKey]: { category_ids: newCatIds, display_order: currentModelMapping?.display_order || 1 }
                                  }));

                                  setActiveGroupMenuKey(null);
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-white/15 hover:text-white flex items-center gap-2.5 text-silver transition-colors cursor-pointer"
                              >
                                <Star className="size-3.5 text-amber-400 fill-amber-400" />
                                {categoryMappings[group.groupKey]?.category_ids?.includes("11111111-1111-4111-a111-111111111111")
                                  ? "Desafixar de Mais Vendidos"
                                  : "Fixar no Topo (Mais Vendidos)"}
                              </button>
                              <div className="h-px bg-white/10 my-1" />
                              <button
                                type="button"
                                onClick={() => { handleDeleteGroup(group); setActiveGroupMenuKey(null); }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center gap-2.5 transition-colors cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                                Excluir Modelo Completo
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Linha Única de Métricas Unificadas e Elegantes (Sem Barra de Progresso Polluted) */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs font-medium pt-1 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Estoque Total</span>
                        <span className="font-bold text-white bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                          {group.totalStock} un
                        </span>
                      </div>
                      <div className="h-3 w-px bg-white/10" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Venda</span>
                        <span className="font-bold text-white">{formatBRL(group.price)}</span>
                      </div>
                      <div className="h-3 w-px bg-white/10" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Custo</span>
                        <span className="font-medium text-muted-foreground">{group.cost_price ? formatBRL(group.cost_price) : "—"}</span>
                      </div>
                      <div className="h-3 w-px bg-white/10" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Lucro</span>
                        <span className="font-bold text-emerald-400">{group.cost_price ? formatBRL(profit) : "—"}</span>
                        {group.cost_price ? (
                          <span className="text-[10px] text-emerald-400/80 font-semibold">({marginPct}%)</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ━━━ MODAL CARD DEDICADO DE GESTÃO DE SABORES POR MODELO ━━━━━━━━━━━━━━ */}
      {viewingFlavorsGroup && (() => {
        const currentGroup = skuGroups.find(g => g.groupKey === viewingFlavorsGroup.groupKey) || viewingFlavorsGroup;
        const displayName = getGroupDisplayName(currentGroup.brand, currentGroup.name);
        const realFlavors = currentGroup.realFlavors || [];
        const hasModalPendingChanges = realFlavors.some((f: any) => pendingStockChanges[f.id] !== undefined);

        const handleCloseViewingFlavors = () => {
          if (hasModalPendingChanges) {
            if (window.confirm("Você possui alterações de estoque pendentes para este modelo. Deseja salvar no cardápio antes de fechar?")) {
              handleSaveAllStockChanges();
            } else {
              handleDiscardStockChanges();
            }
          }
          setViewingFlavorsGroup(null);
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#121212] border border-border rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-border flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-3.5">
                  {currentGroup.image_url ? (
                    <img src={currentGroup.image_url} alt={displayName} className="size-12 object-cover rounded-xl border border-white/10" />
                  ) : (
                    <div className="size-12 rounded-xl bg-elevated border border-border flex items-center justify-center">
                      <Box className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {displayName}
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                        {currentGroup.totalStock} un em estoque
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {realFlavors.length} {realFlavors.length === 1 ? 'sabor cadastrado' : 'sabores cadastrados'} • Venda {formatBRL(currentGroup.price)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAddingFlavorGroup(currentGroup);
                      setNewFlavorName("");
                      setNewFlavorStock("");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] cursor-pointer active:scale-95"
                  >
                    <Plus className="size-4" />
                    Adicionar Sabor
                  </button>
                  <button
                    onClick={handleCloseViewingFlavors}
                    className="p-2 text-muted-foreground hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body - Lista Limpa de Sabores */}
              <div className="p-5 overflow-y-auto space-y-3 custom-scrollbar flex-1">
                {realFlavors.map((f: any) => {
                  let stockBadgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                  let stockLabel = "Em estoque";
                  if (f.stock === 0) {
                    stockBadgeClass = "bg-red-500/10 text-red-400 border-red-500/20";
                    stockLabel = "Sem estoque";
                  } else if (f.stock < 5) {
                    stockBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                    stockLabel = "Baixo estoque";
                  }

                  return (
                    <div key={f.id} className="p-4 rounded-2xl border border-white/10 bg-black/30 flex items-center justify-between gap-4 hover:border-white/20 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-2.5 rounded-full bg-emerald-400 shrink-0" />
                        <div>
                          <div className="text-sm font-bold text-white truncate">{f.flavor || 'Padrão'}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${stockBadgeClass}`}>
                              {stockLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controles de Estoque Estáveis */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          onClick={() => handleUpdateStock(f.id, Math.max(0, (f.stock || 0) - 1))}
                          className="size-9 rounded-xl bg-elevated border border-white/10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span 
                          onClick={() => { setEditingStockSku(f); setNewStockValue(String(f.stock || 0)); }}
                          className="w-12 text-center font-mono text-sm font-bold text-white hover:text-emerald-400 cursor-pointer"
                          title="Clique para editar valor exato"
                        >
                          {f.stock || 0} un
                        </span>
                        <button
                          onClick={() => handleUpdateStock(f.id, (f.stock || 0) + 1)}
                          className="size-9 rounded-xl bg-elevated border border-white/10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {realFlavors.length === 0 && (
                  <p className="text-xs text-muted-foreground py-6 text-center italic">Nenhum sabor cadastrado para este modelo ainda.</p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border bg-black/40 flex justify-end">
                <button
                  onClick={() => setViewingFlavorsGroup(null)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all cursor-pointer"
                >
                  Concluir
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ━━━ MODAL FLUTUANTE CENTRALIZADO ("BOLHA"): NOVO PRODUTO ━━━━━━━━ */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div 
            className="absolute inset-0" 
            onClick={() => setShowNewProductModal(false)} 
          />
          <div className="relative bg-[#121212] border border-border rounded-3xl w-full max-w-lg shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="size-5 text-emerald-400" />
                  Cadastrar Novo Modelo
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Preencha as informações do produto</p>
              </div>
              <button 
                onClick={() => setShowNewProductModal(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Marca</label>
                  <input 
                    type="text" value={brand} onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ex.: Ignite, Elf Bar"
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Modelo *</label>
                  <input 
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: V50, BC5000"
                    required
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Puffs</label>
                <input 
                  type="number" value={puffs} onChange={(e) => setPuffs(e.target.value)}
                  placeholder="Ex.: 5000"
                  className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Preço de Venda (R$) *</label>
                  <input 
                    type="text" 
                    inputMode="decimal" 
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex.: 104,90 ou 104.90" 
                    required
                    disabled={submitting}
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium disabled:opacity-50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Custo (R$)</label>
                  <input 
                    type="text" 
                    inputMode="decimal" 
                    value={costPrice} 
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="Ex.: 35,00 ou 35.00"
                    disabled={submitting}
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Foto do Pod</label>
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border border-dashed rounded-xl p-3 text-center transition-all ${
                    isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-[#0a0a0a]'
                  }`}
                >
                  {imagePreview ? (
                    <div className="relative size-16 mx-auto rounded-xl overflow-hidden border border-white/10">
                      <img src={imagePreview} alt="Preview" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setImageFile(null); setImagePreview(""); }}
                        className="absolute top-1 right-1 bg-black/80 text-red-400 p-0.5 rounded-full"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="py-1">
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="modal-pod-upload" />
                      <Camera className="size-6 text-muted-foreground/30 mx-auto mb-1" />
                      <label htmlFor="modal-pod-upload" className="text-xs font-medium text-emerald-400 hover:underline cursor-pointer">
                        Selecionar Imagem
                      </label>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">ou arraste o arquivo aqui</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-border">
                <button 
                  type="button"
                  onClick={() => setShowNewProductModal(false)}
                  disabled={submitting}
                  className="flex-1 bg-elevated hover:bg-white/10 text-muted-foreground text-xs font-semibold py-2.5 rounded-xl border border-border transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-black" />
                      Cadastrando...
                    </>
                  ) : (
                    "Cadastrar Modelo"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ━━━ MODAL: ADICIONAR SABOR ━━━━━━━━━━━━━━━━━━━━━ */}
      {addingFlavorGroup && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-border rounded-2xl w-full max-w-sm shadow-2xl p-5 relative animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <button onClick={() => setAddingFlavorGroup(null)} className="absolute top-3 right-3 text-muted-foreground hover:text-white"><X className="size-4" /></button>
            <div>
              <h3 className="font-bold text-sm text-silver flex items-center gap-2">
                <Plus className="size-4 text-emerald-400" />
                Adicionar Sabor ao Modelo
              </h3>
              <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                {getGroupDisplayName(addingFlavorGroup.brand, addingFlavorGroup.name)}
              </p>
            </div>
            <form onSubmit={handleAddFlavorSubmit} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Nome do Sabor *</label>
                <input type="text" autoFocus required value={newFlavorName} onChange={(e) => setNewFlavorName(e.target.value)}
                  placeholder="Ex.: Watermelon Ice, Mint, Grape"
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Estoque Inicial (unidades)</label>
                <input type="number" value={newFlavorStock} onChange={(e) => setNewFlavorStock(e.target.value)}
                  placeholder="Ex.: 10"
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddingFlavorGroup(null)}
                  className="flex-1 bg-elevated hover:bg-white/10 text-muted-foreground text-xs py-2.5 rounded-xl border border-border">
                  Cancelar
                </button>
                <button type="submit" disabled={submittingFlavor}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {submittingFlavor ? <Loader2 className="size-3.5 animate-spin" /> : "Adicionar Sabor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ━━━ MODAL: EDIÇÃO DE ESTOQUE ━━━━━━━━━━━━━━━━━━━ */}
      {editingStockSku && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-border rounded-2xl w-full max-w-xs shadow-2xl p-5 relative animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <button onClick={() => setEditingStockSku(null)} className="absolute top-3 right-3 text-muted-foreground hover:text-white"><X className="size-4" /></button>
            <h3 className="font-semibold text-sm text-silver">Ajustar Estoque Físico</h3>
            <p className="text-xs text-muted-foreground">{editingStockSku.flavor} ({editingStockSku.brand})</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">Nova Quantidade</label>
              <input type="number" autoFocus value={newStockValue}
                onChange={(e) => setNewStockValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveModalStock()}
                className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-emerald-500/50 font-medium"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingStockSku(null)} className="flex-1 bg-elevated hover:bg-white/10 text-muted-foreground text-xs py-2 rounded-xl border border-border">Cancelar</button>
              <button onClick={handleSaveModalStock} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2 rounded-xl">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ MODAL: EDIÇÃO COMPLETA DO PRODUTO (MARCA, MODELO, PUFFS, PREÇO, CUSTO, IMAGEM) ━━━━━━━ */}
      {editingFullProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#121212] border border-border rounded-3xl w-full max-w-md shadow-2xl p-6 relative space-y-5 overflow-hidden">
            <button 
              type="button" 
              onClick={() => setEditingFullProduct(null)} 
              disabled={isSavingFullProduct} 
              className="absolute top-4 right-4 text-muted-foreground hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center shrink-0">
                <Edit3 className="size-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Editar Produto</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getGroupDisplayName(editingFullProduct.brand, editingFullProduct.name)} ({editingFullProduct.flavors.length} sabores vinculados)
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveFullProductEdit} className="space-y-4">
              {/* Foto do Pod */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Foto do Pod</label>
                <div className="flex items-center gap-3">
                  <div className="relative size-16 rounded-xl overflow-hidden border border-white/10 bg-black/40 shrink-0">
                    {editImagePreview ? (
                      <img src={editImagePreview} alt="Preview" className="size-full object-cover" />
                    ) : (
                      <ImagePlus className="size-6 text-muted-foreground/30 absolute inset-0 m-auto" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input 
                      ref={editFileInputRef} 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setEditImageFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setEditImagePreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }} 
                      className="hidden" 
                      id="edit-modal-pod-upload" 
                    />
                    <label 
                      htmlFor="edit-modal-pod-upload" 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-elevated hover:bg-white/10 text-white text-xs font-semibold border border-white/10 cursor-pointer transition-colors"
                    >
                      <Camera className="size-3.5 text-emerald-400" />
                      Alterar Imagem
                    </label>
                    <span className="text-[10px] text-muted-foreground block">
                      {editImageFile ? editImageFile.name : "Manter imagem atual se não selecionar outra"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Marca e Modelo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Marca</label>
                  <input 
                    type="text" 
                    value={editBrand} 
                    onChange={(e) => setEditBrand(e.target.value)}
                    disabled={isSavingFullProduct}
                    placeholder="Ex.: Ignite, ELF BAR"
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium disabled:opacity-50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Modelo *</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={isSavingFullProduct}
                    placeholder="Ex.: V50, BC20K"
                    required
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Puffs */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Puffs</label>
                <input 
                  type="number" 
                  value={editPuffs} 
                  onChange={(e) => setEditPuffs(e.target.value)}
                  disabled={isSavingFullProduct}
                  placeholder="Ex.: 20000"
                  className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium disabled:opacity-50"
                />
              </div>

              {/* Preço de Venda e Custo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Preço de Venda (R$) *</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    value={editPrice} 
                    onChange={(e) => setEditPrice(e.target.value)}
                    disabled={isSavingFullProduct}
                    placeholder="Ex.: 79,90"
                    required
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium disabled:opacity-50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Custo (R$)</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    value={editCostPrice} 
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    disabled={isSavingFullProduct}
                    placeholder="Ex.: 42,00"
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-2.5 pt-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setEditingFullProduct(null)} 
                  disabled={isSavingFullProduct}
                  className="flex-1 bg-elevated hover:bg-white/10 text-muted-foreground text-xs font-semibold py-2.5 rounded-xl border border-border transition-all disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingFullProduct}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                >
                  {isSavingFullProduct ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-black" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ━━━ MODAL: EDIÇÃO EM LOTE (PREÇO/CUSTO) ━━━━━━━ */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-border rounded-2xl w-full max-w-sm shadow-2xl p-5 relative animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <button onClick={() => setEditingGroup(null)} disabled={isSavingBatchPrice} className="absolute top-3 right-3 text-muted-foreground hover:text-white disabled:opacity-50"><X className="size-4" /></button>
            <h3 className="font-semibold text-sm text-silver">Editar Valores do Modelo</h3>
            <p className="text-xs text-muted-foreground">
              {getGroupDisplayName(editingGroup.brand, editingGroup.name)} ({editingGroup.flavors.length} sabores afetados)
            </p>
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">Preço de Venda (R$)</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  placeholder="Ex.: 99.90 ou 99,90"
                  value={batchPrice} 
                  onChange={(e) => setBatchPrice(e.target.value)}
                  disabled={isSavingBatchPrice}
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-medium disabled:opacity-50" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">Custo de Reposição (R$)</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  placeholder="Ex.: 40.00 ou 40,00"
                  value={batchCostPrice} 
                  onChange={(e) => setBatchCostPrice(e.target.value)}
                  disabled={isSavingBatchPrice}
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-medium disabled:opacity-50" 
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setEditingGroup(null)} 
                disabled={isSavingBatchPrice}
                className="flex-1 bg-elevated hover:bg-white/10 text-muted-foreground text-xs py-2.5 rounded-xl border border-border disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleSaveBatchGroupEdit} 
                disabled={isSavingBatchPrice}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                {isSavingBatchPrice ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin text-black" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ DRAWER: DETALHES DO SKU ━━━━━━━━━━━━━━━━━━━━ */}
      {selectedDrawerSKU && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-[#121212] border-l border-border w-full max-w-md h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-250 overflow-y-auto custom-scrollbar space-y-6">
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-14 rounded-xl border border-white/10 bg-black/50 overflow-hidden flex items-center justify-center shrink-0">
                    {selectedDrawerSKU.image_url ? (
                      <img src={selectedDrawerSKU.image_url} alt={selectedDrawerSKU.flavor} className="size-full object-cover" />
                    ) : (
                      <ImagePlus className="size-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">{selectedDrawerSKU.flavor}</h3>
                    <p className="text-xs text-muted-foreground">{selectedDrawerSKU.brand} · {selectedDrawerSKU.name}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedDrawerSKU(null); setIsEditingSingleSkuPrice(false); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10">
                  <X className="size-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-3">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Venda</span>
                  <span className="text-sm font-bold text-white mt-1 block">{formatBRL(selectedDrawerSKU.price)}</span>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Custo</span>
                  <span className="text-sm font-bold text-muted-foreground mt-1 block">{formatBRL(selectedDrawerSKU.cost_price || 35)}</span>
                </div>
                <div className="bg-card border border-emerald-500/20 rounded-xl p-3">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Lucro</span>
                  <span className="text-sm font-bold text-emerald-400 mt-1 block">
                    {formatBRL(selectedDrawerSKU.price - (selectedDrawerSKU.cost_price || 35))}
                  </span>
                </div>
              </div>

              {/* Formulário de Edição Individual de Preço/Custo da Variação */}
              {isEditingSingleSkuPrice ? (
                <div className="bg-card border border-emerald-500/30 rounded-xl p-4 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Editar Valores Deste Sabor</span>
                    <button onClick={() => setIsEditingSingleSkuPrice(false)} className="text-xs text-muted-foreground hover:text-white"><X className="size-3.5" /></button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">Preço de Venda (R$)</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={singleSkuPriceInput}
                        onChange={(e) => setSingleSkuPriceInput(e.target.value)}
                        disabled={isSavingSingleSkuPrice}
                        className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">Custo de Reposição (R$)</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={singleSkuCostInput}
                        onChange={(e) => setSingleSkuCostInput(e.target.value)}
                        disabled={isSavingSingleSkuPrice}
                        className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button 
                      onClick={() => setIsEditingSingleSkuPrice(false)}
                      disabled={isSavingSingleSkuPrice}
                      className="flex-1 bg-elevated hover:bg-white/10 text-muted-foreground text-xs py-2 rounded-xl border border-border"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleSaveSingleSkuPrice}
                      disabled={isSavingSingleSkuPrice}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isSavingSingleSkuPrice ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin text-black" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    setIsEditingSingleSkuPrice(true);
                    setSingleSkuPriceInput(selectedDrawerSKU.price.toString());
                    setSingleSkuCostInput((selectedDrawerSKU.cost_price || 35).toString());
                  }}
                  className="w-full bg-elevated hover:bg-white/10 text-white text-xs font-semibold py-2.5 rounded-xl border border-border flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Edit3 className="size-4 text-blue-400" />
                  Editar Preço / Custo Deste Sabor
                </button>
              )}

              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Estoque Físico</span>
                  <span className="font-bold text-white text-sm">{selectedDrawerSKU.stock} un</span>
                </div>
                <div className="h-2 w-full bg-elevated rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      selectedDrawerSKU.stock >= 5 ? 'bg-emerald-400' : selectedDrawerSKU.stock > 0 ? 'bg-amber-400' : 'bg-red-500'
                    }`} 
                    style={{ width: `${Math.min(100, (selectedDrawerSKU.stock / 30) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-xs">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">Inteligência de Vendas</span>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-silver">Vendidos Hoje</span>
                  <span className="text-white font-semibold">2 un</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-silver">Vendidos nesta Semana</span>
                  <span className="text-emerald-400 font-semibold">14 un</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-silver">Última Venda</span>
                  <span className="text-muted-foreground font-medium">Hoje às 15:40</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <button onClick={() => handleToggleActive(selectedDrawerSKU.id, selectedDrawerSKU.is_active)}
                className="w-full bg-elevated hover:bg-white/10 text-white text-xs font-semibold py-2.5 rounded-xl border border-border flex items-center justify-center gap-2 cursor-pointer transition-colors">
                {selectedDrawerSKU.is_active ? <EyeOff className="size-4 text-amber-400" /> : <Eye className="size-4 text-emerald-400" />}
                {selectedDrawerSKU.is_active ? "Ocultar do Cardápio" : "Exibir no Cardápio"}
              </button>
              <button onClick={() => handleDuplicateSKU(selectedDrawerSKU)}
                className="w-full bg-elevated hover:bg-white/10 text-white text-xs font-semibold py-2.5 rounded-xl border border-border flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <Copy className="size-4 text-blue-400" />
                Duplicar SKU
              </button>
              <button onClick={() => handleDeleteProduct(selectedDrawerSKU.id, selectedDrawerSKU.flavor)}
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold py-2.5 rounded-xl border border-red-500/20 flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <Trash2 className="size-4" />
                Excluir SKU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ MODAL CARD DEDICADO: RANKING COMPLETO DE VENDAS ━━━━━━━━━━━━━━ */}
      {showFullRankingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-border rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-center justify-between bg-black/40 gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center shrink-0">
                  <TrendingUp className="size-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Ranking Completo de Vendas por Modelo
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Visualização detalhada do desempenho de todos os modelos do catálogo</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-64 hidden sm:block">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={rankingSearchQuery}
                    onChange={(e) => setRankingSearchQuery(e.target.value)}
                    placeholder="Pesquisar no ranking..."
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <button
                  onClick={() => setShowFullRankingModal(false)}
                  className="p-2 text-muted-foreground hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Lista Completa com Expansão */}
            <div className="p-6 overflow-y-auto space-y-3 custom-scrollbar flex-1">
              {(() => {
                const filteredRanking = modelRankingList.filter(m => {
                  if (!rankingSearchQuery.trim()) return true;
                  const q = rankingSearchQuery.toLowerCase().trim();
                  return m.modelDisplayName.toLowerCase().includes(q) || m.brand.toLowerCase().includes(q);
                });

                if (filteredRanking.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-muted-foreground italic">
                      Nenhum modelo encontrado no ranking.
                    </div>
                  );
                }

                return filteredRanking.map((modelItem, idx) => {
                  const maxSold = modelRankingList[0]?.totalSold || 1;
                  const pct = maxSold > 0 ? Math.round((modelItem.totalSold / maxSold) * 100) : 0;
                  const medal = MEDAL_STYLES[idx];
                  const isExpanded = expandedRankingModelKey === modelItem.groupKey;
                  const barColor = medal
                    ? `bg-gradient-to-r ${medal.barFrom} ${medal.barTo}`
                    : "bg-emerald-500/60";

                  return (
                    <div key={modelItem.groupKey} className="border border-white/10 rounded-2xl overflow-hidden bg-black/30 hover:border-white/20 transition-all">
                      <div 
                        onClick={() => setExpandedRankingModelKey(isExpanded ? null : modelItem.groupKey)}
                        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <span className="text-base font-bold w-8 text-center shrink-0">
                          {medal ? medal.emoji : `#${idx + 1}`}
                        </span>

                        {modelItem.image_url ? (
                          <img src={modelItem.image_url} alt={modelItem.modelDisplayName} className="size-10 object-cover rounded-xl border border-white/10 shrink-0" />
                        ) : (
                          <div className="size-10 rounded-xl bg-elevated border border-border flex items-center justify-center shrink-0">
                            <Box className="size-5 text-muted-foreground" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-sm font-bold truncate ${medal ? medal.text : "text-white"}`}>
                              {modelItem.modelDisplayName}
                            </span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                                {modelItem.totalSold} un vendidas
                              </span>
                              <span className="text-xs text-muted-foreground font-medium">
                                {modelItem.totalStock} un em estoque
                              </span>
                            </div>
                          </div>
                          <div className="h-2 w-full bg-elevated rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct || 3}%` }} />
                          </div>
                        </div>

                        <div className="text-muted-foreground hover:text-white shrink-0 ml-1">
                          {isExpanded ? <ChevronUp className="size-5 text-emerald-400" /> : <ChevronDown className="size-5" />}
                        </div>
                      </div>

                      {/* Expansão de Sabores no Ranking Completo */}
                      {isExpanded && (
                        <div className="border-t border-white/10 bg-black/50 p-4 space-y-2 text-xs">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2 flex items-center justify-between">
                            <span>Desempenho de Sabores — {modelItem.modelDisplayName}</span>
                            <span>Estoque Atual</span>
                          </div>

                          {modelItem.flavors.map((fItem: any) => {
                            const flavorStock = fItem.stock;
                            let stockBadgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                            let stockLabel = `${flavorStock} un em estoque`;

                            if (flavorStock === 0) {
                              stockBadgeClass = "bg-red-500/10 text-red-400 border-red-500/20";
                              stockLabel = "Sem estoque";
                            } else if (flavorStock < 5) {
                              stockBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                              stockLabel = `${flavorStock} un restando`;
                            }

                            return (
                              <div key={fItem.id || fItem.flavor} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <Tag className="size-3.5 text-emerald-400" />
                                  <span className="font-semibold text-white">{fItem.flavor}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-muted-foreground font-mono text-xs">
                                    {fItem.totalSold} vendidas
                                  </span>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${stockBadgeClass}`}>
                                    {stockLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-black/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Total de {modelRankingList.length} modelos ranqueados
              </span>
              <button
                onClick={() => setShowFullRankingModal(false)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ━━━ MODAL DE GERENCIAMENTO DE CATEGORIAS E DESTAQUES (⭐) ━━━━━━━━━━━━━━ */}
      {editingCategoryGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-white/15 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Star className="size-5 text-amber-400 fill-amber-400" />
                <h3 className="font-bold text-base text-white">Fixar Pod nos Mais Vendidos</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategoryGroup(null)}
                className="text-muted-foreground hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="size-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Modelo selecionado:</p>
              <p className="text-sm font-bold text-emerald-400">
                {getGroupDisplayName(editingCategoryGroup.brand, editingCategoryGroup.name)}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-silver uppercase tracking-wider block">
                Destaque no Topo do Catálogo
              </label>
              <div className="space-y-2 bg-black/40 border border-white/10 rounded-xl p-3">
                {categoriesList.map((cat) => {
                  const isChecked = selectedCategoryIds.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-amber-500/10 border-amber-500/30 text-white font-semibold"
                          : "bg-white/5 border-transparent text-muted-foreground hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategoryIds((prev) => [...prev, cat.id]);
                            } else {
                              setSelectedCategoryIds((prev) => prev.filter((id) => id !== cat.id));
                            }
                          }}
                          className="size-4 accent-amber-400 rounded cursor-pointer"
                        />
                        <span className="text-xs font-bold">Fixar em "{cat.name}"</span>
                      </div>
                      <span className="text-[10px] text-amber-400/80 font-mono">{cat.badge_text}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-silver uppercase tracking-wider block">
                Posição no Topo (1, 2, 3, 4...)
              </label>
              <input
                type="number"
                min="1"
                value={selectedDisplayOrder}
                onChange={(e) => setSelectedDisplayOrder(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400/50"
                placeholder="Ex: 1 (menor número = primeiro pod do topo)"
              />
              <p className="text-[10px] text-muted-foreground">
                Pods fixados com posição 1, 2, 3 e 4 aparecem nos primeiros 4 slots do topo do catálogo.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingCategoryGroup(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingCategory}
                onClick={async () => {
                  setIsSavingCategory(true);
                  const orderNum = parseInt(selectedDisplayOrder) || 1;
                  const pIds = editingCategoryGroup.flavors.map((f: any) => f.id);
                  const modelKey = editingCategoryGroup.groupKey;
                  const targetCompanyId = company?.id || 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';

                  await updateModelCategories({
                    productIds: pIds,
                    modelKey: modelKey,
                    categoryIds: selectedCategoryIds,
                    displayOrder: orderNum,
                    companyId: targetCompanyId,
                  });

                  setCategoryMappings((prev) => {
                    const updated = { ...prev };
                    updated[modelKey] = { category_ids: selectedCategoryIds, display_order: orderNum };
                    pIds.forEach((pid: string) => {
                      updated[pid] = { category_ids: selectedCategoryIds, display_order: orderNum };
                    });
                    return updated;
                  });

                  setIsSavingCategory(false);
                  setEditingCategoryGroup(null);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(251,191,36,0.3)] cursor-pointer"
              >
                {isSavingCategory ? <Loader2 className="size-4 animate-spin text-black" /> : <Save className="size-4" />}
                <span>Salvar Categorias</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ BARRA FLUTUANTE FIXA NO CANTO INFERIOR DIREITO: SALVAR ALTERAÇÕES ━━━ */}
      {Object.keys(pendingStockChanges).length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-[#121212] border border-emerald-500/40 rounded-2xl p-4 shadow-[0_0_30px_rgba(16,185,129,0.35)] flex items-center gap-4 border-l-4 border-l-emerald-500 backdrop-blur-xl">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Alterações de Estoque</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                {Object.keys(pendingStockChanges).length} {Object.keys(pendingStockChanges).length === 1 ? 'item alterado' : 'itens alterados'} no rascunho
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardStockChanges}
                disabled={isSavingStock}
                className="px-3.5 py-2 rounded-xl bg-elevated hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Descartar
              </button>

              <button
                type="button"
                onClick={handleSaveAllStockChanges}
                disabled={isSavingStock}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isSavingStock ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-black" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ MODAL DE REGISTRO DE VENDA MANUAL ━━━━━━━━━━━━━━━━ */}
      <ManualSaleModal
        isOpen={isManualSaleModalOpen}
        onClose={() => {
          setIsManualSaleModalOpen(false);
          setPreSelectedFlavorIdForSale(null);
          setPreSelectedGroupForSale(null);
        }}
        onSaleSuccess={() => {
          fetchData();
        }}
        preSelectedFlavorId={preSelectedFlavorIdForSale}
        preSelectedGroup={preSelectedGroupForSale}
        companyId={company?.id || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5"}
      />
    </div>
  );
}
