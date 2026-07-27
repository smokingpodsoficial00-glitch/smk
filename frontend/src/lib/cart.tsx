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
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("cart-items", JSON.stringify(items));
  }, [items]);

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

// Fallback caso o store_config não esteja disponível
export const WHATSAPP_NUMBER = "5511977300561"; // troque pelo seu número

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Busca o WhatsApp e nome da loja do store_config (cache em memória)
let _cachedWhatsApp: string | null = null;
let _cachedStoreName: string | null = null;
let _configFetchPromise: Promise<void> | null = null;

async function ensureStoreConfig() {
  if (_cachedWhatsApp !== null) return;
  if (_configFetchPromise) {
    await _configFetchPromise;
    return;
  }
  _configFetchPromise = (async () => {
    try {
      const { data } = await supabase.from("store_config").select("whatsapp_number, store_name").limit(1).single();
      if (data) {
        _cachedWhatsApp = data.whatsapp_number || WHATSAPP_NUMBER;
        _cachedStoreName = data.store_name || "Minha Loja";
      }
    } catch {
      _cachedWhatsApp = WHATSAPP_NUMBER;
      _cachedStoreName = "Minha Loja";
    }
  })();
  await _configFetchPromise;
}

export async function getWhatsAppNumber(): Promise<string> {
  await ensureStoreConfig();
  return _cachedWhatsApp || WHATSAPP_NUMBER;
}

export async function getStoreName(): Promise<string> {
  await ensureStoreConfig();
  return _cachedStoreName || "Minha Loja";
}

export function buildWhatsAppUrl(items: CartItem[], total: number, whatsappNumber?: string, storeName?: string) {
  const phone = whatsappNumber || _cachedWhatsApp || WHATSAPP_NUMBER;
  const name = storeName || _cachedStoreName || "Minha Loja";
  const parts = items.map(i => `${i.quantity}x ${i.product.name} (${i.product.flavor})`).join(", ");
  const msg = `[PEDIDO-${name.toUpperCase().replace(/\s+/g, "")}] ${parts} | Total: ${formatBRL(total)}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}
