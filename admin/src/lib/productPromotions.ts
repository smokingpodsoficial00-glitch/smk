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

/**
 * Busca promoções oficiais do banco Supabase.
 * FONTE PRIMÁRIA: Tabela 'smoking_products' no Supabase.
 */
export async function fetchProductPromotionsMap(companyId?: string): Promise<Record<string, PromoData>> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const result: Record<string, PromoData> = {};

  try {
    // 1. SUPABASE COMO FONTE PRIMÁRIA: busca direta da tabela smoking_products
    const { data: products, error: prodErr } = await supabase
      .from("smoking_products")
      .select("id, promo_price, is_promotional, discount_pct")
      .eq("company_id", targetCompanyId)
      .eq("is_promotional", true);

    if (!prodErr && products && products.length > 0) {
      products.forEach((p: any) => {
        result[p.id] = {
          productId: p.id,
          isPromotional: true,
          promoPrice: parseFloat(p.promo_price) || 0,
          discountPct: parseFloat(p.discount_pct) || 0,
        };
      });
      saveLocalProductPromotions(result);
      return result;
    }

    // 2. Transição/Contingência: lê de smoking_orders se ainda não migrado
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
    console.warn("Aviso: Falha ao buscar promoções no Supabase DB. Usando cache secundário.", e);
  }

  console.warn("Aviso: Operando com cache local de promoções.");
  return getLocalProductPromotions();
}

/**
 * Atualiza ou remove uma promoção de produto.
 * FONTE PRIMÁRIA: Atualiza a tabela 'smoking_products' no Supabase.
 */
export async function updateProductPromotion(params: {
  productId: string;
  isPromotional: boolean;
  promoPrice?: number;
  discountPct?: number;
  companyId?: string;
}): Promise<boolean> {
  const { productId, isPromotional, promoPrice, discountPct, companyId } = params;
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  // 1. Atualizar cache local
  const currentLocal = getLocalProductPromotions();
  if (isPromotional) {
    currentLocal[productId] = {
      productId,
      isPromotional: true,
      promoPrice: promoPrice || 0,
      discountPct: discountPct || 0,
    };
  } else {
    delete currentLocal[productId];
  }
  saveLocalProductPromotions(currentLocal);

  // 2. Persistir no Supabase na tabela oficial smoking_products (FONTE PRIMÁRIA)
  try {
    const { error: prodErr } = await supabase
      .from("smoking_products")
      .update({
        is_promotional: isPromotional,
        promo_price: isPromotional ? (promoPrice || null) : null,
        discount_pct: isPromotional ? (discountPct || null) : null,
      })
      .eq("id", productId)
      .eq("company_id", targetCompanyId);

    if (prodErr) {
      console.warn("Aviso ao atualizar promoção em smoking_products:", prodErr.message);
    }
  } catch (e) {
    console.warn("Erro ao persistir promoção em smoking_products:", e);
  }

  // 3. Sincronizar também no Shadow Metastore (smoking_orders) para compatibilidade retroativa
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

    if (isPromotional) {
      preservedItems.push({
        id: productId,
        productId: productId,
        isPromotional: true,
        promoPrice: promoPrice || 0,
        discountPct: discountPct || 0,
      });
    }

    if (existingRowId) {
      await supabase
        .from("smoking_orders")
        .update({ items: preservedItems })
        .eq("id", existingRowId);
    }
  } catch (e) {
    console.warn("Erro ao sincronizar promoção no shadow metastore:", e);
  }

  return true;
}
