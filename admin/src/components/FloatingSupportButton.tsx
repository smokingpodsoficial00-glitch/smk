import React, { useState, useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";

const SUPPORT_WHATSAPP_NUMBER = "5511977300561";
const SUPPORT_MESSAGE = encodeURIComponent("Olá! Preciso de ajuda ou suporte técnico com o sistema.");
const WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${SUPPORT_MESSAGE}`;

export function FloatingSupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSmokeActive, setIsSmokeActive] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const smokeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

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

  // Dispara a animação de fumaça ao abrir
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      setIsOpen(true);
      setIsSmokeActive(true);
      if (smokeTimeoutRef.current) clearTimeout(smokeTimeoutRef.current);
      // Fumaça ativa por 2 segundos durante a transição
      smokeTimeoutRef.current = setTimeout(() => {
        setIsSmokeActive(false);
      }, 2000);
    } else {
      setIsOpen(false);
    }
  };

  const handleOpenWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  return (
    <>
      {/* Estilos e Keyframes da Fumaça de Pod & Revelação */}
      <style>{`
        @keyframes smokeRise1 {
          0% {
            transform: translate(0px, 20px) scale(0.3) rotate(0deg);
            opacity: 0;
            filter: blur(6px);
          }
          20% {
            opacity: 0.85;
            filter: blur(10px);
          }
          60% {
            opacity: 0.5;
            filter: blur(18px);
          }
          100% {
            transform: translate(-35px, -90px) scale(2.8) rotate(55deg);
            opacity: 0;
            filter: blur(26px);
          }
        }

        @keyframes smokeRise2 {
          0% {
            transform: translate(10px, 25px) scale(0.2) rotate(0deg);
            opacity: 0;
            filter: blur(8px);
          }
          25% {
            opacity: 0.9;
            filter: blur(14px);
          }
          65% {
            opacity: 0.45;
            filter: blur(20px);
          }
          100% {
            transform: translate(30px, -110px) scale(3.2) rotate(-45deg);
            opacity: 0;
            filter: blur(30px);
          }
        }

        @keyframes smokeRise3 {
          0% {
            transform: translate(-5px, 15px) scale(0.4);
            opacity: 0;
            filter: blur(6px);
          }
          30% {
            opacity: 0.8;
            filter: blur(12px);
          }
          100% {
            transform: translate(-15px, -80px) scale(2.4);
            opacity: 0;
            filter: blur(22px);
          }
        }

        @keyframes smokeMistEmerald {
          0% {
            transform: translate(0px, 10px) scale(0.4);
            opacity: 0;
            filter: blur(12px);
          }
          35% {
            opacity: 0.65;
            filter: blur(18px);
          }
          100% {
            transform: translate(-50px, -70px) scale(3.5);
            opacity: 0;
            filter: blur(32px);
          }
        }

        @keyframes textSmokePull {
          0% {
            opacity: 0;
            transform: translateX(18px) scale(0.92);
            filter: blur(8px);
          }
          40% {
            opacity: 0.7;
            filter: blur(3px);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
            filter: blur(0px);
          }
        }

        .smoke-puff-base {
          position: absolute;
          border-radius: 9999px;
          pointer-events: none;
          mix-blend-mode: screen;
        }

        .smoke-puff-1 {
          width: 70px;
          height: 70px;
          bottom: 15px;
          right: 15px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(200, 245, 220, 0.5) 45%, rgba(37, 211, 102, 0.2) 70%, transparent 100%);
          animation: smokeRise1 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .smoke-puff-2 {
          width: 85px;
          height: 85px;
          bottom: 10px;
          right: 5px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.85) 0%, rgba(220, 255, 235, 0.45) 40%, rgba(16, 185, 129, 0.2) 70%, transparent 100%);
          animation: smokeRise2 1.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
        }

        .smoke-puff-3 {
          width: 60px;
          height: 60px;
          bottom: 20px;
          right: 25px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(230, 250, 240, 0.6) 45%, transparent 100%);
          animation: smokeRise3 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.05s forwards;
        }

        .smoke-puff-emerald {
          width: 95px;
          height: 95px;
          bottom: 5px;
          right: 10px;
          background: radial-gradient(circle, rgba(37, 211, 102, 0.7) 0%, rgba(16, 185, 129, 0.35) 45%, transparent 100%);
          animation: smokeMistEmerald 1.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <aside
        ref={containerRef}
        aria-label="Botão de Suporte WhatsApp"
        className={`fixed bottom-5 right-5 z-40 transition-all duration-300 ease-out select-none ${
          isTourActive
            ? "opacity-0 pointer-events-none translate-y-4 scale-90"
            : "opacity-100 pointer-events-auto translate-y-0 scale-100"
        }`}
      >
        <div className="relative flex items-center justify-end">
          
          {/* Nuvens de Fumaça de Vapor (Smoking Pods Vapor) */}
          {isSmokeActive && (
            <div className="absolute -top-24 -right-12 w-64 h-64 pointer-events-none overflow-visible z-50">
              <div className="smoke-puff-base smoke-puff-emerald" />
              <div className="smoke-puff-base smoke-puff-1" />
              <div className="smoke-puff-base smoke-puff-2" />
              <div className="smoke-puff-base smoke-puff-3" />
            </div>
          )}

          {/* ━━━ ESTADO 1: ABERTO (Pílula Completa puxada pela fumaça) ━━━ */}
          {isOpen ? (
            <div
              onClick={handleOpenWhatsApp}
              title="Abrir suporte direto no WhatsApp"
              className="flex items-center gap-3 pl-3 pr-2.5 py-2.5 rounded-full bg-[#0a0f0c]/95 hover:bg-[#0f1712] backdrop-blur-md border border-emerald-500/50 hover:border-[#25D366] text-white shadow-[0_8px_32px_rgba(0,0,0,0.85),0_0_25px_rgba(37,211,102,0.35)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.95),0_0_35px_rgba(37,211,102,0.55)] transition-all duration-300 cursor-pointer active:scale-98 group animate-in fade-in zoom-in-95 duration-200"
            >
              {/* Ícone Oficial WhatsApp */}
              <div className="relative flex items-center justify-center size-9 rounded-full bg-[#25D366] text-black shadow-[0_0_15px_rgba(37,211,102,0.6)] shrink-0 group-hover:scale-105 transition-transform">
                <svg
                  className="size-5 fill-black"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-300 animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400" />
              </div>

              {/* Textos de Suporte (Efeito Fumaça Puxando a Escrita) */}
              <div 
                className="flex flex-col text-left pr-1"
                style={{ animation: "textSmokePull 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
              >
                <span className="text-xs font-bold text-white tracking-tight leading-tight group-hover:text-emerald-300 transition-colors flex items-center gap-1.5">
                  <span>Suporte para dúvidas</span>
                  <ExternalLink className="size-3 text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                </span>
                <span className="text-[10px] font-medium text-emerald-400/90 leading-tight flex items-center gap-1 mt-0.5">
                  <span className="size-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  WhatsApp Online
                </span>
              </div>

              {/* Botão de Fechar discreto */}
              <button
                type="button"
                onClick={handleClose}
                title="Fechar"
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            /* ━━━ ESTADO 2: FECHADO (Apenas o símbolo do WhatsApp no cantinho) ━━━ */
            <button
              type="button"
              onClick={handleToggle}
              title="Suporte para dúvidas no WhatsApp"
              className="relative flex items-center justify-center size-12 rounded-full bg-[#0d1410]/95 hover:bg-[#121c16] backdrop-blur-md border border-emerald-500/40 hover:border-[#25D366] text-white shadow-[0_4px_25px_rgba(0,0,0,0.8),0_0_20px_rgba(37,211,102,0.25)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.9),0_0_30px_rgba(37,211,102,0.55)] transition-all duration-300 group cursor-pointer active:scale-95"
            >
              <div className="relative flex items-center justify-center size-8 rounded-full bg-[#25D366] text-black shadow-[0_0_15px_rgba(37,211,102,0.6)] group-hover:scale-110 transition-transform">
                <svg
                  className="size-4.5 fill-black"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-300 animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400" />
              </div>
            </button>
          )}

        </div>
      </aside>
    </>
  );
}
