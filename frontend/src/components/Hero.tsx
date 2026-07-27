import { Search, ShoppingBag } from "lucide-react";
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

  const storeName = config?.store_name || "Minha Loja";
  const storeDescription = config?.description || "Pedido finalizado em segundos pelo WhatsApp.";
  const logoUrl = config?.logo_url;

  return (
    <section className="px-5 pt-10 pb-6 sm:pt-16 sm:pb-10 max-w-6xl mx-auto relative">
      
      {/* Carrinho de topo esquerdo (Minimalista) */}
      <button 
        onClick={onCartClick}
        className="absolute top-6 left-5 sm:top-10 flex items-center justify-center p-2 rounded-full transition-transform hover:scale-110"
        aria-label="Ver carrinho"
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          {totalItems > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid place-items-center w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground border border-black">
              {totalItems}
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-col items-center text-center gap-3 sm:gap-5">
        {logoUrl && (
          <img 
            src={logoUrl} 
            alt={storeName} 
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl mb-1"
          />
        )}
        <span className="text-[9px] sm:text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
          {storeDescription.length > 50 ? storeDescription.substring(0, 50) + "..." : storeDescription}
        </span>
        <h1 className="text-silver text-4xl sm:text-7xl font-semibold tracking-tight leading-none pb-2 -mb-2">{storeName}</h1>
        <p className="text-muted-foreground max-w-md text-xs sm:text-base">
          Pedido finalizado em segundos pelo WhatsApp.
        </p>
      </div>

      <div className="mt-8 sm:mt-12 max-w-xl mx-auto">
        <div className="glass-strong rounded-full flex items-center gap-3 px-5 py-3.5">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Buscar marca, modelo ou sabor"
            className="bg-transparent outline-none text-sm sm:text-base flex-1 min-w-0 placeholder:text-muted-foreground"
          />
        </div>
      </div>

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
      className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 border ${
        active ? "bg-primary text-primary-foreground border-transparent"
               : "glass text-foreground hover:bg-elevated"
      }`}
    >{label}</button>
  );
}
