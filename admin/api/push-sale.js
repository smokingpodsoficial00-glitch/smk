import webpush from "web-push";

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BKUV9ArzYVwZSNW8I_jDeA08jx5RX6fxZohUGixp_PCStkKVK__8ur8bhoCaruOSnkIsU0DelwCcclIf7hXBt54";
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "jxFw917wRq3agccRGIanJg9hCoAK-gGZWfzbSzBfpU4";

webpush.setVapidDetails(
  "mailto:suporte@smokingpods.com.br",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { subscriptions, title, body, url } = req.body || {};

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return res.status(200).json({ sent: 0, message: "No subscriptions provided" });
    }

    const payload = JSON.stringify({
      title: title || "💰 Nova Venda Registrada!",
      body: body || "Uma nova venda entrou no sistema.",
      url: url || "/pedidos",
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(sub, payload, {
          urgency: "high",
          TTL: 86400,
        })
      )
    );

    const sentCount = results.filter((r) => r.status === "fulfilled").length;
    const expiredEndpoints = [];

    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        const statusCode = r.reason?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(subscriptions[idx]?.endpoint);
        }
      }
    });

    return res.status(200).json({
      success: true,
      sent: sentCount,
      total: subscriptions.length,
      expiredEndpoints,
    });
  } catch (err) {
    console.error("[api/push-sale] Erro ao disparar Web Push:", err);
    return res.status(200).json({ success: false, error: String(err?.message || err) });
  }
}
