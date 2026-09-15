import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Product } from "@/lib/products";

export interface CartItem { product: Product; quantity: number; }

interface CartContextValue {
  items: CartItem[];
  add: (p: Product) => void;
  remove: (id: string) => void;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  clear: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((p: Product) => {
    setItems(prev => {
      const ex = prev.find(i => i.product.id === p.id);
      if (ex) return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: p, quantity: 1 }];
    });
  }, []);
  const remove = useCallback((id: string) => setItems(p => p.filter(i => i.product.id !== id)), []);
  const increment = useCallback((id: string) => setItems(p => p.map(i => i.product.id === id ? { ...i, quantity: i.quantity + 1 } : i)), []);
  const decrement = useCallback((id: string) => setItems(p => p.map(i => i.product.id === id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0)), []);
  const clear = useCallback(() => setItems([]), []);

  const { totalItems, totalPrice } = useMemo(() => items.reduce(
    (acc, i) => { acc.totalItems += i.quantity; acc.totalPrice += i.quantity * i.product.price; return acc; },
    { totalItems: 0, totalPrice: 0 }
  ), [items]);

  return <CartContext.Provider value={{ items, add, remove, increment, decrement, clear, totalItems, totalPrice }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function buildWhatsAppUrl(items: CartItem[], total: number, whatsappNumber?: string): string | null {
  const cleanPhone = whatsappNumber ? whatsappNumber.replace(/\D/g, "") : "";
  if (!cleanPhone || cleanPhone.length < 10) return null;
  const phone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const parts = items.map(i => `${i.quantity}x ${i.product.name} (${i.product.flavor})`).join(", ");
  const msg = `[PEDIDO-SMOKING] ${parts} | Total: ${formatBRL(total)}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}
