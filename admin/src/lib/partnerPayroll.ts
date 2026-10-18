/**
 * Módulo de Folha de Pagamento, Salários dos Sócios & Reinvestimento (SMK System)
 * Persistência Híbrida Multi-Tenant: Cache Local Instantâneo + Sincronização Supabase por company_id
 */

import { supabase } from "@/lib/supabase";
import { type Partner, type PartnerTransaction } from "./partners";
import { getCycleForDate } from "./financialCycles";

export const SYSTEM_PAYROLL_CONFIG_KEY = "__SYSTEM_SMK_PAYROLL_CONFIG__";
const DEFAULT_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

export interface PayrollConfig {
  reinvestmentPct: number; // Padrão: 50%
  partnerPcts: Record<string, number>; // Ex: { "id_eduardo": 25, "id_gabriel": 25 }
  periodMode: "CYCLE" | "ALL_TIME"; // Base de cálculo: Ciclo Atual ou Acumulado Geral
  updatedAt?: string;
}

export interface PartnerPayrollItem {
  partner: Partner;
  salaryPct: number; // % do lucro total destinada ao salário deste sócio (ex: 25%)
  grossSalaryGenerated: number; // Valor bruto gerado no período/ciclo
  salaryPaidInPeriod: number; // Total já sacado/pago de salário no período/ciclo
  availableToReceive: number; // Saldo líquido disponível para sacar (inclui acumulado de ciclos anteriores se em modo ciclo)
  totalSalaryPaidAllTime: number; // Histórico total de salários recebidos
  carriedOverPendingSalary?: number; // Saldo remanescente acumulado de ciclos anteriores não retirado
}

export interface PayrollOverview {
  periodMode: "CYCLE" | "ALL_TIME";
  baseNetProfit: number;
  reinvestmentPct: number;
  reinvestmentAmount: number;
  totalPartnersPct: number;
  totalPartnersGenerated: number;
  totalPartnersPaid: number;
  totalPartnersAvailable: number;
  partnerItems: PartnerPayrollItem[];
}

/**
 * Mantido por compatibilidade de assinatura (nunca bloqueia nomes de sócios)
 */
export function isCompanyEntityPartner(_partnerName?: string | null): boolean {
  return false;
}

/**
 * Retorna todos os sócios ativos cadastrados na empresa (suporta qualquer quantidade de sócios)
 */
export function filterRealHumanPartners(partners: Partner[]): Partner[] {
  return (partners || []).filter((p) => p.is_active !== false);
}

/**
 * Verifica se uma transação societária é um Custo / Despesa Operacional da Empresa
 */
export function isCompanyExpenseTransaction(
  tx: PartnerTransaction | any,
  _partners: Partner[] = []
): boolean {
  if (!tx) return false;
  if (tx.type === "DESPESA_OPERACIONAL") return true;
  return false;
}

/**
 * Gera a configuração padrão (50% Reinvestimento + 50% dividido igualmente entre os sócios reais)
 */
export function buildDefaultPayrollConfig(partners: Partner[] = []): PayrollConfig {
  const realPartners = filterRealHumanPartners(partners);
  const reinvestmentPct = 50;
  const remainingPct = 100 - reinvestmentPct;
  const partnerPcts: Record<string, number> = {};

  if (realPartners.length > 0) {
    const equalShare = Number((remainingPct / realPartners.length).toFixed(2));
    realPartners.forEach((p, idx) => {
      if (idx === realPartners.length - 1) {
        const sumPrevious = equalShare * (realPartners.length - 1);
        partnerPcts[p.id] = Number((remainingPct - sumPrevious).toFixed(2));
      } else {
        partnerPcts[p.id] = equalShare;
      }
    });
  }

  return {
    reinvestmentPct,
    partnerPcts,
    periodMode: "CYCLE",
  };
}

function getStorageKey(companyId?: string): string {
  const cId = companyId || DEFAULT_COMPANY_ID;
  return `smk_partner_payroll_config_v1_${cId}`;
}

/**
 * Garante que todos os sócios reais ativos tenham percentual atribuído na configuração
 */
export function normalizePayrollConfig(
  rawConfig: Partial<PayrollConfig> | null | undefined,
  partners: Partner[] = []
): PayrollConfig {
  const realPartners = filterRealHumanPartners(partners);
  const def = buildDefaultPayrollConfig(partners);

  if (!rawConfig || typeof rawConfig.reinvestmentPct !== "number") {
    return def;
  }

  const reinvestmentPct = Math.max(0, Math.min(100, Number(rawConfig.reinvestmentPct)));
  const remainingPct = Math.max(0, 100 - reinvestmentPct);
  const rawMap = rawConfig.partnerPcts || {};

  // Verificar se os sócios atuais estão mapeados
  const hasAllRealPartners =
    realPartners.length > 0 &&
    realPartners.every((p) => typeof rawMap[p.id] === "number");

  const partnerPcts: Record<string, number> = {};

  if (hasAllRealPartners) {
    realPartners.forEach((p) => {
      partnerPcts[p.id] = Math.max(0, Number(rawMap[p.id]) || 0);
    });
  } else if (realPartners.length > 0) {
    const equalShare = Number((remainingPct / realPartners.length).toFixed(2));
    realPartners.forEach((p, idx) => {
      if (idx === realPartners.length - 1) {
        const sumPrev = equalShare * (realPartners.length - 1);
        partnerPcts[p.id] = Number((remainingPct - sumPrev).toFixed(2));
      } else {
        partnerPcts[p.id] = equalShare;
      }
    });
  }

  return {
    reinvestmentPct,
    partnerPcts,
    periodMode: rawConfig.periodMode === "ALL_TIME" ? "ALL_TIME" : "CYCLE",
    updatedAt: rawConfig.updatedAt,
  };
}

export function loadLocalPayrollConfig(
  companyId?: string,
  partners: Partner[] = []
): PayrollConfig {
  try {
    const raw = localStorage.getItem(getStorageKey(companyId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizePayrollConfig(parsed, partners);
    }
  } catch (e) {
    console.warn("[Payroll] Erro ao ler config local:", e);
  }
  return buildDefaultPayrollConfig(partners);
}

export function saveLocalPayrollConfig(
  config: PayrollConfig,
  companyId?: string
): void {
  try {
    localStorage.setItem(getStorageKey(companyId), JSON.stringify(config));
  } catch (e) {
    console.warn("[Payroll] Erro ao salvar config local:", e);
  }
}

/**
 * Persiste a configuração de Salários e Reinvestimento no Supabase de forma isolada por company_id
 * Fonte Oficial Primária: tabela companies (campo jsonb payment_gateway -> payroll_config)
 * Fonte de Contingência: localStorage
 */
export async function savePayrollConfigToSupabase(
  config: PayrollConfig,
  companyId?: string
): Promise<boolean> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;
  const payload: PayrollConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };

  saveLocalPayrollConfig(payload, targetCompanyId);

  try {
    // 1. Persistência Oficial e Isolada: tabela companies
    const { data: compData, error: compFetchErr } = await supabase
      .from("companies")
      .select("payment_gateway")
      .eq("id", targetCompanyId)
      .maybeSingle();

    if (!compFetchErr && compData) {
      const currentGw = (compData.payment_gateway && typeof compData.payment_gateway === 'object')
        ? compData.payment_gateway
        : {};

      const updatedGw = {
        ...currentGw,
        payroll_config: payload,
      };

      const { error: compUpdateErr } = await supabase
        .from("companies")
        .update({ payment_gateway: updatedGw })
        .eq("id", targetCompanyId);

      if (!compUpdateErr) {
        window.dispatchEvent(new CustomEvent("smk-payroll-config-updated"));
        return true;
      }
      console.warn("[Payroll] Aviso ao atualizar companies.payment_gateway:", compUpdateErr.message);
    }
  } catch (e) {
    console.warn("[Payroll] Exceção ao salvar config em companies:", e);
  }

  window.dispatchEvent(new CustomEvent("smk-payroll-config-updated"));
  return true;
}

/**
 * Sincroniza e carrega a configuração de salários:
 * 1º Tenta a fonte oficial isolada em companies.payment_gateway.payroll_config
 * 2º Se não encontrar, faz fallback de leitura para a antiga linha legada em smoking_orders (preservação retroativa)
 * 3º Fallback final: localStorage
 */
export async function fetchPayrollConfigFromSupabase(
  companyId?: string,
  partners: Partner[] = []
): Promise<PayrollConfig> {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  try {
    // 1. Busca na fonte oficial isolada: companies.payment_gateway.payroll_config
    const { data: compData, error: compErr } = await supabase
      .from("companies")
      .select("payment_gateway")
      .eq("id", targetCompanyId)
      .maybeSingle();

    if (!compErr && compData?.payment_gateway?.payroll_config) {
      const cfg = compData.payment_gateway.payroll_config;
      if (cfg && typeof cfg.reinvestmentPct === "number") {
        const normalized = normalizePayrollConfig(cfg, partners);
        saveLocalPayrollConfig(normalized, targetCompanyId);
        return normalized;
      }
    }

    // 2. Fallback de transição retroativa: lê linha antiga em smoking_orders sem apagar dados
    const { data: legacyRows, error: legErr } = await supabase
      .from("smoking_orders")
      .select("items")
      .eq("client_phone", SYSTEM_PAYROLL_CONFIG_KEY)
      .eq("company_id", targetCompanyId)
      .limit(1);

    if (!legErr && legacyRows && legacyRows.length > 0 && Array.isArray(legacyRows[0].items) && legacyRows[0].items.length > 0) {
      const saved = legacyRows[0].items[0];
      if (saved && typeof saved.reinvestmentPct === "number") {
        const normalized = normalizePayrollConfig(saved, partners);
        saveLocalPayrollConfig(normalized, targetCompanyId);
        // Auto-migra para a nova fonte oficial
        await savePayrollConfigToSupabase(normalized, targetCompanyId);
        return normalized;
      }
    }
  } catch (e) {
    console.warn("[Payroll] Exceção ao consultar configuração remota de salários:", e);
  }

  const local = loadLocalPayrollConfig(targetCompanyId, partners);
  return local;
}

/**
 * Mantido para compatibilidade retroativa com fluxos que passam rawOrders
 */
export function syncPayrollConfigFromOrders(
  rawOrders: any[],
  companyId?: string,
  partners: Partner[] = []
): PayrollConfig {
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  if (Array.isArray(rawOrders)) {
    const configRow = rawOrders.find(
      (o) => o && o.client_phone === SYSTEM_PAYROLL_CONFIG_KEY
    );

    if (configRow && Array.isArray(configRow.items) && configRow.items.length > 0) {
      const saved = configRow.items[0];
      if (saved && typeof saved.reinvestmentPct === "number") {
        const normalized = normalizePayrollConfig(saved, partners);
        saveLocalPayrollConfig(normalized, targetCompanyId);
        return normalized;
      }
    }
  }

  const local = loadLocalPayrollConfig(targetCompanyId, partners);
  saveLocalPayrollConfig(local, targetCompanyId);
  return local;
}

/**
 * Calcula o resumo completo de Reinvestimento e Folha Salarial de cada sócio
 */
export function calculatePayrollOverview(params: {
  config: PayrollConfig;
  partners: Partner[];
  transactions: PartnerTransaction[];
  cycleNetProfit: number;
  allTimeNetProfit: number;
  currentCycleId: string;
}): PayrollOverview {
  const {
    config,
    partners,
    transactions,
    cycleNetProfit,
    allTimeNetProfit,
    currentCycleId,
  } = params;

  const realPartners = filterRealHumanPartners(partners);
  const normalized = normalizePayrollConfig(config, realPartners);
  const periodMode = normalized.periodMode;

  const baseNetProfit = Math.max(
    0,
    periodMode === "CYCLE" ? cycleNetProfit : allTimeNetProfit
  );

  const reinvestmentPct = normalized.reinvestmentPct;
  const reinvestmentAmount = Number(
    ((baseNetProfit * reinvestmentPct) / 100).toFixed(2)
  );

  let totalPartnersPct = 0;
  let totalPartnersGenerated = 0;
  let totalPartnersPaid = 0;
  let totalPartnersAvailable = 0;

  const partnerItems: PartnerPayrollItem[] = realPartners.map((partner) => {
    const salaryPct = Number(normalized.partnerPcts[partner.id] ?? 0);
    const grossSalaryGenerated = Number(
      ((baseNetProfit * salaryPct) / 100).toFixed(2)
    );

    // Transações de salário / pró-labore / distribuição de lucro deste sócio
    const salaryTxs = (transactions || []).filter(
      (tx) =>
        tx.partner_id === partner.id &&
        (tx.type === "PRO_LABORE" || tx.type === "DISTRIBUICAO_LUCRO")
    );

    const totalSalaryPaidAllTime = Number(
      salaryTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0).toFixed(2)
    );

    const periodSalaryTxs =
      periodMode === "CYCLE"
        ? salaryTxs.filter((tx) => {
            const d = tx.date || tx.created_at;
            if (!d) return false;
            return getCycleForDate(d).id === currentCycleId;
          })
        : salaryTxs;

    const salaryPaidInPeriod = Number(
      periodSalaryTxs
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
        .toFixed(2)
    );

    let availableToReceive = 0;
    let carriedOverPendingSalary = 0;

    if (periodMode === "ALL_TIME") {
      availableToReceive = Number(
        Math.max(0, grossSalaryGenerated - totalSalaryPaidAllTime).toFixed(2)
      );
    } else {
      // No modo ciclo, calculamos o saldo gerado no ciclo atual menos os saques do ciclo atual.
      // Se allTimeNetProfit acumulado gerou mais direito do que o total sacado na história,
      // a diferença que não pertence ao ciclo atual é acumulada como rollover (carryover).
      const allTimeGrossGenerated = Number(((allTimeNetProfit * salaryPct) / 100).toFixed(2));
      const totalAllTimeAvailable = Math.max(0, allTimeGrossGenerated - totalSalaryPaidAllTime);
      const cycleAvailable = Math.max(0, grossSalaryGenerated - salaryPaidInPeriod);

      carriedOverPendingSalary = Number(Math.max(0, totalAllTimeAvailable - cycleAvailable).toFixed(2));
      // O disponível total do sócio é o direito do ciclo corrente + acumulado de ciclos anteriores não retirados
      availableToReceive = Number((cycleAvailable + carriedOverPendingSalary).toFixed(2));
    }

    totalPartnersPct += salaryPct;
    totalPartnersGenerated += grossSalaryGenerated;
    totalPartnersPaid += salaryPaidInPeriod;
    totalPartnersAvailable += availableToReceive;

    return {
      partner,
      salaryPct,
      grossSalaryGenerated,
      salaryPaidInPeriod,
      availableToReceive,
      totalSalaryPaidAllTime,
      carriedOverPendingSalary,
    };
  });

  return {
    periodMode,
    baseNetProfit: Number(baseNetProfit.toFixed(2)),
    reinvestmentPct,
    reinvestmentAmount,
    totalPartnersPct: Number(totalPartnersPct.toFixed(2)),
    totalPartnersGenerated: Number(totalPartnersGenerated.toFixed(2)),
    totalPartnersPaid: Number(totalPartnersPaid.toFixed(2)),
    totalPartnersAvailable: Number(totalPartnersAvailable.toFixed(2)),
    partnerItems,
  };
}
