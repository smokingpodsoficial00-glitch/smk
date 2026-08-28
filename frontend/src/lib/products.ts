import { supabase } from "@/lib/supabase";
import { fetchProductPromotionsMap } from "@/lib/productPromotions";

export interface Product {
  id: string;
  name: string;
  brand: string;
  puffs: number;
  flavor: string;
  price: number;
  original_price?: number;
  promo_price?: number;
  is_promotional?: boolean;
  discount_pct?: number;
  stock: number;
  image_url: string;
  is_active: boolean;
}

export interface PodModel {
  name: string;
  brand: string;
  puffs: number;
  price: number;
  original_price?: number;
  is_promotional?: boolean;
  discount_pct?: number;
  variants: Product[];
  categories?: Array<{ id: string; name: string; slug: string; badge_text: string }>;
  displayOrder?: number;
}

export const BRANDS = ["Ignite", "Elf Bar", "Lost Mary", "Waka", "Oxbar"] as const;

// Fallback Mock Data caso o Supabase esteja desconectado
const baseModels = [
  { name: "Ignite V50", brand: "Ignite", puffs: 5000, price: 90 },
  { name: "Elf Bar BC5000", brand: "Elf Bar", puffs: 5000, price: 85 },
  { name: "Lost Mary OS5000", brand: "Lost Mary", puffs: 5000, price: 95 },
];

const mockFlavors = [
  "Watermelon Ice", "Blueberry Ice", "Strawberry Mango", "Menthol", "Blue Razz Ice", "Grape Ice"
];

export const fallbackProducts: Product[] = [];
let idCounter = 1;
for (const model of baseModels) {
  for (let i = 0; i < mockFlavors.length; i++) {
    fallbackProducts.push({
      id: `fallback-${idCounter++}`,
      name: model.name,
      brand: model.brand,
      puffs: model.puffs,
      flavor: mockFlavors[i],
      price: model.price,
      original_price: model.price,
      stock: 15,
      image_url: "",
      is_active: true,
    });
  }
}

export async function fetchProductsFromSupabase(): Promise<Product[]> {
  try {
    const [productsRes, promosMap] = await Promise.all([
      supabase
        .from("smoking_products")
        .select("*")
        .order("brand", { ascending: true })
        .order("name", { ascending: true }),
      fetchProductPromotionsMap(),
    ]);

    const data = productsRes.data;
    const error = productsRes.error;

    if (!error && data && data.length > 0) {
      return data
        .filter((item: any) => {
          if (item.is_active === false) return false;
          return true;
        })
        .map((item: any) => {
          const originalPrice = parseFloat(item.price) || 0;
          const promoInfo = promosMap[item.id];
          const hasPromo = Boolean(promoInfo && promoInfo.isPromotional && promoInfo.promoPrice && promoInfo.promoPrice > 0);

          const finalPrice = hasPromo ? Number(promoInfo.promoPrice) : originalPrice;
          const discountPct = hasPromo
            ? promoInfo.discountPct || Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
            : 0;

          return {
            id: item.id,
            name: item.name,
            brand: item.brand,
            puffs: item.puffs || 5000,
            flavor: item.flavor,
            price: finalPrice,
            original_price: originalPrice,
            promo_price: hasPromo ? finalPrice : undefined,
            is_promotional: hasPromo,
            discount_pct: discountPct,
            stock: parseInt(item.stock) || 0,
            image_url: item.image_url || "",
            is_active: item.is_active ?? true,
          };
        });
    }
  } catch (err) {
    console.error("Erro ao buscar produtos do Supabase no cardápio:", err);
  }
  return fallbackProducts;
}
