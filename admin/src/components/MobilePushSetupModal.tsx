import { useState, useEffect } from "react";
import { Bell, Smartphone, CheckCircle2, X, Loader2, Share, PlusSquare, Sparkles } from "lucide-react";
import {
  registerCurrentDeviceForSalePush,
  sendTestSalePush,
  isCurrentDeviceSubscribed,
  fetchCompanyPushSubscriptions,
} from "@/lib/saleNotifications";

interface MobilePushSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
}

export function MobilePushSetupModal({ isOpen, onClose, companyId }: MobilePushSetupModalProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [devicesCount, setDevicesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);
    isCurrentDeviceSubscribed().then(setIsSubscribed);
    fetchCompanyPushSubscriptions(companyId).then(({ devices }) => {
      setDevicesCount(devices.length);
    });
  }, [isOpen, companyId]);

  if (!isOpen) return null;

  const handleActivateThisDevice = async () => {
    setLoading(true);
    setFeedback(null);
    const res = await registerCurrentDeviceForSalePush(companyId);
    setLoading(false);
    if (res.success) {
      setIsSubscribed(true);
      if (typeof res.devicesCount === "number") {
        setDevicesCount(res.devicesCount);
      }
      setFeedback({ type: "success", text: res.message });
    } else {
      setFeedback({ type: "error", text: res.message });
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    setFeedback(null);
    const res = await sendTestSalePush(companyId);
    setTesting(false);
    setFeedback({
      type: res.success ? "success" : "error",
      text: res.message,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#111113] border border-white/15 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-5 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bell className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>App & Notificações de Venda</span>
              </h3>
              <p className="text-xs text-white/50">
                Receba alertas nativos na tela bloqueada (R$ 0,00)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Status de aparelhos conectados */}
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="size-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white/80">
              Celulares conectados nesta loja:
            </span>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {devicesCount} {devicesCount === 1 ? "aparelho" : "aparelhos"}
          </span>
        </div>

        {/* Passo a passo rápido para iPhone / Android */}
        <div className="space-y-2.5 bg-black/50 border border-white/10 rounded-2xl p-4 text-xs">
          <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> Como ativar no seu iPhone ou Android:
          </div>
          <ol className="space-y-2 text-white/75 list-decimal list-inside">
            <li>
              Abra este painel no navegador do celular (<strong>Safari</strong> no iPhone ou{" "}
              <strong>Chrome</strong> no Android).
            </li>
            <li>
              Toque em{" "}
              <span className="inline-flex items-center gap-1 text-white font-semibold">
                <Share className="size-3 text-amber-400 inline" /> Compartilhar
              </span>{" "}
              ➔{" "}
              <span className="inline-flex items-center gap-1 text-white font-semibold">
                <PlusSquare className="size-3 text-emerald-400 inline" /> Adicionar à Tela de Início
              </span>
              .
            </li>
            <li>
              Abra o ícone <strong>SMK Admin</strong> que apareceu na tela inicial do seu celular e
              toque no botão verde abaixo:
            </li>
          </ol>
        </div>

        {feedback && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold border ${
              feedback.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : "bg-amber-500/15 border-amber-500/30 text-amber-300"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Botões Principais */}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={handleActivateThisDevice}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin text-black" />
            ) : isSubscribed ? (
              <CheckCircle2 className="size-4 text-black" />
            ) : (
              <Bell className="size-4 text-black" />
            )}
            <span>
              {isSubscribed
                ? "✅ Este Aparelho já está Ativo (Clique para Revalidar)"
                : "🔔 Ativar Notificações neste Celular / Aparelho"}
            </span>
          </button>

          {devicesCount > 0 && (
            <button
              type="button"
              disabled={testing}
              onClick={handleSendTest}
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {testing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Bell className="size-3.5 text-amber-400" />
              )}
              <span>Disparar Notificação de Teste Agora</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
