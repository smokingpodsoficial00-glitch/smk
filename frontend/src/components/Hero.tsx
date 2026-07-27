import { Search, ShoppingBag, Store } from "lucide-react";
import { BRANDS } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useStoreConfig } from "@/lib/useStoreConfig";

interface HeroProps {
  query: string;
  onQueryChange: (q: string) => void;
  activeBrand: string | null;
  onBrandChange: (b: string | null) => void;
  onCartClick?: () => void;
  brands?: string[];
}

export function Hero({ query, onQueryChange, activeBrand, onBrandChange, onCartClick, brands }: HeroProps) {
  const { totalItems } = useCart();
  const { config } = useStoreConfig();
  const brandList = brands && brands.length > 0 ? brands : (BRANDS as unknown as string[]);

  const storeName = config?.store_name || "Smoking Pods";
  const logoUrl = config?.logo_url;

  return (
    <section className="px-5 pt-8 pb-6 sm:pt-14 sm:pb-10 max-w-6xl mx-auto relative">
      
      {/* Carrinho de topo esquerdo (Minimalista) */}
      <button 
        onClick={onCartClick}
        className="absolute top-6 left-5 sm:top-8 flex items-center justify-center p-2 rounded-full transition-transform hover:scale-110 cursor-pointer"
        aria-label="Ver carrinho"
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          {totalItems > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid place-items-center w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-black border border-black">
              {totalItems}
            </span>
          )}
        </div>
      </button>

      {/* Destaque Central: Badge de Logo do Negócio + Nome da Loja */}
      <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
        <div className="relative size-20 sm:size-24 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 flex items-center justify-center overflow-hidden shadow-[0_0_25px_rgba(16,185,129,0.15)] transition-all hover:scale-105">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={storeName} 
              className="size-full object-contain rounded-xl"
            />
          ) : (
            <Store className="size-9 sm:size-11 text-emerald-400" />
          )}
        </div>

        <h1 className="text-white text-3xl sm:text-6xl font-bold tracking-tight leading-none">
          {storeName}
        </h1>

        <p className="text-muted-foreground max-w-md text-xs sm:text-sm font-medium">
          Pedido finalizado em segundos pelo WhatsApp.
        </p>
      </div>

      {/* Barra de Pesquisa Destacada */}
      <div className="mt-8 sm:mt-10 max-w-xl mx-auto">
        <div className="glass-strong rounded-full flex items-center gap-3 px-5 py-3.5 border border-white/10 focus-within:border-emerald-500/50 transition-all">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Buscar marca, modelo ou sabor..."
            className="bg-transparent outline-none text-sm sm:text-base flex-1 min-w-0 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Filtros por Marca */}
      <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
        <Pill label="Todos" active={activeBrand === null} onClick={() => onBrandChange(null)} />
        {brandList.map(b => (
          <Pill key={b} label={b} active={activeBrand === b} onClick={() => onBrandChange(b)} />
        ))}
      </div>
    </section>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 border cursor-pointer ${
        active ? "bg-emerald-500 text-black font-bold border-transparent shadow-[0_0_15px_rgba(16,185,129,0.3)]"
               : "glass text-foreground hover:bg-elevated"
      }`}
    >{label}</button>
  );
}
