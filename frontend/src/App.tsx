import { useEffect, useMemo, useState } from "react";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { CartBar } from "@/components/CartBar";
import { CartSheet } from "@/components/CartSheet";
import { FlavorSheet } from "@/components/FlavorSheet";
import { CartProvider } from "@/lib/cart";
import { fetchProductsFromSupabase, type Product, type PodModel } from "@/lib/products";
import { fetchCategories, fetchProductCategoryMappings, DEFAULT_CATEGORIES, type Category } from "@/lib/categories";
import { supabase } from "@/lib/supabase";
import { Loader2, Star } from "lucide-react";

// Trigger Vercel auto-deploy from Git
export default function App() {
  return (
    <CartProvider>
      <Menu />
    </CartProvider>
  );
}

function Menu() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, { category_ids: string[]; display_order: number }>>({});
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<PodModel | null>(null);

  const loadProducts = async () => {
    const [data, cats, catMap] = await Promise.all([
      fetchProductsFromSupabase(),
      fetchCategories(),
      fetchProductCategoryMappings()
    ]);
    setProductList(data);
    setCategories(cats);
    setCategoryMappings(catMap.productMap);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();

    // Polling de 3 em 3 segundos para manter sincronizado (sem F5)
    const intervalId = setInterval(() => {
      loadProducts();
    }, 3000);

    // Inscrição em tempo real para atualizações no Supabase (produtos e categorias/destaques)
    const subscription = supabase
      .channel("public:realtime_menu")
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_products" }, () => {
        loadProducts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_orders" }, () => {
        loadProducts();
      })
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(subscription);
    };
  }, []);

  const models = useMemo(() => {
    const map = new Map<string, PodModel>();
    for (const p of productList) {
      if (!p.is_active) continue;
      const modelDisplayName = p.name.toLowerCase().includes(p.brand.toLowerCase()) ? p.name : `${p.brand} ${p.name}`;
      const groupKey = `${p.brand}-${modelDisplayName}`.toLowerCase();

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          name: modelDisplayName,
          brand: p.brand,
          puffs: p.puffs,
          price: p.price,
          variants: []
        });
      }
      map.get(groupKey)!.variants.push(p);
    }

    return Array.from(map.values()).map(m => {
      const realFlavors = m.variants.filter(v => {
        const f = (v.flavor || '').trim().toLowerCase();
        return f !== 'padrão' && f !== 'padrao' && f !== '';
      });

      const modelVariants = realFlavors.length > 0 ? realFlavors : m.variants;

      // Identificar categorias do modelo
      const firstVariant = m.variants[0];
      const modelKeyStandard = `${m.brand.toLowerCase()}__${m.name.toLowerCase()}`;
      const modelKeyAlternative = firstVariant ? `${m.brand.toLowerCase()}__${firstVariant.name.toLowerCase()}` : '';

      const mapping = categoryMappings[modelKeyStandard] || 
                      categoryMappings[modelKeyAlternative] || 
                      (firstVariant ? categoryMappings[firstVariant.id] : null);

      const modelCategoryIds = mapping?.category_ids || [];
      const modelDisplayOrder = mapping?.display_order ?? 99;

      const matchedCategories = categories.filter(c => modelCategoryIds.includes(c.id));

      return {
        ...m,
        variants: modelVariants,
        categories: matchedCategories,
        displayOrder: modelDisplayOrder
      };
    });
  }, [productList, categories, categoryMappings]);

  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    for (const p of productList) {
      if (p.is_active && p.brand) set.add(p.brand);
    }
    return Array.from(set);
  }, [productList]);

  // Separar produtos com ⭐ (Mais Vendidos) e produtos normais sem duplicação
  const { topFeaturedModels, mainCatalogModels, isOnlyMaisVendidosMode } = useMemo(() => {
    const q = query.trim().toLowerCase();
    
    // Todos os modelos que passam nos filtros de marca e busca
    const baseList = models.filter(m => {
      if (brand && m.brand.toLowerCase() !== brand.toLowerCase()) return false;
      if (!q) return true;
      const matchesModel = m.name.toLowerCase().includes(q) || m.brand.toLowerCase().includes(q);
      const matchesFlavor = m.variants.some(v => v.flavor.toLowerCase().includes(q));
      return matchesModel || matchesFlavor;
    });

    const MAIS_VENDIDOS_ID = "11111111-1111-4111-a111-111111111111";

    const isMaisVendido = (m: PodModel) => {
      // 1. Checar por qualquer ID de variante individual no categoryMappings
      const hasVariantMatch = m.variants.some(v => {
        const catIds = categoryMappings[v.id]?.category_ids || [];
        return catIds.includes(MAIS_VENDIDOS_ID);
      });
      if (hasVariantMatch) return true;

      // 2. Checar por variadas chaves do modelo (bruta, limpa, brand__name)
      for (const v of m.variants) {
        const b = (v.brand || '').toLowerCase().trim();
        const n = (v.name || '').toLowerCase().trim();
        const bClean = b.replace(/\s+/g, '');
        const nClean = n.replace(/\s+/g, '');

        const keysToCheck = [
          `${b}__${n}`,
          `${bClean}__${nClean}`,
          `${(m.brand || '').toLowerCase()}__${(m.name || '').toLowerCase()}`,
          `${(m.brand || '').toLowerCase().replace(/\s+/g, '')}__${(m.name || '').toLowerCase().replace(/\s+/g, '')}`
        ];

        for (const k of keysToCheck) {
          if (categoryMappings[k]?.category_ids?.includes(MAIS_VENDIDOS_ID)) return true;
        }
      }

      // 3. Checar por categorias diretas
      return m.categories?.some(c => c.slug === 'mais-vendidos' || c.id === MAIS_VENDIDOS_ID) || false;
    };

    // Se o cliente clicou na pílula "⭐ Mais Vendidos"
    if (selectedCategorySlug === 'mais-vendidos') {
      const allStarred = baseList.filter(isMaisVendido).sort((a, b) => {
        const orderA = a.displayOrder ?? 99;
        const orderB = b.displayOrder ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      return {
        topFeaturedModels: [],
        mainCatalogModels: allStarred,
        isOnlyMaisVendidosMode: true
      };
    }

    // Modo Padrão / Busca / Marca
    const starredAll = baseList.filter(isMaisVendido).sort((a, b) => {
      const orderA = a.displayOrder ?? 99;
      const orderB = b.displayOrder ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    // Se há busca ou filtro por marca ativo, exibe em lista única ordenada (starred no topo)
    if (brand || q) {
      const sortedSearch = [...baseList].sort((a, b) => {
        const aStar = isMaisVendido(a);
        const bStar = isMaisVendido(b);
        if (aStar && !bStar) return -1;
        if (!aStar && bStar) return 1;
        const orderA = a.displayOrder ?? 99;
        const orderB = b.displayOrder ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

      return {
        topFeaturedModels: [],
        mainCatalogModels: sortedSearch,
        isOnlyMaisVendidosMode: false
      };
    }

    // Modo Padrão (Sem busca, sem marca, "Todas"):
    // Seção Topo: No máximo os 4 primeiros produtos com ⭐
    const top4 = starredAll.slice(0, 4);

    // Seção Todos os Produtos: Todos os modelos RESTANTES (sem os 4 que já estão no topo, para evitar duplicação)
    const rest = baseList.filter(m => !top4.some(top => top.name === m.name)).sort((a, b) => {
      const aStar = isMaisVendido(a);
      const bStar = isMaisVendido(b);
      if (aStar && !bStar) return -1;
      if (!aStar && bStar) return 1;
      const orderA = a.displayOrder ?? 99;
      const orderB = b.displayOrder ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    return {
      topFeaturedModels: top4,
      mainCatalogModels: rest,
      isOnlyMaisVendidosMode: false
    };
  }, [query, brand, selectedCategorySlug, models]);

  return (
    <div className="min-h-screen pb-safe">
      <Hero 
        query={query} 
        onQueryChange={setQuery} 
        activeBrand={brand} 
        onBrandChange={setBrand} 
        activeCategory={selectedCategorySlug}
        onCategoryChange={setSelectedCategorySlug}
        onCartClick={() => setCartOpen(true)}
        brands={availableBrands}
      />
      
      <section className="px-4 sm:px-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-sm text-muted-foreground gap-3">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p>Carregando catálogo digital...</p>
          </div>
        ) : topFeaturedModels.length === 0 && mainCatalogModels.length === 0 ? (
          <div className="py-24 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</div>
        ) : (
          <div className="space-y-8 pb-32">
            {/* Seção 1: ⭐ Mais Vendidos (Topo - Máximo 4 Pods no modo padrão) */}
            {topFeaturedModels.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
                  <Star className="size-4 text-amber-400 fill-amber-400" />
                  <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">Mais Vendidos</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {topFeaturedModels.map(m => (
                    <ProductCard key={m.name} model={m} onClick={() => setSelectedModel(m)} />
                  ))}
                </div>
              </div>
            )}

            {/* Seção 2: Todos os Produtos / Restante do Catálogo */}
            {mainCatalogModels.length > 0 && (
              <div className="space-y-4">
                {topFeaturedModels.length > 0 && (
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2.5 pt-2">
                    <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">Todos os Produtos</h2>
                  </div>
                )}
                {isOnlyMaisVendidosMode && (
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
                    <Star className="size-4 text-amber-400 fill-amber-400" />
                    <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">Mais Vendidos</h2>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {mainCatalogModels.map(m => (
                    <ProductCard key={m.name} model={m} onClick={() => setSelectedModel(m)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      
      {/* Esconde a barra inferior se o FlavorSheet estiver aberto para evitar o bug de scroll no Safari */}
      {!selectedModel && <CartBar onClick={() => setCartOpen(true)} />}
      
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
      <FlavorSheet model={selectedModel} open={!!selectedModel} onClose={() => setSelectedModel(null)} />
    </div>
  );
}

