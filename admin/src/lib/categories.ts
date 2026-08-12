import { supabase } from "@/lib/supabase";

export interface Category {
  id: string;
  name: string;
  slug: string;
  badge_text: string;
  position: number;
}

export interface ProductCategoryMapping {
  product_id: string;
  category_id: string;
  display_order: number;
  company_id?: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "11111111-1111-4111-a111-111111111111", name: "Mais Vendidos", slug: "mais-vendidos", badge_text: "⭐ Mais vendido", position: 1 },
];

const LOCAL_STORAGE_CAT_KEY = "smk_product_categories_cache";
const SYSTEM_KEY = "__SYSTEM_SMK_BEST_SELLERS__";
const DEFAULT_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

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

export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from("smoking_categories")
      .select("*")
      .order("position", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        badge_text: c.badge_text || c.name,
        position: c.position || 0,
      }));
    }
  } catch (e) {
    console.warn("Erro ao buscar categorias do Supabase:", e);
  }
  return DEFAULT_CATEGORIES;
}

export async function fetchProductCategoryMappings(companyId?: string): Promise<{
  productMap: Record<string, { category_ids: string[]; display_order: number }>;
}> {
  const result: Record<string, { category_ids: string[]; display_order: number }> = {};
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  // 1. Inicia com dados locais salvos
  const localData = getLocalCategoryMappings();
  Object.assign(result, localData);

  // 2. Busca configuracao em smoking_orders (Persistencia infalivel no Supabase DB)
  try {
    const { data: orderConfig, error: configErr } = await supabase
      .from("smoking_orders")
      .select("items")
      .eq("client_phone", SYSTEM_KEY)
      .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
      .limit(1);

    if (!configErr && orderConfig && orderConfig.length > 0 && orderConfig[0].items) {
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
    }
  } catch (e) {
    console.warn("Erro ao buscar configuracao em smoking_orders:", e);
  }

  // 3. Tenta buscar da tabela product_categories (fallback caso exista)
  try {
    let query = supabase.from("product_categories").select("*");
    if (companyId) {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    }
    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      data.forEach((row: any) => {
        const pId = row.product_id;
        if (!result[pId]) {
          result[pId] = { category_ids: [], display_order: row.display_order || 0 };
        }
        if (!result[pId].category_ids.includes(row.category_id)) {
          result[pId].category_ids.push(row.category_id);
        }
        if (row.display_order !== undefined && row.display_order !== null) {
          result[pId].display_order = row.display_order;
        }
      });
    }
  } catch (e) {
    // Ignora silenciosamente
  }

  // Atualiza cache local com o resultado mesclado do Supabase
  saveLocalCategoryMappings(result);

  return { productMap: result };
}

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
  
  if (categoryIds.length === 0) {
    delete currentLocal[modelKey];
    productIds.forEach((pid) => delete currentLocal[pid]);
  } else {
    currentLocal[modelKey] = { category_ids: categoryIds, display_order: displayOrder };
    productIds.forEach((pid) => {
      currentLocal[pid] = { category_ids: categoryIds, display_order: displayOrder };
    });
  }

  saveLocalCategoryMappings(currentLocal);

  // 2. Persistir no Supabase DB via tabela smoking_orders (Persistencia infalivel)
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

    // Filtrar itens para remover este modelo/productIds caso a estrela tenha sido desativada
    const updatedItems = currentItems.filter((item: any) => {
      if (item.modelKey === modelKey) return false;
      if (productIds.includes(item.product_id) || productIds.includes(item.id)) return false;
      return true;
    });

    // Se as categorias estiverem ativas, adiciona o novo mapeamento
    if (categoryIds.length > 0) {
      // Adiciona entrada para o modelKey
      updatedItems.push({
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

      // Adiciona entradas para cada productId individual de variante
      productIds.forEach((pid) => {
        updatedItems.push({
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
      });
    }

    if (existingRowId) {
      await supabase
        .from("smoking_orders")
        .update({ items: updatedItems })
        .eq("id", existingRowId);
    } else {
      await supabase
        .from("smoking_orders")
        .insert({
          client_phone: SYSTEM_KEY,
          client_name: "System Config Best Sellers",
          shipping_address: "CONFIG",
          items: updatedItems,
          total_amount: 0,
          company_id: targetCompanyId
        });
    }
  } catch (e) {
    console.warn("Erro ao sincronizar categorias em smoking_orders no Supabase:", e);
  }

  // 3. Tentar persisitr tambem em product_categories (caso venha a existir)
  try {
    if (productIds.length > 0) {
      let delQuery = supabase.from("product_categories").delete().in("product_id", productIds);
      if (companyId) delQuery = delQuery.eq("company_id", companyId);
      await delQuery;
    }

    if (categoryIds.length > 0 && productIds.length > 0) {
      const rowsToInsert: any[] = [];
      productIds.forEach((pid) => {
        categoryIds.forEach((cid) => {
          rowsToInsert.push({
            product_id: pid,
            category_id: cid,
            display_order: displayOrder,
            company_id: targetCompanyId,
          });
        });
      });

      await supabase.from("product_categories").insert(rowsToInsert);
    }
  } catch (e) {
    // Ignora se a tabela nao existir
  }

  return true;
}
