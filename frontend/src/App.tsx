import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { CartBar } from "@/components/CartBar";
import { CartSheet } from "@/components/CartSheet";
import { FlavorSheet } from "@/components/FlavorSheet";
import { CartProvider } from "@/lib/cart";
import type { SortOption } from "@/components/SortDropdown";
import { fetchProductsFromSupabase, resolveCatalogCompanyId, type Product, type PodModel } from "@/lib/products";
import { fetchCategories, fetchProductCategoryMappings, saveLocalCategoryMappings, LIVE_CATALOG_CHANNEL, DEFAULT_CATEGORIES, type Category } from "@/lib/categories";
import { useStoreConfig, fetchConfig, applyInstantConfigPatch } from "@/lib/useStoreConfig";
import { supabase } from "@/lib/supabase";
import { Loader2, Star } from "lucide-react";

// Lazy loading sob demanda da página Hub
const HubPage = lazy(() => import("@/components/HubPage").then(m => ({ default: m.HubPage })));

function getInitialView(): "hub" | "menu" {
  if (typeof window === "undefined") return "menu";
  const path = window.location.pathname.toLowerCase();
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash.toLowerCase();

  // Se o usuário acessar explicitamente /hub, /links ou /bio
  if (
    path.includes("/hub") ||
    path.includes("/links") ||
    path.includes("/bio") ||
    search.get("view") === "hub" ||
    search.get("page") === "hub" ||
    hash.includes("hub") ||
    hash.includes("links")
  ) {
    return "hub";
  }

  // Padrão Absoluto: Cardápio Digital Original na raiz /
  return "menu";
}

export default function App() {
  return (
    <CartProvider>
      <MainApp />
    </CartProvider>
  );
}

function MainApp() {
  const [view, setView] = useState<"hub" | "menu">(getInitialView);

  useEffect(() => {
    const handlePopState = () => {
      setView(getInitialView());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (newView: "hub" | "menu") => {
    setView(newView);
    const targetPath = newView === "hub" ? "/hub" : "/";
    window.history.pushState({ view: newView }, "", targetPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (view === "hub") {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-[#070709] flex flex-col items-center justify-center text-white/50 gap-3">
          <Loader2 className="size-8 text-emerald-400 animate-spin" />
        </div>
      }>
        <HubPage onOpenMenu={() => navigateTo("menu")} />
      </Suspense>
    );
  }

  return <Menu onBackToHub={() => navigateTo("hub")} />;
}


function Menu({ onBackToHub }: { onBackToHub: () => void }) {
  const { config } = useStoreConfig();
  const [productList, setProductList] = useState<Product[]>([]);
  const [hydratedImages, setHydratedImages] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, { category_ids: string[]; display_order: number }>>({});
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("default");

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null);

  const loadProducts = async () => {
    let companyId = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
    try {
      companyId = await resolveCatalogCompanyId();
    } catch (e) {
      console.error(e);
    }
    const [data, cats, catMap] = await Promise.all([
      fetchProductsFromSupabase(companyId, (imgMap) => {
        setHydratedImages(imgMap);
      }),
      fetchCategories(companyId),
      fetchProductCategoryMappings(companyId),
      fetchConfig()
    ]);
    setProductList(data);
    setCategories(cats);
    setCategoryMappings(catMap.productMap);
    setLoading(false);
  };

  // Sincronização leve ao vivo (23KB em ~100ms): atualiza estoque, visibilidade e destaques (⭐) instantaneamente
  const syncLiveCatalog = async () => {
    try {
      const companyId = await resolveCatalogCompanyId();
      const [data, catMap] = await Promise.all([
        fetchProductsFromSupabase(companyId, (imgMap) => {
          setHydratedImages(imgMap);
        }),
        fetchProductCategoryMappings(companyId),
        fetchConfig()
      ]);
      setProductList(data);
      setCategoryMappings(catMap.productMap);
    } catch {}
  };

  useEffect(() => {
    loadProducts();

    // 1. Inscrição Postgres CDC para atualizações no estoque, catálogo e configurações
    const subscription = supabase
      .channel("public:realtime_menu")
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_products" }, () => {
        syncLiveCatalog();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, () => {
        syncLiveCatalog();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "product_categories" }, () => {
        syncLiveCatalog();
      })
      .subscribe();

    // 2. Canal Broadcast WebSocket em tempo real (<50ms entre domínios/dispositivos diferentes!)
    //    IMPORTANTE: Deve usar EXATAMENTE o mesmo nome LIVE_CATALOG_CHANNEL que o Admin usa para publicar!
    const liveSyncChannel = supabase
      .channel(LIVE_CATALOG_CHANNEL)
      .on("broadcast", { event: "catalog_sync" }, (msg: any) => {
        const payload = msg?.payload;
        if (payload && payload.type === "CATEGORIES_UPDATED" && payload.category_mappings) {
          saveLocalCategoryMappings(payload.category_mappings);
          setCategoryMappings({ ...payload.category_mappings });
        } else if (payload && payload.type === "CONFIG_UPDATED" && payload.config) {
          applyInstantConfigPatch(payload.config);
        } else {
          syncLiveCatalog();
        }
      })
      .subscribe();

    // 3. BroadcastChannel local (mesmo navegador)
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("store_config_channel_v5");
        bc.onmessage = (ev) => {
          if (ev.data && ev.data.type === "CATEGORIES_UPDATED" && ev.data.category_mappings) {
            setCategoryMappings({ ...ev.data.category_mappings });
          } else {
            syncLiveCatalog();
          }
        };
      }
    } catch {}

    // 4. Revalidação instantânea ao focar a aba/janela + polling leve de 2.5s
    const handleFocus = () => {
      syncLiveCatalog();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncLiveCatalog();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    const pollInterval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        syncLiveCatalog();
      }
    }, 2500);

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(liveSyncChannel);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(pollInterval);
      if (bc) {
        try { bc.close(); } catch {}
      }
    };
  }, []);

  const models = useMemo(() => {
    // 1. "Ocultar produtos totalmente esgotados"
    const hideProducts = Boolean(config?.hide_out_of_stock_products);
    // 2. "Ocultar variantes esgotadas"
    const hideVariants = Boolean(config?.hide_out_of_stock_variants);

    const map = new Map<string, { model: PodModel; rawVariants: Product[] }>();
    for (const p of productList) {
      // 1. Soberania estrita da ocultação manual por produto/variante
      if (!p.is_active) continue;

      const modelDisplayName = p.name.toLowerCase().includes(p.brand.toLowerCase()) ? p.name : `${p.brand} ${p.name}`;
      const groupKey = `${p.brand}-${modelDisplayName}`.toLowerCase();
      const gKeyCache = `${(p.brand || "").trim().toLowerCase()}__${(p.name || "").trim().toLowerCase()}`;
      const effectiveImage = p.image_url || hydratedImages[p.id] || hydratedImages[gKeyCache] || "";

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          model: {
            name: modelDisplayName,
            brand: p.brand,
            puffs: p.puffs,
            price: p.price,
            image_url: effectiveImage,
            variants: []
          },
          rawVariants: []
        });
      }
      const entry = map.get(groupKey)!;
      entry.rawVariants.push(effectiveImage && !p.image_url ? { ...p, image_url: effectiveImage } : p);
      if (!entry.model.image_url && effectiveImage) {
        entry.model.image_url = effectiveImage;
      }
    }

    const result: PodModel[] = [];

    for (const { model: m, rawVariants } of map.values()) {
      const realFlavors = rawVariants.filter(v => (v.flavor || '').trim() !== '');
      const baseVariants = realFlavors.length > 0 ? realFlavors : rawVariants;

      // Preserva a imagem real original cadastrada do produto (mesmo se esgotado ou filtrado)
      const modelImage = 
        baseVariants.find(v => !!v.image_url)?.image_url || 
        rawVariants.find(v => !!v.image_url)?.image_url || 
        m.image_url || 
        "";

      // Verifica se o modelo possui ao menos 1 variante ativa com estoque disponível (> 0)
      const hasAvailableVariant = baseVariants.some(v => (v.stock || 0) > 0);

      // REGRA 1: "Ocultar produtos totalmente esgotados"
      // Se a configuração estiver ATIVADA e TODAS as variantes estiverem com estoque <= 0,
      // o modelo inteiro desaparece do catálogo.
      if (hideProducts && !hasAvailableVariant) {
        continue;
      }

      // REGRA 2: "Ocultar variantes esgotadas"
      // Se a configuração estiver ATIVADA, esconde das opções as variantes com estoque <= 0.
      // Se estiver DESATIVADA, exibe todas as variantes (as zeradas seguem o comportamento de "Esgotado").
      const displayedVariants = hideVariants
        ? baseVariants.filter(v => (v.stock || 0) > 0)
        : baseVariants;

      // Identificar categorias do modelo verificando chaves do modelo e TODAS as variantes (inclusive esgotadas)
      const firstVariant = rawVariants[0];
      const modelKeyStandard = `${m.brand.toLowerCase()}__${m.name.toLowerCase()}`;
      const modelKeyAlternative = firstVariant ? `${m.brand.toLowerCase()}__${firstVariant.name.toLowerCase()}` : '';
      const modelKeyClean = `${m.brand.toLowerCase().replace(/\s+/g, '')}__${(firstVariant?.name || m.name).toLowerCase().replace(/\s+/g, '')}`;

      const collectedCatIds = new Set<string>();
      let bestOrder = 99;

      const candidateKeys = [
        modelKeyStandard,
        modelKeyAlternative,
        modelKeyClean,
        ...rawVariants.map(rv => rv.id)
      ];

      for (const ck of candidateKeys) {
        if (!ck) continue;
        const entry = categoryMappings[ck];
        if (entry && Array.isArray(entry.category_ids)) {
          entry.category_ids.forEach(cid => collectedCatIds.add(cid));
          if (typeof entry.display_order === "number" && entry.display_order < bestOrder) {
            bestOrder = entry.display_order;
          }
        }
      }

      const modelCategoryIds = Array.from(collectedCatIds);
      const modelDisplayOrder = bestOrder;

      const matchedCategories = categories.filter(c => modelCategoryIds.includes(c.id));

      const priceVariants = displayedVariants.length > 0 ? displayedVariants : baseVariants;
      const hasAnyPromo = priceVariants.some(v => v.is_promotional);
      const minPrice = priceVariants.length > 0 ? Math.min(...priceVariants.map(v => v.price)) : m.price;
      const maxOriginalPrice = hasAnyPromo 
        ? Math.max(...priceVariants.filter(v => v.is_promotional).map(v => v.original_price || v.price))
        : minPrice;
      const maxDiscountPct = hasAnyPromo
        ? Math.max(...priceVariants.filter(v => v.is_promotional).map(v => v.discount_pct || 0))
        : 0;

      result.push({
        ...m,
        price: minPrice,
        original_price: hasAnyPromo && maxOriginalPrice > minPrice ? maxOriginalPrice : undefined,
        is_promotional: hasAnyPromo,
        discount_pct: maxDiscountPct,
        image_url: modelImage,
        allVariants: baseVariants,
        variants: displayedVariants,
        categories: matchedCategories,
        displayOrder: modelDisplayOrder
      });
    }

    return result;
  }, [productList, hydratedImages, categories, categoryMappings, config?.hide_out_of_stock_products, config?.hide_out_of_stock_variants]);

  // Modelo atualmente aberto no modal de sabores SEMPRE derivado ao vivo de `models`
  // (se o switch "Ocultar variantes esgotadas" for ativado com o modal aberto, os sabores zerados somem ao vivo!)
  const activeSelectedModel = useMemo(() => {
    if (!selectedModelName) return null;
    return models.find(m => m.name === selectedModelName) || null;
  }, [models, selectedModelName]);

  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    for (const m of models) {
      if (m.brand && m.brand.trim()) set.add(m.brand.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [models]);

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
      const allVarsToCheck = (m.allVariants && m.allVariants.length > 0) ? m.allVariants : m.variants;

      // 1. Checar por qualquer ID de variante individual no categoryMappings (incluindo esgotadas)
      const hasVariantMatch = allVarsToCheck.some(v => {
        const catIds = categoryMappings[v.id]?.category_ids || [];
        return catIds.includes(MAIS_VENDIDOS_ID);
      });
      if (hasVariantMatch) return true;

      // 2. Checar por variadas chaves do modelo (bruta, limpa, brand__name)
      for (const v of allVarsToCheck) {
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

    const getPrice = (m: PodModel) => {
      const p = typeof m.price === 'number' ? m.price : parseFloat(String(m.price || 0));
      return isNaN(p) ? 0 : p;
    };

    // Função auxiliar para ordenação por preço
    const sortModelsByPrice = <T extends PodModel>(list: T[], direction: 'asc' | 'desc'): T[] => {
      return [...list].sort((a, b) => {
        const priceDiff = direction === 'asc' 
          ? getPrice(a) - getPrice(b) 
          : getPrice(b) - getPrice(a);
        if (priceDiff !== 0) return priceDiff;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
    };

    // 1. Se o cliente clicou na pílula "⭐ Mais Vendidos"
    if (selectedCategorySlug === 'mais-vendidos') {
      const allStarred = baseList.filter(isMaisVendido);
      let sorted = allStarred;
      if (sortBy === 'price-asc') {
        sorted = sortModelsByPrice(allStarred, 'asc');
      } else if (sortBy === 'price-desc') {
        sorted = sortModelsByPrice(allStarred, 'desc');
      } else {
        sorted = [...allStarred].sort((a, b) => {
          const orderA = a.displayOrder ?? 99;
          const orderB = b.displayOrder ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name, 'pt-BR');
        });
      }

      return {
        topFeaturedModels: [],
        mainCatalogModels: sorted,
        isOnlyMaisVendidosMode: true
      };
    }

    // 2. Se há busca ou filtro por marca ativo
    if (brand || q) {
      let sortedSearch = [...baseList];
      if (sortBy === 'price-asc') {
        sortedSearch = sortModelsByPrice(baseList, 'asc');
      } else if (sortBy === 'price-desc') {
        sortedSearch = sortModelsByPrice(baseList, 'desc');
      } else {
        sortedSearch = [...baseList].sort((a, b) => {
          const aStar = isMaisVendido(a);
          const bStar = isMaisVendido(b);
          if (aStar && !bStar) return -1;
          if (!aStar && bStar) return 1;
          const orderA = a.displayOrder ?? 99;
          const orderB = b.displayOrder ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name, 'pt-BR');
        });
      }

      return {
        topFeaturedModels: [],
        mainCatalogModels: sortedSearch,
        isOnlyMaisVendidosMode: false
      };
    }

    // 3. Modo Padrão (Sem busca, sem marca, "Todas"):
    // Seção Topo: SEMPRE mantém os 4 primeiros pods dos Mais Vendidos na primeira posição com os mesmos produtos
    const starredAll = baseList.filter(isMaisVendido).sort((a, b) => {
      const orderA = a.displayOrder ?? 99;
      const orderB = b.displayOrder ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    const top4 = starredAll.slice(0, 4);

    // Seção Todos os Produtos: Todos os modelos RESTANTES (sem os 4 que já estão no topo)
    const rest = baseList.filter(m => !top4.some(top => top.name === m.name));
    
    let sortedRest = rest;
    if (sortBy === 'price-asc') {
      sortedRest = sortModelsByPrice(rest, 'asc');
    } else if (sortBy === 'price-desc') {
      sortedRest = sortModelsByPrice(rest, 'desc');
    } else {
      sortedRest = [...rest].sort((a, b) => {
        const aStar = isMaisVendido(a);
        const bStar = isMaisVendido(b);
        if (aStar && !bStar) return -1;
        if (!aStar && bStar) return 1;
        const orderA = a.displayOrder ?? 99;
        const orderB = b.displayOrder ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
    }

    return {
      topFeaturedModels: top4,
      mainCatalogModels: sortedRest,
      isOnlyMaisVendidosMode: false
    };
  }, [query, brand, selectedCategorySlug, models, sortBy, categoryMappings]);

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
        onBackToHub={onBackToHub}
        brands={availableBrands}
        sortBy={sortBy}
        onSortChange={setSortBy}
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
                    <ProductCard key={m.name} model={m} onClick={() => setSelectedModelName(m.name)} />
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
                    <ProductCard key={m.name} model={m} onClick={() => setSelectedModelName(m.name)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      
      {/* Esconde a barra inferior se o FlavorSheet estiver aberto para evitar o bug de scroll no Safari */}
      {!activeSelectedModel && <CartBar onClick={() => setCartOpen(true)} />}
      
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
      <FlavorSheet model={activeSelectedModel} open={!!activeSelectedModel} onClose={() => setSelectedModelName(null)} />
    </div>
  );
}
