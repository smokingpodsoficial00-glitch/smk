import { supabase } from "@/lib/supabase";

export interface Category {
  id: string;
  name: string;
  slug: string;
  badge_text: string;
  position: number;
  company_id: string;
}

export interface ProductCategoryMapping {
  product_id: string;
  category_id: string;
  display_order: number;
  company_id: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "11111111-1111-4111-a111-111111111111", name: "Mais Vendidos", slug: "mais-vendidos", badge_text: "⭐ Mais vendido", position: 1, company_id: "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5" },
  { id: "22222222-2222-4222-a222-222222222222", name: "Lançamentos", slug: "lancamentos", badge_text: "✦ Novo", position: 2, company_id: "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5" },
  { id: "33333333-3333-4333-a333-333333333333", name: "Destaques", slug: "destaques", badge_text: "Destaque", position: 3, company_id: "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5" },
  { id: "44444444-4444-4444-a444-444444444444", name: "Promoções", slug: "promocoes", badge_text: "Oferta", position: 4, company_id: "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5" },
];

const LOCAL_STORAGE_CAT_KEY = "smk_product_categories_cache";
const SYSTEM_KEY = "__SYSTEM_SMK_BEST_SELLERS__";
const DEFAULT_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LIVE_CATALOG_CHANNEL = "smk_live_catalog_sync_v1";

export function getLocalCategoryMappings(): Record<string, { category_ids: string[]; display_order: number }> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CAT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveLocalCategoryMappings(mappings: Record<string, { category_ids: string[]; display_order: number }>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CAT_KEY, JSON.stringify(mappings));
  } catch (e) {
    console.warn("Erro ao salvar categorias no localStorage:", e);
  }
}

/**
 * Busca a lista oficial de categorias do Supabase.
 * Fonte Primária: public.smoking_categories
 * Fallback: DEFAULT_CATEGORIES
 */
export async function fetchCategories(companyId?: string): Promise<Category[]> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  try {
    const { data, error } = await supabase
      .from("smoking_categories")
      .select("*")
      .eq("company_id", targetCompanyId)
      .order("display_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((c: any) => {
        const defaultMatch = DEFAULT_CATEGORIES.find(dc => dc.id === c.id || dc.slug === c.slug);
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          badge_text: c.badge_text || defaultMatch?.badge_text || c.name,
          position: c.display_order ?? c.position ?? defaultMatch?.position ?? 0,
          company_id: c.company_id
        };
      });
    }
  } catch (e) {
    console.warn("Erro ao buscar categorias do Supabase:", e);
  }
  return DEFAULT_CATEGORIES;
}

/**
 * Busca o mapa de produtos vinculados a categorias.
 * Fonte 1 (Soberana): Linha pública __STORE_CONFIG__ em smoking_products (sincronizada pelo admin com display_order e modelKey)
 * Fonte 2: Tabela relacional public.product_categories (somente se Fonte 1 não tiver category_mappings definido)
 * Fonte 3: smoking_orders (Shadow Metastore)
 * Fonte 4: localStorage
 */
export async function fetchProductCategoryMappings(companyId?: string): Promise<{
  productMap: Record<string, { category_ids: string[]; display_order: number }>;
}> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const result: Record<string, { category_ids: string[]; display_order: number }> = {};

  // 1. Ler mapeamentos sincronizados pelo admin na linha pública __STORE_CONFIG__
  //    Se `parsed.category_mappings` existir (mesmo que seja `{}` vazio quando todas as estrelas são desmarcadas),
  //    ele é a fonte de verdade soberana e NÃO deve ser misturado com linhas órfãs de `product_categories`.
  try {
    const { data: cfgData, error: cfgErr } = await supabase
      .from("smoking_products")
      .select("flavor")
      .eq("brand", "__STORE_CONFIG__")
      .eq("company_id", targetCompanyId)
      .limit(1);

    if (!cfgErr && cfgData && cfgData.length > 0 && cfgData[0].flavor) {
      try {
        const parsed = JSON.parse(cfgData[0].flavor);
        if (parsed && parsed.category_mappings !== undefined && typeof parsed.category_mappings === "object" && parsed.category_mappings !== null) {
          Object.entries(parsed.category_mappings).forEach(([k, v]: [string, any]) => {
            if (v && Array.isArray(v.category_ids) && v.category_ids.length > 0) {
              result[k] = {
                category_ids: v.category_ids,
                display_order: typeof v.display_order === "number" ? v.display_order : 1
              };
            }
          });
          saveLocalCategoryMappings(result);
          return { productMap: result };
        }
      } catch {}
    }
  } catch {}

  let hasServerData = false;

  // 2. Fallback: Ler da tabela relacional public.product_categories (apenas se __STORE_CONFIG__ ainda não tiver category_mappings)
  try {
    const { data: catRows, error: catErr } = await supabase
      .from("product_categories")
      .select("product_id, category_id");

    if (!catErr && catRows && catRows.length > 0) {
      hasServerData = true;
      catRows.forEach((row: any) => {
        const pid = row.product_id;
        const cid = row.category_id;
        if (!pid || !cid) return;

        if (!result[pid]) {
          result[pid] = { category_ids: [cid], display_order: 1 };
        } else {
          if (!result[pid].category_ids.includes(cid)) {
            result[pid].category_ids.push(cid);
          }
        }
      });
    }
  } catch (e) {
    console.warn("Aviso ao buscar de product_categories:", e);
  }

  if (hasServerData) {
    saveLocalCategoryMappings(result);
    return { productMap: result };
  }

  // 3. Fallback de Contingência: Shadow Metastore em smoking_orders
  try {
    const { data: orderConfig, error: configErr } = await supabase
      .from("smoking_orders")
      .select("items")
      .eq("client_phone", SYSTEM_KEY)
      .eq("company_id", targetCompanyId)
      .limit(1);

    if (!configErr && orderConfig && orderConfig.length > 0) {
      const items = orderConfig[0].items;

      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const catIds = item.category_ids || (item.category_id ? [item.category_id] : ["11111111-1111-4111-a111-111111111111"]);
          const order = item.display_order ?? item.displayOrder ?? 1;

          if (item.product_id) {
            result[item.product_id] = { category_ids: catIds, display_order: order };
          }
          if (item.id) {
            result[item.id] = { category_ids: catIds, display_order: order };
          }
          if (item.modelKey) {
            result[item.modelKey] = { category_ids: catIds, display_order: order };
          }
        });
      }

      saveLocalCategoryMappings(result);
      return { productMap: result };
    }
  } catch (e) {
    console.warn("Erro ao buscar configuracao em smoking_orders:", e);
  }

  // 4. Fallback Offline: Cache local
  const localData = getLocalCategoryMappings();
  return { productMap: localData };
}
