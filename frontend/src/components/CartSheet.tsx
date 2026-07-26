import { useEffect } from "react";
import { Minus, Plus, X, Trash2 } from "lucide-react";
import { buildWhatsAppUrl, formatBRL, useCart } from "@/lib/cart";

const vapeIgnite = "https://placehold.co/400x500/121212/ffffff.jpg?text=Ignite";
const vapeElfbar = "https://placehold.co/400x500/121212/ffffff.jpg?text=ElfBar";
const vapeLostmary = "https://placehold.co/400x500/121212/ffffff.jpg?text=LostMary";

const brandImages: Record<string, string> = {
  Ignite: vapeIgnite, "Elf Bar": vapeElfbar, "Lost Mary": vapeLostmary,
};

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, increment, decrement, remove, totalPrice, totalItems } = useCart();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleCheckout = () => {
    if (!items.length) return;
    window.open(buildWhatsAppUrl(items, totalPrice), "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md" onClick={onClose} />
      <div role="dialog" aria-modal="true"
        className={`absolute inset-x-0 bottom-0 glass-strong rounded-t-3xl border-t border-border transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-auto w-full max-w-xl flex flex-col max-h-[85vh]">
          <div className="flex flex-col items-center pt-3 pb-1"><span className="h-1 w-10 rounded-full bg-border" /></div>

          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Seu pedido</span>
              <h2 className="text-xl font-semibold tracking-tight">{totalItems} {totalItems === 1 ? "item" : "itens"}</h2>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="grid place-items-center size-9 rounded-full bg-elevated hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-2">
            {items.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Nenhum item no carrinho.</div>
            ) : (
              <ul className="flex flex-col gap-3">
                {items.map(item => {
                  const img = brandImages[item.product.brand] ?? vapeIgnite;
                  return (
                    <li key={item.product.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-card/60 border border-border">
                      <img src={img} alt={item.product.name} className="size-16 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{item.product.brand}</p>
                        <p className="text-sm font-semibold truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.product.flavor} · {item.product.puffs.toLocaleString("pt-BR")} puffs</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-sm font-semibold tracking-tight">{formatBRL(item.product.price * item.quantity)}</span>
                        <div className="flex items-center gap-1 bg-elevated rounded-full p-0.5">
                          <button onClick={() => item.quantity === 1 ? remove(item.product.id) : decrement(item.product.id)}
                                  aria-label="Diminuir" className="grid place-items-center size-7 rounded-full hover:bg-accent">
                            {item.quantity === 1 ? <Trash2 className="size-3" /> : <Minus className="size-3" />}
                          </button>
                          <span className="text-xs font-semibold w-5 text-center tabular-nums">{item.quantity}</span>
                          <button onClick={() => increment(item.product.id)} aria-label="Aumentar" className="grid place-items-center size-7 rounded-full hover:bg-accent">
                            <Plus className="size-3" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="p-5 pt-3 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-semibold tracking-tight">{formatBRL(totalPrice)}</span>
            </div>
            <button onClick={handleCheckout} disabled={items.length === 0}
              className="w-full rounded-full bg-primary text-primary-foreground py-4 text-sm font-semibold tracking-wide transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed">
              Finalizar via WhatsApp
            </button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Endereço, frete e PIX são finalizados com nossa IA no WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
