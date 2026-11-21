import { useState, useEffect, useRef } from "react";
import { Users, ArrowRight, Sparkles, ChevronLeft, ChevronRight, Gift } from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";

function WhatsAppIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      aria-hidden="true"
    >
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.976.58 1.942.924 3.149.924 3.182 0 5.767-2.587 5.767-5.766.001-3.187-2.575-5.766-5.767-5.766zm3.393 8.163c-.144.405-.837.774-1.17.822-.312.045-.694.06-2.15-.544-1.611-.666-2.613-2.316-2.694-2.424-.08-.108-.65-8.65-.65-1.652 0-.787.411-1.173.558-1.328.147-.156.321-.195.429-.195.107 0 .215.001.308.006.099.005.231-.037.362.276.135.324.464 1.13.504 1.212.041.082.068.178.014.286-.055.108-.082.176-.163.271-.081.096-.171.214-.244.288-.082.082-.167.171-.072.334.095.163.424.7.91 1.134.626.559 1.155.732 1.318.813.163.082.258.072.355-.039.096-.112.411-.479.52-.643.109-.164.218-.137.366-.082.148.055.938.442 1.1.523.163.082.272.122.312.191.041.069.041.401-.103.806z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.661 1.436 5.176L2 22l4.98-1.399A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2c-1.624 0-3.14-.46-4.428-1.258l-.317-.197-2.957.83.805-2.946-.211-.336A8.17 8.17 0 013.8 12c0-4.521 3.679-8.2 8.2-8.2 4.52 0 8.2 3.679 8.2 8.2 0 4.521-3.68 8.2-8.2 8.2z" />
    </svg>
  );
}

export function PromoSlider() {
  const { config } = useStoreConfig();
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const vipGroupUrl = (config as any)?.vip_group_url || "https://chat.whatsapp.com/Bk2rFAAgHlvKgc8pQANqYg";
  const rawPhone = config?.whatsapp_number?.replace(/\D/g, "") || "";
  const whatsappNumber = rawPhone.length >= 10 ? (rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`) : null;

  const slides = [
    {
      id: "group-vip",
      tag: "OFERTA VIP",
      tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accentBg: "from-emerald-950/40 via-emerald-950/10 to-transparent",
      icon: WhatsAppIcon,
      iconColor: "text-[#25D366]",
      iconGlow: "shadow-[0_0_20px_rgba(37,211,102,0.25)]",
      title: "Entre no Grupo VIP Oficial",
      benefitBadge: "R$ 5 OFF",
      benefitBadgeColor: "bg-emerald-500 text-black font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.35)]",
      desc: "Lotes antecipados, reposições e cupons relâmpago semanais direto no WhatsApp.",
      btnText: "Entrar no Grupo VIP",
      btnBg: "bg-[#25D366] hover:bg-[#20ba59] text-black shadow-[0_0_20px_rgba(37,211,102,0.3)]",
      btnHref: vipGroupUrl
    },
    {
      id: "mgm-indication",
      tag: "MEMBER GET MEMBER",
      tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      accentBg: "from-amber-950/40 via-amber-950/10 to-transparent",
      icon: Users,
      iconColor: "text-amber-400",
      iconGlow: "shadow-[0_0_20px_rgba(245,158,11,0.25)]",
      title: "Indique 5 Amigos que Fumam Pod",
      benefitBadge: "+ R$ 5 OFF",
      benefitBadgeColor: "bg-amber-400 text-black font-extrabold shadow-[0_0_15px_rgba(251,191,36,0.35)]",
      desc: "Envie 5 contatos de amigos de SBC/ABC no zap ao concluir seu pedido.",
      btnText: "Indicar Amigos",
      btnBg: "bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]",
      btnHref: whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Opa! Vim pelo catálogo e quero enviar 5 contatos de amigos para garantir meu desconto de R$ 5 no pedido!")}`
        : "#"
    }
  ];

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrent(prev => (prev === 0 ? 1 : 0));
    }, 5500);
    return () => clearInterval(interval);
  }, [isPaused]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) setCurrent(1);
      else setCurrent(0);
    }
    touchStartX.current = null;
    setIsPaused(false);
  };

  const active = slides[current];
  const IconComp = active.icon;

  return (
    <div 
      className="mt-6 sm:mt-8 max-w-xl mx-auto w-full px-1 select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Moldura Glassmorphism Escura de Alta Fidelidade */}
      <div className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-b from-neutral-900/90 via-neutral-900/60 to-neutral-950/90 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-300">
        
        {/* Glow dinâmico no topo esquerdo */}
        <div 
          className={`absolute -top-16 -left-16 w-60 h-60 bg-gradient-to-br ${active.accentBg} blur-3xl pointer-events-none transition-all duration-700`} 
        />

        {/* Top Header com Status e Navegação */}
        <div className="flex items-center justify-between px-4 sm:px-5 pt-3.5 pb-2 relative z-10 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border ${active.tagColor}`}>
              {active.tag}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrent(prev => (prev === 0 ? 1 : 0))}
              className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex items-center gap-1 px-1">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrent(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    current === idx ? "w-5 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40"
                  }`}
                  aria-label={`Ir para slide ${idx + 1}`}
                />
              ))}
            </div>
            <button
              onClick={() => setCurrent(prev => (prev === 0 ? 1 : 0))}
              className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Próximo slide"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Corpo do Slide Ativo */}
        <div className="p-4 sm:p-5 relative z-10">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            
            {/* Ícone com Moldura Premium */}
            <div className={`p-3 rounded-2xl bg-neutral-950/80 border border-white/10 ${active.iconColor} ${active.iconGlow} shrink-0`}>
              <IconComp className="size-6 sm:size-7" />
            </div>

            {/* Textos e Badge */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white text-base sm:text-lg font-bold tracking-tight">
                  {active.title}
                </h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${active.benefitBadgeColor}`}>
                  {active.benefitBadge}
                </span>
              </div>
              <p className="text-muted-foreground text-xs sm:text-xs mt-1 leading-relaxed">
                {active.desc}
              </p>
            </div>
          </div>

          {/* Botão de Ação Alinhado e com visual fino */}
          <div className="mt-4 pt-3 flex items-center justify-end border-t border-white/5">
            <a
              href={active.btnHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-tight transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${active.btnBg}`}
            >
              <span>{active.btnText}</span>
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>

        {/* Rodapé Fixo Destacado: O Combo dos R$ 10 OFF */}
        <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-neutral-950/90 border-t border-white/10 flex items-center justify-center gap-2 text-center relative z-10">
          <Sparkles className="size-3.5 text-amber-400 shrink-0" />
          <p className="text-[11px] sm:text-xs text-neutral-300 font-medium">
            <strong className="text-white">Dica:</strong> Juntando ambos os passos você garante <span className="text-emerald-400 font-bold">R$ 10 OFF</span> no seu pod!
          </p>
        </div>

      </div>
    </div>
  );
}
