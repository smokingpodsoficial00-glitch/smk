import React, { useState, useEffect } from "react";

const SUPPORT_WHATSAPP_NUMBER = "5511977300561";
const SUPPORT_MESSAGE = encodeURIComponent("Olá! Preciso de ajuda ou suporte técnico com o sistema.");
const WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${SUPPORT_MESSAGE}`;

export function FloatingSupportButton() {
  const [isTourActive, setIsTourActive] = useState(false);

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

  return (
    <aside
      aria-label="Botão de Suporte WhatsApp"
      className={`fixed bottom-5 right-5 z-40 transition-all duration-300 ease-out select-none ${
        isTourActive
          ? "opacity-0 pointer-events-none translate-y-4 scale-90"
          : "opacity-100 pointer-events-auto translate-y-0 scale-100"
      }`}
    >
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Suporte para dúvidas no WhatsApp (11 97730-0561)"
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[#0d1410]/95 hover:bg-[#121c16] backdrop-blur-md border border-emerald-500/40 hover:border-[#25D366] text-white shadow-[0_4px_25px_rgba(0,0,0,0.8),0_0_20px_rgba(37,211,102,0.25)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.9),0_0_30px_rgba(37,211,102,0.5)] transition-all duration-300 group cursor-pointer active:scale-95"
      >
        {/* Ícone Oficial WhatsApp com pulso de notificação */}
        <div className="relative flex items-center justify-center size-8 rounded-full bg-[#25D366] text-black shadow-[0_0_15px_rgba(37,211,102,0.6)] shrink-0 group-hover:scale-105 transition-transform">
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

        {/* Textos explicativos */}
        <div className="flex flex-col text-left pr-1">
          <span className="text-xs font-bold text-white tracking-tight leading-tight group-hover:text-emerald-300 transition-colors">
            Suporte para dúvidas
          </span>
          <span className="text-[10px] font-medium text-emerald-400/90 leading-tight flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            WhatsApp Online
          </span>
        </div>
      </a>
    </aside>
  );
}
