/**
 * Módulo de Metas Semanais da Smoking Pods (SMK System)
 * Fuso Horário Oficial: America/Sao_Paulo (UTC-3)
 * Divide o ciclo oficial (14 → 13) em 4 semanas estratégicas de operação.
 */

import { supabase } from "@/lib/supabase";
import { type CycleDefinition, getSaoPauloDateParts } from "./financialCycles";

export const SYSTEM_WEEKLY_GOALS_KEY = "__SYSTEM_SMK_WEEKLY_GOALS__";
const DEFAULT_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

export interface WeekDefinition {
  weekNumber: 1 | 2 | 3 | 4;
  label: string; // Ex: "Semana 1"
  dateRangeFormatted: string; // Ex: "14/09 → 20/09"
  startDate: Date;
  endDate: Date;
  startDateKey: string; // "YYYY-MM-DD"
  endDateKey: string; // "YYYY-MM-DD"
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  isFutureWeek: boolean;
}

export interface WeekPerformance {
  week: WeekDefinition;
  goal: number;
  revenue: number;
  profit: number;
  ordersCount: number;
  podsSold: number;
  percentage: number;
  status: "CURRENT" | "ACHIEVED" | "BELOW" | "FUTURE";
}

export interface WeeklyGoalsConfig {
  monthlyTarget: number;
  week1: number;
  week2: number;
  week3: number;
  week4: number;
  cycleId?: string;
  updatedAt?: string;
}

// Meta padrão oficial da empresa (R$ 7.000 mensal / R$ 1.750 por semana)
export const DEFAULT_WEEKLY_GOALS: WeeklyGoalsConfig = {
  monthlyTarget: 7000,
  week1: 1750,
  week2: 1750,
  week3: 1750,
  week4: 1750,
};

/**
 * Divide o ciclo financeiro (14 → 13) nas 4 semanas oficiais de vendas
 */
export function getCycleWeeks(cycle: CycleDefinition): WeekDefinition[] {
  const [startD, startM, startY] = cycle.startDateStr.split("/").map(Number);
  const [endD, endM, endY] = cycle.endDateStr.split("/").map(Number);

  // Início oficial: dia 14 às 00:00:00
  const cycleStart = new Date(startY, startM - 1, startD, 0, 0, 0, 0);
  // Fim oficial: dia 13 às 23:59:59.999
  const cycleEnd = new Date(endY, endM - 1, endD, 23, 59, 59, 999);

  const now = new Date();
  const nowSP = getSaoPauloDateParts(now);
  const todayStr = `${nowSP.year}-${String(nowSP.month).padStart(2, "0")}-${String(nowSP.day).padStart(2, "0")}`;

  const formatShort = (d: Date) => {
    const parts = getSaoPauloDateParts(d);
    return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`;
  };

  const toDateKey = (d: Date) => {
    const parts = getSaoPauloDateParts(d);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  };

  // Semana 1: Dias 1 a 7 do ciclo (14 a 20) -> 7 dias
  const w1Start = new Date(cycleStart);
  const w1End = new Date(startY, startM - 1, startD + 6, 23, 59, 59, 999);

  // Semana 2: Dias 8 a 14 do ciclo (21 a 27) -> 7 dias
  const w2Start = new Date(startY, startM - 1, startD + 7, 0, 0, 0, 0);
  const w2End = new Date(startY, startM - 1, startD + 13, 23, 59, 59, 999);

  // Semana 3: Dias 15 a 21 do ciclo (28 a 04/03 do mês seguinte) -> 7 dias
  const w3Start = new Date(startY, startM - 1, startD + 14, 0, 0, 0, 0);
  const w3End = new Date(startY, startM - 1, startD + 20, 23, 59, 59, 999);

  // Semana 4: Dias restantes até o fechamento oficial (dia 13) -> 8 a 9 dias
  const w4Start = new Date(startY, startM - 1, startD + 21, 0, 0, 0, 0);
  const w4End = new Date(cycleEnd);

  const rawWeeks = [
    { num: 1 as const, start: w1Start, end: w1End },
    { num: 2 as const, start: w2Start, end: w2End },
    { num: 3 as const, start: w3Start, end: w3End },
    { num: 4 as const, start: w4Start, end: w4End },
  ];

  return rawWeeks.map(({ num, start, end }) => {
    const sKey = toDateKey(start);
    const eKey = toDateKey(end);

    const isCurrentWeek = cycle.isCurrent && todayStr >= sKey && todayStr <= eKey;
    const isPastWeek = todayStr > eKey;
    const isFutureWeek = todayStr < sKey;

    return {
      weekNumber: num,
      label: `Semana ${num}`,
      dateRangeFormatted: `${formatShort(start)} → ${formatShort(end)}`,
      startDate: start,
      endDate: end,
      startDateKey: sKey,
      endDateKey: eKey,
      isCurrentWeek,
      isPastWeek,
      isFutureWeek,
    };
  });
}

/**
 * Chave de armazenamento persistente multi-tenant (v2 sincronizada com Supabase)
 */
function getStorageKey(companyId?: string, cycleId?: string): string {
  const cId = companyId || DEFAULT_COMPANY_ID;
  const cyc = cycleId || "current";
  return `smk_weekly_goals_v2_${cId}_${cyc}`;
}

function getLegacyStorageKey(companyId?: string, cycleId?: string): string {
  const cId = companyId || "default";
  const cyc = cycleId || "current";
  return `smk_weekly_goals_${cId}_${cyc}`;
}

function saveLocalWeeklyGoalsCache(goals: WeeklyGoalsConfig, companyId?: string, cycleId?: string): void {
  try {
    const key = getStorageKey(companyId, cycleId);
    localStorage.setItem(key, JSON.stringify(goals));

    // Também mantém o planejador de reposição sincronizado no mesmo navegador
    const rawPlannerGoals = localStorage.getItem("smk_financial_goals_v1");
    const parsedPlanner = rawPlannerGoals ? JSON.parse(rawPlannerGoals) : {};
    localStorage.setItem(
      "smk_financial_goals_v1",
      JSON.stringify({
        ...parsedPlanner,
        monthlyRevenueGoal: goals.monthlyTarget,
      })
    );
  } catch (e) {
    console.warn("Erro ao atualizar cache local de metas semanais:", e);
  }
}

/**
 * Carrega a configuração de metas semanais do cache local (com migração limpa)
 */
export function loadWeeklyGoals(companyId?: string, cycleId?: string): WeeklyGoalsConfig {
  try {
    const key = getStorageKey(companyId, cycleId);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.monthlyTarget === "number" && typeof parsed.week1 === "number") {
        return parsed;
      }
    }

    // Migrar configuração personalizada da v1 caso não seja o antigo fallback de 8000/2000
    const legacyKeys = [
      getLegacyStorageKey(companyId, cycleId),
      getLegacyStorageKey("default", cycleId),
    ];
    for (const lKey of legacyKeys) {
      const legacyRaw = localStorage.getItem(lKey);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (
          typeof parsed.monthlyTarget === "number" &&
          typeof parsed.week1 === "number" &&
          !(parsed.monthlyTarget === 8000 && parsed.week1 === 2000)
        ) {
          saveLocalWeeklyGoalsCache(parsed, companyId, cycleId);
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn("Erro ao ler metas semanais do localStorage:", e);
  }
  return { ...DEFAULT_WEEKLY_GOALS };
}

/**
 * Persiste as metas semanais da empresa no Supabase (compartilhado entre todos os sócios e computadores)
 */
export async function persistWeeklyGoalsToSupabase(
  goals: WeeklyGoalsConfig,
  companyId?: string,
  cycleId?: string
): Promise<boolean> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const targetCycleId = cycleId || "current";

  const payloadItem: WeeklyGoalsConfig = {
    monthlyTarget: Number(goals.monthlyTarget) || 7000,
    week1: Number(goals.week1) || 1750,
    week2: Number(goals.week2) || 1750,
    week3: Number(goals.week3) || 1750,
    week4: Number(goals.week4) || 1750,
    cycleId: targetCycleId,
    updatedAt: goals.updatedAt || new Date().toISOString(),
  };

  try {
    const { data: existingRows, error: fetchErr } = await supabase
      .from("smoking_orders")
      .select("id, items")
      .eq("client_phone", SYSTEM_WEEKLY_GOALS_KEY)
      .eq("company_id", targetCompanyId)
      .limit(1);

    if (fetchErr) {
      console.warn("Aviso ao buscar metas semanais no Supabase:", fetchErr.message);
      return false;
    }

    let currentItems: any[] = [];
    let existingRowId: string | null = null;

    if (existingRows && existingRows.length > 0) {
      existingRowId = existingRows[0].id;
      if (Array.isArray(existingRows[0].items)) {
        currentItems = existingRows[0].items;
      }
    }

    // Remove registro anterior do mesmo ciclo e coloca o novo no topo (índice 0 = mais recente da empresa)
    const filteredItems = currentItems.filter(
      (item: any) => item && item.cycleId && item.cycleId !== targetCycleId
    );
    const updatedItems = [payloadItem, ...filteredItems].slice(0, 24);

    if (existingRowId) {
      const { error: updErr } = await supabase
        .from("smoking_orders")
        .update({ items: updatedItems })
        .eq("id", existingRowId);
      if (updErr) {
        console.warn("Aviso ao atualizar metas semanais no Supabase:", updErr.message);
        return false;
      }
    } else {
      const { error: insErr } = await supabase
        .from("smoking_orders")
        .insert({
          client_phone: SYSTEM_WEEKLY_GOALS_KEY,
          client_name: "System Config Weekly Goals",
          shipping_address: "CONFIG",
          items: updatedItems,
          total_amount: 0,
          company_id: targetCompanyId,
        });
      if (insErr) {
        console.warn("Aviso ao inserir metas semanais no Supabase:", insErr.message);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.warn("Exceção ao persistir metas semanais no Supabase:", err);
    return false;
  }
}

/**
 * Extrai as metas semanais diretamente da lista de registros de smoking_orders do Supabase
 * Se ainda não houver registro no banco para a empresa, inicializa no Supabase automaticamente.
 */
export function syncWeeklyGoalsFromOrders(
  rawOrders: any[],
  companyId?: string,
  cycleId?: string
): WeeklyGoalsConfig {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const targetCycleId = cycleId || "current";

  if (Array.isArray(rawOrders)) {
    const configRow = rawOrders.find(
      (o) => o && o.client_phone === SYSTEM_WEEKLY_GOALS_KEY
    );

    if (configRow && Array.isArray(configRow.items) && configRow.items.length > 0) {
      const exactCycleMatch = configRow.items.find(
        (it: any) =>
          it &&
          it.cycleId === targetCycleId &&
          typeof it.monthlyTarget === "number" &&
          typeof it.week1 === "number"
      );
      const latestMatch = configRow.items.find(
        (it: any) =>
          it &&
          typeof it.monthlyTarget === "number" &&
          typeof it.week1 === "number"
      );

      const chosen = exactCycleMatch || latestMatch;
      if (chosen) {
        const synced: WeeklyGoalsConfig = {
          monthlyTarget: Number(chosen.monthlyTarget),
          week1: Number(chosen.week1),
          week2: Number(chosen.week2),
          week3: Number(chosen.week3),
          week4: Number(chosen.week4),
          cycleId: chosen.cycleId || targetCycleId,
          updatedAt: chosen.updatedAt,
        };
        saveLocalWeeklyGoalsCache(synced, targetCompanyId, targetCycleId);
        return synced;
      }
    }
  }

  // Caso ainda não exista no Supabase para esta empresa, usa a meta local/padrão (7000 / 1750) e grava no Supabase
  const fallbackGoals = loadWeeklyGoals(targetCompanyId, targetCycleId);
  saveLocalWeeklyGoalsCache(fallbackGoals, targetCompanyId, targetCycleId);
  persistWeeklyGoalsToSupabase(fallbackGoals, targetCompanyId, targetCycleId).catch(() => {});
  return fallbackGoals;
}

/**
 * Salva a configuração de metas semanais (no cache local e no Supabase para todos os sócios) e dispara evento global
 */
export async function saveWeeklyGoals(
  goals: WeeklyGoalsConfig,
  companyId?: string,
  cycleId?: string
): Promise<void> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const targetCycleId = cycleId || "current";

  const toSave: WeeklyGoalsConfig = {
    ...goals,
    cycleId: targetCycleId,
    updatedAt: new Date().toISOString(),
  };

  saveLocalWeeklyGoalsCache(toSave, targetCompanyId, targetCycleId);

  // Notificar abas e componentes locais imediatamente
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("smk-weekly-goals-updated", { detail: toSave }));
  }

  // Persistir globalmente no Supabase para sincronizar no Vercel entre todos os sócios da empresa
  await persistWeeklyGoalsToSupabase(toSave, targetCompanyId, targetCycleId);
}

/**
 * Calcula o desempenho realizado de cada uma das 4 semanas com base nos pedidos reais do ciclo
 */
export function calculateWeeklyPerformances(
  cycle: CycleDefinition,
  orders: any[],
  goals: WeeklyGoalsConfig,
  persistedCosts: Record<string, number> = {}
): WeekPerformance[] {
  const weeks = getCycleWeeks(cycle);

  return weeks.map((w) => {
    // Filtrar pedidos que caem dentro desta semana pelo fuso America/Sao_Paulo
    const weekOrders = (orders || []).filter((o) => {
      if (!o.created_at) return false;
      const p = getSaoPauloDateParts(o.created_at);
      const dateKey = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
      return dateKey >= w.startDateKey && dateKey <= w.endDateKey;
    });

    let weekRev = 0;
    let weekCmv = 0;
    let weekPods = 0;
    let weekNationalShippingMargin = 0;

    for (const o of weekOrders) {
      const items = Array.isArray(o.items) ? o.items : [];
      if (items.length > 0) {
        for (const it of items) {
          const qty = Number(it.quantity) || 1;
          const price = Number(it.price || it.unit_price) || 0;
          let cost = Number(it.cost_price || it.costPrice) || 0;
          if (!cost && it.product_id && persistedCosts[it.product_id]) {
            cost = persistedCosts[it.product_id];
          }
          if (!cost) cost = 65;

          weekRev += qty * price;
          weekCmv += qty * cost;
          weekPods += qty;
        }
      } else {
        weekRev += Number(o.total_amount) || 0;
        weekCmv += (Number(o.total_amount) || 0) * 0.45;
        weekPods += 1;
      }

      // Se for pedido nacional, somar a margem do frete ao lucro
      const isNational = (Array.isArray(o.items) && o.items.some((i: any) => i?.is_national || i?.isNational)) ||
        (typeof o.shipping_address === "string" && o.shipping_address.includes("[ENVIO NACIONAL"));
      if (isNational) {
        const fee = Number(o.shipping_fee) || 0;
        let costReal = 0;
        if (Array.isArray(o.items)) {
          for (const it of o.items) {
            if (typeof it?.shipping_cost_real === "number") {
              costReal = it.shipping_cost_real;
            }
          }
        }
        weekNationalShippingMargin += (fee - costReal);
      }
    }

    const weekProfit = Number(((weekRev - weekCmv) + weekNationalShippingMargin).toFixed(2));
    const goalForWeek = goals[`week${w.weekNumber}`] || 1750;
    const percentage = goalForWeek > 0 ? Math.round((weekRev / goalForWeek) * 100) : 0;

    let status: WeekPerformance["status"] = "FUTURE";
    if (w.isCurrentWeek) {
      status = "CURRENT";
    } else if (w.isPastWeek) {
      status = weekRev >= goalForWeek ? "ACHIEVED" : "BELOW";
    } else {
      status = "FUTURE";
    }

    return {
      week: w,
      goal: goalForWeek,
      revenue: Number(weekRev.toFixed(2)),
      profit: weekProfit,
      ordersCount: weekOrders.length,
      podsSold: weekPods,
      percentage,
      status,
    };
  });
}
