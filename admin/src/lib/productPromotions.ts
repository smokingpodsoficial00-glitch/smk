import { supabase } from "@/lib/supabase";

const SYSTEM_PROMO_KEY = "__SYSTEM_SMK_PRODUCT_PROMOTIONS__";
const DEFAULT_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
const LOCAL_STORAGE_PROMO_KEY = "smk_product_promotions_cache";

export interface PromoData {
  productId: string;
  isPromotional: boolean;
  promoPrice?: number;
  discountPct?: number;
}

export function getLocalProductPromotions(): Record<string, PromoData> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROMO_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveLocalProductPromotions(promos: Record<string, PromoData>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PROMO_KEY, JSON.stringify(promos));
  } catch (e) {
    console.warn("Erro ao salvar promoções no cache local:", e);
  }
}

export async function fetchProductPromotionsMap(companyId?: string): Promise<Record<string, PromoData>> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const result: Record<string, PromoData> = {};

  try {
    const { data: orderConfig, error: configErr } = await supabase
      .from("smoking_orders")
      .select("items")
      .eq("client_phone", SYSTEM_PROMO_KEY)
      .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
      .limit(1);

    if (!configErr && orderConfig && orderConfig.length > 0 && Array.isArray(orderConfig[0].items)) {
      orderConfig[0].items.forEach((item: any) => {
        if (item.productId || item.id) {
          const pid = item.productId || item.id;
          result[pid] = {
            productId: pid,
            isPromotional: Boolean(item.isPromotional),
            promoPrice: parseFloat(item.promoPrice) || 0,
            discountPct: parseFloat(item.discountPct) || 0,
          };
        }
      });
      saveLocalProductPromotions(result);
      return result;
    }
  } catch (e) {
    console.warn("Erro ao buscar promoções no Supabase DB:", e);
  }

  return getLocalProductPromotions();
}

export async function updateProductPromotion(params: {
  productId: string;
  isPromotional: boolean;
  promoPrice?: number;
  discountPct?: number;
  companyId?: string;
}): Promise<boolean> {
  const { productId, isPromotional, promoPrice, discountPct, companyId } = params;
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  const currentLocal = getLocalProductPromotions();
  currentLocal[productId] = {
    productId,
    isPromotional,
    promoPrice: promoPrice || 0,
    discountPct: discountPct || 0,
  };
  saveLocalProductPromotions(currentLocal);

  try {
    const { data: existingRows } = await supabase
      .from("smoking_orders")
      .select("id, items")
      .eq("client_phone", SYSTEM_PROMO_KEY)
      .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
      .limit(1);

    let currentItems: any[] = [];
    let existingRowId: string | null = null;

    if (existingRows && existingRows.length > 0) {
      existingRowId = existingRows[0].id;
      if (Array.isArray(existingRows[0].items)) {
        currentItems = existingRows[0].items;
      }
    }

    const preservedItems = currentItems.filter((item: any) => item.productId !== productId && item.id !== productId);

    preservedItems.push({
      id: productId,
      productId: productId,
      isPromotional,
      promoPrice: promoPrice || 0,
      discountPct: discountPct || 0,
    });

    if (existingRowId) {
      await supabase
        .from("smoking_orders")
        .update({ items: preservedItems })
        .eq("id", existingRowId);
    } else {
      await supabase
        .from("smoking_orders")
        .insert({
          client_phone: SYSTEM_PROMO_KEY,
          client_name: "System Config Product Promotions",
          shipping_address: "CONFIG",
          items: preservedItems,
          total_amount: 0,
          company_id: targetCompanyId,
        });
    }
  } catch (e) {
    console.warn("Erro ao salvar promoção no Supabase DB:", e);
  }

  return true;
}
