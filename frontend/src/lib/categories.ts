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
      .order("position", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        badge_text: c.badge_text || c.name,
        position: c.position || 0,
        company_id: c.company_id
      }));
    }
  } catch (e) {
    console.warn("Erro ao buscar categorias do Supabase:", e);
  }
  return DEFAULT_CATEGORIES;
}

/**
 * Busca o mapa de produtos vinculados a categorias.
 * Fonte Primária: public.product_categories
 * Fallback de Contingência: smoking_orders (Shadow Metastore)
 * Fallback Offline: localStorage
 */
export async function fetchProductCategoryMappings(companyId?: string): Promise<{
  productMap: Record<string, { category_ids: string[]; display_order: number }>;
}> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  // 1. Fonte Primária Oficial: Tabela relacional public.product_categories
  try {
    const { data: catRows, error: catErr } = await supabase
      .from("product_categories")
      .select("product_id, category_id, display_order, company_id")
      .eq("company_id", targetCompanyId);

    if (!catErr && catRows && catRows.length > 0) {
      const result: Record<string, { category_ids: string[]; display_order: number }> = {};
      
      catRows.forEach((row: any) => {
        const pid = row.product_id;
        const cid = row.category_id;
        const order = row.display_order ?? 1;

        if (!result[pid]) {
          result[pid] = { category_ids: [cid], display_order: order };
        } else {
          if (!result[pid].category_ids.includes(cid)) {
            result[pid].category_ids.push(cid);
          }
          result[pid].display_order = Math.min(result[pid].display_order, order);
        }
      });

      // Preservar chaves textuais de modelo do cache local para compatibilidade transitória
      const local = getLocalCategoryMappings();
      Object.keys(local).forEach(k => {
        if (!k.includes('-') && !result[k]) {
          result[k] = local[k];
        }
      });

      saveLocalCategoryMappings(result);
      return { productMap: result };
    }
  } catch (e) {
    console.warn("Aviso ao buscar de product_categories, tentando contingência:", e);
  }

  // 2. Fallback de Contingência: Shadow Metastore em smoking_orders
  try {
    const { data: orderConfig, error: configErr } = await supabase
      .from("smoking_orders")
      .select("items")
      .eq("client_phone", SYSTEM_KEY)
      .eq("company_id", targetCompanyId)
      .limit(1);

    if (!configErr && orderConfig && orderConfig.length > 0) {
      const result: Record<string, { category_ids: string[]; display_order: number }> = {};
      const items = orderConfig[0].items;

      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const catIds = item.category_ids || (item.category_id ? [item.category_id] : ["11111111-1111-4111-a111-111111111111"]);
          const order = item.display_order ?? item.displayOrder ?? 0;

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

  // 3. Fallback Offline: Cache local
  const localData = getLocalCategoryMappings();
  return { productMap: localData };
}

/**
 * Atualiza categorias de um modelo/conjunto de produtos.
 * Fonte Primária: public.product_categories (Upsert/Delete relacional)
 * Salvaguarda: Shadow Metastore em smoking_orders + localStorage
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

  // 1. Atualizar localStorage em segundo plano
  const currentLocal = getLocalCategoryMappings();
  
  const parts = modelKey.split('__');
  const bStr = (parts[0] || '').trim();
  const nStr = (parts[1] || '').trim();
  const cleanKey = `${bStr.toLowerCase().replace(/\s+/g, '')}__${nStr.toLowerCase().replace(/\s+/g, '')}`;

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

  // 2. Operação Relacional Primária: public.product_categories
  try {
    const validProductIds = productIds.filter(pid => UUID_REGEX.test(pid));

    if (categoryIds.length === 0) {
      if (validProductIds.length > 0) {
        const { error: delErr } = await supabase
          .from("product_categories")
          .delete()
          .in("product_id", validProductIds)
          .eq("company_id", targetCompanyId);
        if (delErr) console.warn("Aviso ao remover de product_categories:", delErr.message);
      }
    } else {
      const upsertRows: any[] = [];
      validProductIds.forEach(pid => {
        categoryIds.forEach(cid => {
          upsertRows.push({
            company_id: targetCompanyId,
            product_id: pid,
            category_id: cid,
            display_order: displayOrder
          });
        });
      });

      if (upsertRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("product_categories")
          .upsert(upsertRows, { onConflict: "product_id,category_id" });
        if (upsertErr) console.warn("Aviso ao salvar em product_categories:", upsertErr.message);
      }
    }
  } catch (e) {
    console.warn("Erro ao atualizar product_categories no Supabase:", e);
  }

  // 3. Manter Shadow Metastore em smoking_orders sincronizado como salvaguarda passiva
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
        flavor: "Padrão",
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
          flavor: "Padrão",
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
            flavor: "Padrão",
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
