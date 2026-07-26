import type { PodModel } from "@/lib/products";
import { formatBRL } from "@/lib/cart";

const vapeIgnite = "https://placehold.co/400x500/121212/ffffff.jpg?text=Ignite";
const vapeElfbar = "https://placehold.co/400x500/121212/ffffff.jpg?text=ElfBar";
const vapeLostmary = "https://placehold.co/400x500/121212/ffffff.jpg?text=LostMary";

const brandImages: Record<string, string> = {
  Ignite: vapeIgnite, "Elf Bar": vapeElfbar, "Lost Mary": vapeLostmary,
};

export function ProductCard({ model, onClick }: { model: PodModel; onClick: () => void }) {
  const outOfStock = model.variants.every(v => v.stock === 0);
  const variantWithImage = model.variants.find(v => !!v.image_url);
  const image = variantWithImage?.image_url || brandImages[model.brand] || vapeIgnite;
  const flavorsCount = model.variants.length;

  return (
    <article onClick={onClick} className="group relative flex flex-col rounded-3xl bg-card border border-border overflow-hidden transition-all duration-500 hover:border-white/20 hover:-translate-y-1 cursor-pointer">
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-b from-elevated to-card">
        <img src={image} alt={`${model.brand} ${model.name}`} loading="lazy"
             className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
        {outOfStock && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
            <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Esgotado</span>
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 glass px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-silver">
          {model.puffs.toLocaleString("pt-BR")} puffs
        </div>
      </div>

      <div className="p-3.5 sm:p-5 flex flex-col gap-2 sm:gap-3 flex-1">
        <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{model.brand}</span>
          <h3 className="text-sm sm:text-lg font-semibold tracking-tight truncate">{model.name}</h3>
          <span className="text-[11px] sm:text-xs text-primary truncate">{flavorsCount} {flavorsCount === 1 ? 'sabor disponível' : 'sabores disponíveis'}</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 sm:gap-3 pt-1">
          <span className="text-base sm:text-lg font-semibold tracking-tight">{formatBRL(model.price)}</span>
          <div className="relative grid place-items-center px-3 sm:px-4 h-8 sm:h-10 rounded-full bg-elevated text-foreground text-[10px] sm:text-xs font-semibold tracking-wide whitespace-nowrap transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            Ver Opções
          </div>
        </div>
      </div>
    </article>
  );
}
