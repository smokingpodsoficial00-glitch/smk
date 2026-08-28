import { useEffect, useState } from "react";
import { X, Plus, Check, Minus } from "lucide-react";
import type { PodModel, Product } from "@/lib/products";
import { formatBRL, useCart } from "@/lib/cart";

export function FlavorSheet({ model, open, onClose }: { model: PodModel | null; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md" onClick={onClose} />
      <div role="dialog" aria-modal="true"
        className={`absolute inset-x-0 bottom-0 glass-strong rounded-t-3xl border-t border-border transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col max-h-[85vh] ${open ? "translate-y-0" : "translate-y-full"}`}>
        
        {model && (
          <>
            <div className="flex flex-col items-center pt-3 pb-1 shrink-0">
              <span className="h-1 w-10 rounded-full bg-border" />
            </div>

            <div className="flex items-center justify-between px-5 pb-4 shrink-0">
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{model.brand}</span>
                <h2 className="text-xl font-semibold tracking-tight">{model.name}</h2>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={onClose} 
                  className="px-4 py-1.5 text-[13px] font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity"
                >
                  Confirmar
                </button>
                <button onClick={onClose} aria-label="Fechar" className="grid place-items-center size-9 rounded-full bg-elevated hover:bg-accent">
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6">
              <ul className="flex flex-col gap-2.5">
                {model.variants.map(v => (
                  <FlavorItem key={v.id} product={v} />
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FlavorItem({ product }: { product: Product }) {
  const { items, add, increment, decrement } = useCart();
  const cartItem = items.find(i => i.product.id === product.id);
  const quantity = cartItem?.quantity || 0;
  const stockQty = typeof product.stock === "number" ? product.stock : parseInt(String(product.stock || "0"), 10);
  const outOfStock = stockQty <= 0;
  const isMaxStockReached = quantity >= stockQty;

  const handleAdd = () => {
    if (outOfStock || isMaxStockReached) return;
    add(product);
  };

  return (
    <li className="flex items-center justify-between p-3.5 rounded-2xl bg-card/60 border border-border">
      <div className="flex flex-col min-w-0 flex-1 pr-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold truncate">{product.flavor}</span>
          {product.is_promotional && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
              OFERTA {product.discount_pct ? `-${product.discount_pct}%` : ""}
            </span>
          )}
        </div>
        {outOfStock ? (
           <span className="text-[11px] text-red-400 font-medium">Esgotado</span>
        ) : (
           <span className="text-[11px] text-white/90 font-medium drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
             Em estoque ({stockQty} un)
           </span>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0 pl-3">
        <div className="flex flex-col items-end">
          {product.is_promotional && product.original_price && product.original_price > product.price && (
            <span className="text-[11px] text-muted-foreground line-through font-normal">
              {formatBRL(product.original_price)}
            </span>
          )}
          <span className={`text-sm font-semibold tracking-tight ${product.is_promotional ? "text-emerald-400 font-bold" : "text-foreground"}`}>
            {formatBRL(product.price)}
          </span>
        </div>
        
        {quantity > 0 ? (
          <div className="flex items-center gap-2 bg-elevated rounded-full p-1 border border-border/50">
            <button onClick={() => decrement(product.id)} className="grid place-items-center size-6 rounded-full bg-background hover:bg-muted text-muted-foreground transition-colors cursor-pointer">
              <Minus className="size-3" />
            </button>
            <span className="text-xs font-semibold w-4 text-center font-mono">{quantity}</span>
            <button 
              onClick={() => increment(product.id)} 
              disabled={isMaxStockReached}
              className={`grid place-items-center size-6 rounded-full transition-all ${
                isMaxStockReached 
                  ? "bg-muted/40 text-muted-foreground/30 cursor-not-allowed" 
                  : "bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
              }`}
              title={isMaxStockReached ? `Estoque máximo (${stockQty} un) atingido` : "Adicionar mais"}
            >
              <Plus className="size-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className={`relative grid place-items-center size-8 rounded-full transition-all duration-300 ${
              outOfStock ? "bg-muted text-muted-foreground cursor-not-allowed"
                         : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 cursor-pointer"
            }`}
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
    </li>
  );
}
