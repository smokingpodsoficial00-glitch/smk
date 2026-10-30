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
  image_url?: string;
  variants: Product[];
  allVariants?: Product[];
  categories?: Array<{ id: string; name: string; slug: string; badge_text: string }>;
  displayOrder?: number;
}

export const BRANDS = ["Ignite", "Elf Bar", "Lost Mary", "Waka", "Oxbar"] as const;

export const fallbackProducts: Product[] = [];

const CATALOG_IMAGE_CACHE_KEY = "smk_catalog_model_images_v1";
const memoryImageCache: Record<string, string> = {};

try {
  if (typeof window !== "undefined") {
    const saved = sessionStorage.getItem(CATALOG_IMAGE_CACHE_KEY);
    if (saved) {
      Object.assign(memoryImageCache, JSON.parse(saved));
    }
  }
} catch {}

let _resolvedCompanyIdPromise: Promise<string> | null = null;

export async function resolveCatalogCompanyId(): Promise<string> {
  if (_resolvedCompanyIdPromise) return _resolvedCompanyIdPromise;

  _resolvedCompanyIdPromise = (async () => {
    const DEFAULT_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
    try {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const paramCompany = urlParams.get("company") || urlParams.get("c");
        if (paramCompany && paramCompany.trim().length > 0) {
          return paramCompany.trim();
        }

        let slug = urlParams.get("loja");
        if (!slug) {
          const host = window.location.hostname.toLowerCase();
          // Ignora localhost e domínios Vercel (onde o subdomínio é o nome do deploy Vercel, não o slug da loja)
          if (!host.includes("localhost") && !host.includes("127.0.0.1") && !host.endsWith("vercel.app")) {
            const parts = host.split(".");
            if (parts.length >= 3 && !["www", "smoking-pods-catalogo", "admin", "app"].includes(parts[0])) {
              slug = parts[0];
            }
          }
        }

        const cleanSlug = (slug || "").trim().toLowerCase();
        if (cleanSlug && !["smoking-pods", "smoking-pods-01", "smokingpods"].includes(cleanSlug)) {
          try {
            const { data: vStoreData } = await supabase
              .from("public_store_config")
              .select("company_id")
              .eq("store_slug", cleanSlug)
              .maybeSingle();

            if (vStoreData?.company_id) {
              return vStoreData.company_id;
            }

            const { data: baseStoreData } = await supabase
              .from("store_config")
              .select("company_id")
              .eq("store_slug", cleanSlug)
              .maybeSingle();

            if (baseStoreData?.company_id) {
              return baseStoreData.company_id;
            }

            const formattedName = cleanSlug.replace(/-/g, " ");
            const { data: vCompData } = await supabase
              .from("public_companies")
              .select("id")
              .ilike("name", formattedName)
              .maybeSingle();

            if (vCompData?.id) {
              return vCompData.id;
            }

            const { data: baseCompData } = await supabase
              .from("companies")
              .select("id")
              .ilike("name", formattedName)
              .maybeSingle();

            if (baseCompData?.id) {
              return baseCompData.id;
            }
          } catch (e) {
            console.warn("Erro ao buscar empresa por slug no catálogo:", e);
          }
        }
      }

      const envCompanyId = import.meta.env.VITE_COMPANY_ID;
      if (envCompanyId && typeof envCompanyId === "string" && envCompanyId.trim().length > 0) {
        return envCompanyId.trim();
      }
    } catch (e) {
      console.warn("Erro ao resolver empresa no catálogo:", e);
    }
    return DEFAULT_ID;
  })();

  return _resolvedCompanyIdPromise;
}

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

/**
 * Busca imagens de modelos que ainda não estão em cache (1 imagem por modelo único, reduzindo 5.3MB para ~0KB nos refreshes).
 */
export async function hydrateMissingModelImages(
  items: Product[],
  onImagesLoaded?: (newMap: Record<string, string>) => void
): Promise<Record<string, string>> {
  const missingRepIds: string[] = [];
  const seenGroupKeys = new Set<string>();

  for (const p of items) {
    const groupKey = `${(p.brand || "").trim().toLowerCase()}__${(p.name || "").trim().toLowerCase()}`;
    if (p.image_url) {
      memoryImageCache[groupKey] = p.image_url;
      memoryImageCache[p.id] = p.image_url;
      continue;
    }
    if (memoryImageCache[groupKey] !== undefined || memoryImageCache[p.id] !== undefined) continue;
    if (!seenGroupKeys.has(groupKey)) {
      seenGroupKeys.add(groupKey);
      missingRepIds.push(p.id);
    }
  }

  if (missingRepIds.length === 0) {
    return memoryImageCache;
  }

  try {
    const { data: imgRows } = await supabase
      .from("smoking_products")
      .select("id, brand, name, image_url")
      .in("id", missingRepIds)
      .not("image_url", "is", null)
      .neq("image_url", "");

    if (imgRows && imgRows.length > 0) {
      for (const r of imgRows) {
        if (r.image_url) {
          const gKey = `${(r.brand || "").trim().toLowerCase()}__${(r.name || "").trim().toLowerCase()}`;
          memoryImageCache[gKey] = r.image_url;
          memoryImageCache[r.id] = r.image_url;
        }
      }
    }

    // Marca como vazia qualquer chave consultada que veio sem foto para não reconsultar
    for (const p of items) {
      const groupKey = `${(p.brand || "").trim().toLowerCase()}__${(p.name || "").trim().toLowerCase()}`;
      if (memoryImageCache[groupKey] === undefined) {
        memoryImageCache[groupKey] = "";
      }
      if (memoryImageCache[p.id] === undefined) {
        memoryImageCache[p.id] = "";
      }
    }

    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(CATALOG_IMAGE_CACHE_KEY, JSON.stringify(memoryImageCache));
      }
    } catch {}

    if (onImagesLoaded && imgRows && imgRows.length > 0) {
      onImagesLoaded({ ...memoryImageCache });
    }
  } catch (e) {
    console.warn("Aviso ao carregar imagens de modelos:", e);
  }

  return memoryImageCache;
}

export async function fetchProductsFromSupabase(
  customCompanyId?: string,
  onImagesHydrated?: (imgMap: Record<string, string>) => void
): Promise<Product[]> {
  try {
    const companyId = customCompanyId || (await resolveCatalogCompanyId());

    // Seleciona apenas colunas leves (23KB em 90ms em vez de 5.3MB de Base64 repetidos em 1820ms!)
    const lightCols = "id, name, brand, puffs, flavor, price, stock, is_active, promo_price, is_promotional, discount_pct";

    const [productsRes, promosMap] = await Promise.all([
      supabase
        .from("smoking_products")
        .select(lightCols)
        .eq("company_id", companyId)
        .neq("brand", "__STORE_CONFIG__")
        .order("brand", { ascending: true })
        .order("name", { ascending: true }),
      fetchProductPromotionsMap(companyId),
    ]);

    const data = productsRes.data;
    const error = productsRes.error;

    if (!error && data && data.length > 0) {
      const mapped: Product[] = data
        .filter((item: any) => {
          if (item.is_active === false) return false;
          if (String(item.brand || "").startsWith("__")) return false;
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

          const gKey = `${(item.brand || "").trim().toLowerCase()}__${(item.name || "").trim().toLowerCase()}`;
          const cachedImg = memoryImageCache[item.id] || memoryImageCache[gKey] || "";

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
            image_url: cachedImg,
            is_active: item.is_active ?? true,
          };
        });

      // Hidrata apenas 1 imagem por modelo único em segundo plano (ou imediatamente se já em cache)
      hydrateMissingModelImages(mapped, onImagesHydrated);

      return mapped;
    }
  } catch (err: any) {
    console.error("Erro ao buscar produtos do Supabase no cardápio:", err?.message || err);
    return [];
  }
  return [];
}
