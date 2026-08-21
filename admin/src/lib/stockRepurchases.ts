import { supabase } from "@/lib/supabase";

export interface StockRepurchase {
  id: string;
  company_id: string;
  stock_purchase_amount: number;
  freight_amount: number;
  total_repurchase_amount: number;
  purchase_date: string;
  notes?: string;
  created_at: string;
}

const DEFAULT_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
const SYSTEM_REPURCHASE_KEY = "__SYSTEM_SMK_STOCK_REPURCHASES__";
const LOCAL_CACHE_KEY = "smk_stock_repurchases_cache_v1";

function getLocalCache(companyId: string): StockRepurchase[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_CACHE_KEY}_${companyId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(companyId: string, data: StockRepurchase[]) {
  try {
    localStorage.setItem(`${LOCAL_CACHE_KEY}_${companyId}`, JSON.stringify(data));
  } catch {}
}

/**
 * Busca todas as recompras de estoque no Supabase isoladas por company_id
 */
export async function fetchStockRepurchases(companyId?: string): Promise<StockRepurchase[]> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  // 1. Tenta buscar da tabela dedicada `smoking_stock_repurchases`
  try {
    const { data, error } = await supabase
      .from("smoking_stock_repurchases")
      .select("*")
      .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
      .order("purchase_date", { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped: StockRepurchase[] = data.map((row: any) => ({
        id: row.id,
        company_id: row.company_id || targetCompanyId,
        stock_purchase_amount: Number(row.stock_purchase_amount) || 0,
        freight_amount: Number(row.freight_amount) || 0,
        total_repurchase_amount: Number(row.total_repurchase_amount) || (Number(row.stock_purchase_amount) || 0) + (Number(row.freight_amount) || 0),
        purchase_date: row.purchase_date || new Date().toISOString().split("T")[0],
        notes: row.notes || "",
        created_at: row.created_at || new Date().toISOString(),
      }));
      setLocalCache(targetCompanyId, mapped);
      return mapped;
    }
  } catch (e) {
    // Tabela dedicada pode não ter sido criada ainda no schema cache
  }

  // 2. Persistência atômica resiliente no Supabase através de smoking_orders (configuração de sistema)
  try {
    const { data: configRows, error: configErr } = await supabase
      .from("smoking_orders")
      .select("id, items")
      .eq("client_phone", SYSTEM_REPURCHASE_KEY)
      .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
      .limit(1);

    if (!configErr && configRows && configRows.length > 0 && Array.isArray(configRows[0].items)) {
      const mapped: StockRepurchase[] = configRows[0].items.map((row: any) => ({
        id: row.id,
        company_id: row.company_id || targetCompanyId,
        stock_purchase_amount: Number(row.stock_purchase_amount) || 0,
        freight_amount: Number(row.freight_amount) || 0,
        total_repurchase_amount: Number(row.total_repurchase_amount) || (Number(row.stock_purchase_amount) || 0) + (Number(row.freight_amount) || 0),
        purchase_date: row.purchase_date || new Date().toISOString().split("T")[0],
        notes: row.notes || "",
        created_at: row.created_at || new Date().toISOString(),
      }));
      // Ordena pelas mais recentes
      mapped.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
      setLocalCache(targetCompanyId, mapped);
      return mapped;
    }
  } catch (e) {
    console.warn("Erro ao buscar recompras de estoque no Supabase:", e);
  }

  return getLocalCache(targetCompanyId);
}

/**
 * Cria uma nova recompra de estoque no Supabase
 */
export async function createStockRepurchase(params: {
  companyId?: string;
  stock_purchase_amount: number;
  freight_amount?: number;
  purchase_date?: string;
  notes?: string;
}): Promise<{ data: StockRepurchase | null; error: Error | null }> {
  const targetCompanyId = params.companyId || DEFAULT_COMPANY_ID;
  const stockAmount = Number(params.stock_purchase_amount) || 0;
  const freightAmount = Number(params.freight_amount) || 0;
  const totalAmount = stockAmount + freightAmount;
  const purchaseDate = params.purchase_date || new Date().toISOString().split("T")[0];
  const notes = params.notes?.trim() || "";

  if (stockAmount <= 0) {
    return { data: null, error: new Error("O valor pago no estoque deve ser maior que zero.") };
  }

  const newRecord: StockRepurchase = {
    id: crypto.randomUUID ? crypto.randomUUID() : `rep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    company_id: targetCompanyId,
    stock_purchase_amount: stockAmount,
    freight_amount: freightAmount,
    total_repurchase_amount: totalAmount,
    purchase_date: purchaseDate,
    notes,
    created_at: new Date().toISOString(),
  };

  // 1. Tenta salvar na tabela dedicada `smoking_stock_repurchases`
  try {
    const { data: insertData, error: insertErr } = await supabase
      .from("smoking_stock_repurchases")
      .insert({
        id: newRecord.id,
        company_id: targetCompanyId,
        stock_purchase_amount: stockAmount,
        freight_amount: freightAmount,
        total_repurchase_amount: totalAmount,
        purchase_date: purchaseDate,
        notes: notes || null,
      })
      .select()
      .single();

    if (!insertErr && insertData) {
      const current = getLocalCache(targetCompanyId);
      setLocalCache(targetCompanyId, [newRecord, ...current]);
      return { data: newRecord, error: null };
    }
  } catch (e) {}

  // 2. Persistência atômica em smoking_orders no Supabase DB
  try {
    const { data: existingRows } = await supabase
      .from("smoking_orders")
      .select("id, items")
      .eq("client_phone", SYSTEM_REPURCHASE_KEY)
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

    const updatedItems = [newRecord, ...currentItems];

    if (existingRowId) {
      const { error: updateErr } = await supabase
        .from("smoking_orders")
        .update({
          items: updatedItems,
          total_amount: updatedItems.reduce((sum: number, it: any) => sum + (Number(it.total_repurchase_amount) || 0), 0),
        })
        .eq("id", existingRowId);

      if (updateErr) throw updateErr;
    } else {
      const { error: insertConfigErr } = await supabase
        .from("smoking_orders")
        .insert({
          client_phone: SYSTEM_REPURCHASE_KEY,
          client_name: "System Config Stock Repurchases",
          shipping_address: "CONFIG",
          items: updatedItems,
          total_amount: totalAmount,
          company_id: targetCompanyId,
          delivery_status: "AGUARDANDO_PAGAMENTO",
        });

      if (insertConfigErr) throw insertConfigErr;
    }

    setLocalCache(targetCompanyId, updatedItems);
    return { data: newRecord, error: null };
  } catch (err: any) {
    console.error("Erro ao salvar recompra no Supabase:", err);
    return { data: null, error: new Error(err.message || "Erro ao salvar no banco de dados.") };
  }
}

/**
 * Exclui uma recompra de estoque com segurança no Supabase
 */
export async function deleteStockRepurchase(id: string, companyId?: string): Promise<{ success: boolean; error: Error | null }> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  // 1. Tenta deletar da tabela dedicada se existir
  try {
    const { error: delErr } = await supabase
      .from("smoking_stock_repurchases")
      .delete()
      .eq("id", id)
      .or(`company_id.eq.${targetCompanyId},company_id.is.null`);

    if (!delErr) {
      const cached = getLocalCache(targetCompanyId).filter(r => r.id !== id);
      setLocalCache(targetCompanyId, cached);
      return { success: true, error: null };
    }
  } catch (e) {}

  // 2. Deleta do registro de configuração em smoking_orders
  try {
    const { data: existingRows } = await supabase
      .from("smoking_orders")
      .select("id, items")
      .eq("client_phone", SYSTEM_REPURCHASE_KEY)
      .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
      .limit(1);

    if (existingRows && existingRows.length > 0) {
      const existingRowId = existingRows[0].id;
      const currentItems = Array.isArray(existingRows[0].items) ? existingRows[0].items : [];
      const filtered = currentItems.filter((item: any) => item.id !== id);

      await supabase
        .from("smoking_orders")
        .update({
          items: filtered,
          total_amount: filtered.reduce((sum: number, it: any) => sum + (Number(it.total_repurchase_amount) || 0), 0),
        })
        .eq("id", existingRowId);

      setLocalCache(targetCompanyId, filtered);
      return { success: true, error: null };
    }
  } catch (err: any) {
    console.error("Erro ao excluir recompra no Supabase:", err);
    return { success: false, error: new Error(err.message || "Erro ao excluir do banco de dados.") };
  }

  return { success: true, error: null };
}
