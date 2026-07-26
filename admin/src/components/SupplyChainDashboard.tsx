import { useState, useEffect, useRef } from "react";
import { PackageSearch, AlertCircle, Plane, Truck, Box, Plus, Minus, Eye, EyeOff, Save, Loader2, ImagePlus, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function SupplyChainDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [topSelling, setTopSelling] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("Ignite");
  const [flavor, setFlavor] = useState("");
  const [price, setPrice] = useState("90.00");
  const [costPrice, setCostPrice] = useState("35.00");
  const [stock, setStock] = useState("10");
  const [puffs, setPuffs] = useState("5000");

  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input edits temporários por ID do produto
  const [editingStock, setEditingStock] = useState<Record<string, string>>({});
  const [editingFields, setEditingFields] = useState<Record<string, { brand?: string; name?: string; flavor?: string; price?: string; cost_price?: string }>>({});

  const handleSaveRowField = async (id: string, field: 'brand' | 'name' | 'flavor' | 'price' | 'cost_price') => {
    const skuFields = editingFields[id];
    if (!skuFields || skuFields[field] === undefined) return;
    const value = skuFields[field];

    try {
      let updatePayload: any = {};
      if (field === 'price' || field === 'cost_price') {
        const parsedPrice = parseFloat(value!);
        if (isNaN(parsedPrice) || parsedPrice < 0) return;
        updatePayload[field] = parsedPrice;
      } else {
        if (!value!.trim()) return;
        updatePayload[field] = value!.trim();
      }

      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updatePayload } : p));

      const { data, error } = await supabase
        .from("smoking_products")
        .update(updatePayload)
        .eq("id", id)
        .select();

      if (error || !data || data.length === 0) {
        console.error(`Erro ao atualizar ${field}:`, error);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      fetchData();
    }
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

    // Fallback leve e ultra rápido: Base64 comprimido (~30KB)
    return await compressImage(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
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
        .limit(5);

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
    
    // Polling de 3 em 3 segundos para manter sincronizado
    const intervalId = setInterval(() => {
      fetchData();
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !flavor.trim() || !price) {
      alert("Por favor, preencha o Modelo, o Sabor e o Preço para cadastrar.");
      return;
    }
    setSubmitting(true);

    try {
      let imageUrl = "";
      if (imageFile) {
        imageUrl = await uploadProductImage(imageFile);
      }

      const { data, error } = await supabase
        .from("smoking_products")
        .insert({
          name: name.trim(),
          brand,
          flavor: flavor.trim(),
          price: parseFloat(price),
          cost_price: parseFloat(costPrice) || 35.00,
          stock: parseInt(stock) || 0,
          puffs: parseInt(puffs) || 5000,
          image_url: imageUrl,
          is_active: true,
        })
        .select();

      if (!error && data && data.length > 0) {
        setName("");
        setFlavor("");
        setPrice("90.00");
        setCostPrice("35.00");
        setStock("10");
        setPuffs("5000");
        setImageFile(null);
        setImagePreview("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        alert(`SKU "${flavor}" cadastrado com sucesso!`);
        await fetchData();
      } else {
        alert("Erro ao inserir no Supabase: " + (error?.message || "Permissão RLS bloqueou no Supabase. Execute o comando SQL."));
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao cadastrar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRowImageUpload = async (productItem: any, file: File) => {
    setUploadingRowId(productItem.id);
    try {
      const imageUrl = await uploadProductImage(file);
      setProducts(prev => prev.map(p => (p.name === productItem.name && p.brand === productItem.brand) || p.id === productItem.id ? { ...p, image_url: imageUrl } : p));
      
      // Atualiza no Supabase para TODOS os sabores deste mesmo modelo de pod
      const { data, error } = await supabase
        .from("smoking_products")
        .update({ image_url: imageUrl })
        .eq("name", productItem.name)
        .eq("brand", productItem.brand)
        .select();

      if (error || !data || data.length === 0) {
        console.error("Erro ao atualizar imagem do modelo (RLS Bloqueou):", error);
        alert("Aviso do Supabase: A alteração não foi salva porque a permissão de escrita (RLS) na tabela 'smoking_products' precisa ser ativada no Supabase.");
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingRowId(null);
    }
  };

  const handleUpdateStock = async (id: string, newStock: number) => {
    if (newStock < 0) return;
    try {
      // Otimista
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p));
      
      const { data, error } = await supabase
        .from("smoking_products")
        .update({ stock: newStock })
        .eq("id", id)
        .select();

      if (error || !data || data.length === 0) {
        console.error("Erro no update (RLS Bloqueou):", error);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      fetchData();
    }
  };

  const handleInputStockBlur = async (id: string, currentStock: number) => {
    const val = editingStock[id];
    if (val === undefined || val === "") return;
    const parsed = parseInt(val);
    if (isNaN(parsed) || parsed < 0) {
      // Reset
      setEditingStock(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      return;
    }
    
    await handleUpdateStock(id, parsed);
    setEditingStock(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
      
      const { error } = await supabase
        .from("smoking_products")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) {
        console.error(error);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      fetchData();
    }
  };

  const handleDeleteProduct = async (id: string, flavorName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o SKU "${flavorName}" permanentemente do sistema?`)) return;
    try {
      setProducts(prev => prev.filter(p => p.id !== id));
      const { error } = await supabase
        .from("smoking_products")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Erro ao deletar produto:", error);
        alert("Erro ao excluir do Supabase: " + error.message);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      fetchData();
    }
  };

  const maxSoldVal = topSelling.length > 0 ? topSelling[0].total_sold : 1;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <Loader2 className="size-8 text-primary animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Carregando painel de suprimentos...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-6">
      <header className="mb-8">
        <h2 className="text-2xl font-semibold text-silver font-sans">Gestão de Estoque e Vendas (SKU)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie a reposição de estoque em tempo real e analise as marcas e sabores líderes de saída.
        </p>
      </header>

      {/* Grid: Análise + Cadastro */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Líderes de Saída (Análise) */}
        <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-silver tracking-wide mb-4 flex items-center gap-2">
              <AlertCircle className="size-4 text-primary" />
              Líderes de Saída (Top Sabores)
            </h3>
            <div className="flex flex-col gap-4">
              {topSelling.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Nenhuma venda computada ainda.
                </div>
              ) : (
                topSelling.map((item, index) => {
                  const pct = Math.max(10, Math.min(100, (item.total_sold / maxSoldVal) * 100));
                  return (
                    <div key={item.product_id || index} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-silver truncate max-w-[70%]">{item.product_name} ({item.flavor})</span>
                        <span className="text-muted-foreground font-mono">{item.total_sold} un</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500" 
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>Faturamento PY em Trânsito</span>
            <span className="text-silver font-semibold">R$ 7.300,00</span>
          </div>
        </div>

        {/* Cadastro Rápido de SKU */}
        <form onSubmit={handleAddProduct} className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-silver tracking-wide mb-4 flex items-center gap-2">
              <Plus className="size-4 text-emerald-400" />
              Cadastro Rápido de SKU
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">Marca</label>
                <input 
                  type="text" 
                  value={brand} 
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ex: Ignite, Zomo, Nikbar"
                  required
                  className="bg-elevated/70 border border-border rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">Modelo</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: V50, BC5000"
                  required
                  className="bg-elevated/70 border border-border rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">Sabor</label>
                <input 
                  type="text" 
                  value={flavor} 
                  onChange={(e) => setFlavor(e.target.value)}
                  placeholder="Ex: Watermelon Ice"
                  required
                  className="bg-elevated/70 border border-border rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">Puffs</label>
                <input 
                  type="number" 
                  value={puffs} 
                  onChange={(e) => setPuffs(e.target.value)}
                  placeholder="5000"
                  className="bg-elevated/70 border border-border rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">Preço Venda (BRL)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={price} 
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="90.00"
                  required
                  className="bg-elevated/70 border border-border rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">Custo Reposição (BRL)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={costPrice} 
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="35.00"
                  required
                  className="bg-elevated/70 border border-border rounded-xl px-3 py-2 text-sm text-emerald-400 placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-400 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">Estoque Inicial</label>
                <input 
                  type="number" 
                  value={stock} 
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  className="bg-elevated/70 border border-border rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-3">
                <label className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">Foto do Pod (Upload Direto)</label>
                <div className="flex items-center gap-4 bg-elevated/40 border border-dashed border-border rounded-xl p-3">
                  {imagePreview ? (
                    <div className="relative size-16 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black/40">
                      <img src={imagePreview} alt="Preview" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview("");
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="absolute top-1 right-1 bg-black/80 text-red-400 p-1 rounded-full hover:bg-black"
                        title="Remover Imagem"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="size-16 rounded-lg border border-white/5 bg-elevated/60 flex flex-col items-center justify-center text-muted-foreground shrink-0">
                      <ImagePlus className="size-6 text-muted-foreground/60" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
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
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated hover:bg-white/10 text-xs font-semibold text-silver cursor-pointer border border-white/5 transition-all"
                    >
                      <Upload className="size-3.5 text-emerald-400" />
                      {imageFile ? "Trocar Imagem Selecionada" : "Selecionar Foto do Pod"}
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {imageFile ? imageFile.name : "Envie foto em PNG, JPG ou WEBP (Max 5MB)"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="mt-5 w-full bg-emerald-500 text-black font-semibold text-sm py-2.5 rounded-xl hover:bg-emerald-400 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Cadastrar SKU"}
          </button>
        </form>

      </div>

      {/* Tabela de Radar de Estoque */}
      <div className="bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-card/50">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Box className="size-5 text-primary" />
            Radar de Estoque por Sabor (SKU)
          </h3>
          <span className="text-xs text-muted-foreground font-mono bg-elevated px-3 py-1 rounded-full border border-white/5">
            {products.length} SKUs cadastrados
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-elevated/30">
              <tr>
                <th className="px-4 py-4 font-medium text-center" style={{ width: '70px' }}>Foto</th>
                <th className="px-6 py-4 font-medium">Marca / Modelo / Sabor</th>
                <th className="px-6 py-4 font-medium">Preço Venda</th>
                <th className="px-6 py-4 font-medium text-emerald-400">Custo Reposição</th>
                <th className="px-6 py-4 font-medium text-center" style={{ width: '160px' }}>Estoque Físico</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((sku) => {
                let StatusBadge;
                if (sku.stock >= 5) {
                  StatusBadge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><div className="size-1.5 rounded-full bg-emerald-400"/>Disponível</span>;
                } else if (sku.stock > 0) {
                  StatusBadge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"><div className="size-1.5 rounded-full bg-yellow-400"/>Últimas Unidades</span>;
                } else {
                  StatusBadge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse"><div className="size-1.5 rounded-full bg-red-400"/>Esgotado</span>;
                }

                const currentVal = editingStock[sku.id] ?? sku.stock.toString();
                const isUploadingThisRow = uploadingRowId === sku.id;

                return (
                  <tr key={sku.id} className="hover:bg-white/5 transition-colors">
                    {/* Coluna da Imagem */}
                    <td className="px-4 py-3 text-center">
                      <div className="relative group size-11 rounded-lg overflow-hidden border border-white/10 bg-black/40 mx-auto flex items-center justify-center">
                        {sku.image_url ? (
                          <img src={sku.image_url} alt={sku.flavor} className="size-full object-cover" />
                        ) : (
                          <ImagePlus className="size-5 text-muted-foreground/40" />
                        )}
                        <label
                          htmlFor={`row-upload-${sku.id}`}
                          className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
                          title="Trocar Foto"
                        >
                          {isUploadingThisRow ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        </label>
                        <input
                          id={`row-upload-${sku.id}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleRowImageUpload(sku, file);
                          }}
                        />
                      </div>
                    </td>

                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-0.5">
                        <input
                          type="text"
                          value={editingFields[sku.id]?.flavor ?? sku.flavor}
                          onChange={(e) => setEditingFields(prev => ({ ...prev, [sku.id]: { ...prev[sku.id], flavor: e.target.value } }))}
                          onBlur={() => handleSaveRowField(sku.id, 'flavor')}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveRowField(sku.id, 'flavor')}
                          className="bg-transparent font-semibold text-silver border-b border-transparent hover:border-white/20 focus:border-emerald-400 focus:bg-elevated/80 rounded px-1.5 py-0.5 text-sm focus:outline-none transition-colors"
                          title="Clique para editar o sabor"
                        />
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1.5">
                          <input
                            type="text"
                            value={editingFields[sku.id]?.brand ?? sku.brand}
                            onChange={(e) => setEditingFields(prev => ({ ...prev, [sku.id]: { ...prev[sku.id], brand: e.target.value } }))}
                            onBlur={() => handleSaveRowField(sku.id, 'brand')}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveRowField(sku.id, 'brand')}
                            className="w-20 bg-transparent text-xs text-muted-foreground border-b border-transparent hover:border-white/20 focus:border-emerald-400 focus:bg-elevated/80 rounded py-0.5 focus:outline-none transition-colors"
                            title="Clique para editar a marca"
                          />
                          <span>·</span>
                          <input
                            type="text"
                            value={editingFields[sku.id]?.name ?? sku.name}
                            onChange={(e) => setEditingFields(prev => ({ ...prev, [sku.id]: { ...prev[sku.id], name: e.target.value } }))}
                            onBlur={() => handleSaveRowField(sku.id, 'name')}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveRowField(sku.id, 'name')}
                            className="w-24 bg-transparent text-xs text-muted-foreground border-b border-transparent hover:border-white/20 focus:border-emerald-400 focus:bg-elevated/80 rounded py-0.5 focus:outline-none transition-colors"
                            title="Clique para editar o modelo"
                          />
                          <span>· {sku.puffs.toLocaleString()} puffs</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 font-mono text-silver font-medium">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editingFields[sku.id]?.price ?? sku.price.toString()}
                          onChange={(e) => setEditingFields(prev => ({ ...prev, [sku.id]: { ...prev[sku.id], price: e.target.value } }))}
                          onBlur={() => handleSaveRowField(sku.id, 'price')}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveRowField(sku.id, 'price')}
                          className="w-20 bg-transparent text-sm font-mono text-silver border-b border-transparent hover:border-white/20 focus:border-emerald-400 focus:bg-elevated/80 rounded px-1 py-0.5 focus:outline-none transition-colors"
                          title="Clique para editar o preço de venda"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-3 font-mono text-emerald-400 font-medium">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-emerald-500/60">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editingFields[sku.id]?.cost_price ?? (sku.cost_price ? sku.cost_price.toString() : "35.00")}
                          onChange={(e) => setEditingFields(prev => ({ ...prev, [sku.id]: { ...prev[sku.id], cost_price: e.target.value } }))}
                          onBlur={() => handleSaveRowField(sku.id, 'cost_price')}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveRowField(sku.id, 'cost_price')}
                          className="w-20 bg-transparent text-sm font-mono text-emerald-400 border-b border-transparent hover:border-emerald-400/40 focus:border-emerald-400 focus:bg-elevated/80 rounded px-1 py-0.5 focus:outline-none transition-colors"
                          title="Clique para editar o custo de reposição (atacado)"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-2 bg-elevated/70 border border-border rounded-lg p-1">
                        <button 
                          type="button"
                          onClick={() => handleUpdateStock(sku.id, sku.stock - 1)}
                          disabled={sku.stock === 0}
                          className="grid place-items-center size-6 rounded-md hover:bg-white/10 active:scale-95 disabled:opacity-20 cursor-pointer"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        
                        <input 
                          type="number"
                          value={currentVal}
                          onChange={(e) => setEditingStock({ ...editingStock, [sku.id]: e.target.value })}
                          onBlur={() => handleInputStockBlur(sku.id, sku.stock)}
                          onKeyDown={(e) => e.key === "Enter" && handleInputStockBlur(sku.id, sku.stock)}
                          className="w-10 bg-transparent text-center text-sm font-semibold text-silver border-0 p-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono"
                        />

                        <button 
                          type="button"
                          onClick={() => handleUpdateStock(sku.id, sku.stock + 1)}
                          className="grid place-items-center size-6 rounded-md hover:bg-white/10 active:scale-95 cursor-pointer"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {StatusBadge}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(sku.id, sku.is_active)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${sku.is_active ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10' : 'border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10'}`}
                          title={sku.is_active ? "Ativo no Cardápio (Clique para ocultar no cardápio)" : "Inativo no Cardápio (Clique para exibir no cardápio)"}
                        >
                          {sku.is_active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(sku.id, sku.flavor)}
                          className="p-1.5 rounded-lg border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/20 transition-all cursor-pointer"
                          title="Excluir SKU permanentemente"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
