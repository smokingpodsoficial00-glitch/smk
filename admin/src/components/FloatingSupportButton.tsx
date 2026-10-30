import React, { useState, useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";

const SUPPORT_WHATSAPP_NUMBER = "5511977300561";
const SUPPORT_MESSAGE = encodeURIComponent("Olá! Preciso de ajuda ou suporte técnico com o sistema.");
const WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${SUPPORT_MESSAGE}`;

export function FloatingSupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleToggleOrOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      setIsOpen(true);
    } else {
      window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  return (
    <aside
      ref={containerRef}
      aria-label="Botão de Suporte WhatsApp"
      className={`fixed bottom-5 right-5 z-40 select-none transition-all duration-300 ease-out ${
        isTourActive
          ? "opacity-0 pointer-events-none translate-y-4 scale-90"
          : "opacity-100 pointer-events-auto translate-y-0 scale-100"
      }`}
    >
      <div className="relative flex items-center justify-end">
        
        {/* Container Expansível com Transição Suave */}
        <div
          onClick={handleToggleOrOpen}
          title={isOpen ? "Clique para abrir suporte no WhatsApp" : "Abrir suporte para dúvidas"}
          className={`relative flex items-center overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer active:scale-98 backdrop-blur-md text-white group ${
            isOpen
              ? "w-[280px] sm:w-[295px] h-12 pl-2.5 pr-2 rounded-full bg-[#090f0c]/95 hover:bg-[#0e1713] border border-emerald-500/50 hover:border-[#25D366] shadow-[0_8px_32px_rgba(0,0,0,0.85),0_0_25px_rgba(37,211,102,0.35)]"
              : "w-12 h-12 rounded-full bg-[#0d1410]/95 hover:bg-[#121c16] border border-emerald-500/40 hover:border-[#25D366] shadow-[0_4px_25px_rgba(0,0,0,0.8),0_0_20px_rgba(37,211,102,0.25)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.9),0_0_30px_rgba(37,211,102,0.55)] justify-center hover:scale-105"
          }`}
        >
          {/* Ícone Oficial WhatsApp */}
          <div
            className={`relative flex items-center justify-center size-8.5 rounded-full bg-[#25D366] text-black shadow-[0_0_15px_rgba(37,211,102,0.6)] shrink-0 transition-transform duration-300 ${
              !isOpen ? "group-hover:scale-110" : "group-hover:scale-105"
            }`}
          >
            <svg
              className="size-4.5 fill-black"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-300 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400" />
          </div>

          {/* Escrita Revelada Suavemente ao Abrir */}
          {isOpen && (
            <div className="flex items-center justify-between flex-1 min-w-0 pl-2.5 pr-1 animate-in fade-in slide-in-from-right-3 duration-300">
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
                title="Recolher"
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0 ml-1.5 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>
    </aside>
  );
}
