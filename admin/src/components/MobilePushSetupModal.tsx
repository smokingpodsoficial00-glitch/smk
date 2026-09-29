import { useState, useEffect } from "react";
import {
  Bell,
  Smartphone,
  CheckCircle2,
  X,
  Loader2,
  Share,
  PlusSquare,
  Sparkles,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";
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
  storeName?: string;
}

export function MobilePushSetupModal({
  isOpen,
  onClose,
  companyId,
  storeName = "Sua Loja",
}: MobilePushSetupModalProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [devicesCount, setDevicesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<"iphone" | "android">("iphone");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const panelUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/financeiro`
      : "https://smoking-pods-admin.vercel.app/financeiro";

  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);
    if (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)) {
      setSelectedPlatform("android");
    }
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(panelUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(
    panelUrl
  )}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#111113] border border-white/15 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl text-white my-auto max-h-[92dvh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Smartphone className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-white truncate">
                Conectar Sistema no Seu Celular
              </h3>
              <p className="text-xs text-white/50 truncate">
                App de Bolso & Notificações na Tela Bloqueada ({storeName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Status de aparelhos conectados & Isolamento por Conta */}
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-white/85 truncate">
              Aparelhos conectados na conta <strong className="text-white">{storeName}</strong>:
            </span>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            {devicesCount} {devicesCount === 1 ? "celular" : "celulares"}
          </span>
        </div>

        {/* Bloco QR Code (Visível no Computador para facilitar abrir no celular) */}
        <div className="hidden sm:flex items-center gap-4 bg-black/50 border border-white/10 rounded-2xl p-3.5">
          <div className="bg-white p-1.5 rounded-xl shrink-0">
            <img
              src={qrCodeImgUrl}
              alt="QR Code para abrir no celular"
              className="size-20 rounded-lg object-contain"
            />
          </div>
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <QrCode className="size-3.5" />
              <span>Aponte a câmera do seu celular aqui</span>
            </div>
            <p className="text-[11px] text-white/65 leading-relaxed">
              Escaneie o QR Code para abrir o sistema direto no navegador do seu celular ou copie o link abaixo:
            </p>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-bold text-white transition-all cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Link Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5 text-white/70" />
                  <span>Copiar Link do App</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Seletor de Passo a Passo: iPhone (Safari) vs Android (Chrome) */}
        <div className="space-y-3 bg-black/50 border border-white/10 rounded-2xl p-4 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> Passo a Passo de Instalação:
            </div>
            <div className="inline-flex p-0.5 rounded-xl bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => setSelectedPlatform("iphone")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  selectedPlatform === "iphone"
                    ? "bg-white text-black shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                🍎 iPhone (Safari)
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlatform("android")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  selectedPlatform === "android"
                    ? "bg-white text-black shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                🤖 Android (Chrome)
              </button>
            </div>
          </div>

          {selectedPlatform === "iphone" ? (
            <ol className="space-y-2.5 text-white/80 list-decimal list-inside leading-relaxed">
              <li>
                <strong>1º Passo:</strong> Entre no sistema pelo navegador{" "}
                <strong className="text-white">Safari</strong> do seu iPhone e faça login na sua conta.
              </li>
              <li>
                <strong>2º Passo:</strong> Na barra do Safari, toque no botão{" "}
                <span className="inline-flex items-center gap-1 text-white font-bold bg-white/10 px-1.5 py-0.5 rounded">
                  <Share className="size-3 text-amber-400 inline" /> Compartilhar
                </span>{" "}
                e escolha{" "}
                <span className="inline-flex items-center gap-1 text-emerald-300 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded">
                  <PlusSquare className="size-3 text-emerald-400 inline" /> Adicionar à Tela de Início
                </span>
                .
              </li>
              <li>
                <strong>3º Passo:</strong> Abra o aplicativo criado na sua <strong>Tela de Início</strong>,
                entre aqui em <strong>Conectar no Celular</strong> e toque no botão verde abaixo:
              </li>
            </ol>
          ) : (
            <ol className="space-y-2.5 text-white/80 list-decimal list-inside leading-relaxed">
              <li>
                <strong>1º Passo:</strong> Entre no sistema pelo navegador{" "}
                <strong className="text-white">Google Chrome</strong> do seu Android e faça login na sua conta.
              </li>
              <li>
                <strong>2º Passo:</strong> Toque nos <strong>3 pontinhos (⋮)</strong> no canto superior do Chrome e selecione{" "}
                <span className="inline-flex items-center gap-1 text-emerald-300 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded">
                  <PlusSquare className="size-3 text-emerald-400 inline" /> Instalar Aplicativo / Adicionar à Tela Inicial
                </span>
                .
              </li>
              <li>
                <strong>3º Passo:</strong> Abra o aplicativo instalado, entre em{" "}
                <strong>Conectar no Celular</strong> e toque no botão verde abaixo:
              </li>
            </ol>
          )}
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
                ? "✅ Este Aparelho já está Conectado (Clique para Revalidar)"
                : "🔔 Ativar Notificações Neste Celular / Aparelho"}
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
              <span>Disparar Notificação de Teste Agora (Sem Criar Venda)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
