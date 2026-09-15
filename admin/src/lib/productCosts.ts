import { supabase } from "@/lib/supabase";

const SYSTEM_COST_KEY = "__SYSTEM_SMK_PRODUCT_COSTS__";
const DEFAULT_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
const LOCAL_STORAGE_COST_KEY = "smk_product_costs_cache";

export function getLocalProductCosts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_COST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveLocalProductCosts(costs: Record<string, number>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_COST_KEY, JSON.stringify(costs));
  } catch (e) {
    console.warn("Erro ao salvar custos no localStorage:", e);
  }
}

/**
 * Busca o mapa de custos dos produtos.
 * FONTE PRIMÁRIA: Tabela 'smoking_products' no Supabase.
 * Contingência: Cache local de segurança.
 */
export async function fetchProductCostsMap(companyId?: string): Promise<Record<string, number>> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const result: Record<string, number> = {};

  try {
    // 1. SUPABASE COMO FONTE PRIMÁRIA: busca direta da tabela smoking_products
    const { data: products, error: prodErr } = await supabase
      .from("smoking_products")
      .select("id, brand, name, cost_price")
      .eq("company_id", targetCompanyId);

    if (!prodErr && products && products.length > 0) {
      let populatedFromProducts = 0;
      products.forEach((p: any) => {
        const cost = parseFloat(p.cost_price);
        if (!isNaN(cost) && cost > 0) {
          result[p.id] = cost;
          populatedFromProducts++;
          if (p.brand && p.name) {
            const b = p.brand.trim().toLowerCase();
            const n = p.name.trim().toLowerCase();
            result[`${b}__${n}`] = cost;
            result[`${b.replace(/\s+/g, '')}__${n.replace(/\s+/g, '')}`] = cost;
          }
        }
      });

      if (populatedFromProducts > 0) {
        saveLocalProductCosts(result);
        return result;
      }
    }

    // 2. Transição/Contingência: Se smoking_products ainda não possui cost_price, lê de smoking_orders
    const { data: orderConfig, error: configErr } = await supabase
      .from("smoking_orders")
      .select("items")
      .eq("client_phone", SYSTEM_COST_KEY)
      .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
      .limit(1);

    if (!configErr && orderConfig && orderConfig.length > 0 && Array.isArray(orderConfig[0].items)) {
      orderConfig[0].items.forEach((item: any) => {
        const cost = parseFloat(item.cost_price);
        if (!isNaN(cost) && cost > 0) {
          if (item.product_id) result[item.product_id] = cost;
          if (item.id) result[item.id] = cost;
          if (item.modelKey) {
            const mk = item.modelKey.trim().toLowerCase();
            result[mk] = cost;
            result[mk.replace(/\s+/g, '')] = cost;
          }
        }
      });
      saveLocalProductCosts(result);
      return result;
    }
  } catch (e) {
    console.warn("Aviso: Falha ao buscar custos no Supabase. Usando cache de segurança.", e);
  }

  // Fallback secundário (com warning explícito, sem inventar custos fictícios)
  console.warn("Aviso: Operando com cache local secundário de custos.");
  return getLocalProductCosts();
}

export async function updateProductCost(params: {
  modelKey: string;
  productIds: string[];
  costPrice: number;
  companyId?: string;
}): Promise<boolean> {
  const { modelKey, productIds, costPrice, companyId } = params;
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  if (isNaN(costPrice) || costPrice <= 0) return false;

  const parts = modelKey.split('__');
  const bStr = (parts[0] || '').trim();
  const nStr = (parts[1] || '').trim();
  const cleanKey = `${bStr.toLowerCase().replace(/\s+/g, '')}__${nStr.toLowerCase().replace(/\s+/g, '')}`;

  // 1. Atualizar cache local imediatamente
  const currentLocal = getLocalProductCosts();
  currentLocal[modelKey] = costPrice;
  currentLocal[cleanKey] = costPrice;
  productIds.forEach(pid => { currentLocal[pid] = costPrice; });
  saveLocalProductCosts(currentLocal);

  // 2. Persistir no Supabase na tabela oficial smoking_products (FONTE PRIMÁRIA)
  try {
    let updateQuery = supabase
      .from("smoking_products")
      .update({ cost_price: costPrice })
      .eq("company_id", targetCompanyId);

    if (productIds && productIds.length > 0) {
      updateQuery = updateQuery.in("id", productIds);
    } else if (bStr && nStr) {
      updateQuery = updateQuery.ilike("brand", bStr).ilike("name", nStr);
    }

    const { error: prodUpdateErr } = await updateQuery;
    if (prodUpdateErr) {
      console.warn("Aviso ao atualizar cost_price em smoking_products:", prodUpdateErr.message);
    }
  } catch (e) {
    console.warn("Erro ao persistir cost_price em smoking_products:", e);
  }

  // 3. Sincronizar também no Shadow Metastore (smoking_orders) para compatibilidade retroativa
  try {
    const { data: existingRows } = await supabase
      .from("smoking_orders")
      .select("id, items")
      .eq("client_phone", SYSTEM_COST_KEY)
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

    const preservedItems = currentItems.filter((item: any) => {
      if (item.modelKey === modelKey || item.modelKey === cleanKey) return false;
      if (productIds.includes(item.product_id) || productIds.includes(item.id)) return false;
      return true;
    });

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    preservedItems.push({
      id: "11111111-1111-4111-a111-111111111111",
      product_id: "11111111-1111-4111-a111-111111111111",
      modelKey: modelKey,
      cost_price: costPrice
    });

    if (cleanKey !== modelKey) {
      preservedItems.push({
        id: "11111111-1111-4111-a111-111111111111",
        product_id: "11111111-1111-4111-a111-111111111111",
        modelKey: cleanKey,
        cost_price: costPrice
      });
    }

    productIds.forEach((pid) => {
      if (UUID_REGEX.test(pid)) {
        preservedItems.push({
          id: pid,
          product_id: pid,
          modelKey: modelKey,
          cost_price: costPrice
        });
      }
    });

    if (existingRowId) {
      await supabase
        .from("smoking_orders")
        .update({ items: preservedItems })
        .eq("id", existingRowId);
    }
  } catch (e) {
    console.warn("Erro ao sincronizar shadow metastore em smoking_orders:", e);
  }

  return true;
}
