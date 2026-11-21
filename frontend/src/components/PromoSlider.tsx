import { useState, useEffect, useRef } from "react";
import { MessageCircle, Users, ArrowRight, Sparkles, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";

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
      stepBadge: "PASSO 01 • R$ 5 OFF",
      badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      glowColor: "from-emerald-500/10 via-transparent to-transparent",
      borderColor: "hover:border-emerald-500/40",
      icon: MessageCircle,
      iconBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      title: "Entre no Grupo VIP do WhatsApp",
      valueHighlight: "Ganhe R$ 5 OFF",
      description: "Acesso antecipado aos estoques, novidades e cupons semanais direto no WhatsApp.",
      buttonText: "Entrar no Grupo Agora",
      buttonHref: vipGroupUrl,
      buttonTarget: "_blank"
    },
    {
      id: "mgm-indication",
      stepBadge: "PASSO 02 • + R$ 5 OFF",
      badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      glowColor: "from-amber-500/10 via-transparent to-transparent",
      borderColor: "hover:border-amber-500/40",
      icon: Users,
      iconBg: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      title: "Indique 5 Amigos que Fumam Pod",
      valueHighlight: "Ganhe mais R$ 5 OFF",
      description: "Mande o contato de 5 amigos de SBC/ABC no nosso WhatsApp ao finalizar o seu pedido.",
      buttonText: "Indicar Amigos no WhatsApp",
      buttonHref: whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Opa! Vim pelo catálogo e quero enviar 5 contatos de amigos para garantir meu desconto de R$ 5 no pedido!")}`
        : "#",
      buttonTarget: "_blank"
    }
  ];

  // Auto-play suave a cada 5 segundos se não estiver pausado por hover ou touch
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrent(prev => (prev === 0 ? 1 : 0));
    }, 5000);
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
      if (diff > 0) {
        // Swipe para a esquerda -> próximo
        setCurrent(1);
      } else {
        // Swipe para a direita -> anterior
        setCurrent(0);
      }
    }
    touchStartX.current = null;
    setIsPaused(false);
  };

  return (
    <div 
      className="mt-6 sm:mt-8 max-w-xl mx-auto w-full px-1"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Container Principal do Card em Vidro Fosco */}
      <div className="relative rounded-2xl sm:rounded-3xl glass-strong border border-white/10 p-4 sm:p-5 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all">
        
        {/* Glow dinâmico de fundo */}
        <div 
          className={`absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br ${slides[current].glowColor} blur-3xl pointer-events-none transition-all duration-700`} 
        />

        {/* Header do Card: Título de Boas-Vindas & Controles de Slide */}
        <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase text-white/80">
              Desconto Especial de Hoje
            </span>
          </div>

          {/* Botões de Navegação discretos */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrent(prev => (prev === 0 ? 1 : 0))}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-[10px] text-white/50 font-mono px-1">
              {current + 1}/{slides.length}
            </span>
            <button
              onClick={() => setCurrent(prev => (prev === 0 ? 1 : 0))}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Próximo slide"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Área do Slide Deslizante */}
        <div className="relative overflow-hidden min-h-[140px] sm:min-h-[135px]">
          <div 
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {slides.map((slide, idx) => {
              const Icon = slide.icon;
              return (
                <div key={slide.id} className="w-full shrink-0 flex flex-col justify-between pr-0.5">
                  <div>
                    {/* Badge de Etapa / Desconto */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border tracking-wide ${slide.badgeColor}`}>
                        {slide.stepBadge}
                      </span>
                    </div>

                    {/* Título & Descrição */}
                    <div className="flex items-start gap-3">
                      <div className={`p-2 sm:p-2.5 rounded-xl border shrink-0 ${slide.iconBg}`}>
                        <Icon className="size-5 sm:size-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white text-sm sm:text-base font-bold tracking-tight leading-snug">
                          {slide.title}
                        </h3>
                        <p className="text-muted-foreground text-xs sm:text-xs mt-1 leading-relaxed">
                          {slide.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Ação do Slide */}
                  <div className="mt-3.5 pt-2 flex items-center justify-between gap-3 border-t border-white/5">
                    <span className="text-emerald-400 font-bold text-xs sm:text-sm">
                      {slide.valueHighlight}
                    </span>
                    <a
                      href={slide.buttonHref}
                      target={slide.buttonTarget}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-black hover:bg-white/90 text-xs font-semibold tracking-tight transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    >
                      <span>{slide.buttonText}</span>
                      <ArrowRight className="size-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Indicadores de Bolinha (Dots) interativos */}
        <div className="flex items-center justify-center gap-1.5 mt-3 pt-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                current === idx ? "w-6 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Ir para slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Rodapé Fixo Destacado: O Lembrete dos R$ 10 OFF Combinados */}
        <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-center bg-white/[0.02] -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 rounded-b-2xl sm:rounded-b-3xl">
          <Sparkles className="size-3.5 text-amber-400 shrink-0 animate-pulse" />
          <p className="text-[11px] sm:text-xs font-medium text-white/90">
            <span className="text-amber-300 font-bold">Dica de Ouro:</span> Juntando ambos os passos você garante <span className="underline decoration-emerald-400 underline-offset-2 font-bold text-white">R$ 10 OFF</span> no valor final do seu pod!
          </p>
        </div>

      </div>
    </div>
  );
}
