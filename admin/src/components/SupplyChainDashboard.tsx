import { useState, useEffect, useRef } from "react";
import { 
  PackageSearch, Box, Plus, Minus, Eye, EyeOff, Loader2, ImagePlus, Upload, 
  Trash2, Search, Filter, ArrowUpDown, MoreVertical, Copy, Edit3, DollarSign, 
  AlertTriangle, CheckCircle2, X, RefreshCw
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/cart";

export function SupplyChainDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [topSelling, setTopSelling] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states (Começam vazios sem valores pré-preenchidos)
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [flavor, setFlavor] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [puffs, setPuffs] = useState("");

  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de busca, filtros e ordenação
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"TODOS" | "EM_ESTOQUE" | "BAIXO_ESTOQUE" | "SEM_ESTOQUE">("TODOS");
  const [sortBy, setSortBy] = useState<"RECENTES" | "MAIS_VENDIDOS" | "MAIOR_ESTOQUE" | "MENOR_ESTOQUE">("RECENTES");

  // Edição inline e Menu de Ações por SKU
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [tempStockValue, setTempStockValue] = useState<string>("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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
        .order("created_at", { ascending: false });

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
      const { data, error } = await supabase
        .from("smoking_products")
        .update({ stock: newStock })
        .eq("id", id)
        .select();

      if (error || !data || data.length === 0) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
      fetchData();
    }
  };

  const handleSaveInlineStock = async (id: string) => {
    const parsed = parseInt(tempStockValue);
    if (!isNaN(parsed) && parsed >= 0) {
      await handleUpdateStock(id, parsed);
    }
    setEditingStockId(null);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
      const { error } = await supabase
        .from("smoking_products")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) fetchData();
    } catch (err) {
      fetchData();
    }
  };

  const handleDeleteProduct = async (id: string, flavorName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o SKU "${flavorName}" permanentemente?`)) return;
    try {
      setProducts(prev => prev.filter(p => p.id !== id));
      const { error } = await supabase.from("smoking_products").delete().eq("id", id);
      if (error) {
        alert("Erro ao excluir: " + error.message);
        fetchData();
      }
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

  // Cálculos de Métricas
  const totalProducts = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const outOfStockCount = products.filter(p => (p.stock || 0) === 0).length;
  const totalStockValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (parseFloat(p.price) || 0)), 0);

  // Filtragem e Ordenação
  const filteredProducts = products.filter(p => {
    const currentStock = p.stock || 0;
    if (stockFilter === 'EM_ESTOQUE' && currentStock < 5) return false;
    if (stockFilter === 'BAIXO_ESTOQUE' && (currentStock === 0 || currentStock >= 5)) return false;
    if (stockFilter === 'SEM_ESTOQUE' && currentStock > 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchBrand = (p.brand || '').toLowerCase().includes(q);
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchFlavor = (p.flavor || '').toLowerCase().includes(q);
      return matchBrand || matchName || matchFlavor;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'MAIOR_ESTOQUE') return (b.stock || 0) - (a.stock || 0);
    if (sortBy === 'MENOR_ESTOQUE') return (a.stock || 0) - (b.stock || 0);
    if (sortBy === 'MAIS_VENDIDOS') {
      const topA = topSelling.find(t => t.product_id === a.id)?.total_sold || 0;
      const topB = topSelling.find(t => t.product_id === b.id)?.total_sold || 0;
      return topB - topA;
    }
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
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
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-8 bg-background custom-scrollbar">
      {/* Header Principal */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-silver">Gestão de Estoque e Vendas (SKU)</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Cadastre novos produtos, monitore métricas e controle a disponibilidade em tempo real.
          </p>
        </div>
      </header>

      {/* SEÇÃO 1: FORMULÁRIO DE CADASTRO DE SKU */}
      <section className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 text-silver">
          <Plus className="size-5 text-emerald-400" />
          <h3 className="text-base font-semibold">Cadastro Rápido de SKU</h3>
        </div>

        <form onSubmit={handleAddProduct} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Marca */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Marca</label>
              <input 
                type="text" 
                value={brand} 
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Digite a marca"
                className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>

            {/* Modelo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Modelo *</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: V50, BC5000"
                required
                className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>

            {/* Sabor */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Sabor *</label>
              <input 
                type="text" 
                value={flavor} 
                onChange={(e) => setFlavor(e.target.value)}
                placeholder="Digite o sabor"
                required
                className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>

            {/* Puffs */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Puffs</label>
              <input 
                type="number" 
                value={puffs} 
                onChange={(e) => setPuffs(e.target.value)}
                placeholder="Ex.: 5000"
                className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>

            {/* Preço de Venda */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Preço Venda (R$) *</label>
              <input 
                type="number" 
                step="0.01" 
                value={price} 
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ex.: 90.00"
                required
                className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
              />
            </div>

            {/* Custo de Reposição */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Reposição (R$)</label>
              <input 
                type="number" 
                step="0.01" 
                value={costPrice} 
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="Ex.: 35.00"
                className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
              />
            </div>

            {/* Estoque Inicial */}
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-2">
              <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Estoque Inicial</label>
              <input 
                type="number" 
                value={stock} 
                onChange={(e) => setStock(e.target.value)}
                placeholder="Ex.: 10"
                className="bg-[#0f0f0f] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>

          {/* Upload de Imagem Card Drag & Drop */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">Foto do Pod</label>
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border border-dashed rounded-xl p-4 transition-all flex flex-col sm:flex-row items-center gap-4 ${
                isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-[#0f0f0f]/60 hover:border-white/20'
              }`}
            >
              {imagePreview ? (
                <div className="relative size-20 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-black/60">
                  <img src={imagePreview} alt="Preview" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute top-1 right-1 bg-black/80 text-red-400 p-1 rounded-full hover:bg-black transition-colors"
                    title="Remover Imagem"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="size-20 rounded-xl border border-white/5 bg-elevated/40 flex items-center justify-center text-muted-foreground shrink-0">
                  <ImagePlus className="size-8 text-muted-foreground/40" />
                </div>
              )}

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="pod-image-upload"
                />
                <label
                  htmlFor="pod-image-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-elevated hover:bg-white/10 text-xs font-semibold text-silver cursor-pointer border border-white/10 transition-all"
                >
                  <Upload className="size-3.5 text-emerald-400" />
                  {imageFile ? "Trocar Imagem" : "Arraste a imagem aqui ou Selecionar arquivo"}
                </label>
                <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                  {imageFile ? imageFile.name : "Formatos aceitos: PNG, JPG ou WEBP (Max 5MB)"}
                </p>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Cadastrar SKU"}
          </button>
        </form>
      </section>

      {/* SEÇÃO 2: GESTÃO DE ESTOQUE (RADAR DE SKUS) */}
      <section className="space-y-6">
        {/* Banner de 4 Cards de Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Produtos Cadastrados</span>
            <div className="text-2xl font-bold text-silver font-mono mt-2">
              {totalProducts} <span className="text-xs font-sans text-muted-foreground">SKUs</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Estoque Total</span>
            <div className="text-2xl font-bold text-silver font-mono mt-2">
              {totalStockUnits} <span className="text-xs font-sans text-muted-foreground">unidades</span>
            </div>
          </div>

          <div className="bg-card border border-red-500/20 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Produtos Zerados</span>
            <div className="text-2xl font-bold text-red-400 font-mono mt-2 flex items-center gap-2">
              {outOfStockCount} <span className="text-xs font-sans text-muted-foreground">sem estoque</span>
            </div>
          </div>

          <div className="bg-card border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Valor em Estoque</span>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-2">
              {formatBRL(totalStockValue)}
            </div>
          </div>
        </div>

        {/* Tabela de Gestão de Estoque + Barra de Busca e Filtros */}
        <div className="bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-xl">
          {/* Barra de Filtros e Busca */}
          <div className="p-4 border-b border-border flex flex-col lg:flex-row items-center justify-between gap-4 bg-card/60">
            {/* Busca Instantânea */}
            <div className="relative flex-1 w-full">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por marca, modelo ou sabor..."
                className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end shrink-0">
              {/* Filtros de Status */}
              <div className="flex items-center gap-1.5 bg-[#0f0f0f] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-silver">
                <Filter className="size-3.5 text-muted-foreground" />
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="bg-[#0f0f0f] text-xs text-silver focus:outline-none cursor-pointer"
                >
                  <option value="TODOS" className="bg-[#121212]">Todos os Status</option>
                  <option value="EM_ESTOQUE" className="bg-[#121212]">🟢 Em estoque</option>
                  <option value="BAIXO_ESTOQUE" className="bg-[#121212]">🟡 Estoque Baixo</option>
                  <option value="SEM_ESTOQUE" className="bg-[#121212]">🔴 Esgotado</option>
                </select>
              </div>

              {/* Ordenação */}
              <div className="flex items-center gap-1.5 bg-[#0f0f0f] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-silver">
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-[#0f0f0f] text-xs text-silver focus:outline-none cursor-pointer"
                >
                  <option value="RECENTES" className="bg-[#121212]">Mais Recentes</option>
                  <option value="MAIS_VENDIDOS" className="bg-[#121212]">Mais Vendidos</option>
                  <option value="MAIOR_ESTOQUE" className="bg-[#121212]">Maior Estoque</option>
                  <option value="MENOR_ESTOQUE" className="bg-[#121212]">Menor Estoque</option>
                </select>
              </div>
            </div>
          </div>

          {/* LISTAGEM: Tabela em telas de Desktop (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-muted-foreground uppercase bg-elevated/40 tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-center" style={{ width: '60px' }}>Foto</th>
                  <th className="px-6 py-3">Produto / Marca / Sabor</th>
                  <th className="px-4 py-3 font-mono text-right">Venda</th>
                  <th className="px-4 py-3 font-mono text-right">Reposição</th>
                  <th className="px-6 py-3 text-center" style={{ width: '160px' }}>Estoque</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      Nenhum produto encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((sku) => {
                    let statusBadge;
                    if (sku.stock >= 5) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <div className="size-1.5 rounded-full bg-emerald-400" />
                          Em estoque
                        </span>
                      );
                    } else if (sku.stock > 0) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <div className="size-1.5 rounded-full bg-amber-400" />
                          Estoque Baixo
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                          <div className="size-1.5 rounded-full bg-red-400" />
                          Esgotado
                        </span>
                      );
                    }

                    const isEditingThisStock = editingStockId === sku.id;
                    const isMenuOpen = activeMenuId === sku.id;

                    return (
                      <tr key={sku.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* Foto */}
                        <td className="px-4 py-3 text-center">
                          <div className="size-10 rounded-lg overflow-hidden border border-white/10 bg-black/40 mx-auto flex items-center justify-center">
                            {sku.image_url ? (
                              <img src={sku.image_url} alt={sku.flavor} className="size-full object-cover" />
                            ) : (
                              <ImagePlus className="size-4 text-muted-foreground/40" />
                            )}
                          </div>
                        </td>

                        {/* Identificação */}
                        <td className="px-6 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-silver text-sm">{sku.flavor}</span>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>{sku.brand}</span>
                              <span>·</span>
                              <span>{sku.name}</span>
                              {sku.puffs && (
                                <>
                                  <span>·</span>
                                  <span>{sku.puffs} puffs</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Preço de Venda */}
                        <td className="px-4 py-3 font-mono text-right text-emerald-400 font-medium text-xs">
                          {formatBRL(sku.price || 0)}
                        </td>

                        {/* Custo de Reposição */}
                        <td className="px-4 py-3 font-mono text-right text-muted-foreground text-xs">
                          {formatBRL(sku.cost_price || 35.00)}
                        </td>

                        {/* Controle de Estoque Inline */}
                        <td className="px-6 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-[#0f0f0f] border border-white/10 rounded-xl p-1">
                            <button 
                              type="button"
                              onClick={() => handleUpdateStock(sku.id, sku.stock - 1)}
                              disabled={sku.stock === 0}
                              className="grid place-items-center size-6 rounded-lg hover:bg-white/10 active:scale-95 disabled:opacity-20 cursor-pointer text-muted-foreground hover:text-white"
                            >
                              <Minus className="size-3" />
                            </button>

                            {isEditingThisStock ? (
                              <input 
                                type="number"
                                autoFocus
                                value={tempStockValue}
                                onChange={(e) => setTempStockValue(e.target.value)}
                                onBlur={() => handleSaveInlineStock(sku.id)}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveInlineStock(sku.id)}
                                className="w-10 bg-elevated text-center text-xs font-semibold text-white border border-emerald-500 rounded p-0 focus:outline-none font-mono"
                              />
                            ) : (
                              <span 
                                onClick={() => {
                                  setEditingStockId(sku.id);
                                  setTempStockValue(sku.stock.toString());
                                }}
                                className="w-10 text-center text-xs font-semibold text-silver cursor-pointer font-mono hover:text-emerald-400 transition-colors"
                                title="Clique para editar a quantidade"
                              >
                                {sku.stock}
                              </span>
                            )}

                            <button 
                              type="button"
                              onClick={() => handleUpdateStock(sku.id, sku.stock + 1)}
                              className="grid place-items-center size-6 rounded-lg hover:bg-white/10 active:scale-95 cursor-pointer text-muted-foreground hover:text-white"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-3 text-center">
                          {statusBadge}
                        </td>

                        {/* Ações Menu Dropdown (⋮) */}
                        <td className="px-4 py-3 text-right relative">
                          <button
                            onClick={() => setActiveMenuId(isMenuOpen ? null : sku.id)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                            title="Opções do SKU"
                          >
                            <MoreVertical className="size-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-4 top-10 z-50 bg-[#121212] border border-border rounded-xl shadow-2xl py-1.5 w-44 text-xs font-medium text-left animate-in fade-in zoom-in-95 duration-150">
                              <button
                                onClick={() => {
                                  handleToggleActive(sku.id, sku.is_active);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-silver cursor-pointer"
                              >
                                {sku.is_active ? <EyeOff className="size-3.5 text-amber-400" /> : <Eye className="size-3.5 text-emerald-400" />}
                                {sku.is_active ? "Ocultar do Cardápio" : "Exibir no Cardápio"}
                              </button>

                              <button
                                onClick={() => {
                                  handleDuplicateSKU(sku);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-silver cursor-pointer"
                              >
                                <Copy className="size-3.5 text-blue-400" />
                                Duplicar SKU
                              </button>

                              <div className="h-px bg-border my-1" />

                              <button
                                onClick={() => {
                                  handleDeleteProduct(sku.id, sku.flavor);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-red-500/10 flex items-center gap-2 text-red-400 cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                                Excluir SKU
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* LISTAGEM MOBILE: Cards Responsivos em Celulares (block md:hidden) */}
          <div className="block md:hidden p-4 space-y-4">
            {filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Nenhum produto encontrado.
              </div>
            ) : (
              filteredProducts.map((sku) => (
                <div key={sku.id} className="bg-[#0f0f0f] border border-white/10 rounded-xl p-4 space-y-3">
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

                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <div className="inline-flex items-center gap-2 bg-elevated/60 border border-white/10 rounded-lg p-1">
                      <button 
                        onClick={() => handleUpdateStock(sku.id, sku.stock - 1)}
                        disabled={sku.stock === 0}
                        className="p-1 text-muted-foreground hover:text-white disabled:opacity-20"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="font-mono text-xs font-semibold px-2">{sku.stock} un</span>
                      <button 
                        onClick={() => handleUpdateStock(sku.id, sku.stock + 1)}
                        className="p-1 text-muted-foreground hover:text-white"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(sku.id, sku.is_active)}
                        className="p-2 rounded-lg bg-elevated text-muted-foreground hover:text-white"
                      >
                        {sku.is_active ? <Eye className="size-4 text-emerald-400" /> : <EyeOff className="size-4 text-amber-400" />}
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(sku.id, sku.flavor)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
