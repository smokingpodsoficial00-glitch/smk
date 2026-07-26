import { useEffect, useMemo, useState } from "react";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { CartBar } from "@/components/CartBar";
import { CartSheet } from "@/components/CartSheet";
import { FlavorSheet } from "@/components/FlavorSheet";
import { CartProvider } from "@/lib/cart";
import { fetchProductsFromSupabase, type Product, type PodModel } from "@/lib/products";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function App() {
  return (
    <CartProvider>
      <Menu />
    </CartProvider>
  );
}

function Menu() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<PodModel | null>(null);

  const loadProducts = async () => {
    const data = await fetchProductsFromSupabase();
    setProductList(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();

    // Inscrição em tempo real para atualizações de estoque no Supabase
    const subscription = supabase
      .channel("public:smoking_products")
      .on("postgres_changes", { event: "*", schema: "public", table: "smoking_products" }, () => {
        loadProducts();
      })
      .subscribe();

    return () => {
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
    return Array.from(map.values());
  }, [productList]);

  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    for (const p of productList) {
      if (p.is_active && p.brand) set.add(p.brand);
    }
    return Array.from(set);
  }, [productList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter(m => {
      if (brand && m.brand.toLowerCase() !== brand.toLowerCase()) return false;
      if (!q) return true;
      const matchesModel = m.name.toLowerCase().includes(q) || m.brand.toLowerCase().includes(q);
      const matchesFlavor = m.variants.some(v => v.flavor.toLowerCase().includes(q));
      return matchesModel || matchesFlavor;
    });
  }, [query, brand, models]);

  return (
    <div className="min-h-screen pb-safe">
      <Hero 
        query={query} 
        onQueryChange={setQuery} 
        activeBrand={brand} 
        onBrandChange={setBrand} 
        onCartClick={() => setCartOpen(true)}
        brands={availableBrands}
      />
      
      <section className="px-4 sm:px-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-sm text-muted-foreground gap-3">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p>Carregando catálogo digital...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 pb-32">
            {filtered.map(m => (
              <ProductCard key={m.name} model={m} onClick={() => setSelectedModel(m)} />
            ))}
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

