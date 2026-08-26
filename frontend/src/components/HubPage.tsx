import { useState, useMemo } from "react";
import { 
  Package, 
  MessageCircle, 
  Crown, 
  Truck, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  ChevronRight, 
  Share2, 
  Check, 
  Sparkles,
  AlertTriangle
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";

interface HubPageProps {
  onOpenMenu: () => void;
}

export function HubPage({ onOpenMenu }: HubPageProps) {
  const { config } = useStoreConfig();
  const [copied, setCopied] = useState(false);

  const storeName = config?.store_name || "Smoking Pods";
  const whatsappNumber = config?.whatsapp_number?.replace(/\D/g, "") || "5511977300561";
  
  // Link para o WhatsApp com mensagem pré-formatada
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Olá! Vim pelo Link da Bio e gostaria de ver os sabores disponíveis e fazer um pedido."
  )}`;

  // Link para o Grupo VIP do WhatsApp
  const vipGroupUrl = (config as any)?.vip_group_url || "https://chat.whatsapp.com/Bk2rFAAgHlvKgc8pQANqYg";

  // Verificação dinâmica de status de funcionamento (Horário de SP)
  const isCurrentlyOpen = useMemo(() => {
    try {
      const now = new Date();
      // Converte para horário de São Paulo (UTC-3)
      const spTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const day = spTime.getDay(); // 0 = Domingo, 1-6 = Seg a Sáb
      const hours = spTime.getHours();
      const minutes = spTime.getMinutes();
      const currentDecimalTime = hours + minutes / 60;

      if (day === 0) {
        // Domingo: 13h às 20h
        return currentDecimalTime >= 13 && currentDecimalTime < 20;
      } else {
        // Seg a Sáb: 11h às 23h
        return currentDecimalTime >= 11 && currentDecimalTime < 23;
      }
    } catch {
      return true;
    }
  }, []);

  const handleShare = async () => {
    const url = window.location.origin + "/hub";
    if (navigator.share) {
      try {
        await navigator.share({
          title: storeName,
          text: "Confira o catálogo e faça seu pedido na Smoking Pods!",
          url: url,
        });
        return;
      } catch {
        // Fallback para cópia de link
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-8 sm:py-14 relative overflow-x-hidden selection:bg-white/20 selection:text-white">
      {/* Luzes ambiente de fundo (Glow sutil no topo) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-md sm:max-w-lg flex flex-col gap-6 sm:gap-7 relative z-10">
        
        {/* 1. Header / Identidade Visual Tipográfica Centralizada */}
        <header className="flex flex-col items-center text-center gap-3 pt-2">
          {/* Status em Tempo Real (Pill Animado com Vidro Fosco) */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900/60 backdrop-blur-2xl border border-white/15 text-[11px] font-medium text-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
            <span className="relative flex h-2 w-2">
              {isCurrentlyOpen ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
              )}
            </span>
            <span>
              {isCurrentlyOpen 
                ? "Atendimento Online & Entregas Ativas" 
                : "Modo Noturno • Entregas a partir das 11h"}
            </span>
          </div>

          {/* Nome da Loja (Tipografia Exata do Cardápio) */}
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mt-1 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            {storeName}
          </h1>

          {/* Subtítulo Oficial */}
          <p className="text-muted-foreground text-xs sm:text-sm max-w-xs sm:max-w-sm font-medium">
            Pedido finalizado em segundos pelo WhatsApp.
          </p>
        </header>

        {/* 2. Os 3 Botões de Ação Principais (CTAs com Glassmorphism Real) */}
        <section className="flex flex-col gap-3.5 mt-2" aria-label="Ações Principais">
          
          {/* CTA 1: Cardápio Digital Interativo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onOpenMenu();
            }}
            className="group relative w-full text-left p-4 sm:p-5 rounded-2xl bg-neutral-900/50 backdrop-blur-2xl border border-white/20 hover:border-white/60 transition-all duration-300 hover:-translate-y-0.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] cursor-pointer overflow-hidden block"
          >
            {/* Shimmer/Brilho de fundo no hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border border-white/20 backdrop-blur-md">
                <Sparkles className="size-2.5 text-amber-400 fill-amber-400" />
                🔥 Catálogo Ao Vivo
              </span>
              <ChevronRight className="size-4 sm:size-5 text-muted-foreground group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="flex items-start gap-3.5 mt-2">
              <div className="p-2.5 sm:p-3 rounded-xl bg-elevated/80 backdrop-blur-md border border-white/10 text-white group-hover:bg-white group-hover:text-black transition-colors shrink-0">
                <Package className="size-5 sm:size-6" />
              </div>
              <div className="flex flex-col min-w-0 pr-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                  Acessar Cardápio Digital Interativo
                </h2>
                <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
                  Monte seu carrinho e veja os sabores disponíveis em tempo real
                </p>
              </div>
            </div>
          </a>

          {/* CTA 2: Fazer Pedido Direto no WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative w-full text-left p-4 sm:p-5 rounded-2xl bg-neutral-900/50 backdrop-blur-2xl border border-white/10 hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-0.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] cursor-pointer block"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20 backdrop-blur-md">
                ⚡ Atendimento Rápido
              </span>
              <ChevronRight className="size-4 sm:size-5 text-muted-foreground group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="flex items-start gap-3.5 mt-2">
              <div className="p-2.5 sm:p-3 rounded-xl bg-elevated/80 backdrop-blur-md border border-white/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-colors shrink-0">
                <MessageCircle className="size-5 sm:size-6" />
              </div>
              <div className="flex flex-col min-w-0 pr-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                  Fazer Pedido Direto no WhatsApp
                </h2>
                <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
                  Fale com nosso atendimento rápido e tire suas dúvidas
                </p>
              </div>
            </div>
          </a>

          {/* CTA 3: Entrar no Clube VIP do WhatsApp */}
          <a
            href={vipGroupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative w-full text-left p-4 sm:p-5 rounded-2xl bg-neutral-900/50 backdrop-blur-2xl border border-white/10 hover:border-amber-400/50 transition-all duration-300 hover:-translate-y-0.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_0_30px_rgba(251,191,36,0.15)] cursor-pointer block"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border border-amber-400/20 backdrop-blur-md">
                🔕 Grupo Silenciado
              </span>
              <ChevronRight className="size-4 sm:size-5 text-muted-foreground group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="flex items-start gap-3.5 mt-2">
              <div className="p-2.5 sm:p-3 rounded-xl bg-elevated/80 backdrop-blur-md border border-white/10 text-amber-400 group-hover:bg-amber-400 group-hover:text-black transition-colors shrink-0">
                <Crown className="size-5 sm:size-6" />
              </div>
              <div className="flex flex-col min-w-0 pr-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                  Entrar no Clube VIP do WhatsApp
                </h2>
                <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
                  Participe de sorteios, cupons de frete e avisos de novos estoques
                </p>
              </div>
            </div>
          </a>
        </section>

        {/* 3. Badges de Autoridade & Prova Social (Grid 3 Colunas com Vidro Fosco) */}
        <section className="grid grid-cols-3 gap-2.5 sm:gap-3" aria-label="Garantias e Autoridade">
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-neutral-900/50 backdrop-blur-2xl border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] gap-1.5">
            <Truck className="size-5 text-white/80" />
            <h3 className="text-[11px] sm:text-xs font-bold text-white leading-tight">Delivery Rápido</h3>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">25 a 35 min em SBC e ABC</p>
          </div>

          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-neutral-900/50 backdrop-blur-2xl border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] gap-1.5">
            <ShieldCheck className="size-5 text-white/80" />
            <h3 className="text-[11px] sm:text-xs font-bold text-white leading-tight">100% Originais</h3>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Lacrados com procedência</p>
          </div>

          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-neutral-900/50 backdrop-blur-2xl border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] gap-1.5">
            <CheckCircle2 className="size-5 text-white/80" />
            <h3 className="text-[11px] sm:text-xs font-bold text-white leading-tight">+10.000 Pedidos</h3>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Entregues desde 2023</p>
          </div>
        </section>

        {/* 4. Card de Horários de Funcionamento & Região */}
        <section className="p-4 rounded-2xl bg-neutral-900/50 backdrop-blur-2xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-elevated/80 backdrop-blur-md text-white/90 shrink-0 border border-white/5">
              <Clock className="size-4" />
            </div>
            <div className="flex flex-col text-xs sm:text-[13px]">
              <span className="font-semibold text-white">Horários de Funcionamento</span>
              <span className="text-muted-foreground mt-0.5">Segunda a Sábado: 11:00 às 23:00</span>
              <span className="text-muted-foreground">Domingos e Feriados: 13:00 às 20:00</span>
            </div>
          </div>

          <div className="h-px bg-white/10 w-full" />

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-elevated/80 backdrop-blur-md text-white/90 shrink-0 border border-white/5">
              <MapPin className="size-4" />
            </div>
            <div className="flex flex-col text-xs sm:text-[13px]">
              <span className="font-semibold text-white">Região Atendida</span>
              <span className="text-muted-foreground mt-0.5">São Bernardo do Campo & Grande ABC - SP (Uber Direct)</span>
            </div>
          </div>
        </section>

        {/* Botão de Compartilhar Link da Bio */}
        <div className="flex justify-center">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900/60 backdrop-blur-2xl hover:bg-elevated text-xs font-medium text-white/80 hover:text-white transition-all cursor-pointer border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Link Copiado!</span>
              </>
            ) : (
              <>
                <Share2 className="size-3.5" />
                <span>Compartilhar Link da Bio</span>
              </>
            )}
          </button>
        </div>

        {/* 5. Compliance & Rodapé */}
        <footer className="flex flex-col items-center text-center gap-2 pt-2 pb-6 text-muted-foreground text-[11px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] backdrop-blur-md border border-white/5 text-[10px] sm:text-[11px] text-white/60">
            <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
            <span>Proibido para menores de 18 anos. Produtos restritos a adultos.</span>
          </div>

          <p className="mt-2 text-white/40">
            © {new Date().getFullYear()} {storeName} • Todos os direitos reservados.
          </p>
        </footer>

      </div>
    </main>
  );
}
