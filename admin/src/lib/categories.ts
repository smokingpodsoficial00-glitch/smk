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
 * Fonte 1: Linha pública __STORE_CONFIG__ em smoking_products (sincronizada pelo admin com display_order e modelKey)
 * Fonte 2: Tabela relacional public.product_categories
 * Fonte 3: smoking_orders (Shadow Metastore)
 * Fonte 4: localStorage
 */
export async function fetchProductCategoryMappings(companyId?: string): Promise<{
  productMap: Record<string, { category_ids: string[]; display_order: number }>;
}> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const result: Record<string, { category_ids: string[]; display_order: number }> = {};
  let hasServerData = false;

  // 1. Ler mapeamentos sincronizados pelo admin na linha pública __STORE_CONFIG__ (contém modelKeys e display_order)
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
        if (parsed && parsed.category_mappings && typeof parsed.category_mappings === "object") {
          Object.entries(parsed.category_mappings).forEach(([k, v]: [string, any]) => {
            if (v && Array.isArray(v.category_ids) && v.category_ids.length > 0) {
              result[k] = {
                category_ids: v.category_ids,
                display_order: typeof v.display_order === "number" ? v.display_order : 1
              };
            }
          });
          hasServerData = true;
        }
      } catch {}
    }
  } catch {}

  // 2. Ler da tabela relacional public.product_categories (sem colunas inexistentes display_order/company_id)
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

/**
 * Atualiza categorias de um modelo/conjunto de produtos.
 * Fonte Primária: public.product_categories + linha pública __STORE_CONFIG__ em smoking_products
 * Salvaguarda: Shadow Metastore em smoking_orders + localStorage + BroadcastChannel
 */
export async function updateModelCategories(params: {
  productIds: string[];
  modelKey: string;
  categoryIds: string[];
  displayOrder: number;
  companyId?: string;
}): Promise<boolean> {
  const { productIds, modelKey, categoryIds, displayOrder, companyId } = params;
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  // 1. Atualizar localStorage imediatamente
  const currentLocal = getLocalCategoryMappings();

  const parts = modelKey.split("__");
  const bStr = (parts[0] || "").trim();
  const nStr = (parts[1] || "").trim();
  const cleanKey = `${bStr.toLowerCase().replace(/\s+/g, "")}__${nStr.toLowerCase().replace(/\s+/g, "")}`;

  if (categoryIds.length === 0) {
    delete currentLocal[modelKey];
    delete currentLocal[cleanKey];
    productIds.forEach((pid) => delete currentLocal[pid]);
  } else {
    currentLocal[modelKey] = { category_ids: categoryIds, display_order: displayOrder };
    currentLocal[cleanKey] = { category_ids: categoryIds, display_order: displayOrder };
    productIds.forEach((pid) => {
      currentLocal[pid] = { category_ids: categoryIds, display_order: displayOrder };
    });
  }

  saveLocalCategoryMappings(currentLocal);

  // 2. Transmitir atualização instantânea para abas abertas do catálogo
  try {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel("store_config_channel_v5");
      bc.postMessage({ type: "CATEGORIES_UPDATED", category_mappings: currentLocal });
      bc.close();
    }
  } catch {}

  // 3. Operação Relacional em public.product_categories (apenas colunas reais: product_id, category_id)
  try {
    const validProductIds = productIds.filter(pid => UUID_REGEX.test(pid));

    if (validProductIds.length > 0) {
      // Sempre remove vínculos anteriores dessas variantes antes de inserir os novos
      const { error: delErr } = await supabase
        .from("product_categories")
        .delete()
        .in("product_id", validProductIds);
      if (delErr) console.warn("Aviso ao limpar de product_categories:", delErr.message);

      if (categoryIds.length > 0) {
        const insertRows: any[] = [];
        validProductIds.forEach(pid => {
          categoryIds.forEach(cid => {
            insertRows.push({
              product_id: pid,
              category_id: cid
            });
          });
        });

        if (insertRows.length > 0) {
          const { error: insErr } = await supabase
            .from("product_categories")
            .insert(insertRows);
          if (insErr) console.warn("Aviso ao inserir em product_categories:", insErr.message);
        }
      }
    }
  } catch (e) {
    console.warn("Erro ao atualizar product_categories no Supabase:", e);
  }

  // 4. Sincronizar category_mappings na linha pública __STORE_CONFIG__ em smoking_products
  //    (garante que o catálogo público receba modelKey e display_order e dispare Realtime)
  try {
    const { data: existingConfigRow } = await supabase
      .from("smoking_products")
      .select("id, flavor")
      .eq("brand", "__STORE_CONFIG__")
      .eq("company_id", targetCompanyId)
      .limit(1);

    let existingPayload: any = {};
    if (existingConfigRow && existingConfigRow.length > 0 && existingConfigRow[0].flavor) {
      try {
        existingPayload = JSON.parse(existingConfigRow[0].flavor) || {};
      } catch {}
    }

    const remoteMappings = (existingPayload.category_mappings && typeof existingPayload.category_mappings === "object")
      ? { ...existingPayload.category_mappings }
      : { ...currentLocal };

    if (categoryIds.length === 0) {
      delete remoteMappings[modelKey];
      delete remoteMappings[cleanKey];
      productIds.forEach((pid) => delete remoteMappings[pid]);
    } else {
      remoteMappings[modelKey] = { category_ids: categoryIds, display_order: displayOrder };
      remoteMappings[cleanKey] = { category_ids: categoryIds, display_order: displayOrder };
      productIds.forEach((pid) => {
        remoteMappings[pid] = { category_ids: categoryIds, display_order: displayOrder };
      });
    }

    const updatedPayload = {
      ...existingPayload,
      category_mappings: remoteMappings,
      updated_at: new Date().toISOString()
    };

    if (existingConfigRow && existingConfigRow.length > 0) {
      await supabase
        .from("smoking_products")
        .update({
          flavor: JSON.stringify(updatedPayload),
          is_active: false
        })
        .eq("id", existingConfigRow[0].id)
        .eq("company_id", targetCompanyId);
    } else {
      await supabase
        .from("smoking_products")
        .insert({
          company_id: targetCompanyId,
          brand: "__STORE_CONFIG__",
          name: "STORE_CONFIG",
          flavor: JSON.stringify(updatedPayload),
          price: 0,
          stock: 0,
          puffs: 0,
          is_active: false
        });
    }
  } catch (e) {
    console.warn("Aviso ao sincronizar category_mappings em __STORE_CONFIG__:", e);
  }

  // 5. Manter Shadow Metastore em smoking_orders sincronizado como salvaguarda passiva
  try {
    const { data: existingRows } = await supabase
      .from("smoking_orders")
      .select("id, items")
      .eq("client_phone", SYSTEM_KEY)
      .eq("company_id", targetCompanyId)
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

    if (categoryIds.length > 0) {
      preservedItems.push({
        id: "11111111-1111-4111-a111-111111111111",
        product_id: "11111111-1111-4111-a111-111111111111",
        modelKey: modelKey,
        category_ids: categoryIds,
        category_id: categoryIds[0],
        display_order: displayOrder,
        name: modelKey,
        flavor: "",
        quantity: 1,
        price: 0,
        unit_price: 0
      });

      if (cleanKey !== modelKey) {
        preservedItems.push({
          id: "11111111-1111-4111-a111-111111111111",
          product_id: "11111111-1111-4111-a111-111111111111",
          modelKey: cleanKey,
          category_ids: categoryIds,
          category_id: categoryIds[0],
          display_order: displayOrder,
          name: cleanKey,
          flavor: "",
          quantity: 1,
          price: 0,
          unit_price: 0
        });
      }

      productIds.forEach((pid) => {
        if (UUID_REGEX.test(pid)) {
          preservedItems.push({
            id: pid,
            product_id: pid,
            modelKey: modelKey,
            category_ids: categoryIds,
            category_id: categoryIds[0],
            display_order: displayOrder,
            name: modelKey,
            flavor: "",
            quantity: 1,
            price: 0,
            unit_price: 0
          });
        }
      });
    }

    if (existingRowId) {
      const { error: updErr } = await supabase
        .from("smoking_orders")
        .update({ items: preservedItems })
        .eq("id", existingRowId);
      if (updErr) console.warn("Aviso ao atualizar categorias em smoking_orders:", updErr.message);
    } else if (preservedItems.length > 0) {
      const { error: insErr } = await supabase
        .from("smoking_orders")
        .insert({
          client_phone: SYSTEM_KEY,
          client_name: "System Config Best Sellers",
          shipping_address: "CONFIG",
          items: preservedItems,
          total_amount: 0,
          company_id: targetCompanyId
        });
      if (insErr) console.warn("Aviso ao inserir categorias em smoking_orders:", insErr.message);
    }
  } catch (e) {
    console.warn("Aviso na sincronização do Shadow Metastore:", e);
  }

  return true;
}
