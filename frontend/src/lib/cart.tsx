import { createContext, useCallback, useContext, useMemo, useState, useEffect, type ReactNode } from "react";
import type { Product } from "@/lib/products";
import { supabase } from "@/lib/supabase";

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
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("cart-items");
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((it: any) =>
        it &&
        typeof it === 'object' &&
        it.product &&
        typeof it.product === 'object' &&
        typeof it.product.id === 'string' &&
        typeof it.quantity === 'number' &&
        it.quantity > 0
      ).map((it: any) => ({
        product: {
          ...it.product,
          price: typeof it.product.price === 'number' && !isNaN(it.product.price) ? it.product.price : parseFloat(String(it.product.price || 0)) || 0
        },
        quantity: it.quantity
      }));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("cart-items", JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = useCallback((p: Product) => {
    setItems(prev => {
      const ex = prev.find(i => i.product.id === p.id);
      const maxStock = typeof p.stock === 'number' ? p.stock : parseInt(String(p.stock || '999'), 10);
      if (ex) {
        if (ex.quantity >= maxStock) return prev;
        return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (maxStock <= 0) return prev;
      return [...prev, { product: p, quantity: 1 }];
    });
  }, []);
  const remove = useCallback((id: string) => setItems(p => p.filter(i => i.product.id !== id)), []);
  const increment = useCallback((id: string) => setItems(prev => prev.map(i => {
    if (i.product.id === id) {
      const maxStock = typeof i.product.stock === 'number' ? i.product.stock : parseInt(String(i.product.stock || '999'), 10);
      if (i.quantity >= maxStock) return i;
      return { ...i, quantity: i.quantity + 1 };
    }
    return i;
  })), []);
  const decrement = useCallback((id: string) => setItems(p => p.map(i => i.product.id === id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0)), []);
  const clear = useCallback(() => setItems([]), []);

  const { totalItems, totalPrice } = useMemo(() => items.reduce(
    (acc, i) => {
      const qty = typeof i.quantity === 'number' ? i.quantity : 1;
      const price = typeof i.product?.price === 'number' ? i.product.price : parseFloat(String(i.product?.price || 0)) || 0;
      acc.totalItems += qty;
      acc.totalPrice += qty * price;
      return acc;
    },
    { totalItems: 0, totalPrice: 0 }
  ), [items]);

  return <CartContext.Provider value={{ items, add, remove, increment, decrement, clear, totalItems, totalPrice }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function formatBRL(value: number | undefined | null) {
  const num = typeof value === 'number' && !isNaN(value) ? value : parseFloat(String(value || 0)) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Constrói o link de finalização via WhatsApp com a mensagem detalhada do carrinho.
 * Retorna null se o número do WhatsApp não estiver devidamente configurado no Supabase.
 */
export function buildWhatsAppUrl(
  items: CartItem[],
  total: number,
  whatsappNumber?: string | null,
  storeName?: string
): string | null {
  if (!whatsappNumber || typeof whatsappNumber !== "string") return null;
  const cleanPhone = whatsappNumber.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 10) return null;

  const phone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const name = storeName || "Smoking Pods";
  const storeTag = name.toUpperCase().replace(/\s+/g, "");

  const itemLines = items.map(i => `• ${i.quantity}x ${i.product.name} (${i.product.flavor})`).join("\n");
  const msg = `[PEDIDO-${storeTag}]\n${itemLines}\n• Total: ${formatBRL(total)}`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}
