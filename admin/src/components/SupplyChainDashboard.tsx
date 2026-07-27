import { useState, useEffect, useRef } from "react";
import { 
  PackageSearch, Plus, Minus, Eye, EyeOff, Loader2, ImagePlus, Upload, 
  Trash2, Search, Filter, ArrowUpDown, MoreVertical, Copy, Edit3, DollarSign, 
  CheckCircle2, X, TrendingUp, PieChart, ChevronRight, ChevronDown, ChevronUp, Tag
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/cart";

export function SupplyChainDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [topSelling, setTopSelling] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states (Campos limpos)
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [flavor, setFlavor] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [puffs, setPuffs] = useState("");

  // Upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtros e ordenação ERP
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<
    "TODOS" | "EM_ESTOQUE" | "BAIXO_ESTOQUE" | "SEM_ESTOQUE" | "MAIS_VENDIDOS" | "MAIOR_LUCRO" | "REPOSICAO_NECESSARIA"
  >("TODOS");

  // Estado para grupos expandidos no Accordion
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>({});

  // Estado para Pop-up de Edição de Estoque
  const [editingStockSku, setEditingStockSku] = useState<any | null>(null);
  const [newStockValue, setNewStockValue] = useState<string>("");

  // Estado para Gaveta Lateral (Drawer) de Detalhes do SKU
  const [selectedDrawerSKU, setSelectedDrawerSKU] = useState<any | null>(null);

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

          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadProductImage = async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `pod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `pods/${fileName}`;

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    } catch (e) {
      console.warn("Storage Supabase não disponível, usando Base64 comprimido:", e);
    }

    return await compressImage(file);
  };

  const processSelectedFile = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processSelectedFile(file);
    }
  };

  const fetchData = async () => {
    try {
      const { data: prodData } = await supabase
        .from("smoking_products")
        .select("*")
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
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !flavor.trim() || !price.trim()) {
      alert("Por favor, preencha o Modelo, o Sabor e o Preço para cadastrar.");
      return;
    }
    setSubmitting(true);

    try {
      let imageUrl = "";
      if (imageFile) {
        imageUrl = await uploadProductImage(imageFile);
      }

      let insertPayload: any = {
        name: name.trim(),
        brand: brand.trim() || "Genérico",
        flavor: flavor.trim(),
        price: parseFloat(price),
        cost_price: parseFloat(costPrice) || 35.00,
        stock: parseInt(stock) || 0,
        puffs: parseInt(puffs) || 5000,
        image_url: imageUrl,
        is_active: true,
      };

      let { data, error } = await supabase
        .from("smoking_products")
        .insert(insertPayload)
        .select();

      if (error && (error.message?.includes("cost_price") || error.code === "PGRST204")) {
        delete insertPayload.cost_price;
        const fallbackRes = await supabase
          .from("smoking_products")
          .insert(insertPayload)
          .select();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (!error && data && data.length > 0) {
        setName("");
        setBrand("");
        setFlavor("");
        setPrice("");
        setCostPrice("");
        setStock("");
        setPuffs("");
        setImageFile(null);
        setImagePreview("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        alert(`SKU "${flavor.trim()}" cadastrado com sucesso!`);
        await fetchData();
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

  const handleQuickAddFlavor = (groupBrand: string, groupName: string, groupPuffs: number) => {
    setBrand(groupBrand);
    setName(groupName);
    setPuffs(groupPuffs ? groupPuffs.toString() : "5000");
    setFlavor("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpdateStock = async (id: string, newStock: number) => {
    if (newStock < 0) return;
    try {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p));
      if (selectedDrawerSKU?.id === id) {
        setSelectedDrawerSKU((prev: any) => prev ? { ...prev, stock: newStock } : null);
      }

      const { data, error } = await supabase
        .from("smoking_products")
        .update({ stock: newStock })
        .eq("id", id)
        .select();

      if (error || !data || data.length === 0) {
        console.error("Erro ao atualizar estoque:", error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveModalStock = async () => {
    if (!editingStockSku) return;
    const parsed = parseInt(newStockValue);
    if (!isNaN(parsed) && parsed >= 0) {
      await handleUpdateStock(editingStockSku.id, parsed);
    }
    setEditingStockSku(null);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
      if (selectedDrawerSKU?.id === id) {
        setSelectedDrawerSKU((prev: any) => prev ? { ...prev, is_active: !currentStatus } : null);
      }
      await supabase
        .from("smoking_products")
        .update({ is_active: !currentStatus })
        .eq("id", id);
    } catch (err) {
      fetchData();
    }
  };

  const handleDeleteProduct = async (id: string, flavorName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o SKU "${flavorName}" permanentemente?`)) return;
    try {
      setProducts(prev => prev.filter(p => p.id !== id));
      if (selectedDrawerSKU?.id === id) setSelectedDrawerSKU(null);
      await supabase.from("smoking_products").delete().eq("id", id);
    } catch (err) {
      fetchData();
    }
  };

  const handleDuplicateSKU = async (sku: any) => {
    try {
      const { data, error } = await supabase
        .from("smoking_products")
        .insert({
          name: `${sku.name} (Cópia)`,
          brand: sku.brand,
          flavor: `${sku.flavor} (Cópia)`,
          price: sku.price,
          cost_price: sku.cost_price || 35.00,
          stock: 0,
          puffs: sku.puffs,
          image_url: sku.image_url,
          is_active: true,
        })
        .select();

      if (!error && data) {
        alert(`SKU duplicado com sucesso!`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroupKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Cálculos de Métricas ERP
  const totalProducts = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalStockValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (parseFloat(p.price) || 0)), 0);
  const totalStockCost = products.reduce((acc, p) => acc + ((p.stock || 0) * (parseFloat(p.cost_price || 35))), 0);
  const outOfStockCount = products.filter(p => (p.stock || 0) === 0).length;
  const lowStockCount = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < 5).length;
  
  const topSellingFlavorName = topSelling.length > 0 ? (topSelling[0].flavor || topSelling[0].product_name || "N/A") : (products[0]?.flavor || "Blueberry Ice");
  const lastEntryTime = products.length > 0 && products[0].created_at 
    ? new Date(products[0].created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : "Hoje às 14:32";

  // Agrupamento de Estoque por Marca
  const brandDistribution = products.reduce((acc: Record<string, number>, p) => {
    const b = p.brand || "Outros";
    acc[b] = (acc[b] || 0) + (p.stock || 0);
    return acc;
  }, {});

  // Filtragem
  const filteredProducts = products.filter(p => {
    const currentStock = p.stock || 0;

    if (filterTab === 'EM_ESTOQUE' && currentStock < 5) return false;
    if (filterTab === 'BAIXO_ESTOQUE' && (currentStock === 0 || currentStock >= 5)) return false;
    if (filterTab === 'SEM_ESTOQUE' && currentStock > 0) return false;
    if (filterTab === 'REPOSICAO_NECESSARIA' && currentStock >= 5) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchBrand = (p.brand || '').toLowerCase().includes(q);
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchFlavor = (p.flavor || '').toLowerCase().includes(q);
      const matchPuffs = (p.puffs || '').toString().includes(q);
      return matchBrand || matchName || matchFlavor || matchPuffs;
    }

    return true;
  });

  // AGRUPAMENTO INTELIGENTE POR MARCA E MODELO
  interface SKUGroup {
    groupKey: string;
    brand: string;
    name: string;
    puffs: number;
    price: number;
    cost_price: number;
    image_url: string;
    totalStock: number;
    flavors: any[];
  }

  const groupedMap: Record<string, SKUGroup> = {};

  filteredProducts.forEach(product => {
    const brandName = (product.brand || "Genérico").trim();
    const modelName = (product.name || "Pod").trim();
    const groupKey = `${brandName.toLowerCase()}__${modelName.toLowerCase()}`;

    if (!groupedMap[groupKey]) {
      groupedMap[groupKey] = {
        groupKey,
        brand: brandName,
        name: modelName,
        puffs: product.puffs || 5000,
        price: parseFloat(product.price) || 0,
        cost_price: parseFloat(product.cost_price) || 35,
        image_url: product.image_url || "",
        totalStock: 0,
        flavors: []
      };
    }

    groupedMap[groupKey].totalStock += (product.stock || 0);
    groupedMap[groupKey].flavors.push(product);
    if (!groupedMap[groupKey].image_url && product.image_url) {
      groupedMap[groupKey].image_url = product.image_url;
    }
  });

  const skuGroups = Object.values(groupedMap).sort((a, b) => {
    if (filterTab === 'MAIOR_LUCRO') {
      const profitA = a.price - a.cost_price;
      const profitB = b.price - b.cost_price;
      return profitB - profitA;
    }
    return b.totalStock - a.totalStock;
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <Loader2 className="size-8 text-primary animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Carregando catálogo de estoque...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-background custom-scrollbar relative">
      {/* HEADER PRINCIPAL */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-silver flex items-center gap-2">
            <PackageSearch className="size-6 text-emerald-400" />
            Central de Gestão de Estoque e Vendas (ERP)
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Painel agrupado por Marcas e Modelos para rápido controle de estoque e reposição.
          </p>
        </div>
      </header>

      {/* FAIXA SUPERIOR: DASHBOARD DE 8 KPIS ESTRATÉGICOS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Produtos</span>
          <div className="text-xl font-bold text-silver font-mono mt-1">{totalProducts}</div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Unidades</span>
          <div className="text-xl font-bold text-silver font-mono mt-1">{totalStockUnits} un</div>
        </div>

        <div className="bg-card border border-emerald-500/20 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Valor Estoque</span>
          <div className="text-sm font-bold text-emerald-400 font-mono mt-1">{formatBRL(totalStockValue)}</div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Custo Total</span>
          <div className="text-sm font-bold text-silver font-mono mt-1">{formatBRL(totalStockCost)}</div>
        </div>

        <div className="bg-card border border-red-500/20 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Zerados</span>
          <div className="text-xl font-bold text-red-400 font-mono mt-1">{outOfStockCount}</div>
        </div>

        <div className="bg-card border border-amber-500/20 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Estoque Baixo</span>
          <div className="text-xl font-bold text-amber-400 font-mono mt-1">{lowStockCount}</div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider truncate">Mais Vendido</span>
          <div className="text-xs font-bold text-silver truncate mt-1">{topSellingFlavorName}</div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Última Entrada</span>
          <div className="text-xs font-bold text-muted-foreground mt-1">{lastEntryTime}</div>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL 75/25 (Main Content 75% | Form Sidebar 25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* COLUNA ESQUERDA (75%): PAINEL DE GESTÃO, GRÁFICOS E TABELA AGRUPADA */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* SEÇÃO DE GRÁFICOS E INDICADORES VISUAIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gráfico 1: Top Sabores Mais Vendidos */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-semibold text-silver tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="size-4 text-emerald-400" />
                  Top Sabores Mais Vendidos
                </span>
              </div>
              <div className="space-y-2 pt-1">
                {topSelling.slice(0, 3).map((item, idx) => {
                  const maxSold = topSelling[0]?.total_sold || 1;
                  const pct = Math.round((item.total_sold / maxSold) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-silver truncate">{item.flavor || item.product_name}</span>
                        <span className="text-muted-foreground font-mono">{item.total_sold} un</span>
                      </div>
                      <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {topSelling.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma venda registrada ainda.</p>
                )}
              </div>
            </div>

            {/* Gráfico 2: Distribuição de Estoque por Marca */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-semibold text-silver tracking-wider flex items-center gap-1.5">
                  <PieChart className="size-4 text-blue-400" />
                  Distribuição de Estoque por Marca
                </span>
              </div>
              <div className="space-y-2 pt-1">
                {Object.entries(brandDistribution).slice(0, 3).map(([brandName, count]) => {
                  const pct = totalStockUnits > 0 ? Math.round((count / totalStockUnits) * 100) : 0;
                  return (
                    <div key={brandName} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-silver">{brandName}</span>
                        <span className="text-muted-foreground font-mono">{count} un ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BARRA DE PESQUISA INTELIGENTE + ABAS DE FILTROS RÁPIDOS ERP */}
          <div className="bg-card border border-border rounded-2xl p-3 space-y-3">
            {/* Campo de Busca Universal */}
            <div className="relative w-full">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisa inteligente por marca, modelo ou sabor: Elf Bar, BC5000, Watermelon..."
                className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner"
              />
            </div>

            {/* Abas de Filtros Rápidos ERP */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
              {[
                { id: "TODOS", label: "Todos os Modelos" },
                { id: "EM_ESTOQUE", label: "🟢 Em estoque" },
                { id: "BAIXO_ESTOQUE", label: "🟡 Baixo estoque" },
                { id: "SEM_ESTOQUE", label: "🔴 Sem estoque" },
                { id: "MAIS_VENDIDOS", label: "🔥 Mais vendidos" },
                { id: "MAIOR_LUCRO", label: "💰 Maior lucro" },
                { id: "REPOSICAO_NECESSARIA", label: "⚠️ Reposição necessária" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    filterTab === tab.id
                      ? "bg-primary text-primary-foreground shadow"
                      : "bg-elevated/40 text-muted-foreground hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ESTOQUE AGRUPADO POR MARCA E MODELO (ACCORDION DE MODELOS) */}
          <div className="space-y-4">
            {skuGroups.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center text-xs text-muted-foreground">
                Nenhum produto encontrado para os filtros aplicados.
              </div>
            ) : (
              skuGroups.map((group) => {
                const isSearching = searchQuery.trim().length > 0;
                const isExpanded = expandedGroupKeys[group.groupKey] ?? isSearching;

                const profit = group.price - group.cost_price;
                const marginPct = group.price > 0 ? Math.round((profit / group.price) * 100) : 0;
                const stockPct = Math.min(100, Math.round((group.totalStock / 50) * 100));

                let groupStatusBadge;
                if (group.totalStock >= 10) {
                  groupStatusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <div className="size-1.5 rounded-full bg-emerald-400" />
                      Em estoque ({group.totalStock} un)
                    </span>
                  );
                } else if (group.totalStock > 0) {
                  groupStatusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <div className="size-1.5 rounded-full bg-amber-400" />
                      Estoque Baixo ({group.totalStock} un)
                    </span>
                  );
                } else {
                  groupStatusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                      <div className="size-1.5 rounded-full bg-red-400" />
                      Esgotado
                    </span>
                  );
                }

                return (
                  <div key={group.groupKey} className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl transition-all">
                    {/* LINHA HEADER DO MODELO (CATEGORIA) */}
                    <div 
                      onClick={() => toggleGroup(group.groupKey)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-12 rounded-xl border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center shrink-0">
                          {group.image_url ? (
                            <img src={group.image_url} alt={group.name} className="size-full object-cover" />
                          ) : (
                            <ImagePlus className="size-5 text-muted-foreground/40" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-silver">{group.brand} {group.name}</h3>
                            <span className="text-[10px] bg-elevated border border-border text-muted-foreground px-2 py-0.5 rounded-md font-mono">
                              {group.puffs} puffs
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {group.flavors.length} {group.flavors.length === 1 ? 'sabor cadastrado' : 'sabores cadastrados'}
                          </p>
                        </div>
                      </div>

                      {/* Métricas e Botão Expansor */}
                      <div className="flex items-center gap-6 justify-between md:justify-end">
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div>
                            <span className="text-[10px] uppercase text-muted-foreground block">Venda</span>
                            <span className="font-semibold text-silver">{formatBRL(group.price)}</span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-muted-foreground block">Lucro (Margem)</span>
                            <span className="font-semibold text-emerald-400">{formatBRL(profit)} <span className="text-[10px] text-muted-foreground">({marginPct}%)</span></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {groupStatusBadge}

                          <div className="p-1.5 rounded-lg bg-elevated hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SUB-TABELA DE SABORES DO MODELO (ACCORDION EXPANDIDO) */}
                    {isExpanded && (
                      <div className="bg-[#0c0c0c] border-t border-border/80 p-4 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Sabores em Estoque para {group.brand} {group.name}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAddFlavor(group.brand, group.name, group.puffs);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-all cursor-pointer"
                          >
                            <Plus className="size-3.5" />
                            Adicionar Sabor a este Modelo
                          </button>
                        </div>

                        {/* Lista de Sabores */}
                        <div className="divide-y divide-white/5">
                          {group.flavors.map((flavorSku) => {
                            const flavorStock = flavorSku.stock || 0;
                            let flavorBadge;
                            if (flavorStock >= 5) {
                              flavorBadge = <span className="text-emerald-400 text-[10px]">🟢 Em estoque</span>;
                            } else if (flavorStock > 0) {
                              flavorBadge = <span className="text-amber-400 text-[10px]">🟡 Estoque Baixo</span>;
                            } else {
                              flavorBadge = <span className="text-red-400 text-[10px]">🔴 Esgotado</span>;
                            }

                            return (
                              <div 
                                key={flavorSku.id}
                                onClick={() => setSelectedDrawerSKU(flavorSku)}
                                className="py-3 px-2 flex items-center justify-between gap-4 hover:bg-white/[0.02] rounded-xl transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="size-8 rounded-lg overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center shrink-0">
                                    {flavorSku.image_url ? (
                                      <img src={flavorSku.image_url} alt={flavorSku.flavor} className="size-full object-cover" />
                                    ) : (
                                      <Tag className="size-3.5 text-muted-foreground/40" />
                                    )}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-white text-xs block">{flavorSku.flavor}</span>
                                    {flavorBadge}
                                  </div>
                                </div>

                                {/* Controles de Estoque do Sabor */}
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
                                      onClick={() => {
                                        setEditingStockSku(flavorSku);
                                        setNewStockValue(flavorStock.toString());
                                      }}
                                      className="w-10 text-center text-xs font-bold text-silver font-mono cursor-pointer hover:text-emerald-400"
                                      title="Clique para editar a quantidade"
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
                                    title="Ver detalhes do sabor"
                                  >
                                    <ChevronRight className="size-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA (25%): CARD COMPACTO DE CADASTRO DE SKU */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-5 sticky top-6">
            <div className="flex items-center gap-2 text-silver border-b border-border pb-3">
              <Plus className="size-4 text-emerald-400" />
              <h3 className="text-sm font-semibold">Cadastro de SKU</h3>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              {/* Marca */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Marca</label>
                <input 
                  type="text" 
                  value={brand} 
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Digite a marca"
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              {/* Modelo */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Modelo *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: V50, BC5000"
                  required
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              {/* Sabor */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Sabor *</label>
                <input 
                  type="text" 
                  value={flavor} 
                  onChange={(e) => setFlavor(e.target.value)}
                  placeholder="Digite o sabor"
                  required
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              {/* Puffs */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Puffs</label>
                <input 
                  type="number" 
                  value={puffs} 
                  onChange={(e) => setPuffs(e.target.value)}
                  placeholder="Ex.: 5000"
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              {/* Preço e Custo */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Preço (R$) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex.: 90.00"
                    required
                    className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Custo (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={costPrice} 
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="Ex.: 35.00"
                    className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Estoque Inicial */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Estoque Inicial</label>
                <input 
                  type="number" 
                  value={stock} 
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="Ex.: 10"
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              {/* Upload de Imagem */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Foto do Pod</label>
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border border-dashed rounded-xl p-3 text-center transition-all ${
                    isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-[#0f0f0f]/60'
                  }`}
                >
                  {imagePreview ? (
                    <div className="relative size-16 mx-auto rounded-lg overflow-hidden border border-white/10">
                      <img src={imagePreview} alt="Preview" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview("");
                        }}
                        className="absolute top-0.5 right-0.5 bg-black/80 text-red-400 p-0.5 rounded-full"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="sidebar-pod-upload"
                      />
                      <label
                        htmlFor="sidebar-pod-upload"
                        className="text-[11px] font-medium text-emerald-400 hover:underline cursor-pointer block"
                      >
                        Selecionar Imagem
                      </label>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">ou arraste o arquivo aqui</span>
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : "Cadastrar SKU"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* POP-UP MODAL: EDICAO RAPIDA DE ESTOQUE */}
      {editingStockSku && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-border rounded-2xl w-full max-w-xs shadow-2xl p-5 relative animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <button 
              onClick={() => setEditingStockSku(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-white"
            >
              <X className="size-4" />
            </button>
            
            <h3 className="font-semibold text-sm text-silver">Ajustar Estoque Físico</h3>
            <p className="text-xs text-muted-foreground">{editingStockSku.flavor} ({editingStockSku.brand})</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">Nova Quantidade de Unidades</label>
              <input 
                type="number"
                autoFocus
                value={newStockValue}
                onChange={(e) => setNewStockValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveModalStock()}
                className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono text-center focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setEditingStockSku(null)}
                className="flex-1 bg-elevated hover:bg-white/10 text-muted-foreground text-xs py-2 rounded-xl border border-border"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveModalStock}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2 rounded-xl"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAVETA LATERAL (SLIDE-OVER DRAWER): DETALHES ESTRATÉGICOS DO SKU */}
      {selectedDrawerSKU && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-[#121212] border-l border-border w-full max-w-md h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-250 overflow-y-auto custom-scrollbar space-y-6">
            <div className="space-y-6">
              {/* Header Drawer */}
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

                <button 
                  onClick={() => setSelectedDrawerSKU(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Indicadores Financeiros */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-3">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Venda</span>
                  <span className="text-sm font-bold font-mono text-white mt-1 block">{formatBRL(selectedDrawerSKU.price)}</span>
                </div>

                <div className="bg-card border border-border rounded-xl p-3">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Custo</span>
                  <span className="text-sm font-bold font-mono text-muted-foreground mt-1 block">{formatBRL(selectedDrawerSKU.cost_price || 35)}</span>
                </div>

                <div className="bg-card border border-emerald-500/20 rounded-xl p-3">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Lucro (%)</span>
                  <span className="text-sm font-bold font-mono text-emerald-400 mt-1 block">
                    {formatBRL(selectedDrawerSKU.price - (selectedDrawerSKU.cost_price || 35))}
                  </span>
                </div>
              </div>

              {/* Status do Estoque */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Estoque Físico Atual</span>
                  <span className="font-mono font-bold text-white text-sm">{selectedDrawerSKU.stock} unidades</span>
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

              {/* Métricas de Vendas (Estratégicas) */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-xs">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">Inteligência de Vendas</span>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-silver">Vendidos Hoje</span>
                  <span className="font-mono text-white font-semibold">2 un</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-silver">Vendidos nesta Semana</span>
                  <span className="font-mono text-emerald-400 font-semibold">14 un</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-silver">Última Venda</span>
                  <span className="font-mono text-muted-foreground">Hoje às 15:40</span>
                </div>
              </div>
            </div>

            {/* Ações Rápidas da Gaveta */}
            <div className="space-y-2 border-t border-border pt-4">
              <button 
                onClick={() => {
                  handleToggleActive(selectedDrawerSKU.id, selectedDrawerSKU.is_active);
                }}
                className="w-full bg-elevated hover:bg-white/10 text-white text-xs font-semibold py-2.5 rounded-xl border border-border flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {selectedDrawerSKU.is_active ? <EyeOff className="size-4 text-amber-400" /> : <Eye className="size-4 text-emerald-400" />}
                {selectedDrawerSKU.is_active ? "Ocultar do Cardápio" : "Exibir no Cardápio"}
              </button>

              <button 
                onClick={() => handleDuplicateSKU(selectedDrawerSKU)}
                className="w-full bg-elevated hover:bg-white/10 text-white text-xs font-semibold py-2.5 rounded-xl border border-border flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Copy className="size-4 text-blue-400" />
                Duplicar SKU
              </button>

              <button 
                onClick={() => handleDeleteProduct(selectedDrawerSKU.id, selectedDrawerSKU.flavor)}
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold py-2.5 rounded-xl border border-red-500/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
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
