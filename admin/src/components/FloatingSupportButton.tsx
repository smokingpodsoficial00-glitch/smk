import React, { useState, useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";

const SUPPORT_WHATSAPP_NUMBER = "5511977300561";
const SUPPORT_MESSAGE = encodeURIComponent("Olá! Preciso de ajuda ou suporte técnico com o sistema.");
const WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${SUPPORT_MESSAGE}`;

type AnimState = "idle" | "firing" | "smoking" | "pulling" | "open";

export function FloatingSupportButton() {
  const [animState, setAnimState] = useState<AnimState>("idle");
  const [isTourActive, setIsTourActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const isOpen = animState === "pulling" || animState === "open";
  const isSmokeActive = animState === "firing" || animState === "smoking" || animState === "pulling";

  // Limpa timers ao desmontar
  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (animState === "open") {
          setAnimState("idle");
        }
      }
    }
    if (animState === "open") {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [animState]);

  // Listener para ocultar quando o Tour estiver ativo
  useEffect(() => {
    const handleTourVisibility = (e: Event) => {
      const customEvent = e as CustomEvent<{ isTourActive: boolean }>;
      if (customEvent.detail !== undefined) {
        setIsTourActive(Boolean(customEvent.detail.isTourActive));
      }
    };

    window.addEventListener("tour-visibility-change", handleTourVisibility);
    return () => window.removeEventListener("tour-visibility-change", handleTourVisibility);
  }, []);

  // Dispara a sequência cinematográfica de fumaça de vape & puxada da escrita
  const handleTriggerSmokeAndOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (animState !== "idle") return;

    clearAllTimers();

    // 1. DISPARO DO POD (0ms): Botão aquece/pulsa com luz verde
    setAnimState("firing");

    // 2. FUMAÇA DE VAPE EXPLODE (80ms): Nuvem densa de vapor sai do WhatsApp e avança pra esquerda
    const t1 = setTimeout(() => {
      setAnimState("smoking");
    }, 80);

    // 3. PUXADA DO WHATSAPP (260ms): A fumaça arrasta e puxa a barra de escrita para frente
    const t2 = setTimeout(() => {
      setAnimState("pulling");
    }, 260);

    // 4. FIXAÇÃO E NITIDEZ (750ms): Escrita sólida, fumaça se dissipa no ar
    const t3 = setTimeout(() => {
      setAnimState("open");
    }, 750);

    timersRef.current = [t1, t2, t3];
  };

  const handleOpenWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearAllTimers();
    setAnimState("idle");
  };

  return (
    <>
      {/* Filtro SVG Orgânico para Fumaça Realista de Pod / Cigarro */}
      <svg className="fixed pointer-events-none" style={{ width: 0, height: 0, position: "absolute" }}>
        <defs>
          <filter id="vapeCloudSmoke" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="28" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="5" />
          </filter>
          <filter id="vapeTendrilSmoke" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="12" result="noise2" />
            <feDisplacementMap in="SourceGraphic" in2="noise2" scale="22" xChannelSelector="R" yChannelSelector="G" result="displaced2" />
            <feGaussianBlur in="displaced2" stdDeviation="4" />
          </filter>
        </defs>
      </svg>

      {/* Animações e Keyframes da Fumaça de Cigarro / Pod saindo e puxando o texto */}
      <style>{`
        /* Jato 1: O tiro principal do vapor sendo exalado para a esquerda */
        @keyframes vapePlumeLeading {
          0% {
            transform: translate(0px, 0px) scale(0.25) rotate(0deg);
            opacity: 0;
            filter: blur(4px);
          }
          20% {
            opacity: 0.95;
            filter: blur(8px);
          }
          60% {
            opacity: 0.7;
            filter: blur(14px);
          }
          100% {
            transform: translate(-230px, -35px) scale(2.8) rotate(25deg);
            opacity: 0;
            filter: blur(24px);
          }
        }

        /* Jato 2: Nuvem superior que se expande para cima e para frente */
        @keyframes vapePlumeUpper {
          0% {
            transform: translate(5px, 5px) scale(0.3) rotate(0deg);
            opacity: 0;
            filter: blur(5px);
          }
          25% {
            opacity: 0.9;
            filter: blur(10px);
          }
          65% {
            opacity: 0.55;
            filter: blur(16px);
          }
          100% {
            transform: translate(-170px, -70px) scale(3.2) rotate(-35deg);
            opacity: 0;
            filter: blur(28px);
          }
        }

        /* Jato 3: O rolo central denso de vapor que puxa a escrita */
        @keyframes vapePlumeDragging {
          0% {
            transform: translate(0px, 0px) scale(0.3);
            opacity: 0;
            filter: blur(4px);
          }
          30% {
            opacity: 0.95;
            filter: blur(8px);
          }
          70% {
            opacity: 0.6;
            filter: blur(15px);
          }
          100% {
            transform: translate(-130px, -20px) scale(2.4);
            opacity: 0;
            filter: blur(22px);
          }
        }

        /* Jato 4: Filete fino de fumaça de cigarro/pod subindo e ondulando */
        @keyframes vapeTendrilRise {
          0% {
            transform: translate(0px, 0px) scale(0.4) rotate(0deg);
            opacity: 0;
            filter: blur(3px);
          }
          30% {
            opacity: 0.8;
            filter: blur(6px);
          }
          75% {
            opacity: 0.4;
            filter: blur(12px);
          }
          100% {
            transform: translate(-80px, -95px) scale(2.0) rotate(40deg);
            opacity: 0;
            filter: blur(18px);
          }
        }

        /* Jato 5: Brilho de névoa esmeralda iluminando a fumaça branca */
        @keyframes vapeMistEmerald {
          0% {
            transform: translate(0px, 0px) scale(0.3);
            opacity: 0;
            filter: blur(8px);
          }
          35% {
            opacity: 0.75;
            filter: blur(14px);
          }
          100% {
            transform: translate(-180px, -45px) scale(3.0);
            opacity: 0;
            filter: blur(28px);
          }
        }

        /* Revelação da escrita puxada pela fumaça */
        @keyframes textPulledBySmoke {
          0% {
            opacity: 0;
            transform: translateX(40px) scale(0.85);
            filter: blur(14px);
          }
          50% {
            opacity: 0.75;
            transform: translateX(8px) scale(0.96);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateX(0px) scale(1);
            filter: blur(0px);
          }
        }

        /* Partículas de Fumaça */
        .vape-smoke-particle {
          position: absolute;
          border-radius: 9999px;
          pointer-events: none;
          mix-blend-mode: screen;
        }

        .smoke-puff-leading {
          width: 80px;
          height: 80px;
          bottom: 0px;
          right: 0px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.98) 0%, rgba(235, 248, 240, 0.7) 35%, rgba(200, 235, 220, 0.35) 60%, transparent 100%);
          filter: url(#vapeCloudSmoke);
          animation: vapePlumeLeading 1.7s cubic-bezier(0.12, 0.8, 0.32, 1) forwards;
        }

        .smoke-puff-upper {
          width: 90px;
          height: 90px;
          bottom: 10px;
          right: -10px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(225, 245, 235, 0.6) 40%, rgba(180, 220, 205, 0.25) 70%, transparent 100%);
          filter: url(#vapeCloudSmoke);
          animation: vapePlumeUpper 1.9s cubic-bezier(0.12, 0.8, 0.32, 1) 0.05s forwards;
        }

        .smoke-puff-dragging {
          width: 75px;
          height: 75px;
          bottom: 5px;
          right: 15px;
          background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(240, 250, 245, 0.8) 45%, rgba(190, 230, 215, 0.3) 75%, transparent 100%);
          filter: url(#vapeCloudSmoke);
          animation: vapePlumeDragging 1.6s cubic-bezier(0.12, 0.8, 0.32, 1) 0.1s forwards;
        }

        .smoke-puff-tendril {
          width: 55px;
          height: 55px;
          bottom: 15px;
          right: 5px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(230, 245, 235, 0.5) 45%, transparent 100%);
          filter: url(#vapeTendrilSmoke);
          animation: vapeTendrilRise 1.8s cubic-bezier(0.16, 1, 0.3, 1) 0.12s forwards;
        }

        .smoke-puff-emerald-glow {
          width: 100px;
          height: 100px;
          bottom: -5px;
          right: -5px;
          background: radial-gradient(circle, rgba(37, 211, 102, 0.8) 0%, rgba(16, 185, 129, 0.4) 40%, transparent 100%);
          filter: url(#vapeCloudSmoke);
          animation: vapeMistEmerald 2.0s cubic-bezier(0.12, 0.8, 0.32, 1) forwards;
        }
      `}</style>

      <aside
        ref={containerRef}
        aria-label="Suporte WhatsApp com Animação de Vape Smoke"
        className={`fixed bottom-5 right-5 z-40 select-none transition-all duration-300 ease-out ${
          isTourActive
            ? "opacity-0 pointer-events-none translate-y-4 scale-90"
            : "opacity-100 pointer-events-auto translate-y-0 scale-100"
        }`}
      >
        <div className="relative flex items-center justify-end">

          {/* ━━━ NUVEM REALISTA DE FUMAÇA DE VAPE / CIGARRO ━━━ */}
          {isSmokeActive && (
            <div className="absolute -bottom-6 -right-6 w-96 h-80 pointer-events-none overflow-visible z-50">
              <div className="vape-smoke-particle smoke-puff-emerald-glow" />
              <div className="vape-smoke-particle smoke-puff-leading" />
              <div className="vape-smoke-particle smoke-puff-upper" />
              <div className="vape-smoke-particle smoke-puff-dragging" />
              <div className="vape-smoke-particle smoke-puff-tendril" />
            </div>
          )}

          {/* ━━━ ESTRUTURA EXPANSÍVEL (PUXADA PELA FUMAÇA) ━━━ */}
          <div
            onClick={isOpen ? handleOpenWhatsApp : handleTriggerSmokeAndOpen}
            className={`relative flex items-center overflow-hidden transition-all duration-500 cursor-pointer ${
              isOpen
                ? "w-[285px] sm:w-[305px] h-13 pl-2.5 pr-2 rounded-full bg-[#080d0a]/95 hover:bg-[#0c140f] border border-emerald-500/50 hover:border-[#25D366] shadow-[0_10px_35px_rgba(0,0,0,0.9),0_0_25px_rgba(37,211,102,0.35)]"
                : "w-12 h-12 rounded-full bg-[#0d1410]/95 hover:bg-[#121c16] border border-emerald-500/40 hover:border-[#25D366] shadow-[0_4px_25px_rgba(0,0,0,0.8),0_0_20px_rgba(37,211,102,0.25)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.9),0_0_30px_rgba(37,211,102,0.55)] justify-center"
            } ${
              animState === "firing" ? "scale-110 ring-4 ring-[#25D366]/40 shadow-[0_0_30px_rgba(37,211,102,0.8)]" : ""
            } active:scale-95 backdrop-blur-md text-white group`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Ícone Oficial WhatsApp (Firme e no centro quando fechado, desliza à esquerda quando aberto) */}
            <div
              className={`relative flex items-center justify-center size-9 rounded-full bg-[#25D366] text-black shadow-[0_0_15px_rgba(37,211,102,0.6)] shrink-0 transition-transform duration-300 ${
                !isOpen ? "group-hover:scale-110" : "group-hover:scale-105"
              }`}
            >
              <svg
                className="size-5 fill-black"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-300 animate-ping" />
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400" />
            </div>

            {/* ESCRITA REVELADA (Puxada de dentro da fumaça) */}
            {isOpen && (
              <div
                className="flex items-center justify-between flex-1 min-w-0 pl-2.5 pr-1"
                style={{
                  animation: "textPulledBySmoke 0.48s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              >
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-xs font-bold text-white tracking-tight leading-tight group-hover:text-emerald-300 transition-colors flex items-center gap-1.5 truncate">
                    <span>Suporte para dúvidas</span>
                    <ExternalLink className="size-3 text-emerald-400 opacity-60 group-hover:opacity-100 shrink-0" />
                  </span>
                  <span className="text-[10px] font-medium text-emerald-400/90 leading-tight flex items-center gap-1 mt-0.5">
                    <span className="size-1.5 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0" />
                    <span>WhatsApp Online</span>
                  </span>
                </div>

                {/* Botão Fechar discreto */}
                <button
                  type="button"
                  onClick={handleClose}
                  title="Fechar"
                  className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0 ml-1.5 cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>

        </div>
      </aside>
    </>
  );
}
