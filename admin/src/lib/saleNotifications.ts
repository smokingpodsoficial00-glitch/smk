/**
 * Módulo 100% isolado e seguro (Fire-and-Forget) para App PWA + Web Push Nativo Oficial
 * (Apple APNs iOS 16.4+ & Google FCM Android).
 * Custo ZERO (R$ 0,00) — Nunca bloqueia ou interfere no fluxo de vendas.
 */

import { supabase } from "./supabase";

const OFFICIAL_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
const SYSTEM_PUSH_SUBS_PHONE = "__SYSTEM_PUSH_SUBS__";
const VAPID_PUBLIC_KEY =
  "BKUV9ArzYVwZSNW8I_jDeA08jx5RX6fxZohUGixp_PCStkKVK__8ur8bhoCaruOSnkIsU0DelwCcclIf7hXBt54";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface StoredPushDevice {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  deviceLabel?: string;
  createdAt: string;
}

export async function fetchCompanyPushSubscriptions(
  companyId?: string
): Promise<{ rowId: string | null; devices: StoredPushDevice[] }> {
  try {
    const cleanCompanyId = companyId || OFFICIAL_COMPANY_ID;
    const isOfficial = cleanCompanyId === OFFICIAL_COMPANY_ID;

    let query = supabase
      .from("smoking_orders")
      .select("id, items")
      .eq("client_phone", SYSTEM_PUSH_SUBS_PHONE)
      .order("created_at", { ascending: false })
      .limit(1);

    if (isOfficial) {
      query = query.or(`company_id.eq.${cleanCompanyId},company_id.is.null`);
    } else {
      query = query.eq("company_id", cleanCompanyId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      const row = data[0];
      const devices = Array.isArray(row.items) ? (row.items as StoredPushDevice[]) : [];
      return { rowId: row.id, devices };
    }
    return { rowId: null, devices: [] };
  } catch {
    return { rowId: null, devices: [] };
  }
}

export async function isCurrentDeviceSubscribed(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

export async function registerCurrentDeviceForSalePush(
  companyId?: string,
  deviceLabel?: string
): Promise<{ success: boolean; message: string; devicesCount?: number }> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return {
        success: false,
        message:
          "No iPhone, primeiro toque em Compartilhar (ícone de seta embaixo no Safari) ➔ 'Adicionar à Tela de Início', depois abra o aplicativo pela Tela de Início e toque aqui novamente!",
      };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        success: false,
        message: "Permissão de notificação negada. Ative as notificações nas configurações do celular.",
      };
    }

    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return {
        success: false,
        message: "Não foi possível gerar a chave de Push deste aparelho.",
      };
    }

    const cleanCompanyId = companyId || OFFICIAL_COMPANY_ID;
    const { rowId, devices } = await fetchCompanyPushSubscriptions(cleanCompanyId);

    const newDevice: StoredPushDevice = {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
      deviceLabel: deviceLabel || navigator.platform || "Celular Sócio",
      createdAt: new Date().toISOString(),
    };

    const filtered = devices.filter((d) => d.endpoint !== newDevice.endpoint);
    const updatedDevices = [...filtered, newDevice];

    if (rowId) {
      await supabase
        .from("smoking_orders")
        .update({ items: updatedDevices })
        .eq("id", rowId);
    } else {
      await supabase.from("smoking_orders").insert({
        client_name: "SYSTEM_PUSH_SUBSCRIPTIONS",
        client_phone: SYSTEM_PUSH_SUBS_PHONE,
        shipping_address: "SYSTEM",
        items: updatedDevices,
        total_amount: 0,
        shipping_fee: 0,
        payment_status: "PAGO",
        delivery_status: "CONCLUIDO",
        payment_method: "PIX",
        company_id: cleanCompanyId,
      });
    }

    // Dispara imediatamente uma notificação de boas-vindas para confirmar na tela do celular!
    await fetch("/api/push-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptions: [newDevice],
        title: "✅ Notificações de Venda Ativadas!",
        body: "Perfeito! A partir de agora toda venda registrada vai apitar na tela do seu celular.",
        url: "/pedidos",
      }),
    }).catch(() => {});

    return {
      success: true,
      message: "✅ Celular conectado com sucesso! Você já deve ter recebido um alerta de confirmação no topo da tela.",
      devicesCount: updatedDevices.length,
    };
  } catch (err: any) {
    console.error("[SaleNotifications] Erro ao ativar push no aparelho:", err);
    return {
      success: false,
      message:
        "Para ativar no iPhone, certifique-se de ter aberto o painel pelo ícone adicionado na Tela de Início (Compartilhar ➔ Adicionar à Tela de Início).",
    };
  }
}

export async function sendTestSalePush(
  companyId?: string
): Promise<{ success: boolean; sent: number; message: string }> {
  try {
    const cleanCompanyId = companyId || OFFICIAL_COMPANY_ID;
    const { devices } = await fetchCompanyPushSubscriptions(cleanCompanyId);

    if (devices.length === 0) {
      return {
        success: false,
        sent: 0,
        message: "Nenhum celular ativado ainda. Abra o app no celular e toque em 'Ativar neste Celular'.",
      };
    }

    const res = await fetch("/api/push-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptions: devices,
        title: "💰 Nova Venda! R$ 110,00",
        body: "👤 Cliente: Samuel (Teste)\n📦 1x Ignite V150 (Melancia Ice)\n💳 PIX • 📈 Lucro: +R$ 55,00",
        url: "/pedidos",
      }),
    });

    const data = await res.json();
    return {
      success: true,
      sent: data.sent ?? devices.length,
      message: `🔔 Alerta de teste enviado para ${devices.length} aparelho(s) conectado(s)!`,
    };
  } catch {
    return {
      success: false,
      sent: 0,
      message: "Erro ao disparar teste.",
    };
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
    const cleanCompanyId = payload.companyId || OFFICIAL_COMPANY_ID;
    const { rowId, devices } = await fetchCompanyPushSubscriptions(cleanCompanyId);
    if (!devices || devices.length === 0) return;

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
      footerParts.push(`✈️ Nacional (${payload.nationalState || "BR"})`);
    }
    if (footerParts.length > 0) {
      lines.push(footerParts.join(" • "));
    }

    const res = await fetch("/api/push-sale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscriptions: devices,
        title: `💰 Nova Venda! R$ ${totalFormatted}`,
        body: lines.join("\n"),
        url: "/pedidos",
      }),
    });

    // Remove aparelhos cuja inscrição foi revogada (410 Gone)
    if (res.ok && rowId) {
      const resultData = await res.json();
      if (Array.isArray(resultData.expiredEndpoints) && resultData.expiredEndpoints.length > 0) {
        const activeDevices = devices.filter(
          (d) => !resultData.expiredEndpoints.includes(d.endpoint)
        );
        await supabase
          .from("smoking_orders")
          .update({ items: activeDevices })
          .eq("id", rowId);
      }
    }
  } catch (err) {
    // Silencioso por segurança absoluta: jamais afeta o registro da venda
    console.warn("[SaleNotifications] Aviso silencioso ao enviar push:", err);
  }
}
