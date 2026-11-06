import { supabase } from "./supabase";
import { invalidateLiveClientsCache } from "./crm";
import { invalidateSalesHistoryCache } from "./salesHistory";

export interface FiadoSaleInfo {
  isFiado: boolean;
  status: "PENDENTE" | "PAGO";
  dueDate: string; // "YYYY-MM-DD"
  dueDateFormatted: string; // "DD/MM/YYYY"
  amountOwed: number; // Quanto o cliente deve no fiado
  upfrontPaid: number; // Quanto foi pago de entrada no ato (se houver)
  paidAt: string | null;
  paidMethod: string | null;
  daysUntilDue: number; // < 0 atrasado, 0 vence hoje, > 0 no prazo
  isOverdue: boolean;
  isDueToday: boolean;
}

/**
 * Retorna a data de hoje no fuso America/Sao_Paulo no formato YYYY-MM-DD
 */
export function getTodaySaoPauloIso(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Retorna uma data futura (hoje + N dias) no formato YYYY-MM-DD
 */
export function getFutureDateIso(daysAhead: number): string {
  const todayStr = getTodaySaoPauloIso();
  const [y, m, d] = todayStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + daysAhead, 12, 0, 0);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Formata uma string YYYY-MM-DD para DD/MM/YYYY
 */
export function formatIsoDateBR(isoDate?: string | null): string {
  if (!isoDate) return "Sem data definida";
  const clean = String(isoDate).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split("-");
    return `${d}/${m}/${y}`;
  }
  try {
    const dt = new Date(isoDate);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    }
  } catch {}
  return String(isoDate);
}

/**
 * Calcula a diferença em dias inteiros entre hoje (America/Sao_Paulo) e a data de vencimento (YYYY-MM-DD)
 */
export function calculateDaysUntilDue(dueDateIso?: string | null): number {
  if (!dueDateIso) return 0;
  const cleanDue = String(dueDateIso).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDue)) return 0;

  const todayIso = getTodaySaoPauloIso();
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const [dy, dm, dd] = cleanDue.split("-").map(Number);

  const todayUtc = Date.UTC(ty, tm - 1, td);
  const dueUtc = Date.UTC(dy, dm - 1, dd);

  return Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Identifica se um pedido é uma venda a Fiado (pendente ou já quitada)
 */
export function isOrderFiado(order: any): boolean {
  if (!order) return false;

  // 1. Status de entrega gravado como FIADO
  if (
    order.delivery_status === "FIADO" ||
    order.delivery_status === "FIADO_PENDENTE" ||
    order.deliveryStatus === "FIADO" ||
    order.deliveryStatus === "FIADO_PENDENTE"
  ) {
    return true;
  }

  // 2. Método de pagamento explícito FIADO
  if (
    order.payment_method === "FIADO" ||
    order.paymentMethod === "FIADO"
  ) {
    return true;
  }

  // 3. Itens com marcação is_fiado ou fiado_due_date ou fiado_status
  if (Array.isArray(order.items)) {
    if (
      order.items.some(
        (item: any) =>
          item &&
          (item.is_fiado === true ||
            item.isFiado === true ||
            Boolean(item.fiado_status) ||
            Boolean(item.fiadoStatus) ||
            Boolean(item.fiado_due_date) ||
            Boolean(item.fiadoDueDate) ||
            item.real_payment_method === "FIADO")
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extrai todos os metadados de Fiado de um pedido
 */
export function extractFiadoInfo(order: any): FiadoSaleInfo {
  const orderTotal = Number(order?.total_amount ?? order?.totalAmount ?? 0) || 0;

  if (!order || !isOrderFiado(order)) {
    return {
      isFiado: false,
      status: "PAGO",
      dueDate: "",
      dueDateFormatted: "",
      amountOwed: 0,
      upfrontPaid: orderTotal,
      paidAt: null,
      paidMethod: null,
      daysUntilDue: 0,
      isOverdue: false,
      isDueToday: false,
    };
  }

  let status: "PENDENTE" | "PAGO" = "PENDENTE";
  let dueDate = "";
  let amountOwed = orderTotal;
  let hasExplicitAmount = false;
  let paidAt: string | null = null;
  let paidMethod: string | null = null;

  if (Array.isArray(order.items)) {
    for (const item of order.items) {
      if (item && (item.is_fiado || item.isFiado || item.real_payment_method === "FIADO")) {
        if (item.fiado_status === "PAGO" || item.fiadoStatus === "PAGO") {
          status = "PAGO";
        } else if (item.fiado_status === "PENDENTE" || item.fiadoStatus === "PENDENTE") {
          status = "PENDENTE";
        }
        if (item.fiado_due_date || item.fiadoDueDate) {
          dueDate = String(item.fiado_due_date || item.fiadoDueDate).slice(0, 10);
        }
        const rawOwed = item.fiado_amount_owed ?? item.fiadoAmountOwed;
        if (rawOwed !== undefined && rawOwed !== null && !hasExplicitAmount) {
          const parsedOwed = Number(rawOwed);
          if (Number.isFinite(parsedOwed) && parsedOwed >= 0) {
            amountOwed = parsedOwed;
            hasExplicitAmount = true;
          }
        }
        if (item.fiado_paid_at || item.fiadoPaidAt) {
          paidAt = String(item.fiado_paid_at || item.fiadoPaidAt);
        }
        if (item.fiado_paid_method || item.fiadoPaidMethod) {
          paidMethod = String(item.fiado_paid_method || item.fiadoPaidMethod);
        }
      }
    }
  }

  const clampedOwed = Math.max(0, Math.min(orderTotal > 0 ? orderTotal : amountOwed, amountOwed));
  const upfrontPaid = Math.max(0, Number((orderTotal - clampedOwed).toFixed(2)));
  const daysUntilDue = dueDate ? calculateDaysUntilDue(dueDate) : 0;
  const isOverdue = status === "PENDENTE" && Boolean(dueDate) && daysUntilDue < 0;
  const isDueToday = status === "PENDENTE" && Boolean(dueDate) && daysUntilDue === 0;

  return {
    isFiado: true,
    status,
    dueDate,
    dueDateFormatted: formatIsoDateBR(dueDate),
    amountOwed: Number(clampedOwed.toFixed(2)),
    upfrontPaid,
    paidAt,
    paidMethod,
    daysUntilDue,
    isOverdue,
    isDueToday,
  };
}

/**
 * Verifica se o pedido é um Fiado que AINDA NÃO FOI PAGO (em aberto)
 */
export function isOrderFiadoPending(order: any): boolean {
  if (!isOrderFiado(order)) return false;
  return extractFiadoInfo(order).status === "PENDENTE";
}

/**
 * Verifica se o pedido era Fiado e JÁ FOI PAGO
 */
export function isOrderFiadoPaid(order: any): boolean {
  if (!isOrderFiado(order)) return false;
  return extractFiadoInfo(order).status === "PAGO";
}

/**
 * Retorna a forma de pagamento real para exibição (PIX, DINHEIRO, CARTAO, FIADO)
 */
export function getOrderDisplayPaymentMethod(order: any): string {
  if (!order) return "PIX";
  if (isOrderFiado(order)) {
    const info = extractFiadoInfo(order);
    if (info.status === "PAGO" && info.paidMethod) {
      return `FIADO (${info.paidMethod})`;
    }
    return "FIADO";
  }
  if (Array.isArray(order.items)) {
    for (const it of order.items) {
      if (it?.real_payment_method) {
        return String(it.real_payment_method);
      }
    }
  }
  const raw = String(order.payment_method || order.paymentMethod || "PIX").toUpperCase();
  if (raw === "CREDITO_LINK") return "CARTAO";
  return raw;
}

/**
 * Marca uma venda a fiado como PAGA no Supabase, permitindo que o valor entre imediatamente no Caixa Real
 */
export async function markFiadoOrderAsPaid(params: {
  orderId: string;
  paidMethod?: "PIX" | "DINHEIRO" | "CARTAO";
  companyId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { orderId, paidMethod = "PIX", companyId } = params;
  try {
    let fetchQuery = supabase
      .from("smoking_orders")
      .select("id, items, total_amount, company_id")
      .eq("id", orderId);

    if (companyId) {
      fetchQuery = fetchQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    const { data: order, error: fetchErr } = await fetchQuery.maybeSingle();
    if (fetchErr || !order) {
      return {
        success: false,
        error: fetchErr?.message || "Pedido não encontrado no banco de dados.",
      };
    }

    const nowIso = new Date().toISOString();
    const currentItems = Array.isArray(order.items) ? order.items : [];
    const updatedItems =
      currentItems.length > 0
        ? currentItems.map((it: any) => ({
            ...it,
            is_fiado: true,
            fiado_status: "PAGO",
            fiado_paid_at: nowIso,
            fiado_paid_method: paidMethod,
          }))
        : [
            {
              name: "Venda Fiado",
              quantity: 1,
              price: Number(order.total_amount) || 0,
              is_fiado: true,
              fiado_status: "PAGO",
              fiado_paid_at: nowIso,
              fiado_paid_method: paidMethod,
            },
          ];

    const safeDbMethod = paidMethod === "CARTAO" ? "CREDITO_LINK" : "PIX";

    const { error: updErr } = await supabase
      .from("smoking_orders")
      .update({
        items: updatedItems,
        payment_status: "PAGO",
        delivery_status: "CONCLUIDO",
        receipt_url: "CONCLUIDO",
        payment_method: safeDbMethod,
      })
      .eq("id", orderId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    const tenant = order.company_id || companyId;
    invalidateLiveClientsCache(tenant);
    invalidateSalesHistoryCache(tenant);

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro inesperado ao confirmar pagamento do fiado.",
    };
  }
}

/**
 * Reabre um fiado (volta o status para PENDENTE, retirando do Caixa Real caso tenha sido baixado por engano)
 */
export async function reopenFiadoOrder(params: {
  orderId: string;
  companyId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { orderId, companyId } = params;
  try {
    let fetchQuery = supabase
      .from("smoking_orders")
      .select("id, items, company_id")
      .eq("id", orderId);

    if (companyId) {
      fetchQuery = fetchQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    const { data: order, error: fetchErr } = await fetchQuery.maybeSingle();
    if (fetchErr || !order) {
      return {
        success: false,
        error: fetchErr?.message || "Pedido não encontrado.",
      };
    }

    const currentItems = Array.isArray(order.items) ? order.items : [];
    const updatedItems = currentItems.map((it: any) => ({
      ...it,
      is_fiado: true,
      fiado_status: "PENDENTE",
      fiado_paid_at: null,
      fiado_paid_method: null,
    }));

    const { error: updErr } = await supabase
      .from("smoking_orders")
      .update({
        items: updatedItems,
        delivery_status: "FIADO",
        payment_status: "PENDENTE",
        receipt_url: null,
      })
      .eq("id", orderId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    const tenant = order.company_id || companyId;
    invalidateLiveClientsCache(tenant);
    invalidateSalesHistoryCache(tenant);

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro ao reabrir fiado.",
    };
  }
}

/**
 * Atualiza a data combinada de pagamento e/ou o valor devido de um fiado
 */
export async function updateFiadoDetails(params: {
  orderId: string;
  dueDate: string;
  amountOwed: number;
  companyId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { orderId, dueDate, amountOwed, companyId } = params;
  try {
    let fetchQuery = supabase
      .from("smoking_orders")
      .select("id, items, company_id")
      .eq("id", orderId);

    if (companyId) {
      fetchQuery = fetchQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    const { data: order, error: fetchErr } = await fetchQuery.maybeSingle();
    if (fetchErr || !order) {
      return {
        success: false,
        error: fetchErr?.message || "Pedido não encontrado.",
      };
    }

    const currentItems = Array.isArray(order.items) ? order.items : [];
    const updatedItems = currentItems.map((it: any) => ({
      ...it,
      is_fiado: true,
      fiado_due_date: dueDate,
      fiado_amount_owed: Number(amountOwed.toFixed(2)),
    }));

    const { error: updErr } = await supabase
      .from("smoking_orders")
      .update({
        items: updatedItems,
      })
      .eq("id", orderId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    const tenant = order.company_id || companyId;
    invalidateLiveClientsCache(tenant);
    invalidateSalesHistoryCache(tenant);

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro ao atualizar dados do fiado.",
    };
  }
}
