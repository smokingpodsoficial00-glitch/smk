import { useState, useEffect, useRef } from "react";
import { 
  PackageSearch, Box, Plus, Minus, Eye, EyeOff, Loader2, ImagePlus, Upload, 
  Trash2, Search, Filter, ArrowUpDown, MoreVertical, Copy, Edit3, DollarSign, 
  AlertTriangle, CheckCircle2, X, RefreshCw, TrendingUp, Layers, PieChart, 
  ChevronRight, Calendar, Tag, ShieldAlert
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

  // Filtragem e Ordenação da Tabela ERP
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
  }).sort((a, b) => {
    if (filterTab === 'MAIS_VENDIDOS') {
      const topA = topSelling.find(t => t.product_id === a.id)?.total_sold || 0;
      const topB = topSelling.find(t => t.product_id === b.id)?.total_sold || 0;
      const diff = topB - topA;
      if (diff !== 0) return diff;
    } else if (filterTab === 'MAIOR_LUCRO') {
      const profitA = (parseFloat(a.price) || 0) - (parseFloat(a.cost_price || 35));
      const profitB = (parseFloat(b.price) || 0) - (parseFloat(b.cost_price || 35));
      const diff = profitB - profitA;
      if (diff !== 0) return diff;
    }

    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    const diff = timeB - timeA;
    if (diff !== 0) return diff;

    return (a.id || '').localeCompare(b.id || '');
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
            Painel consolidado para monitoramento de SKUs, lucratividade, níveis de estoque e reposição estratégica.
          </p>
        </div>
      </header>

      {/* FAIXA SUPERIOR: DASHBOARD DE 8 KPIS ESTRATÉGICOS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Card 1: Produtos */}
        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Produtos</span>
          <div className="text-xl font-bold text-silver font-mono mt-1">{totalProducts}</div>
        </div>

        {/* Card 2: Unidades */}
        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Unidades</span>
          <div className="text-xl font-bold text-silver font-mono mt-1">{totalStockUnits} un</div>
        </div>

        {/* Card 3: Valor Estoque */}
        <div className="bg-card border border-emerald-500/20 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Valor Estoque</span>
          <div className="text-sm font-bold text-emerald-400 font-mono mt-1">{formatBRL(totalStockValue)}</div>
        </div>

        {/* Card 4: Custo Total */}
        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Custo Total</span>
          <div className="text-sm font-bold text-silver font-mono mt-1">{formatBRL(totalStockCost)}</div>
        </div>

        {/* Card 5: Zerados */}
        <div className="bg-card border border-red-500/20 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Zerados</span>
          <div className="text-xl font-bold text-red-400 font-mono mt-1">{outOfStockCount}</div>
        </div>

        {/* Card 6: Estoque Baixo */}
        <div className="bg-card border border-amber-500/20 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Estoque Baixo</span>
          <div className="text-xl font-bold text-amber-400 font-mono mt-1">{lowStockCount}</div>
        </div>

        {/* Card 7: Mais Vendido */}
        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider truncate">Mais Vendido</span>
          <div className="text-xs font-bold text-silver truncate mt-1">{topSellingFlavorName}</div>
        </div>

        {/* Card 8: Última Entrada */}
        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Última Entrada</span>
          <div className="text-xs font-bold text-muted-foreground mt-1">{lastEntryTime}</div>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL 75/25 (Main Content 75% | Form Sidebar 25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* COLUNA ESQUERDA (75%): PAINEL DE GESTÃO, GRÁFICOS E TABELA */}
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
                placeholder="Pesquisa inteligente por qualquer termo: Blueberry, Ignite, V50, 5000, Ice..."
                className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner"
              />
            </div>

            {/* Abas de Filtros Rápidos ERP */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
              {[
                { id: "TODOS", label: "Todos" },
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

          {/* TABELA ERP DE SKUS (DESKTOP) */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-elevated/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-3 text-center" style={{ width: '50px' }}>Foto</th>
                    <th className="py-3 px-4 font-semibold">SKU / Marca / Sabor</th>
                    <th className="py-3 px-3 font-semibold text-right">Venda</th>
                    <th className="py-3 px-3 font-semibold text-right">Custo</th>
                    <th className="py-3 px-4 font-semibold text-right">Lucro (Margem)</th>
                    <th className="py-3 px-4 font-semibold text-center" style={{ width: '180px' }}>Estoque Visual</th>
                    <th className="py-3 px-3 font-semibold text-center">Status</th>
                    <th className="py-3 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                        Nenhum SKU encontrado para os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((sku) => {
                      const priceVal = parseFloat(sku.price) || 0;
                      const costVal = parseFloat(sku.cost_price) || 35;
                      const profit = priceVal - costVal;
                      const marginPct = priceVal > 0 ? Math.round((profit / priceVal) * 100) : 0;
                      const stockPct = Math.min(100, Math.round((sku.stock / 30) * 100));

                      let statusBadge;
                      if (sku.stock >= 5) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <div className="size-1.5 rounded-full bg-emerald-400" />
                            Em estoque
                          </span>
                        );
                      } else if (sku.stock > 0) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <div className="size-1.5 rounded-full bg-amber-400" />
                            Estoque Baixo
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                            <div className="size-1.5 rounded-full bg-red-400" />
                            Esgotado
                          </span>
                        );
                      }

                      return (
                        <tr 
                          key={sku.id} 
                          onClick={() => setSelectedDrawerSKU(sku)}
                          className="group hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
                        >
                          {/* Foto */}
                          <td className="py-3 px-3 text-center">
                            <div className="size-9 rounded-lg overflow-hidden border border-white/10 bg-black/40 mx-auto flex items-center justify-center">
                              {sku.image_url ? (
                                <img src={sku.image_url} alt={sku.flavor} className="size-full object-cover" />
                              ) : (
                                <ImagePlus className="size-4 text-muted-foreground/40" />
                              )}
                            </div>
                          </td>

                          {/* SKU / Nome */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-silver text-sm">{sku.flavor}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {sku.brand} · {sku.name} {sku.puffs ? `· ${sku.puffs} puffs` : ''}
                              </span>
                            </div>
                          </td>

                          {/* Venda */}
                          <td className="py-3 px-3 font-mono text-right text-silver font-medium">
                            {formatBRL(priceVal)}
                          </td>

                          {/* Custo */}
                          <td className="py-3 px-3 font-mono text-right text-muted-foreground">
                            {formatBRL(costVal)}
                          </td>

                          {/* Lucro & Margem */}
                          <td className="py-3 px-4 font-mono text-right">
                            <span className="text-emerald-400 font-semibold block">{formatBRL(profit)}</span>
                            <span className="text-[10px] text-muted-foreground">({marginPct}%)</span>
                          </td>

                          {/* Estoque Visual */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 flex flex-col gap-1">
                                <div className="flex justify-between text-[10px] font-mono">
                                  <span className="text-silver font-semibold">{sku.stock} un</span>
                                </div>
                                <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      sku.stock >= 5 ? 'bg-emerald-400' : sku.stock > 0 ? 'bg-amber-400' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${stockPct}%` }} 
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStockSku(sku);
                                  setNewStockValue(sku.stock.toString());
                                }}
                                className="px-2 py-1 rounded bg-elevated hover:bg-white/10 text-[10px] font-semibold text-silver border border-border shrink-0 transition-colors"
                              >
                                Editar
                              </button>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 text-center">
                            {statusBadge}
                          </td>

                          {/* Ação */}
                          <td className="py-3 px-3 text-right">
                            <ChevronRight className="size-4 text-muted-foreground group-hover:text-white transition-colors" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* CARDS RESPONSIVOS MOBILE (block md:hidden) */}
            <div className="block md:hidden p-4 space-y-3">
              {filteredProducts.map((sku) => (
                <div 
                  key={sku.id}
                  onClick={() => setSelectedDrawerSKU(sku)}
                  className="bg-[#0f0f0f] border border-white/10 rounded-xl p-4 space-y-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg border border-white/10 bg-black/40 overflow-hidden shrink-0 flex items-center justify-center">
                      {sku.image_url ? (
                        <img src={sku.image_url} alt={sku.flavor} className="size-full object-cover" />
                      ) : (
                        <ImagePlus className="size-5 text-muted-foreground/40" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-silver text-sm truncate">{sku.flavor}</h4>
                      <p className="text-xs text-muted-foreground truncate">{sku.brand} · {sku.name}</p>
                    </div>

                    <span className="font-mono font-semibold text-emerald-400 text-sm">
                      {formatBRL(sku.price || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                    <span className="text-muted-foreground">Estoque: <strong className="text-white">{sku.stock} un</strong></span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDrawerSKU(sku);
                      }}
                      className="text-primary font-semibold flex items-center gap-1"
                    >
                      Ver detalhes <ChevronRight className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
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

              {/* Grid 2 colunas para Preço e Custo */}
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
