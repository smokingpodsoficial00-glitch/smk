/**
 * Módulo 100% isolado e seguro (Fire-and-Forget) para envio de notificações
 * de venda em tempo real no celular via ntfy.sh.
 * NUNCA bloqueia ou interfere no fluxo de venda, estoque, financeiro ou CRM.
 */

const OFFICIAL_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
const DEFAULT_OFFICIAL_TOPIC = "smk_vendas_oficial_2026";

export function getSaleNotificationTopic(companyId?: string): string {
  try {
    const cleanCompanyId = companyId || OFFICIAL_COMPANY_ID;
    const customSaved = localStorage.getItem(`smk_ntfy_topic_${cleanCompanyId}`);
    if (customSaved && customSaved.trim()) {
      return customSaved.trim();
    }
    if (cleanCompanyId === OFFICIAL_COMPANY_ID) {
      return DEFAULT_OFFICIAL_TOPIC;
    }
    return `smk_vendas_${cleanCompanyId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase()}`;
  } catch {
    return DEFAULT_OFFICIAL_TOPIC;
  }
}

export interface SaleMobileNotificationPayload {
  companyId?: string;
  clientName: string;
  items: Array<{
    brand?: string;
    modelName?: string;
    name?: string;
    flavor?: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  estimatedProfit?: number;
  paymentMethod?: string;
  isNationalSale?: boolean;
  nationalState?: string;
}

export async function notifyMobileSale(payload: SaleMobileNotificationPayload): Promise<void> {
  try {
    const topic = getSaleNotificationTopic(payload.companyId);
    if (!topic) return;

    const totalFormatted = payload.totalAmount.toFixed(2).replace(".", ",");
    const profitFormatted =
      typeof payload.estimatedProfit === "number"
        ? payload.estimatedProfit.toFixed(2).replace(".", ",")
        : null;

    const itemsSummary = payload.items
      .map((item) => {
        const model = `${item.brand || ""} ${item.modelName || item.name || ""}`.trim();
        const flavor = item.flavor ? ` (${item.flavor})` : "";
        return `${item.quantity}x ${model}${flavor}`;
      })
      .join(", ");

    const lines: string[] = [
      `👤 Cliente: ${payload.clientName || "Cliente Balcão"}`,
      `📦 ${itemsSummary || "Produto vendido"}`,
    ];

    const footerParts: string[] = [];
    if (payload.paymentMethod) {
      footerParts.push(`💳 ${payload.paymentMethod}`);
    }
    if (profitFormatted !== null) {
      footerParts.push(`📈 Lucro: +R$ ${profitFormatted}`);
    }
    if (payload.isNationalSale) {
      footerParts.push(`✈️ Envio Nacional (${payload.nationalState || "BR"})`);
    }
    if (footerParts.length > 0) {
      lines.push(footerParts.join(" • "));
    }

    await fetch("https://ntfy.sh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic,
        title: `💰 Nova Venda! R$ ${totalFormatted}`,
        message: lines.join("\n"),
        priority: 5,
        tags: ["moneybag", "white_check_mark"],
      }),
    });
  } catch (err) {
    // Silencioso por segurança absoluta: jamais afeta o registro da venda
    console.warn("[SaleNotifications] Aviso silencioso ao enviar push:", err);
  }
}
