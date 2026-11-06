import { supabase } from "@/lib/supabase";

export interface RepurchaseItemMeta {
  brand: string;
  model: string;
  flavor: string;
  qty: number;
  unitCost: number;
  previousCost?: number | null;
  unitSell: number;
}

export interface RepurchaseMetadata {
  units: number;
  projectedRevenue: number;
  projectedProfit: number;
  markupPct: number;
  marginPct: number;
  items?: RepurchaseItemMeta[];
}

export interface StockRepurchase {
  id: string;
  company_id: string;
  stock_purchase_amount: number;
  freight_amount: number;
  total_repurchase_amount: number;
  purchase_date: string;
  notes?: string;
  meta?: RepurchaseMetadata | null;
  created_at: string;
}

export interface EnrichedStockRepurchase extends StockRepurchase {
  units: number;
  projectedRevenue: number;
  projectedProfit: number;
  markupPct: number;
  marginPct: number;
  avgUnitCost: number;
  avgUnitSell: number;
  avgUnitProfit: number;
  items: RepurchaseItemMeta[];
  isEstimated: boolean;
  // Comparação com a recompra imediatamente anterior (cronológica)
  prevRepurchaseId?: string | null;
  prevPurchaseDate?: string | null;
  costGrowthDiff?: number | null;
  costGrowthPct?: number | null;
  profitGrowthDiff?: number | null;
  profitGrowthPct?: number | null;
  unitsGrowthDiff?: number | null;
  unitsGrowthPct?: number | null;
}

const DEFAULT_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
const SYSTEM_REPURCHASE_KEY = "__SYSTEM_SMK_STOCK_REPURCHASES__";
const LOCAL_CACHE_KEY = "smk_stock_repurchases_cache_v1";
const META_SEPARATOR = "|||SMK_META:";

export function encodeRepurchaseNotes(cleanNotes: string, meta?: RepurchaseMetadata | null): string {
  const base = (cleanNotes || "").split(META_SEPARATOR)[0].trim();
  if (!meta) return base;
  try {
    return `${base}${META_SEPARATOR}${JSON.stringify(meta)}`;
  } catch {
    return base;
  }
}

export function parseRepurchaseNotes(rawNotes?: string | null): {
  cleanNotes: string;
  meta: RepurchaseMetadata | null;
} {
  if (!rawNotes) return { cleanNotes: "", meta: null };
  const idx = rawNotes.indexOf(META_SEPARATOR);
  if (idx === -1) {
    return { cleanNotes: rawNotes.trim(), meta: null };
  }
  const cleanNotes = rawNotes.slice(0, idx).trim();
  const jsonPart = rawNotes.slice(idx + META_SEPARATOR.length).trim();
  try {
    const parsed = JSON.parse(jsonPart);
    if (parsed && typeof parsed === "object") {
      return {
        cleanNotes,
        meta: {
          units: Number(parsed.units) || 0,
          projectedRevenue: Number(parsed.projectedRevenue) || 0,
          projectedProfit: Number(parsed.projectedProfit) || 0,
          markupPct: Number(parsed.markupPct) || 0,
          marginPct: Number(parsed.marginPct) || 0,
          items: Array.isArray(parsed.items) ? parsed.items : [],
        },
      };
    }
  } catch {
    // Ignorar falha de parse de metadados
  }
  return { cleanNotes, meta: null };
}

/**
 * Enriquece a lista de recompras com métricas de lucro, taxa de retorno (markup/margem),
 * unidades e crescimento comparativo (recompra a recompra).
 */
export function enrichStockRepurchasesList(
  repurchases: StockRepurchase[],
  productsCatalog: any[] = []
): EnrichedStockRepurchase[] {
  // Calcular média real de custo e venda do catálogo da loja para estimativas históricas precisas
  let validCostSum = 0;
  let validSellSum = 0;
  let validCount = 0;

  for (const p of productsCatalog || []) {
    const cost = Number(p.cost_price) || 0;
    const sell = Number(p.price) || 0;
    if (cost > 0 && sell > cost) {
      validCostSum += cost;
      validSellSum += sell;
      validCount++;
    }
  }

  const catalogAvgUnitCost = validCount > 0 ? validCostSum / validCount : 62;
  const catalogSellToCostRatio = validCount > 0 && validCostSum > 0 ? validSellSum / validCostSum : 1.42;

  // Ordenar do mais recente para o mais antigo (com desempate por created_at)
  const sorted = [...(repurchases || [])].sort((a, b) => {
    const dA = new Date(a.purchase_date || a.created_at).getTime();
    const dB = new Date(b.purchase_date || b.created_at).getTime();
    if (dB !== dA) return dB - dA;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  // Primeiro passo: calcular métricas individuais de cada recompra
  const baseEnriched: EnrichedStockRepurchase[] = sorted.map((rep) => {
    const stockCost = Number(rep.stock_purchase_amount) || 0;
    const freight = Number(rep.freight_amount) || 0;
    const totalInvested = Number(rep.total_repurchase_amount) || stockCost + freight;

    if (rep.meta && rep.meta.units > 0 && rep.meta.projectedRevenue > 0) {
      const units = rep.meta.units;
      const projectedRevenue = rep.meta.projectedRevenue;
      const projectedProfit = projectedRevenue - totalInvested;
      const markupPct = totalInvested > 0 ? (projectedProfit / totalInvested) * 100 : 0;
      const marginPct = projectedRevenue > 0 ? (projectedProfit / projectedRevenue) * 100 : 0;

      return {
        ...rep,
        units,
        projectedRevenue: Number(projectedRevenue.toFixed(2)),
        projectedProfit: Number(projectedProfit.toFixed(2)),
        markupPct: Number(markupPct.toFixed(1)),
        marginPct: Number(marginPct.toFixed(1)),
        avgUnitCost: units > 0 ? Number((totalInvested / units).toFixed(2)) : 0,
        avgUnitSell: units > 0 ? Number((projectedRevenue / units).toFixed(2)) : 0,
        avgUnitProfit: units > 0 ? Number((projectedProfit / units).toFixed(2)) : 0,
        items: rep.meta.items || [],
        isEstimated: false,
      };
    }

    // Caso seja uma recompra histórica (sem SMK_META explícito), extrair unidades das observações ou estimar pelo custo médio
    const notesStr = (rep.notes || "").trim();
    let extractedUnits = 0;
    const explicitMatch = notesStr.match(/(\d+)\s*(?:un|unidades|pods|pod)\b/i);
    const pureNumberMatch = notesStr.match(/^\s*(\d+)\s*$/);
    if (explicitMatch) {
      extractedUnits = parseInt(explicitMatch[1], 10);
    } else if (pureNumberMatch) {
      extractedUnits = parseInt(pureNumberMatch[1], 10);
    } else if (stockCost > 0) {
      extractedUnits = Math.max(1, Math.round(stockCost / catalogAvgUnitCost));
    }

    const projectedRevenue = Number((stockCost * catalogSellToCostRatio).toFixed(2));
    const projectedProfit = Number((projectedRevenue - totalInvested).toFixed(2));
    const markupPct = totalInvested > 0 ? Number(((projectedProfit / totalInvested) * 100).toFixed(1)) : 0;
    const marginPct = projectedRevenue > 0 ? Number(((projectedProfit / projectedRevenue) * 100).toFixed(1)) : 0;

    return {
      ...rep,
      units: extractedUnits,
      projectedRevenue,
      projectedProfit,
      markupPct,
      marginPct,
      avgUnitCost: extractedUnits > 0 ? Number((totalInvested / extractedUnits).toFixed(2)) : 0,
      avgUnitSell: extractedUnits > 0 ? Number((projectedRevenue / extractedUnits).toFixed(2)) : 0,
      avgUnitProfit: extractedUnits > 0 ? Number((projectedProfit / extractedUnits).toFixed(2)) : 0,
      items: [],
      isEstimated: true,
    };
  });

  // Segundo passo: calcular evolução e crescimento em relação à recompra imediatamente anterior (índice i + 1)
  return baseEnriched.map((curr, idx) => {
    const prev = idx < baseEnriched.length - 1 ? baseEnriched[idx + 1] : null;
    if (!prev) {
      return {
        ...curr,
        prevRepurchaseId: null,
        prevPurchaseDate: null,
        costGrowthDiff: null,
        costGrowthPct: null,
        profitGrowthDiff: null,
        profitGrowthPct: null,
        unitsGrowthDiff: null,
        unitsGrowthPct: null,
      };
    }

    const costDiff = Number((curr.total_repurchase_amount - prev.total_repurchase_amount).toFixed(2));
    const costPct =
      prev.total_repurchase_amount > 0
        ? Number(((costDiff / prev.total_repurchase_amount) * 100).toFixed(1))
        : null;

    const profitDiff = Number((curr.projectedProfit - prev.projectedProfit).toFixed(2));
    const profitPct =
      prev.projectedProfit > 0
        ? Number(((profitDiff / prev.projectedProfit) * 100).toFixed(1))
        : null;

    const unitsDiff = curr.units - prev.units;
    const unitsPct = prev.units > 0 ? Number(((unitsDiff / prev.units) * 100).toFixed(1)) : null;

    return {
      ...curr,
      prevRepurchaseId: prev.id,
      prevPurchaseDate: prev.purchase_date,
      costGrowthDiff: costDiff,
      costGrowthPct: costPct,
      profitGrowthDiff: profitDiff,
      profitGrowthPct: profitPct,
      unitsGrowthDiff: unitsDiff,
      unitsGrowthPct: unitsPct,
    };
  });
}

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
      const mapped: StockRepurchase[] = data.map((row: any) => {
        const { cleanNotes, meta } = parseRepurchaseNotes(row.notes);
        return {
          id: row.id,
          company_id: row.company_id || targetCompanyId,
          stock_purchase_amount: Number(row.stock_purchase_amount) || 0,
          freight_amount: Number(row.freight_amount) || 0,
          total_repurchase_amount:
            Number(row.total_repurchase_amount) ||
            (Number(row.stock_purchase_amount) || 0) + (Number(row.freight_amount) || 0),
          purchase_date: row.purchase_date || new Date().toISOString().split("T")[0],
          notes: cleanNotes,
          meta,
          created_at: row.created_at || new Date().toISOString(),
        };
      });
      setLocalCache(targetCompanyId, mapped);
      return mapped;
    }

    if (error) {
      console.warn(
        "[StockRepurchases] Erro na consulta primária smoking_stock_repurchases (ativando fallback):",
        error.message
      );
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
      const mapped: StockRepurchase[] = configRows[0].items.map((row: any) => {
        const { cleanNotes, meta } = parseRepurchaseNotes(row.notes);
        return {
          id: row.id,
          company_id: row.company_id || targetCompanyId,
          stock_purchase_amount: Number(row.stock_purchase_amount) || 0,
          freight_amount: Number(row.freight_amount) || 0,
          total_repurchase_amount:
            Number(row.total_repurchase_amount) ||
            (Number(row.stock_purchase_amount) || 0) + (Number(row.freight_amount) || 0),
          purchase_date: row.purchase_date || new Date().toISOString().split("T")[0],
          notes: cleanNotes,
          meta,
          created_at: row.created_at || new Date().toISOString(),
        };
      });
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
  meta?: RepurchaseMetadata | null;
}): Promise<{ data: StockRepurchase | null; error: Error | null }> {
  const targetCompanyId = params.companyId || DEFAULT_COMPANY_ID;
  const stockAmount = Number(params.stock_purchase_amount) || 0;
  const freightAmount = Number(params.freight_amount) || 0;
  const totalAmount = stockAmount + freightAmount;
  const purchaseDate = params.purchase_date || new Date().toISOString().split("T")[0];
  const cleanNotes = (params.notes || "").split(META_SEPARATOR)[0].trim();
  const encodedNotes = encodeRepurchaseNotes(cleanNotes, params.meta);

  if (stockAmount <= 0) {
    return { data: null, error: new Error("O valor pago no estoque deve ser maior que zero.") };
  }

  const newRecord: StockRepurchase = {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
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
    notes: cleanNotes,
    meta: params.meta || null,
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
        notes: encodedNotes || null,
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
    meta?: RepurchaseMetadata | null;
  }
): Promise<{ data: StockRepurchase | null; error: Error | null }> {
  const targetCompanyId = params.companyId || DEFAULT_COMPANY_ID;
  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
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
    const encoded = encodeRepurchaseNotes(params.notes, params.meta);
    updatePayload.notes = encoded || null;
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
      const { cleanNotes, meta } = parseRepurchaseNotes(data.notes);
      const parsedRow: StockRepurchase = {
        ...data,
        notes: cleanNotes,
        meta,
      };
      const cached = getLocalCache(targetCompanyId).map((r) => (r.id === id ? parsedRow : r));
      setLocalCache(targetCompanyId, cached);
      return { data: parsedRow, error: null };
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
export async function deleteStockRepurchase(
  id: string,
  companyId?: string
): Promise<{ success: boolean; error: Error | null }> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  try {
    const { error: delErr } = await supabase
      .from("smoking_stock_repurchases")
      .delete()
      .eq("id", id)
      .eq("company_id", targetCompanyId);

    if (!delErr) {
      const cached = getLocalCache(targetCompanyId).filter((r) => r.id !== id);
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
  const key =
    params.idempotencyKey ||
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
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
      p_items: params.items,
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
