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

    // 2. Transição/Contingência: lê de smoking_orders se ainda não migrado
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
    console.warn("Aviso: Falha ao buscar custos no Supabase. Usando cache de contingência.", e);
  }

  console.warn("Aviso: Operando com cache local secundário de custos.");
  return getLocalProductCosts();
}

