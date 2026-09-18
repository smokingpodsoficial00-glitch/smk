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

// Não gera catálogo falso localmente caso o Supabase esteja desconectado
export const fallbackProducts: Product[] = [];

export function getCatalogCompanyId(): string {
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const paramCompany = urlParams.get("company") || urlParams.get("c");
    if (paramCompany && paramCompany.trim().length > 0) {
      return paramCompany.trim();
    }
  }

  const envCompanyId = import.meta.env.VITE_COMPANY_ID;
  if (!envCompanyId || typeof envCompanyId !== "string" || envCompanyId.trim().length === 0) {
    return "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
  }
  return envCompanyId.trim();
}

export async function fetchProductsFromSupabase(customCompanyId?: string): Promise<Product[]> {
  try {
    const companyId = customCompanyId || getCatalogCompanyId();

    const [productsRes, promosMap] = await Promise.all([
      supabase
        .from("smoking_products")
        .select("*")
        .eq("company_id", companyId)
        .order("brand", { ascending: true })
        .order("name", { ascending: true }),
      fetchProductPromotionsMap(companyId),
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
          const hasPromo = Boolean(
            (item.is_promotional && item.promo_price && parseFloat(item.promo_price) > 0) ||
            (promoInfo && promoInfo.isPromotional && promoInfo.promoPrice && promoInfo.promoPrice > 0)
          );

          const promoPriceVal = (item.is_promotional && item.promo_price)
            ? parseFloat(item.promo_price)
            : (promoInfo?.promoPrice || 0);

          const finalPrice = hasPromo ? Number(promoPriceVal) : originalPrice;
          const discountPct = hasPromo
            ? (item.discount_pct ? parseFloat(item.discount_pct) : (promoInfo?.discountPct || Math.round(((originalPrice - finalPrice) / originalPrice) * 100)))
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
  } catch (err: any) {
    console.error("Erro ao buscar produtos do Supabase no cardápio:", err?.message || err);
    return [];
  }
  return [];
}
