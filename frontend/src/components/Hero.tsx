import { useEffect } from "react";
import { Search, ShoppingBag, Star } from "lucide-react";
import { BRANDS } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useStoreConfig } from "@/lib/useStoreConfig";
import { BrandDropdown } from "@/components/BrandDropdown";
import { SortDropdown, type SortOption } from "@/components/SortDropdown";

interface HeroProps {
  query: string;
  onQueryChange: (q: string) => void;
  activeBrand: string | null;
  onBrandChange: (b: string | null) => void;
  activeCategory?: string | null;
  onCategoryChange?: (c: string | null) => void;
  onCartClick?: () => void;
  brands?: string[];
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function Hero({ 
  query, 
  onQueryChange, 
  activeBrand, 
  onBrandChange, 
  activeCategory = null,
  onCategoryChange,
  onCartClick, 
  brands,
  sortBy,
  onSortChange
}: HeroProps) {
  const { totalItems } = useCart();
  const { config } = useStoreConfig();
  const brandList = brands && brands.length > 0 ? brands : (BRANDS as unknown as string[]);

  const storeName = config?.store_name || "Smoking Pods";

  useEffect(() => {
    if (storeName) {
      document.title = storeName;
    }
  }, [storeName]);

  return (
    <section className="px-4 sm:px-6 pt-8 pb-6 sm:pt-14 sm:pb-8 max-w-6xl mx-auto relative">
      
      {/* Carrinho de topo esquerdo (Minimalista) */}
      <button 
        onClick={onCartClick}
        className="absolute top-6 left-4 sm:top-8 sm:left-6 flex items-center justify-center p-2 rounded-full transition-transform hover:scale-110 cursor-pointer"
        aria-label="Ver carrinho"
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
          {totalItems > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid place-items-center w-4 h-4 rounded-full bg-white text-[9px] font-bold text-black border border-black shadow-[0_0_10px_rgba(255,255,255,0.9)]">
              {totalItems}
            </span>
          )}
        </div>
      </button>

      {/* Destaque Central: Nome da Loja */}
      <div className="flex flex-col items-center text-center gap-3 sm:gap-4 pt-4">
        <h1 className="text-white text-3xl sm:text-6xl font-bold tracking-tight leading-none">
          {storeName}
        </h1>

        <p className="text-muted-foreground max-w-md text-xs sm:text-sm font-medium">
          Pedido finalizado em segundos pelo WhatsApp.
        </p>
      </div>

      {/* Barra de Pesquisa Destacada */}
      <div className="mt-8 sm:mt-10 max-w-xl mx-auto">
        <div className="glass-strong rounded-full flex items-center gap-3 px-5 py-3.5 border border-white/10 focus-within:border-white/60 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Buscar marca, modelo ou sabor..."
            className="bg-transparent outline-none text-sm sm:text-base flex-1 min-w-0 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Barra Unificada de Filtros e Ordenação */}
      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filtros à esquerda: [ Todas ] [ ⭐ Mais Vendidos ] [ Marcas ▾ ] */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <Pill 
            label="Todas" 
            active={activeBrand === null && (!activeCategory || activeCategory === null)} 
            onClick={() => {
              onBrandChange(null);
              onCategoryChange?.(null);
            }} 
          />
          {onCategoryChange && (
            <CategoryPill
              active={activeCategory === 'mais-vendidos'}
              onClick={() => {
                onBrandChange(null);
                onCategoryChange(activeCategory === 'mais-vendidos' ? null : 'mais-vendidos');
              }}
            >
              <Star className={`size-3 sm:size-3.5 mr-1.5 shrink-0 ${activeCategory === 'mais-vendidos' ? 'text-amber-500 fill-amber-500' : 'text-amber-400 fill-amber-400'}`} />
              <span>Mais Vendidos</span>
            </CategoryPill>
          )}
          <BrandDropdown
            brands={brandList}
            activeBrand={activeCategory ? null : activeBrand}
            onSelectBrand={b => {
              onCategoryChange?.(null);
              onBrandChange(activeBrand === b ? null : b);
            }}
          />
        </div>

        {/* Ordenação à direita: [ Ordenar por: Padrão ▾ ] */}
        <div className="flex items-center justify-end shrink-0">
          <SortDropdown value={sortBy} onChange={onSortChange} />
        </div>
      </div>
    </section>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 border cursor-pointer select-none ${
        active 
          ? "bg-white text-black font-semibold border-white shadow-[0_0_14px_rgba(255,255,255,0.28)]"
          : "glass text-white/90 border-white/10 hover:bg-elevated hover:border-white/20 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function CategoryPill({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 border cursor-pointer select-none flex items-center ${
        active 
          ? "bg-white text-black font-semibold border-white shadow-[0_0_14px_rgba(255,255,255,0.28)]"
          : "glass text-white/90 border-white/10 hover:bg-elevated hover:border-white/20 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
