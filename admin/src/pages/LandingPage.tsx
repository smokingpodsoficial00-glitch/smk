import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  ArrowRight, 
  MessageCircle, 
  CheckCircle2, 
  Wallet, 
  TrendingUp, 
  MessageSquare, 
  Users, 
  Package, 
  Bell, 
  BarChart3, 
  ChevronDown, 
  ShieldCheck, 
  Star,
  Sparkles,
  Smartphone,
  ExternalLink,
  Flame,
  ShoppingBag,
  Store,
  Layers,
  Check,
  Clock,
  Truck,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Monitor,
  Menu,
  X
} from 'lucide-react';

function InstagramIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

// Componente inteligente: Se o print real existir em /prints/, exibe a imagem. Senão, exibe o mockup nativo.
function ScreenshotOrFallback({
  src,
  alt,
  fallback,
  className = "w-full rounded-2xl border border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.08)]"
}: {
  src: string;
  alt: string;
  fallback?: React.ReactNode;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full">
      {!error && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`${className} ${loaded ? 'block' : 'hidden'}`}
        />
      )}
      {(!loaded || error) && (fallback || (
        <div className="h-64 bg-[#0a0a0c] flex items-center justify-center text-white/40 text-xs font-mono">
          Visualização do Sistema
        </div>
      ))}
    </div>
  );
}

export function LandingPage() {
  // Contagem regressiva de lançamento (dias, horas, minutos, segundos)
  const [timeLeft, setTimeLeft] = useState({
    days: 6,
    hours: 14,
    minutes: 35,
    seconds: 22,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const whatsappLink = "https://wa.me/5511977300561?text=Ol%C3%A1!%20Vi%20a%20p%C3%A1gina%20do%20SMK%20System%20e%20quero%20tirar%20algumas%20d%C3%BAvidas%20sobre%20o%20sistema.";

  // Integração de Checkout Asaas com Fallback Seguro para Atendimento WhatsApp Oficial
  const asaasGestaoLink = (import.meta.env.VITE_ASAAS_GESTAO_URL as string) || "https://wa.me/5511977300561?text=Ol%C3%A1!%20Quero%20assinar%20o%20Plano%20SMK%20Gest%C3%A3o%20de%20R$%2097/m%C3%AAs%20com%20o%20pre%C3%A7o%20de%20lan%C3%A7amento%20vital%C3%ADcio";
  const asaasComboLink = (import.meta.env.VITE_ASAAS_COMBO_URL as string) || "https://wa.me/5511977300561?text=Ol%C3%A1!%20Quero%20garantir%20o%20Plano%20SMK%20Pro%20Combo%20de%20R$%20127,90/m%C3%AAs%20com%20Cat%C3%A1logo%20e%20pre%C3%A7o%20de%20lan%C3%A7amento%20vital%C3%ADcio";

  return (
    <div id="topo" className="min-h-screen bg-[#050505] text-white font-sans antialiased relative selection:bg-white/20 selection:text-white overflow-x-hidden">
      
      {/* Ambient White Glowing Neons */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-white/[0.04] blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute top-[1400px] left-1/4 -translate-x-1/2 w-[600px] h-[600px] bg-white/[0.02] blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute top-[2800px] right-1/4 translate-x-1/2 w-[700px] h-[700px] bg-white/[0.03] blur-[220px] rounded-full pointer-events-none" />
      <div className="absolute top-[4400px] left-1/3 -translate-x-1/2 w-[700px] h-[700px] bg-white/[0.02] blur-[220px] rounded-full pointer-events-none" />

      {/* ==================================================================== */}
      {/* 1 & 2. HEADER UNIFICADO (BANNER DE LANÇAMENTO + NAVBAR RESPONSIVA)   */}
      {/* ==================================================================== */}
      <div className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#050505]/95 border-b border-[#161616]">
        {/* Top Announcement Banner com Timer Regressivo */}
        <div className="w-full bg-gradient-to-r from-emerald-950/30 via-[#0c0c0c] to-emerald-950/30 border-b border-white/5 py-2 px-3 sm:px-4 text-center">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-white font-extrabold uppercase tracking-wider text-[11px] shrink-0">
              <Sparkles className="size-3.5 text-white animate-pulse" />
              <span>Oferta de Lançamento:</span>
            </div>
            <span className="text-white/70 hidden md:inline shrink-0">
              Trave sua mensalidade vitalícia sem reajustes pelos próximos 30 dias:
            </span>
            
            {/* Countdown Badge */}
            <div className="inline-flex items-center gap-1.5 bg-[#141414] border border-[#2a2a2a] px-2.5 py-0.5 rounded-lg font-mono text-[11px] font-bold text-white shadow-inner shrink-0">
              <span className="text-white">{String(timeLeft.days).padStart(2, '0')}d</span>
              <span className="text-white/30">:</span>
              <span className="text-white">{String(timeLeft.hours).padStart(2, '0')}h</span>
              <span className="text-white/30">:</span>
              <span className="text-white">{String(timeLeft.minutes).padStart(2, '0')}m</span>
              <span className="text-white/30">:</span>
              <span className="text-emerald-400">{String(timeLeft.seconds).padStart(2, '0')}s</span>
            </div>
          </div>
        </div>

        {/* Main Navbar */}
        <header className="w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4">
            
            {/* Logo Brand */}
            <a href="#topo" className="flex items-center gap-2.5 sm:gap-3 shrink-0 group">
              <div className="size-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform shrink-0">
                <Zap className="size-4 fill-white" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white whitespace-nowrap">
                  SMK System
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white font-semibold whitespace-nowrap hidden sm:inline-flex">
                  SaaS Pro
                </span>
              </div>
            </a>

            {/* Nav Links (Desktop) */}
            <nav className="hidden lg:flex items-center gap-3.5 xl:gap-5 2xl:gap-6 text-xs font-medium text-white/60">
              <a href="#dores" className="hidden 2xl:inline-block hover:text-white transition-colors whitespace-nowrap shrink-0">
                O Caos
              </a>
              <a href="#catalogo" className="text-white hover:text-white transition-colors font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <span>Catálogo na Bio</span>
                <span className="size-1.5 rounded-full bg-white animate-ping" />
              </a>
              <a href="#kanban" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
                Kanban & Despacho
              </a>
              <a href="#recompra" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
                CRM & Recompra
              </a>
              <a href="#estoque" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
                Estoque Parado
              </a>
              <a href="#socios" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
                Sócios
              </a>
              <a href="#case" className="hidden 2xl:inline-block hover:text-white transition-colors whitespace-nowrap shrink-0">
                Case Real
              </a>
              <a href="#planos" className="hover:text-white transition-colors font-bold text-white whitespace-nowrap shrink-0">
                Planos
              </a>
            </nav>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Link 
                to="/login" 
                className="text-xs font-bold text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors hidden sm:inline-flex whitespace-nowrap"
              >
                Entrar
              </Link>
              <Link 
                to="/cadastro" 
                className="text-xs font-bold text-white/90 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors hidden xl:inline-flex whitespace-nowrap"
              >
                Criar Conta
              </Link>
              <Link 
                to="/checkout?plano=combo"
                className="bg-white hover:bg-slate-100 text-black font-extrabold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
              >
                <span>Garantir Acesso</span>
                <ArrowRight className="size-3.5" />
              </Link>

              {/* Mobile Hamburger Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                aria-label="Abrir Menu de Navegação"
              >
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>

          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-white/10 bg-[#070707]/95 px-4 py-4 space-y-3 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                <a 
                  href="#dores" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors flex items-center gap-2"
                >
                  <span>⚡</span>
                  <span>O Caos</span>
                </a>
                <a 
                  href="#catalogo" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-white/10 border border-white/10 text-white font-bold transition-colors flex items-center gap-2"
                >
                  <span className="size-2 rounded-full bg-emerald-400" />
                  <span>Catálogo na Bio</span>
                </a>
                <a 
                  href="#kanban" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors flex items-center gap-2"
                >
                  <span>📦</span>
                  <span>Kanban & Despacho</span>
                </a>
                <a 
                  href="#recompra" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors flex items-center gap-2"
                >
                  <span>🔄</span>
                  <span>CRM & Recompra</span>
                </a>
                <a 
                  href="#estoque" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors flex items-center gap-2"
                >
                  <span>🏷️</span>
                  <span>Estoque Parado</span>
                </a>
                <a 
                  href="#socios" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors flex items-center gap-2"
                >
                  <span>🤝</span>
                  <span>Sócios</span>
                </a>
                <a 
                  href="#case" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors flex items-center gap-2"
                >
                  <span>🏆</span>
                  <span>Case Real</span>
                </a>
                <Link 
                  to="/checkout?plano=combo" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-white text-black font-extrabold transition-all flex items-center justify-between"
                >
                  <span>Garantir Acesso</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3 text-xs font-bold">
                <Link 
                  to="/login" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 py-2.5 text-center rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                >
                  Fazer Login
                </Link>
                <Link 
                  to="/cadastro" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 py-2.5 text-center rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-colors"
                >
                  Criar Conta
                </Link>
              </div>
            </div>
          )}
        </header>
      </div>

      {/* ==================================================================== */}
      {/* 3. HERO PRINCIPAL                                                    */}
      {/* ==================================================================== */}
      <section className="pt-16 pb-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          
          {/* Niche Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold shadow-[0_0_20px_rgba(255,255,255,0.15)]">
            <Zap className="size-3.5 fill-white text-white" />
            <span>O 1º Sistema de Gestão & Catálogo Feito Sob Medida para Lojas de Pods</span>
          </div>

          {/* Main Giant Glowing Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12] max-w-4xl mx-auto">
            A ferramenta que separa quem brinca de vender pod{' '}
            <span className="bg-gradient-to-r from-white via-slate-200 to-gray-400 bg-clip-text text-transparent underline decoration-white/30 decoration-2 underline-offset-8">
              de quem domina
            </span>{' '}
            a própria cidade.
          </h1>

          {/* Sub-headline Densa */}
          <p className="text-sm sm:text-base lg:text-lg text-white/70 max-w-3xl mx-auto leading-relaxed font-normal">
            Quem compra pod quer rapidez, confiança e atendimento impecável. Troque as mensagens amadoras por uma vitrine interativa na sua bio, sistema de despacho organizado e uma operação que venda mais com menos esforço!
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/checkout?plano=combo"
              className="bg-white hover:bg-slate-100 text-black font-extrabold px-8 py-4 rounded-xl text-sm sm:text-base transition-all shadow-[0_0_35px_rgba(255,255,255,0.35)] hover:shadow-[0_0_45px_rgba(255,255,255,0.55)] flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer text-center"
            >
              <span>Compre Agora e Pague Para Sempre o Preço de Lançamento</span>
              <ArrowRight className="size-4 shrink-0" />
            </Link>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="bg-[#0e1713] hover:bg-[#13231c] border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 font-bold px-6 py-4 rounded-xl text-sm sm:text-base transition-all flex items-center gap-2.5 active:scale-95"
            >
              <MessageCircle className="size-4 fill-emerald-400/20 text-emerald-400 shrink-0" />
              <span>Tirar Dúvidas no WhatsApp</span>
            </a>
          </div>

          <div className="pt-2 text-xs text-white/40 flex items-center justify-center gap-4 font-medium flex-wrap">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-400" />
              Garantia de 7 dias
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-400" />
              Sem fidelidade ou multas
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-4 text-white" />
              Preço vitalício congelado
            </span>
          </div>

        </div>

        {/* ==================================================================== */}
        {/* HERO MOCKUP: PRINT REAL DO PAINEL FINANCEIRO                        */}
        {/* ==================================================================== */}
        <div className="max-w-6xl mx-auto mt-14 relative">
          
          <div className="absolute -inset-1 bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-3xl blur-xl opacity-70 pointer-events-none" />

          {/* Janela de Sistema em Moldura macOS com Print Real */}
          <div className="relative rounded-2xl sm:rounded-3xl border border-white/15 bg-[#0a0a0c] p-2 sm:p-3 shadow-[0_0_60px_rgba(255,255,255,0.07),0_20px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10 overflow-hidden group">
            {/* Barra Superior da Janela */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40 rounded-t-xl mb-2 text-xs text-white/50 font-mono">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-red-500/80" />
                <div className="size-3 rounded-full bg-yellow-500/80" />
                <div className="size-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-[11px] text-white/40 hidden sm:inline-block">
                  app.smksystem.com/financeiro
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>DRE & Caixa Real em Tempo Real</span>
              </div>
            </div>

            {/* Print Real do Financeiro */}
            <div className="rounded-xl overflow-hidden border border-white/10 relative bg-[#0a0a0c]">
              <ScreenshotOrFallback
                src="/prints/financeiro-hero.png"
                alt="Painel Financeiro Real do SMK System - DRE, Faturamento e Lucro Líquido"
                className="w-full h-auto object-cover block transition-transform duration-500 group-hover:scale-[1.01]"
              />
            </div>
          </div>
        </div>

      </section>

      {/* ==================================================================== */}
      {/* 4. AS 4 DORES DO LOJISTA DE PODS (DIAGNÓSTICO BRUTAL)                */}
      {/* ==================================================================== */}
      <section id="dores" className="py-24 px-4 sm:px-6 border-t border-[#161616] bg-[#070707]">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50 font-mono">
              O Custo Oculto do Amadorismo
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              As 4 dores que travam o crescimento de qualquer loja de pods
            </h2>
            <p className="text-xs sm:text-sm text-white/60">
              Se você se identificar com pelo menos duas dessas situações, você não precisa trabalhar mais horas. Você só precisa de uma ferramenta feita para a sua realidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Dor 1 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 p-6 sm:p-8 rounded-3xl transition-all duration-300 space-y-3 group shadow-lg">
              <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <MessageSquare className="size-6 text-white" />
              </div>
              <span className="text-xs font-mono text-white/40 block">DOR #01</span>
              <h3 className="text-lg font-bold text-white">O Inferno de Digitar Listas de Sabores Todo Santo Dia</h3>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                Você acorda, abre o WhatsApp e tem que ir lá escrever pod por pod, sabor por sabor manualmente. Encaminha a lista para 10 clientes. Quando um deles compra, você tem que voltar na mensagem e apagar o sabor na mão. Se esquecer de apagar, o próximo cliente pede o mesmo pod, você tem que avisar que acabou e ele desiste irritado da compra.
              </p>
            </div>

            {/* Dor 2 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 p-6 sm:p-8 rounded-3xl transition-all duration-300 space-y-3 group shadow-lg">
              <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <Truck className="size-6 text-white" />
              </div>
              <span className="text-xs font-mono text-white/40 block">DOR #02</span>
              <h3 className="text-lg font-bold text-white">O Caos de Despachar Múltiplos Pedidos no Horário de Pico</h3>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                Sua loja começa a vender 5, 8 ou 10 pods por dia. De repente caem 3 ou 4 clientes de uma vez na sexta à noite. Sem organização visual, você se perde: não sabe se o motoboy já saiu, se está em rota ou se já entregou. Esquece de despachar um pedido porque estava embalando outro, o cliente fica esperando, reclama, perde a paciência e cancela.
              </p>
            </div>

            {/* Dor 3 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 p-6 sm:p-8 rounded-3xl transition-all duration-300 space-y-3 group shadow-lg">
              <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <RefreshCw className="size-6 text-white" />
              </div>
              <span className="text-xs font-mono text-white/40 block">DOR #03</span>
              <h3 className="text-lg font-bold text-white">Ficar Postando Stories e Deixar o Cliente Comprar de Outra Loja</h3>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                Pod é um produto de consumo diário. Quando começa a queimar, o cliente quer repor rápido. Mas você tem uma base com dezenas de clientes e fica apenas postando stories esperando o pedido cair do céu. Como você não sabe quando o pod dele vai acabar e não entra em contato, na hora que queima ele entra no Instagram da primeira loja que encontrar e compra lá.
              </p>
            </div>

            {/* Dor 4 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 p-6 sm:p-8 rounded-3xl transition-all duration-300 space-y-3 group shadow-lg">
              <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <Wallet className="size-6 text-white" />
              </div>
              <span className="text-xs font-mono text-white/40 block">DOR #04</span>
              <h3 className="text-lg font-bold text-white">Dar Desconto no Pod Errado e Prender Dinheiro em Sabores Parados</h3>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                Quando quer vender mais, você comete o erro clássico: dá desconto em Ignite e Lost Mary que já venderiam com preço cheio e margem alta. Enquanto isso, aqueles sabores que não saem ficam tomando espaço na prateleira, mofando na gaveta com o dinheiro da loja totalmente preso e sem ninguém saber quais são.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. [DESTAQUE MÁXIMO] CATÁLOGO DIGITAL OFICIAL NA BIO                */}
      {/* ==================================================================== */}
      <section id="catalogo" className="py-24 px-4 sm:px-6 border-t border-[#161616] relative overflow-hidden bg-[#050505]">
        
        <div className="max-w-6xl mx-auto space-y-16">
          
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold font-mono">
              <Sparkles className="size-3.5 text-white" />
              <span>O Maior Diferencial Para Donos de Loja de Pods</span>
            </div>

            {/* HEADLINE ÚNICA DO CATÁLOGO */}
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Sua Vitrine Online na Bio do Instagram:{' '}
              <span className="text-white underline decoration-white/30 decoration-2 underline-offset-8">
                Chega de digitar lista de sabores todo santo dia.
              </span>
            </h2>

            <p className="text-sm sm:text-base text-white/70 leading-relaxed">
              O catálogo oficial do SMK System transforma o link da sua bio em um cardápio profissional, interativo e com estoque sincronizado em tempo real. Você nunca mais vai perder 20 minutos escrevendo texto no WhatsApp.
            </p>
          </div>

          {/* Grid: Explicação Técnica dos 4 Pilares do Catálogo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-6">
              
              {/* Pilar 1 */}
              <div className="flex gap-4 p-5 rounded-2xl bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 transition-colors">
                <div className="size-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 font-bold font-mono">
                  01
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Cadastrou os modelos uma única vez, tá pronto</h3>
                  <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                    Você cadastra o modelo do aparelho uma única vez e todos os sabores ficam salvos no sistema. Quando chega um lote novo do fornecedor, você só clica em um botão para ativar o sabor de volta no ar. Sem retrabalho.
                  </p>
                </div>
              </div>

              {/* Pilar 2 */}
              <div className="flex gap-4 p-5 rounded-2xl bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 transition-colors">
                <div className="size-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 font-bold font-mono">
                  02
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Vendeu o último pod? Ele sai do ar sozinho</h3>
                  <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                    Cada vez que você aceita um pedido no Kanban, o sistema dá baixa imediata no estoque. O sabor esgotado desaparece ou fica marcado como indisponível no catálogo. O cliente nunca mais vai pedir o que não tem.
                  </p>
                </div>
              </div>

              {/* Pilar 3 */}
              <div className="flex gap-4 p-5 rounded-2xl bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 transition-colors">
                <div className="size-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 font-bold font-mono">
                  03
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Visual premium que passa respeito e autoridade</h3>
                  <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                    Fotos oficiais em alta definição de Ignite (V50, V80, V150), Elfbar (BC15000, TE30000), Lost Mary e Oxbar. Seu cliente abre o link no celular e vê uma loja de verdade, e não fotos escuras tiradas em cima de uma mesa.
                  </p>
                </div>
              </div>

              {/* Pilar 4 */}
              <div className="flex gap-4 p-5 rounded-2xl bg-[#0b0b0b] border border-[#1f1f1f] hover:border-emerald-500/40 transition-colors">
                <div className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0 font-bold font-mono">
                  04
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">O pedido cai mastigado e pronto no seu WhatsApp</h3>
                  <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                    O cliente escolhe a marca, seleciona o sabor, define a quantidade e digita o endereço. Ao clicar em finalizar, o WhatsApp dele abre com a mensagem pré-formatada com todos os dados. Você só confere o Pix e despacha.
                  </p>
                </div>
              </div>

            </div>

            {/* MOCKUP VISUAL DO SMARTPHONE DO CATÁLOGO COM O PRINT REAL EMBUTIDO */}
            <div className="flex justify-center">
              <div className="w-full max-w-[340px] bg-[#0c0c0c] border-[7px] sm:border-[8px] border-[#222] rounded-[46px] sm:rounded-[48px] p-2.5 sm:p-3 shadow-[0_0_60px_rgba(255,255,255,0.12),0_25px_50px_rgba(0,0,0,0.85)] relative mx-auto select-none group ring-1 ring-white/10">
                {/* Speaker notch */}
                <div className="w-24 h-3.5 bg-[#1c1c1e] rounded-full mx-auto mb-2 flex items-center justify-center gap-1.5 shadow-inner">
                  <div className="size-1 rounded-full bg-white/20" />
                  <div className="w-6 h-0.5 bg-white/10 rounded-full" />
                </div>

                {/* Tela do Celular com Print Real do Catálogo */}
                <div className="rounded-[34px] overflow-hidden border border-white/10 relative bg-black shadow-inner">
                  <ScreenshotOrFallback
                    src="/prints/catalogo-mobile.png"
                    alt="Catálogo Oficial Smoking Pods no Celular"
                    className="w-full h-auto object-cover object-top block transition-transform duration-500 group-hover:scale-[1.02]"
                    fallback={
                      <div className="p-3 space-y-2">
                        {/* Catalog Header */}
                        <div className="space-y-1.5 pb-2.5 border-b border-white/10 text-center">
                          <div className="inline-flex items-center gap-1 text-[9px] text-white bg-white/10 border border-white/15 px-2 py-0.5 rounded-full font-bold">
                            <span>⚡ Entrega Express em 25-35min</span>
                          </div>
                          <div className="font-extrabold text-xs text-white">Smoking Pods • Catálogo Oficial</div>
                          <div className="text-[9px] text-white/50">Toque no pod para ver os sabores disponíveis</div>
                        </div>

                        {/* Filter Pills */}
                        <div className="flex gap-1 py-1.5 overflow-x-auto text-[9px] font-bold no-scrollbar">
                          <span className="px-2 py-0.5 rounded-md bg-white text-black shrink-0">Todos</span>
                          <span className="px-2 py-0.5 rounded-md bg-[#1a1a1a] text-white/70 shrink-0">Ignite V50</span>
                          <span className="px-2 py-0.5 rounded-md bg-[#1a1a1a] text-white/70 shrink-0">Lost Mary</span>
                          <span className="px-2 py-0.5 rounded-md bg-[#1a1a1a] text-white/70 shrink-0">Elfbar</span>
                        </div>

                        {/* Products List inside Phone */}
                        <div className="space-y-2 pt-0.5">
                          <div className="bg-[#141414] border border-[#262626] rounded-xl p-2 flex items-center justify-between">
                            <div>
                              <div className="text-[11px] font-bold text-white">Ignite V50</div>
                              <div className="text-[9px] text-white/70 font-mono">5.000 Puffs • R$ 115,00</div>
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-white/10 text-[9px] font-bold text-white border border-white/20">
                              Escolher
                            </span>
                          </div>

                          <div className="bg-[#141414] border border-white/40 rounded-xl p-2 flex items-center justify-between">
                            <div>
                              <span className="text-[8px] bg-white text-black px-1 rounded font-black uppercase">Mais Vendido</span>
                              <div className="text-[11px] font-bold text-white mt-0.5">Lost Mary MO20000 Pro</div>
                              <div className="text-[9px] text-white/70 font-mono">20.000 Puffs • R$ 135,00</div>
                            </div>
                            <span className="px-2 py-1 rounded-md bg-white text-[9px] font-bold text-black shadow">
                              Escolher
                            </span>
                          </div>
                        </div>

                        {/* Floating Bottom Cart Bar */}
                        <div className="mt-2.5 bg-white text-black font-extrabold p-2 rounded-xl text-center text-xs flex items-center justify-between shadow-lg">
                          <div className="text-left">
                            <span className="text-[8px] block text-black/70 uppercase">Sacola (1 item)</span>
                            <span className="text-xs">R$ 135,00</span>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] bg-black text-white px-2.5 py-1 rounded-lg">
                            <span>Pedir no WhatsApp</span>
                            <ArrowRight className="size-2.5" />
                          </span>
                        </div>
                      </div>
                    }
                  />

                  {/* Reflexo sutil de vidro da tela */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.06] pointer-events-none" />
                </div>

                {/* Home indicator bar at bottom */}
                <div className="w-24 h-1 bg-white/30 rounded-full mx-auto mt-2" />
              </div>
            </div>

          </div>

          {/* Reforço do Catálogo com Print Desktop no Computador */}
          <div className="pt-14 border-t border-white/10 space-y-8">
            <div className="text-center space-y-4 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold font-mono">
                <Monitor className="size-3.5 text-white" />
                <span>100% Responsivo • Celular, Tablet e Computador</span>
              </div>

              <h3 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Enquanto você digita lista de sabores no WhatsApp,{' '}
                <span className="text-white underline decoration-white/30 decoration-2 underline-offset-8">
                  seu cliente está fazendo Pix para o seu concorrente.
                </span>
              </h3>

              <p className="text-sm sm:text-base text-white/70 max-w-3xl mx-auto leading-relaxed">
                Venda de pod é vício e imediatismo. Se você demora 5 minutos para conferir estoque e atualizar sua lista de sabores, parabéns: você acabou de doar o seu cliente para a concorrência. Tanto no celular quanto no computador, seu cliente navega por fotos oficiais de cada modelo, escolhe o sabor em 10 segundos e fecha o pedido no piloto automático.
              </p>
            </div>

            {/* Desktop Window Mockup com o Print Real do Computador */}
            <div className="rounded-2xl sm:rounded-3xl border border-white/15 bg-[#0a0a0c] p-2 sm:p-3 shadow-[0_0_60px_rgba(255,255,255,0.07),0_20px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10 overflow-hidden group">
              {/* Barra superior de Janela de Navegador */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40 rounded-t-xl mb-2 text-xs text-white/50 font-mono">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-red-500/80" />
                  <div className="size-3 rounded-full bg-yellow-500/80" />
                  <div className="size-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-[11px] text-white/40 hidden sm:inline-block">smoking-pods-catalogo.vercel.app</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Catálogo Online no Ar</span>
                </div>
              </div>

              {/* Imagem Real do Catálogo Desktop */}
              <div className="rounded-xl overflow-hidden border border-white/10 relative bg-black">
                <ScreenshotOrFallback
                  src="/prints/catalogo-desktop.png"
                  alt="Catálogo Oficial Smoking Pods no Computador"
                  className="w-full h-auto object-cover block transition-transform duration-500 group-hover:scale-[1.01]"
                />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 6. A CENTRAL DE PEDIDOS EM KANBAN (ADEUS CAOS NA ENTREGA)           */}
      {/* ==================================================================== */}
      <section id="kanban" className="py-24 px-4 sm:px-6 border-t border-[#161616] bg-[#070707]">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50 font-mono">
              Operação de Entrega Blindada
            </span>

            {/* HEADLINE ÚNICA DO KANBAN */}
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Painel de Pedidos em Kanban:{' '}
              <span className="text-white underline decoration-white/30 decoration-2 underline-offset-8">
                Saiba exatamente onde cada motoboy está e nunca mais atrase uma entrega.
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-white/60">
              Quando começam a cair 5 ou 10 pedidos ao mesmo tempo no fim de semana, a organização é o que separa uma loja lucrativa de uma loja cheia de reclamações e cancelamentos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-2xl space-y-3 hover:border-white/40 transition-colors">
              <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Package className="size-5" />
              </div>
              <h3 className="text-base font-bold text-white">Controle de Múltiplos Pedidos Sem Erro</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Chegaram 4 pedidos no mesmo minuto? Você visualiza tudo na coluna de <strong>Novos Pedidos</strong>. Ao separar o sabor na gaveta, arrasta para <strong>Separando</strong>. Ninguém confunde sabor, ninguém esquece pedido na bancada.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-2xl space-y-3 hover:border-white/40 transition-colors">
              <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Truck className="size-5" />
              </div>
              <h3 className="text-base font-bold text-white">Você Sabe Onde o Motoboy Está</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                A coluna <strong>Em Rota</strong> mostra exatamente os pedidos que já saíram com o Uber Flash ou entregador próprio. Você nunca mais vai esquecer de avisar o cliente que o motoboy chegou no portão dele.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-2xl space-y-3 hover:border-white/40 transition-colors">
              <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <TrendingUp className="size-5" />
              </div>
              <h3 className="text-base font-bold text-white">Mais Entregas Rápidas = Mais Faturamento</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Com o endereço já formatado em 1 clique para colar no app da Uber, você despacha em 2 minutos. Cliente de pod valoriza entrega rápida: quanto mais ágil você for, mais ele compra toda semana.
              </p>
            </div>

          </div>

          {/* Kanban Board Visual com Moldura de Aplicação Real */}
          <div className="rounded-2xl sm:rounded-3xl border border-white/15 bg-[#0a0a0c] p-2 sm:p-3 shadow-[0_0_60px_rgba(255,255,255,0.07),0_20px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10 overflow-hidden group">
            {/* Barra superior de Janela de Sistema com os 3 botões */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40 rounded-t-xl mb-2 text-xs text-white/50 font-mono">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-red-500/80" />
                <div className="size-3 rounded-full bg-yellow-500/80" />
                <div className="size-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-[11px] text-white/40 hidden sm:inline-block">smoking-pods-admin.vercel.app/pedidos</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Kanban em Tempo Real</span>
              </div>
            </div>

            {/* Imagem Real do Kanban */}
            <div className="rounded-xl overflow-hidden border border-white/10 relative bg-[#0a0a0c]">
              <ScreenshotOrFallback
                src="/prints/kanban-desktop.png"
                alt="Painel de Pedidos em Kanban Real da Smoking Pods"
                className="w-full h-auto object-cover block transition-transform duration-500 group-hover:scale-[1.01]"
                fallback={
                  <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl p-4 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono text-white/60 border-b border-white/5 pb-3">
                      <span>FLUXO OPERACIONAL AO VIVO</span>
                      <span className="text-emerald-400">3 Fases de Despacho Rápido</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Coluna 1 */}
                      <div className="bg-[#141414] border border-[#222] rounded-xl p-3 space-y-2">
                        <div className="text-xs font-bold text-white flex justify-between">
                          <span>1. Novos Pedidos</span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-white">2</span>
                        </div>
                        <div className="bg-[#1c1c1c] p-2.5 rounded-lg text-xs space-y-1">
                          <div className="font-bold text-white">#1055 • Ignite V50 Watermelon</div>
                          <div className="text-[10px] text-white/50">Marina Silva • Pix Confirmado</div>
                        </div>
                      </div>

                      {/* Coluna 2 */}
                      <div className="bg-[#141414] border border-[#222] rounded-xl p-3 space-y-2">
                        <div className="text-xs font-bold text-white flex justify-between">
                          <span>2. Separando Sabor</span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-white">1</span>
                        </div>
                        <div className="bg-[#1c1c1c] p-2.5 rounded-lg text-xs space-y-1">
                          <div className="font-bold text-white">#1054 • Lost Mary 20k Miami Mint</div>
                          <div className="text-[10px] text-white/50">Embalando c/ adesivo da loja</div>
                        </div>
                      </div>

                      {/* Coluna 3 */}
                      <div className="bg-[#141414] border border-[#222] rounded-xl p-3 space-y-2">
                        <div className="text-xs font-bold text-white flex justify-between">
                          <span>3. Em Rota (Uber/Moto)</span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-white">2</span>
                        </div>
                        <div className="bg-[#1c1c1c] p-2.5 rounded-lg text-xs space-y-1">
                          <div className="font-bold text-white">#1053 • Elfbar BC15k Blue Razz</div>
                          <div className="text-[10px] text-white/70 font-mono">🛵 Uber Flash a caminho (7 min)</div>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              />
            </div>
          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 7. GESTÃO DE CLIENTES & CRM PREDITIVO                                */}
      {/* ==================================================================== */}
      <section id="recompra" className="py-24 px-4 sm:px-6 border-t border-[#161616] relative bg-[#050505]">
        
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-4 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold font-mono">
              <Users className="size-3.5 text-white" />
              <span>Gestão de Clientes & CRM Preditivo</span>
            </div>

            {/* HEADLINE PRINCIPAL DO CRM */}
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Pare de atender como camelô.{' '}
              <span className="text-white underline decoration-white/30 decoration-2 underline-offset-8">
                Transforme sua revenda de pods em um negócio profissional.
              </span>
            </h2>

            <p className="text-sm sm:text-base text-white/70 max-w-3xl mx-auto leading-relaxed">
              Vender pods não é ser feirante esperando cliente cair do céu ou disputando preço como na feirinha de São Paulo. Você sabe quanto cada cliente gasta com você por mês? Qual o tempo de vida dele? E o principal: <strong>quanto tempo falta para o pod dele acabar?</strong> O CRM do SMK System rastreia o ciclo de consumo de cada cliente para você entrar em contato na hora exata e vender de novo antes que ele compre em outra loja.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-2xl space-y-3 hover:border-white/40 transition-colors">
              <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Store className="size-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-white">Chega de Vender como Feirante</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Quem atende no WhatsApp como feirante perde vendas por esquecimento e disputa centavos com concorrentes amadores. No SMK System, você tem a lista organizada de todos os seus clientes com histórico de compras e ticket médio.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-2xl space-y-3 hover:border-white/40 transition-colors">
              <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Clock className="size-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-white">Radar do Ciclo de Vida do Pod</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                O sistema calcula o tempo médio de uso baseado no modelo e puffs (5k, 15k ou 30k). Quando faltam 4 ou 5 dias para o pod queimar, o radar acende o alerta de recompra na sua tela com a porcentagem exata do ciclo.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-2xl space-y-3 hover:border-white/40 transition-colors">
              <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-400">
                <MessageCircle className="size-5" />
              </div>
              <h3 className="text-base font-bold text-white">Aborde Antes da Concorrência</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Com 1 clique no botão verde de "Recompra", você abre o WhatsApp do cliente na hora exata com o sabor favorito dele pronto. Antes mesmo do pod queimar e dele pensar em procurar outra loja no Instagram, o Pix já tá fechado.
              </p>
            </div>

          </div>

          {/* CRM Desktop Window Mockup com o Print Real */}
          <div className="rounded-2xl sm:rounded-3xl border border-white/15 bg-[#0a0a0c] p-2 sm:p-3 shadow-[0_0_60px_rgba(255,255,255,0.07),0_20px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10 overflow-hidden group">
            {/* Barra superior de Janela de Sistema */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40 rounded-t-xl mb-2 text-xs text-white/50 font-mono">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-red-500/80" />
                <div className="size-3 rounded-full bg-yellow-500/80" />
                <div className="size-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-[11px] text-white/40 hidden sm:inline-block">smoking-pods-admin.vercel.app/clientes</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Radar Preditivo de Recompra Ativo</span>
              </div>
            </div>

            {/* Imagem Real do CRM */}
            <div className="rounded-xl overflow-hidden border border-white/10 relative bg-[#0a0a0c]">
              <ScreenshotOrFallback
                src="/prints/crm-recompra.png"
                alt="Gestão de Clientes e CRM Preditivo Smoking Pods"
                className="w-full h-auto object-cover block transition-transform duration-500 group-hover:scale-[1.01]"
              />
            </div>
          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 8. RADAR DE ESTOQUE PARADO & QUEIMA INTELIGENTE                     */}
      {/* ==================================================================== */}
      <section id="estoque" className="py-24 px-4 sm:px-6 border-t border-[#161616] bg-[#070707]">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50 font-mono">
              Destrave seu Capital de Giro
            </span>

            {/* HEADLINE ÚNICA DO ESTOQUE PARADO */}
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Radar de Estoque Parado:{' '}
              <span className="text-white underline decoration-white/30 decoration-2 underline-offset-8">
                Dê descontos inteligentes sem queimar o lucro dos pods que mais vendem.
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
              O maior erro dos lojistas é dar desconto em produtos que já vendem a preço cheio. O SMK System aponta o dedo exatamente para os sabores que estão encalhados na prateleira para você fazer caixa rápido.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-2xl space-y-3">
              <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold font-mono">
                01
              </div>
              <h3 className="text-base font-bold text-white">Proteja os Pods Mais Vendidos</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Ignite V50 Watermelon Ice ou Lost Mary Miami Mint saem todos os dias com margem cheia. O sistema te impede de cometer o erro de queimar margem nesses modelos à toa.
              </p>
            </div>

            <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-2xl space-y-3">
              <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold font-mono">
                02
              </div>
              <h3 className="text-base font-bold text-white">Localize o Dinheiro Encalhado</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                O painel lista os sabores que estão há mais de 15 ou 20 dias ocupando espaço na prateleira. Você não precisa conferir gaveta por gaveta: o sistema mostra o valor total travado.
              </p>
            </div>

            <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-2xl space-y-3">
              <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold font-mono">
                03
              </div>
              <h3 className="text-base font-bold text-white">Liquidação Cirúrgica e Caixa Destravado</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Crie combos e queimas de estoque exclusivamente para girar os produtos parados. Você recupera seu custo rápido e reinveste em novas marcas e sabores que a galera tá pedindo.
              </p>
            </div>

          </div>

          {/* Screenshot Container para Estoque Parado */}
          <ScreenshotOrFallback
            src="/prints/estoque-parado.png"
            alt="Estoque Parado SMK System"
            fallback={<div className="hidden" />}
          />

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 9. GESTÃO SIMPLES PARA SÓCIOS & DINHEIRO DA LOJA                    */}
      {/* ==================================================================== */}
      <section id="socios" className="py-24 px-4 sm:px-6 border-t border-[#161616] bg-[#050505]">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50 font-mono">
              Clareza & Fim das Discussões
            </span>

            {/* HEADLINE ÚNICA DE SÓCIOS */}
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Divisão de Sócios Sem Complicação:{' '}
              <span className="bg-gradient-to-r from-white via-slate-200 to-gray-400 bg-clip-text text-transparent">
                Saiba o que é dinheiro da empresa e quanto cada sócio pode retirar.
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
              Muitos amigos abrem loja de pod juntos e brigam achando que um tirou mais dinheiro que o outro. O SMK System mostra com números limpos o patrimônio real da loja, quanto tem em estoque e a fatia exata de cada um.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            <div className="space-y-5 text-xs sm:text-sm text-white/70">
              
              <div className="flex gap-3">
                <CheckCircle2 className="size-5 text-white shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block text-sm">O Dinheiro da Empresa é Intocável</strong>
                  O sistema separa claramente o caixa de reposição (que tem que ficar na conta para comprar o próximo lote com o fornecedor) do lucro limpo disponível. Ninguém gasta o dinheiro da mercadoria.
                </div>
              </div>

              <div className="flex gap-3">
                <CheckCircle2 className="size-5 text-white shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block text-sm">Patrimônio Real na Prateleira</strong>
                  Quem investe quer saber onde o dinheiro está. O sistema calcula a soma do caixa líquido com todos os pods físicos em estoque a preço de custo. Fica tudo visível e registrado.
                </div>
              </div>

              <div className="flex gap-3">
                <CheckCircle2 className="size-5 text-white shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block text-sm">Fatia Automática por Sócio</strong>
                  Se a divisão for 50/50, 60/40 ou 70/30, cada retirada fica registrada com data e valor. Acabou aquele clima chato de um sócio achar que o outro está com o dinheiro dele na mão.
                </div>
              </div>

            </div>

            {/* Card Widget dos Sócios ou Print Real */}
            <ScreenshotOrFallback
              src="/prints/socios-equity.png"
              alt="Divisão de Sócios SMK System"
              fallback={
                <div className="bg-[#0c0c0c] border border-[#242424] rounded-3xl p-6 space-y-5">
                  <div className="flex justify-between items-center pb-3 border-b border-white/10 text-xs">
                    <span className="font-bold text-white">Resumo Societário da Loja</span>
                    <span className="text-emerald-400 font-mono font-bold">100% Auditado</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#141414] p-3 rounded-xl border border-white/5">
                      <span className="text-[10px] text-white/40 block">Caixa Líquido</span>
                      <span className="text-base font-extrabold text-emerald-400">R$ 18.545,00</span>
                    </div>
                    <div className="bg-[#141414] p-3 rounded-xl border border-white/5">
                      <span className="text-[10px] text-white/40 block">Estoque em Pods</span>
                      <span className="text-base font-extrabold text-white">R$ 22.310,00</span>
                    </div>
                  </div>

                  {/* Sócios Split */}
                  <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                    <div className="flex justify-between p-2.5 rounded-xl bg-white/5 items-center">
                      <div>
                        <span className="font-bold text-white block">Sócio 1 (50%)</span>
                        <span className="text-[10px] text-white/50">Disponível para retirada</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 text-sm">R$ 6.272,50</span>
                    </div>

                    <div className="flex justify-between p-2.5 rounded-xl bg-white/5 items-center">
                      <div>
                        <span className="font-bold text-white block">Sócio 2 (50%)</span>
                        <span className="text-[10px] text-white/50">Disponível para retirada</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 text-sm">R$ 6.272,50</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-center text-white/40">
                    🔒 Caixa de Reposição de Fornecedor: R$ 6.000,00 blindado.
                  </div>
                </div>
              }
            />

          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 10. CASE REAL SMOKING PODS (PROVA SOCIAL NA PRÁTICA)                 */}
      {/* ==================================================================== */}
      <section id="case" className="py-24 px-4 sm:px-6 border-t border-[#161616] bg-[#070707] relative">
        <div className="max-w-5xl mx-auto space-y-10 text-center">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-semibold">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>Testado no Campo de Batalha Real</span>
          </div>

          {/* HEADLINE ÚNICA DO CASE REAL */}
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight max-w-3xl mx-auto leading-tight">
            Criado por quem vive o balcão:{' '}
            <span className="text-white underline decoration-white/30 decoration-2 underline-offset-8">
              O sistema testado na operação da Smoking Pods com +10.000 pedidos.
            </span>
          </h2>

          <p className="text-xs sm:text-sm text-white/70 max-w-2xl mx-auto leading-relaxed">
            O SMK System não foi desenhado por quem nunca pegou uma caixa de pod na mão. Ele nasceu e foi lapidado dentro da nossa própria operação real, resolvendo os problemas diários de entregadores, estoque e clientes exigentes.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] p-5 rounded-2xl">
              <div className="text-2xl sm:text-4xl font-extrabold text-white">+10.000</div>
              <div className="text-[11px] text-white/50 mt-1">Pedidos entregues com sucesso</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] p-5 rounded-2xl">
              <div className="text-2xl sm:text-4xl font-extrabold text-white">0 minutos</div>
              <div className="text-[11px] text-white/50 mt-1">Digitando sabores no WhatsApp</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] p-5 rounded-2xl">
              <div className="text-2xl sm:text-4xl font-extrabold text-emerald-400">25.3%</div>
              <div className="text-[11px] text-white/50 mt-1">Margem líquida média real</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] p-5 rounded-2xl">
              <div className="text-2xl sm:text-4xl font-extrabold text-white">100%</div>
              <div className="text-[11px] text-white/50 mt-1">Paz de espírito entre os sócios</div>
            </div>
          </div>

          {/* Print Real do Financeiro / Prova de Faturamento */}
          <div className="pt-4">
            <ScreenshotOrFallback
              src="/prints/financeiro-dre.png"
              alt="Painel Financeiro Real da Smoking Pods"
              className="w-full max-w-4xl mx-auto rounded-2xl border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.1)]"
              fallback={<div className="hidden" />}
            />
          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 11. TABELA DE PREÇOS (OFERTA DE LANÇAMENTO VITALÍCIA)               */}
      {/* ==================================================================== */}
      <section id="planos" className="py-24 px-4 sm:px-6 border-t border-[#161616] relative bg-[#050505]">
        <div className="max-w-5xl mx-auto space-y-12">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold font-mono">
              <Sparkles className="size-3.5 text-white" />
              <span>Condição Especial de Lançamento</span>
            </div>

            {/* HEADLINE ÚNICA DOS PLANOS */}
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Escolha o plano ideal para a sua loja de pods
            </h2>

            <p className="text-xs sm:text-sm text-white/60">
              Quem assinar nos primeiros 30 dias de lançamento garante esse valor de forma <strong className="text-white">VITALÍCIA</strong>. O preço nunca aumentará para você.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            
            {/* PLANO 1: SMK GESTÃO */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/30 rounded-3xl p-8 flex flex-col justify-between transition-all duration-300">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">SMK Gestão de Pods</h3>
                    <Store className="size-5 text-white/40" />
                  </div>
                  <p className="text-xs text-white/50 mt-1">Para organizar pedidos, entregas e divisão de sócios.</p>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-white/40 line-through">De R$ 149,90/mês</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">R$ 97</span>
                    <span className="text-white/50 text-sm font-semibold">,00 / mês</span>
                  </div>
                  <p className="text-[11px] text-emerald-400 font-semibold font-mono">
                    Valor congelado vitalício no lançamento
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-white/10 text-xs sm:text-sm text-white/80">
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Painel Kanban de Pedidos em tempo real</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Controle de marcas, modelos e sabores com baixa automática</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Alerta de Pod Acabando (aviso no WhatsApp antes de queimar)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Radar de Estoque Parado para queimas inteligentes</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Divisão automática de lucros e fatias entre sócios</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Suporte via WhatsApp</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <Link
                  to="/checkout?plano=gestao"
                  className="w-full bg-[#161616] hover:bg-[#202020] border border-[#2a2a2a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95 cursor-pointer"
                >
                  <span>Assinar Plano Gestão</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* PLANO 2: SMK PRO COMBO (MAIS VENDIDO) */}
            <div className="bg-[#0d0d0d] border-2 border-white/60 rounded-3xl p-8 flex flex-col justify-between relative shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300 group">
              
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-white text-black text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                <Star className="size-3 fill-black" />
                <span>Mais Vendido • Recomendado</span>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">SMK Pro Combo</h3>
                    <Sparkles className="size-5 text-white" />
                  </div>
                  <p className="text-xs text-white/50 mt-1">Sistema Completo + Catálogo Oficial na Bio do Instagram.</p>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-white/40 line-through">De R$ 167,90/mês</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">R$ 127</span>
                    <span className="text-white/50 text-sm font-semibold">,90 / mês</span>
                  </div>
                  <p className="text-[11px] text-emerald-400 font-semibold font-mono">
                    Economize R$ 40/mês para sempre
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-white/10 text-xs sm:text-sm text-white/90">
                  <div className="flex items-center gap-2.5 font-semibold text-white">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>TUDO incluso no Plano Gestão de Pods</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-semibold text-white">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Catálogo Digital Oficial Próprio para a Bio</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Estoque e sabores sincronizados em tempo real</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Fotos oficiais dos modelos em alta resolução</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Carrinho de compras que cai pronto no seu WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Nunca mais digite lista de sabores no WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Suporte prioritário VIP no WhatsApp</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <Link
                  to="/checkout?plano=combo"
                  className="w-full bg-white hover:bg-slate-100 text-black font-extrabold py-4 rounded-xl transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95 cursor-pointer"
                >
                  <span>Garantir Combo com Catálogo →</span>
                </Link>
              </div>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6 text-center">
            <span className="text-xs text-white/50">Dúvidas sobre o plano ideal para a sua loja?</span>
            <a
              href="https://wa.me/5511977300561?text=Ol%C3%A1!%20Tenho%20d%C3%BAvidas%20sobre%20os%20planos%20do%20sistema%20SMK%20System"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 transition-colors underline underline-offset-4"
            >
              <MessageCircle className="size-3.5" />
              <span>Fale com nosso time de especialistas no WhatsApp</span>
            </a>
          </div>

          <div className="text-center text-xs text-white/40 pt-4">
            Após os 30 dias de lançamento, os valores sobem para R$ 147,00 e R$ 167,90. Quem entrar agora tem o valor travado de forma vitalícia.
          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 12. DÚVIDAS FREQUENTES (FAQ ACCORDION)                              */}
      {/* ==================================================================== */}
      <section id="duvidas" className="py-20 px-4 sm:px-6 border-t border-[#161616] bg-[#070707]">
        <div className="max-w-4xl mx-auto space-y-10">
          
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-white/40 font-mono">Sem Letras Miúdas</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">Dúvidas Frequentes</h2>
            <p className="text-xs sm:text-sm text-white/50">Tudo o que você precisa saber antes de transformar sua loja.</p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "Preciso instalar algum programa no computador?",
                a: "Não! O SMK System é 100% online em nuvem. Você e seus sócios podem acessar de qualquer computador, notebook, tablet ou até direto do navegador do celular."
              },
              {
                q: "Como funciona o Catálogo Digital na Bio?",
                a: "Você recebe um link exclusivo da sua loja para fixar na Bio do seu Instagram ou enviar no WhatsApp. O cliente clica, escolhe os sabores disponíveis com fotos oficiais e clica em pedir. O pedido chega montado no seu WhatsApp com endereço e valores calculados."
              },
              {
                q: "Como o catálogo atualiza quando um pod vende?",
                a: "Automaticamente! Ao aceitar o pedido no Kanban ou registrar uma venda manual, o sistema dá baixa no sabor vendido. O cliente nunca verá um sabor disponível se ele já tiver acabado na sua prateleira."
              },
              {
                q: "Como funciona o Alerta de Pod Acabando?",
                a: "O sistema calcula a duração média dos pods conforme a quantidade de puffs (5.000, 15.000, 35.000) e o histórico do cliente. Quando a estimativa indica que o aparelho está terminando, um alerta surge na sua tela para você enviar uma mensagem no WhatsApp antes que ele compre de outra loja."
              },
              {
                q: "Posso cadastrar mais de um sócio?",
                a: "Sim! Você pode cadastrar os sócios da sua loja, definir a porcentagem de cada um (ex: 50/50, 60/40) e registrar aportes ou retiradas. O sistema calcula a fatia líquida de cada sócio e protege o caixa de reposição."
              },
              {
                q: "E se eu não gostar? Como funciona a garantia?",
                a: "Você tem 7 dias de garantia incondicional. Se você achar que o sistema não facilitou a sua rotina ou não aumentou suas vendas, basta chamar no WhatsApp e devolvemos 100% do seu dinheiro, sem letras miúdas."
              }
            ].map((item, idx) => (
              <div 
                key={idx}
                className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-white hover:text-white transition-colors"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`size-4 shrink-0 transition-transform duration-200 ${openFaq === idx ? 'rotate-180 text-white' : 'text-white/40'}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-white/60 leading-relaxed border-t border-white/5 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 13. FOOTER & CTA FINAL                                               */}
      {/* ==================================================================== */}
      <footer className="py-16 px-4 sm:px-6 border-t border-[#161616] bg-[#050505] text-center space-y-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Sua loja já cresceu. Agora sua operação precisa acompanhar.
          </h2>
          <p className="text-xs sm:text-sm text-white/60">
            Pare de perder vendas por desorganização. Garanta agora seu acesso com preço congelado de lançamento para sempre.
          </p>
          <div className="pt-2">
            <Link
              to="/checkout?plano=combo"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-black font-extrabold px-8 py-4 rounded-xl text-sm transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] active:scale-95 cursor-pointer"
            >
              <span>Começar Agora com Preço Vitalício</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 border-t border-[#141414] flex flex-col sm:flex-row items-center justify-between text-xs text-white/40 gap-4">
          <div className="flex items-center gap-2 font-bold text-white/80">
            <div className="size-6 rounded-lg bg-white/10 flex items-center justify-center">
              <Zap className="size-3 fill-white text-white" />
            </div>
            <span>SMK System SaaS Pro</span>
          </div>
          <div>
            © 2026 SMK System. Todos os direitos reservados.
          </div>
          <div className="flex gap-4">
            <a href="#topo" className="hover:text-white transition-colors">Voltar ao topo ↑</a>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Action Button */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20bd5a] text-black font-black p-3.5 rounded-full shadow-[0_0_25px_rgba(37,211,102,0.4)] hover:shadow-[0_0_35px_rgba(37,211,102,0.7)] transition-all flex items-center gap-2 group active:scale-90"
        title="Fale no WhatsApp"
      >
        <MessageCircle className="size-6 fill-black" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap text-xs font-bold pl-0 group-hover:pr-1">
          Dúvidas? Fale Conosco
        </span>
      </a>

    </div>
  );
}
