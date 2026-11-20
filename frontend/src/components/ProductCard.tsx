import type { PodModel } from "@/lib/products";
import { formatBRL } from "@/lib/cart";
import { MinimalistVapeIcon } from "./MinimalistVapeIcon";

export function ProductCard({ model, onClick }: { model: PodModel; onClick: () => void }) {
  const allVars = model.allVariants && model.allVariants.length > 0 ? model.allVariants : model.variants;
  const outOfStock = allVars.length === 0 || allVars.every(v => (v.stock || 0) <= 0);
  const variantWithImage = model.variants.find(v => !!v.image_url) || model.allVariants?.find(v => !!v.image_url);
  
  // Imagem real cadastrada no modelo ou na variação
  const hasRealImage = !!(model.image_url || variantWithImage?.image_url);
  const realImageUrl = model.image_url || variantWithImage?.image_url;

  const flavorsCount = model.variants.length;
  const primaryCategory = model.categories && model.categories.length > 0 ? model.categories[0] : null;

  return (
    <article onClick={onClick} className="group relative flex flex-col rounded-2xl sm:rounded-3xl bg-card border border-border overflow-hidden transition-all duration-300 hover:border-white/20 active:scale-[0.98] sm:hover:-translate-y-1 cursor-pointer">
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-b from-elevated to-card flex items-center justify-center">
        {hasRealImage ? (
          /* Quando TEM foto cadastrada: exibe a foto real do produto */
          <img
            src={realImageUrl}
            alt={`${model.brand} ${model.name}`}
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          /* Quando NÃO TEM foto cadastrada: Vaper minimalista branco com fundo preto puro */
          <div className="size-full bg-black flex flex-col items-center justify-center relative p-4 sm:p-6 select-none transition-transform duration-700 group-hover:scale-105">
            <MinimalistVapeIcon className="w-16 h-28 sm:w-28 sm:h-40" />
          </div>
        )}

        {/* Overlay padrão de esgotado caso o produto esteja zerado */}
        {outOfStock && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm z-10">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-muted-foreground font-semibold">Esgotado</span>
          </div>
        )}

        {model.puffs && model.puffs > 0 ? (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 glass px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-silver z-10 font-medium">
            {model.puffs.toLocaleString("pt-BR")} puffs
          </div>
        ) : null}
        {model.is_promotional && (
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-red-500 text-white font-bold px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[10px] tracking-wider shadow-lg shadow-red-500/40 uppercase flex items-center gap-1 animate-in fade-in z-10">
            <span>🔥 {model.discount_pct ? `-${model.discount_pct}%` : "OFF"}</span>
          </div>
        )}
        {!model.is_promotional && primaryCategory && (
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 glass-strong px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-bold text-amber-300 border border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.35)] z-10">
            {primaryCategory.badge_text || primaryCategory.name}
          </div>
        )}
      </div>

      <div className="p-2.5 sm:p-5 flex flex-col gap-1.5 sm:gap-3 flex-1 min-w-0">
        <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
          <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-muted-foreground truncate">{model.brand}</span>
          <h3 className="text-xs sm:text-lg font-semibold tracking-tight truncate leading-tight">{model.name}</h3>
          <span className="text-[10px] sm:text-xs text-primary truncate">
            {flavorsCount === 0 ? 'Indisponível' : flavorsCount === 1 ? '1 opção' : `${flavorsCount} opções`}
          </span>
        </div>

        <div className="mt-auto flex flex-col xs:flex-row items-start xs:items-center justify-between gap-1.5 sm:gap-3 pt-1 border-t border-white/5">
          <div className="flex flex-col min-w-0 shrink-0">
            {model.is_promotional && model.original_price && model.original_price > model.price && (
              <span className="text-[10px] sm:text-xs text-muted-foreground line-through font-normal leading-none">
                {formatBRL(model.original_price)}
              </span>
            )}
            <span className={`text-xs sm:text-lg font-bold tracking-tight whitespace-nowrap ${model.is_promotional ? "text-emerald-400" : "text-foreground"}`}>
              {formatBRL(model.price)}
            </span>
          </div>
          <div className="w-full xs:w-auto text-center px-2 sm:px-4 h-6 sm:h-9 rounded-full bg-elevated text-foreground text-[9px] sm:text-xs font-semibold tracking-wide whitespace-nowrap transition-colors flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground border border-white/10 sm:border-transparent">
            Ver Opções
          </div>
        </div>
      </div>
    </article>
  );
}
