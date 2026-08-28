import { supabase } from "@/lib/supabase";

export const DEFAULT_VIP_GROUP_URL = "https://chat.whatsapp.com/Bk2rFAAgHlvKgc8pQANqYg";
const SYSTEM_AUDIT_LOG_KEY = "__SYSTEM_VIP_OFFER_BROADCAST__";
const DEFAULT_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

export interface GenerateVipOfferParams {
  brand: string;
  name: string;
  flavor: string;
  puffs?: number;
  originalPrice: number;
  promoPrice: number;
  discountPct: number;
  stock: number;
}

export function generateVipOfferMessage(params: GenerateVipOfferParams): string {
  const { brand, name, flavor, puffs, originalPrice, promoPrice, discountPct, stock } = params;

  const stockText =
    stock === 1
      ? "⚠️ *Apenas 1 unidade disponível!*"
      : stock <= 3
      ? `⚡ *Últimas ${stock} unidades disponíveis no estoque!*`
      : `📦 *${stock} unidades disponíveis no lote.*`;

  const puffsText = puffs ? ` (${puffs.toLocaleString("pt-BR")} puffs)` : "";

  return [
    "👑 *OFERTA EXCLUSIVA DO CLUBE VIP* 👑",
    "",
    "Quem faz parte do grupo recebe as melhores oportunidades em primeira mão!",
    "",
    `🔥 *${brand} ${name}* — _${flavor}_${puffsText}`,
    "",
    `❌ De: ~R$ ${originalPrice.toFixed(2)}~`,
    `✅ Por: *R$ ${promoPrice.toFixed(2)}*`,
    `💥 Desconto: *${discountPct}% OFF*`,
    "",
    stockText,
    "",
    "🔒 Condição especial por tempo limitado exclusiva para o Clube VIP.",
    "👉 Garanta a sua respondendo agora antes que o estoque acabe!",
  ].join("\n");
}

export async function logVipOfferBroadcast(params: {
  productId: string;
  brand: string;
  name: string;
  flavor: string;
  originalPrice: number;
  promoPrice: number;
  discountPct: number;
  companyId?: string;
}): Promise<void> {
  const { productId, brand, name, flavor, originalPrice, promoPrice, discountPct, companyId } = params;
  const targetCompanyId = companyId || DEFAULT_COMPANY_ID;

  try {
    const { data: existingRows } = await supabase
      .from("smoking_orders")
      .select("id, items")
      .eq("client_phone", SYSTEM_AUDIT_LOG_KEY)
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

    currentItems.unshift({
      id: `vip-log-${Date.now()}`,
      productId,
      brand,
      name,
      flavor,
      originalPrice,
      promoPrice,
      discountPct,
      action: "DIVULGACAO_GRUPO_VIP",
      broadcastAt: new Date().toISOString(),
    });

    // Limitar histórico a 50 registros para manter o payload leve
    const trimmedItems = currentItems.slice(0, 50);

    if (existingRowId) {
      await supabase
        .from("smoking_orders")
        .update({ items: trimmedItems })
        .eq("id", existingRowId);
    } else {
      await supabase
        .from("smoking_orders")
        .insert({
          client_phone: SYSTEM_AUDIT_LOG_KEY,
          client_name: "System Audit VIP Broadcast Log",
          shipping_address: "AUDIT",
          items: trimmedItems,
          total_amount: 0,
          company_id: targetCompanyId,
        });
    }
  } catch (err) {
    console.warn("Aviso ao registrar log de divulgação VIP no Supabase:", err);
  }
}
