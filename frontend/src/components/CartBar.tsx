import { ShoppingBag } from "lucide-react";
import { formatBRL, useCart } from "@/lib/cart";

export function CartBar({ onClick }: { onClick: () => void }) {
  const { totalItems, totalPrice } = useCart();
  if (totalItems === 0) return null;

  return (
    <div 
      className="fixed bottom-0 inset-x-0 z-40 px-4 sm:px-6 pointer-events-none"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <button onClick={onClick}
        className="pointer-events-auto mx-auto flex items-center justify-between gap-4 w-full max-w-md glass-strong rounded-full px-5 py-3.5 transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]">
        <span className="flex items-center gap-3 min-w-0">
          <span className="relative grid place-items-center size-9 rounded-full bg-primary text-primary-foreground">
            <ShoppingBag className="size-4" />
            <span className="absolute -top-1 -right-1 grid place-items-center size-5 rounded-full bg-background text-foreground text-[10px] font-semibold border border-border">
              {totalItems}
            </span>
          </span>
          <span className="text-sm font-medium truncate">Ver pedido</span>
        </span>
        <span className="text-sm font-semibold tracking-tight">{formatBRL(totalPrice)}</span>
      </button>
    </div>
  );
}
