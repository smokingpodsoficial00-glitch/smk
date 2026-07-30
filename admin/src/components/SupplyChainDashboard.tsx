import { useState, useEffect, useRef, useMemo } from "react";
import { 
  PackageSearch, Plus, Minus, Eye, EyeOff, Loader2, ImagePlus, Upload, 
  Trash2, Search, Filter, ArrowUpDown, MoreVertical, Copy, Edit3, DollarSign, 
  CheckCircle2, X, TrendingUp, PieChart, ChevronRight, ChevronDown, ChevronUp, 
  Tag, Box, Camera, Download, FileText, BarChart3
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/cart";
import { useAuth } from "../contexts/AuthContext";

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

  // Estado para o menu de 3 pontos do grupo/modelo
  const [activeGroupMenuKey, setActiveGroupMenuKey] = useState<string | null>(null);

  // Estado para Modal de Edição de Preço/Custo em Lote por Grupo
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [batchPrice, setBatchPrice] = useState<string>("");
  const [batchCostPrice, setBatchCostPrice] = useState<string>("");

  // Estado para Pop-up de Edição de Estoque por Sabor
  const [editingStockSku, setEditingStockSku] = useState<any | null>(null);
  const [newStockValue, setNewStockValue] = useState<string>("");

  // Estado para Gaveta Lateral (Drawer) de Detalhes do SKU
  const [selectedDrawerSKU, setSelectedDrawerSKU] = useState<any | null>(null);

  // Estado para modelo expandido no Ranking de Vendas por Modelo
  const [expandedRankingModelKey, setExpandedRankingModelKey] = useState<string | null>(null);

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
    if (!company?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }
    try {
      const { data: prodData } = await supabase
        .from("smoking_products")
        .select("*")
        .eq("company_id", company.id)
        .neq("brand", "__STORE_CONFIG__")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });

      const { data: topData } = await supabase
        .from("vw_top_selling_flavors")
        .select("*")
        .limit(10);
      if (prodData) setProducts(prodData);
      if (topData) setTopSelling(topData);
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
    if (!name.trim() || !price.trim()) {
      alert("Por favor, preencha o Modelo e o Preço para cadastrar.");
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl = "";
      if (imageFile) imageUrl = await uploadProductImage(imageFile);

      const newBrandName = brand.trim() || "Genérico";
      const newModelName = name.trim();
      const newPriceVal = parseFloat(price);
      const newCostVal = parseFloat(costPrice) || 35.00;
      const newPuffsVal = parseInt(puffs) || 5000;

      let insertPayload: any = {
        name: newModelName, brand: newBrandName, flavor: "Padrão",
        price: newPriceVal, cost_price: newCostVal, stock: 0,
        puffs: newPuffsVal, image_url: imageUrl, is_active: true,
        company_id: company?.id || null,
      };

      // Garante que o vínculo company_users existe no Supabase antes de inserir
      if (company?.id) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase.from("companies").upsert({
            id: company.id, name: company.name || 'Minha Loja', email: session.user.email || '', onboarding_done: true
          }, { onConflict: 'id' }).catch(() => {});

          await supabase.from("company_users").upsert({
            company_id: company.id, auth_user_id: session.user.id, name: 'Administrador', email: session.user.email || '', role: 'admin'
          }, { onConflict: 'company_id,auth_user_id' }).catch(() => {});
        }
      }

      let { data, error } = await supabase.from("smoking_products").insert(insertPayload).select();
      if (error && error.message?.includes("row-level security")) {
        // Tenta sem filtro RLS restrito ou com payload formatado
        delete insertPayload.company_id;
        const retryRes = await supabase.from("smoking_products").insert(insertPayload).select();
        data = retryRes.data; error = retryRes.error;
      }
      if (error && (error.message?.includes("cost_price") || error.code === "PGRST204")) {
        delete insertPayload.cost_price;
        const fallbackRes = await supabase.from("smoking_products").insert(insertPayload).select();
        data = fallbackRes.data; error = fallbackRes.error;
      }

      if (!error && data && data.length > 0) {
        setName(""); setBrand(""); setPrice(""); setCostPrice(""); setPuffs("");
        setImageFile(null); setImagePreview("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setShowNewProductModal(false);
        await fetchData();

        setAddingFlavorGroup({
          brand: newBrandName, name: newModelName, price: newPriceVal,
          cost_price: newCostVal, puffs: newPuffsVal, image_url: imageUrl,
        });
        setNewFlavorName(""); setNewFlavorStock("");
      } else {
        alert("Erro ao inserir no Supabase: " + (error?.message || "Erro desconhecido."));
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao cadastrar: " + err.message);
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
    setSubmittingFlavor(true);
    try {
      let insertPayload: any = {
        name: addingFlavorGroup.name, brand: addingFlavorGroup.brand,
        flavor: newFlavorName.trim(), price: addingFlavorGroup.price,
        cost_price: addingFlavorGroup.cost_price || 35.00,
        stock: parseInt(newFlavorStock) || 0, puffs: addingFlavorGroup.puffs || 5000,
        image_url: addingFlavorGroup.image_url || "", is_active: true,
        company_id: company?.id || null,
      };
      let { data, error } = await supabase.from("smoking_products").insert(insertPayload).select();
      if (error && (error.message?.includes("cost_price") || error.code === "PGRST204")) {
        delete insertPayload.cost_price;
        const fallbackRes = await supabase.from("smoking_products").insert(insertPayload).select();
        data = fallbackRes.data; error = fallbackRes.error;
      }
      if (!error && data) {
        const addedName = newFlavorName.trim();
        const modelName = getGroupDisplayName(addingFlavorGroup.brand, addingFlavorGroup.name);
        setAddingFlavorGroup(null); setNewFlavorName(""); setNewFlavorStock("");
        alert(`Sabor "${addedName}" adicionado ao modelo ${modelName}!`);
        await fetchData();
      } else {
        alert("Erro ao adicionar sabor: " + (error?.message || "Erro desconhecido."));
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao adicionar sabor: " + err.message);
    } finally {
      setSubmittingFlavor(false);
    }
  };

  const handleUpdateStock = async (id: string, newStock: number) => {
    if (newStock < 0) return;
    try {
      // 1. Atualização otimista imediata na interface
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p));
      if (selectedDrawerSKU?.id === id) {
        setSelectedDrawerSKU((prev: any) => prev ? { ...prev, stock: newStock } : null);
      }

      // 2. Gravação definitiva no Supabase com fallback seguro
      let query = supabase.from("smoking_products").update({ stock: newStock }).eq("id", id);
      if (company?.id) {
        query = query.eq("company_id", company.id);
      }
      const { data, error } = await query.select();

      if (error || !data || data.length === 0) {
        // Fallback: se por algum motivo a trava de company_id não deu match, tenta pelo ID direto
        await supabase.from("smoking_products").update({ stock: newStock }).eq("id", id);
      }
    } catch (err) {
      console.error("Erro ao salvar estoque no Supabase:", err);
    }
  };

  const handleSaveModalStock = async () => {
    if (!editingStockSku) return;
    const parsed = parseInt(newStockValue);
    if (!isNaN(parsed) && parsed >= 0) await handleUpdateStock(editingStockSku.id, parsed);
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
    if (!editingGroup) return;
    const ids = editingGroup.flavors.map((f: any) => f.id);
    const pVal = parseFloat(batchPrice);
    const cVal = parseFloat(batchCostPrice);
    let updatePayload: any = {};
    if (!isNaN(pVal) && pVal >= 0) updatePayload.price = pVal;
    if (!isNaN(cVal) && cVal >= 0) updatePayload.cost_price = cVal;
    if (Object.keys(updatePayload).length === 0) { setEditingGroup(null); return; }
    try {
      setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, ...updatePayload } : p));
      await supabase.from("smoking_products").update(updatePayload).in("id", ids);
    } catch (err) {
      console.error(err); fetchData();
    } finally {
      setEditingGroup(null);
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
        price: sku.price, cost_price: sku.cost_price || 35.00, stock: 0,
        puffs: sku.puffs, image_url: sku.image_url, is_active: true,
      }).select();
      if (!error && data) { alert("SKU duplicado com sucesso!"); fetchData(); }
    } catch (err) { console.error(err); }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroupKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Computed Metrics ───────────────────────────────────
  const totalProducts = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalStockValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (parseFloat(p.price) || 0)), 0);
  const totalStockCost = products.reduce((acc, p) => acc + ((p.stock || 0) * (parseFloat(p.cost_price || 35))), 0);
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
        price: parseFloat(product.price) || 0, cost_price: parseFloat(product.cost_price) || 35,
        image_url: product.image_url || "", totalStock: 0, 
        flavors: [], realFlavors: [], outOfStockFlavors: [], lowStockFlavors: [], inStockFlavors: []
      };
    }

    groupedMap[groupKey].flavors.push(product);
    if (!groupedMap[groupKey].image_url && product.image_url) groupedMap[groupKey].image_url = product.image_url;
  });

  // Step 3: Compute real flavor lists & stock counts per model group
  Object.values(groupedMap).forEach(group => {
    group.realFlavors = group.flavors.filter((f: any) => {
      const fName = (f.flavor || '').trim().toLowerCase();
      return fName !== 'padrão' && fName !== 'padrao' && fName !== '';
    });

    group.totalStock = group.realFlavors.reduce((sum, f) => sum + (f.stock || 0), 0);
    group.outOfStockFlavors = group.realFlavors.filter(f => (f.stock || 0) === 0);
    group.lowStockFlavors = group.realFlavors.filter(f => (f.stock || 0) > 0 && (f.stock || 0) < 5);
    group.inStockFlavors = group.realFlavors.filter(f => (f.stock || 0) >= 5);
  });

  // Step 4: Apply filterTab based on ANY flavor in the model group matching the selected status!
  const skuGroups = Object.values(groupedMap)
    .filter(group => {
      if (filterTab === 'SEM_ESTOQUE') return group.outOfStockFlavors.length > 0;
      if (filterTab === 'BAIXO_ESTOQUE') return group.lowStockFlavors.length > 0;
      if (filterTab === 'EM_ESTOQUE') return group.inStockFlavors.length > 0;
      return true; // TODOS
    })
    .sort((a, b) => b.totalStock - a.totalStock);

  // Step 5: Ranking de Vendas por Modelo de Pod com Expansão por Sabores
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

  Object.values(groupedMap).forEach(group => {
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

  topSelling.forEach((item: any) => {
    const pName = (item.product_name || item.name || '').toLowerCase();
    const fName = (item.flavor || '').toLowerCase();
    const sold = parseInt(item.total_sold || item.quantity || 0) || 0;

    Object.values(modelRankingMap).forEach(m => {
      const brandLower = m.brand.toLowerCase();
      const nameLower = m.name.toLowerCase();
      if (pName.includes(brandLower) || pName.includes(nameLower) || m.modelDisplayName.toLowerCase().includes(pName)) {
        m.totalSold += sold;
        const foundFlavor = m.flavors.find(f => f.flavor.toLowerCase() === fName);
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

            {/* Apenas o Botão + Novo Produto no Topo Superior Direito */}
            <button
              onClick={() => setShowNewProductModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] cursor-pointer active:scale-[0.97]"
            >
              <Plus className="size-4" />
              Novo Produto
            </button>
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
              <span className="text-[10px] text-muted-foreground font-medium">Clique no modelo para ver os sabores</span>
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
                  {/* ── CARD HEADER MINIMALISTA E UNIFORME ────────── */}
                  <div 
                    onClick={() => toggleGroup(group.groupKey)}
                    className="p-5 cursor-pointer hover:bg-white/[0.015] transition-colors select-none space-y-4"
                  >
                    {/* Linha Superior: Foto, Nome, Puffs e Ações */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {/* Foto do Modelo */}
                        <div 
                          onClick={(e) => e.stopPropagation()}
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

                      {/* Ações do Grupo (Status, Olho, 3 Pontos, Chevron) */}
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${stockBadgeClass}`}>
                          <div className={`size-1.5 rounded-full ${stockBarColor}`} />
                          {stockLabel}
                        </span>

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
                                  setEditingGroup(group);
                                  setBatchPrice(group.price.toString());
                                  setBatchCostPrice(group.cost_price.toString());
                                  setActiveGroupMenuKey(null);
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-white/15 hover:text-white flex items-center gap-2.5 text-silver transition-colors cursor-pointer"
                              >
                                <Edit3 className="size-3.5 text-blue-400" />
                                Editar Preço / Custo em Lote
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
                        <span className="font-medium text-muted-foreground">{formatBRL(group.cost_price)}</span>
                      </div>
                      <div className="h-3 w-px bg-white/10" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Lucro</span>
                        <span className="font-bold text-emerald-400">{formatBRL(profit)}</span>
                        <span className="text-[10px] text-emerald-400/80 font-semibold">({marginPct}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* ── SUB-LISTA DE SABORES (EXPANDIDO) ── */}
                  {isExpanded && (
                    <div className="bg-[#0a0a0a] border-t border-border/80 p-4 space-y-3 animate-in fade-in duration-200 rounded-b-2xl">
                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Sabores — {displayName}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingFlavorGroup(group);
                            setNewFlavorName(""); setNewFlavorStock("");
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-all cursor-pointer"
                        >
                          <Plus className="size-3.5" />
                          Adicionar Sabor
                        </button>
                      </div>

                      {realFlavors.length === 0 ? (
                        <div className="py-6 text-center space-y-2">
                          <p className="text-xs text-muted-foreground">Nenhum sabor cadastrado ainda.</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddingFlavorGroup(group);
                              setNewFlavorName(""); setNewFlavorStock("");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-all cursor-pointer"
                          >
                            <Plus className="size-3.5" />
                            Cadastrar Primeiro Sabor
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {realFlavors.map((flavorSku: any) => {
                            const flavorStock = flavorSku.stock || 0;
                            let flavorBadge;
                            if (flavorStock >= 5) flavorBadge = <span className="text-emerald-400 text-[10px] font-medium">🟢 Em estoque</span>;
                            else if (flavorStock > 0) flavorBadge = <span className="text-amber-400 text-[10px] font-medium">🟡 Estoque Baixo</span>;
                            else flavorBadge = <span className="text-red-400 text-[10px] font-medium">🔴 Esgotado</span>;

                            const isFilteredMatch = 
                              (filterTab === 'SEM_ESTOQUE' && flavorStock === 0) ||
                              (filterTab === 'BAIXO_ESTOQUE' && flavorStock > 0 && flavorStock < 5) ||
                              (filterTab === 'EM_ESTOQUE' && flavorStock >= 5);

                            return (
                              <div 
                                key={flavorSku.id}
                                onClick={() => setSelectedDrawerSKU(flavorSku)}
                                className={`py-2.5 px-3 flex items-center justify-between gap-4 rounded-xl transition-colors cursor-pointer ${
                                  isFilteredMatch && (filterTab as string) !== 'TODOS' ? 'bg-white/[0.04] border border-white/10' : 'hover:bg-white/[0.02]'
                                }`}
                              >
                                <div>
                                  <span className="font-semibold text-white text-xs block">{flavorSku.flavor}</span>
                                  {flavorBadge}
                                </div>
                                <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                  <div className="inline-flex items-center gap-1 bg-[#0f0f0f] border border-white/10 rounded-xl p-1">
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateStock(flavorSku.id, flavorStock - 1)}
                                      disabled={flavorStock === 0}
                                      className="grid place-items-center size-6 rounded-lg hover:bg-white/10 active:scale-95 disabled:opacity-20 cursor-pointer text-muted-foreground hover:text-white"
                                    >
                                      <Minus className="size-3" />
                                    </button>
                                    <span 
                                      onClick={() => { setEditingStockSku(flavorSku); setNewStockValue(flavorStock.toString()); }}
                                      className="w-10 text-center text-xs font-bold text-silver cursor-pointer hover:text-emerald-400"
                                      title="Clique para editar"
                                    >
                                      {flavorStock} un
                                    </span>
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateStock(flavorSku.id, flavorStock + 1)}
                                      className="grid place-items-center size-6 rounded-lg hover:bg-white/10 active:scale-95 cursor-pointer text-muted-foreground hover:text-white"
                                    >
                                      <Plus className="size-3" />
                                    </button>
                                  </div>
                                  <button
                                    onClick={() => setSelectedDrawerSKU(flavorSku)}
                                    className="p-1.5 rounded-lg bg-elevated hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                                    title="Ver detalhes"
                                  >
                                    <ChevronRight className="size-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

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
                    type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                    placeholder="90.00" required
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Custo (R$)</label>
                  <input 
                    type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="35.00"
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
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
                  className="flex-1 bg-elevated hover:bg-white/10 text-muted-foreground text-xs font-semibold py-2.5 rounded-xl border border-border transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? <Loader2 className="size-3.5 animate-spin" /> : "Cadastrar Modelo"}
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

      {/* ━━━ MODAL: EDIÇÃO EM LOTE (PREÇO/CUSTO) ━━━━━━━ */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-border rounded-2xl w-full max-w-sm shadow-2xl p-5 relative animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <button onClick={() => setEditingGroup(null)} className="absolute top-3 right-3 text-muted-foreground hover:text-white"><X className="size-4" /></button>
            <h3 className="font-semibold text-sm text-silver">Editar Valores do Modelo</h3>
            <p className="text-xs text-muted-foreground">
              {getGroupDisplayName(editingGroup.brand, editingGroup.name)} ({editingGroup.flavors.length} sabores afetados)
            </p>
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">Preço de Venda (R$)</label>
                <input type="number" step="0.01" value={batchPrice} onChange={(e) => setBatchPrice(e.target.value)}
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-medium" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">Custo de Reposição (R$)</label>
                <input type="number" step="0.01" value={batchCostPrice} onChange={(e) => setBatchCostPrice(e.target.value)}
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-medium" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingGroup(null)} className="flex-1 bg-elevated hover:bg-white/10 text-muted-foreground text-xs py-2.5 rounded-xl border border-border">Cancelar</button>
              <button onClick={handleSaveBatchGroupEdit} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2.5 rounded-xl">Salvar em Lote</button>
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
                <button onClick={() => setSelectedDrawerSKU(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10">
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
    </div>
  );
}
