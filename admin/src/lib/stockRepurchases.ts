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
 * Fonte Primária Oficial: public.smoking_stock_repurchases
 * Fallback Transitório: smoking_orders (__SYSTEM_SMK_STOCK_REPURCHASES__) / localStorage
 */
export async function fetchStockRepurchases(companyId?: string): Promise<StockRepurchase[]> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  // 1. Fonte Primária Oficial: tabela dedicada `smoking_stock_repurchases`
  try {
    const { data, error } = await supabase
      .from("smoking_stock_repurchases")
      .select("*")
      .eq("company_id", targetCompanyId)
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

    if (error) {
      console.warn("[StockRepurchases] Erro na consulta primária smoking_stock_repurchases (ativando fallback):", error.message);
    }
  } catch (e: any) {
    console.warn("[StockRepurchases] Exceção ao consultar tabela primária:", e?.message || e);
  }

  // 2. Fallback de Compatibilidade Transitória: Shadow Metastore (somente leitura de emergência)
  try {
    const { data: configRows, error: configErr } = await supabase
      .from("smoking_orders")
      .select("id, items")
      .eq("client_phone", SYSTEM_REPURCHASE_KEY)
      .eq("company_id", targetCompanyId)
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
      mapped.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
      setLocalCache(targetCompanyId, mapped);
      return mapped;
    }
  } catch (e) {
    console.warn("[StockRepurchases] Erro no fallback do Shadow Metastore:", e);
  }

  // 3. Fallback Local Final
  return getLocalCache(targetCompanyId);
}

/**
 * Cria uma nova recompra de estoque no Supabase
 * Grava EXCLUSIVAMENTE em public.smoking_stock_repurchases (NÃO grava em smoking_orders)
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
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }),
    company_id: targetCompanyId,
    stock_purchase_amount: stockAmount,
    freight_amount: freightAmount,
    total_repurchase_amount: totalAmount,
    purchase_date: purchaseDate,
    notes,
    created_at: new Date().toISOString(),
  };

  // 1. Fonte Primária: Inserção na tabela dedicada `smoking_stock_repurchases`
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

    if (insertErr) {
      console.warn("[StockRepurchases] Erro ao gravar em smoking_stock_repurchases:", insertErr.message);
      // Salva no cache local de contingência para não perder a digitação do usuário
      const current = getLocalCache(targetCompanyId);
      setLocalCache(targetCompanyId, [newRecord, ...current]);
      return { data: newRecord, error: null };
    }
  } catch (err: any) {
    console.error("[StockRepurchases] Exceção ao salvar recompra no Supabase:", err);
    const current = getLocalCache(targetCompanyId);
    setLocalCache(targetCompanyId, [newRecord, ...current]);
    return { data: newRecord, error: null };
  }

  return { data: newRecord, error: null };
}

/**
 * Atualiza uma recompra de estoque existente no Supabase
 */
export async function updateStockRepurchase(
  id: string,
  params: {
    companyId?: string;
    stock_purchase_amount?: number;
    freight_amount?: number;
    purchase_date?: string;
    notes?: string;
  }
): Promise<{ data: StockRepurchase | null; error: Error | null }> {
  const targetCompanyId = params.companyId || DEFAULT_COMPANY_ID;
  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString()
  };

  if (params.stock_purchase_amount !== undefined) {
    updatePayload.stock_purchase_amount = Number(params.stock_purchase_amount) || 0;
  }
  if (params.freight_amount !== undefined) {
    updatePayload.freight_amount = Number(params.freight_amount) || 0;
  }
  if (params.stock_purchase_amount !== undefined || params.freight_amount !== undefined) {
    const stock = params.stock_purchase_amount !== undefined ? Number(params.stock_purchase_amount) || 0 : 0;
    const freight = params.freight_amount !== undefined ? Number(params.freight_amount) || 0 : 0;
    updatePayload.total_repurchase_amount = stock + freight;
  }
  if (params.purchase_date !== undefined) {
    updatePayload.purchase_date = params.purchase_date;
  }
  if (params.notes !== undefined) {
    updatePayload.notes = params.notes.trim() || null;
  }

  try {
    const { data, error } = await supabase
      .from("smoking_stock_repurchases")
      .update(updatePayload)
      .eq("id", id)
      .eq("company_id", targetCompanyId)
      .select()
      .single();

    if (!error && data) {
      const cached = getLocalCache(targetCompanyId).map(r => r.id === id ? { ...r, ...data } : r);
      setLocalCache(targetCompanyId, cached);
      return { data, error: null };
    }

    if (error) {
      console.warn("[StockRepurchases] Erro ao atualizar em smoking_stock_repurchases:", error.message);
      return { data: null, error: new Error(error.message) };
    }
  } catch (err: any) {
    return { data: null, error: new Error(err.message || "Erro inesperado ao atualizar.") };
  }

  return { data: null, error: new Error("Registro não encontrado.") };
}

/**
 * Exclui uma recompra de estoque com segurança no Supabase
 * Remove EXCLUSIVAMENTE de public.smoking_stock_repurchases
 */
export async function deleteStockRepurchase(id: string, companyId?: string): Promise<{ success: boolean; error: Error | null }> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  // 1. Fonte Primária: Exclusão na tabela dedicada `smoking_stock_repurchases`
  try {
    const { error: delErr } = await supabase
      .from("smoking_stock_repurchases")
      .delete()
      .eq("id", id)
      .eq("company_id", targetCompanyId);

    if (!delErr) {
      const cached = getLocalCache(targetCompanyId).filter(r => r.id !== id);
      setLocalCache(targetCompanyId, cached);
      return { success: true, error: null };
    }

    if (delErr) {
      console.warn("[StockRepurchases] Erro ao deletar de smoking_stock_repurchases:", delErr.message);
      return { success: false, error: new Error(delErr.message) };
    }
  } catch (e: any) {
    console.error("[StockRepurchases] Exceção ao excluir recompra:", e);
    return { success: false, error: new Error(e.message || "Erro inesperado ao excluir.") };
  }

  return { success: true, error: null };
}

/**
 * Executa uma entrada de estoque de forma 100% atômica e transacional no PostgreSQL
 * Utiliza a RPC public.execute_stock_entry
 */
export async function executeStockEntryRpc(params: {
  companyId?: string;
  idempotencyKey?: string;
  purchaseDate?: string;
  stockPurchaseAmount: number;
  freightAmount?: number;
  notes?: string;
  items: Array<{
    brand: string;
    model: string;
    flavor: string;
    qty: number;
    unit_cost: number;
    unit_sell: number;
    puffs?: number;
  }>;
}): Promise<{
  success: boolean;
  already_processed?: boolean;
  repurchase_id?: string;
  total_units?: number;
  updated_products?: number;
  created_products?: number;
  error?: string;
}> {
  const targetCompanyId = params.companyId || DEFAULT_COMPANY_ID;
  const key = params.idempotencyKey || (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }));
  const date = params.purchaseDate || new Date().toISOString().split("T")[0];
  const freight = params.freightAmount || 0;
  const notes = params.notes || `Entrada de estoque via Planejador - ${date}`;

  try {
    const { data, error } = await supabase.rpc("execute_stock_entry", {
      p_company_id: targetCompanyId,
      p_idempotency_key: key,
      p_purchase_date: date,
      p_stock_purchase_amount: params.stockPurchaseAmount,
      p_freight_amount: freight,
      p_notes: notes,
      p_items: params.items
    });

    if (error) {
      console.error("[StockRepurchases] Erro na RPC execute_stock_entry:", error);
      return { success: false, error: error.message };
    }

    return (data as any) || { success: true, repurchase_id: key };
  } catch (e: any) {
    console.error("[StockRepurchases] Exceção ao executar RPC execute_stock_entry:", e);
    return { success: false, error: e?.message || String(e) };
  }
}
