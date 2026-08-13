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

export async function fetchProductCostsMap(companyId?: string): Promise<Record<string, number>> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const result: Record<string, number> = {};

  try {
    // 1. Busca os custos oficiais salvos no Supabase DB para a empresa
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
          if (item.modelKey) result[item.modelKey] = cost;
        }
      });
      // Sincroniza o cache local com os custos oficiais do banco
      saveLocalProductCosts(result);
      return result;
    }
  } catch (e) {
    console.warn("Erro ao buscar custos em smoking_orders no Supabase DB:", e);
  }

  // Fallback para cache local apenas se a rede falhar
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

  // 1. Atualizar cache local imediatamente
  const currentLocal = getLocalProductCosts();
  const parts = modelKey.split('__');
  const bStr = (parts[0] || '').trim();
  const nStr = (parts[1] || '').trim();
  const cleanKey = `${bStr.toLowerCase().replace(/\s+/g, '')}__${nStr.toLowerCase().replace(/\s+/g, '')}`;

  currentLocal[modelKey] = costPrice;
  currentLocal[cleanKey] = costPrice;
  productIds.forEach(pid => { currentLocal[pid] = costPrice; });
  saveLocalCategoryMappings(currentLocal);

  // 2. Persistir no Supabase DB sem apagar outros custos de produtos da empresa!
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

    // Preserva os custos dos outros produtos e atualiza somente este modelo e suas variantes
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
    } else {
      await supabase
        .from("smoking_orders")
        .insert({
          client_phone: SYSTEM_COST_KEY,
          client_name: "System Config Product Costs",
          shipping_address: "CONFIG",
          items: preservedItems,
          total_amount: 0,
          company_id: targetCompanyId
        });
    }
  } catch (e) {
    console.warn("Erro ao salvar custo em smoking_orders no Supabase DB:", e);
  }

  return true;
}

function saveLocalCategoryMappings(currentLocal: Record<string, number>) {
  saveLocalProductCosts(currentLocal);
}
