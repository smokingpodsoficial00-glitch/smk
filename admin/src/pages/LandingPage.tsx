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
  Check
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

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const whatsappLink = "https://wa.me/5511948487714?text=Ol%C3%A1!%20Vi%20a%20p%C3%A1gina%20do%20SMK%20Flow%20e%20quero%20tirar%20algumas%20d%C3%BAvidas%20sobre%20o%20sistema.";

  return (
    <div id="topo" className="min-h-screen bg-[#050505] text-white font-sans antialiased relative selection:bg-white/20 selection:text-white overflow-x-hidden">
      
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-white/[0.04] blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute top-[1200px] left-1/4 -translate-x-1/2 w-[600px] h-[600px] bg-white/[0.02] blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute top-[2800px] right-1/4 translate-x-1/2 w-[600px] h-[600px] bg-white/[0.03] blur-[220px] rounded-full pointer-events-none" />

      {/* ==================================================================== */}
      {/* 1. TOP ANNOUNCEMENT BANNER COM TIMER REGRESSIVO                      */}
      {/* ==================================================================== */}
      <div className="w-full bg-[#0a0a0a] border-b border-[#1c1c1c] py-2.5 px-4 text-center sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
            <Flame className="size-3.5 fill-amber-400 animate-pulse" />
            <span>Oferta de Lançamento:</span>
          </div>
          <span className="text-white/70 hidden sm:inline">Restam poucos dias para travar sua mensalidade vitalícia sem reajustes:</span>
          
          {/* Countdown Badge */}
          <div className="inline-flex items-center gap-1.5 bg-[#141414] border border-[#2a2a2a] px-2.5 py-0.5 rounded-lg font-mono text-[11px] font-bold text-white shadow-inner">
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

      {/* ==================================================================== */}
      {/* 2. HEADER NAVBAR                                                     */}
      {/* ==================================================================== */}
      <header className="border-b border-[#161616] bg-[#070707]/90 backdrop-blur-xl sticky top-[41px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <Zap className="size-4 fill-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-white">SMK Flow</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white font-semibold">
                SaaS Pro
              </span>
            </div>
          </div>

          {/* Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-white/60">
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
            <a href="#dores" className="hover:text-white transition-colors">Por que o SMK?</a>
            <a href="#case" className="hover:text-white transition-colors">Case Real</a>
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
            <a href="#duvidas" className="hover:text-white transition-colors">Dúvidas</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Link 
              to="/login" 
              className="text-xs font-bold text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Entrar no Sistema
            </Link>
            <a 
              href="#planos"
              className="bg-white hover:bg-slate-100 text-black font-extrabold px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] active:scale-95 flex items-center gap-1.5"
            >
              <span>Garantir Acesso</span>
              <ArrowRight className="size-3.5" />
            </a>
          </div>

        </div>
      </header>

      {/* ==================================================================== */}
      {/* 3. HERO SECTION COM MOCKUP REAL NICHADO EM PODS                     */}
      {/* ==================================================================== */}
      <section className="pt-16 pb-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          
          {/* Niche Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold shadow-[0_0_20px_rgba(255,255,255,0.15)] animate-fade-in">
            <Zap className="size-3.5 fill-amber-400 text-amber-400" />
            <span>O Primeiro Sistema Criado Exclusivamente para Lojas de Pods Descartáveis</span>
          </div>

          {/* Main Giant Glowing Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12] max-w-4xl mx-auto">
            Pare de perder dinheiro no WhatsApp.{' '}
            <span className="bg-gradient-to-r from-white via-slate-200 to-gray-400 bg-clip-text text-transparent underline decoration-white/30 decoration-2 underline-offset-8">
              Gerencie pedidos, estoque e aumente sua recompra
            </span>{' '}
            em um único lugar.
          </h1>

          {/* Sub-headline */}
          <p className="text-sm sm:text-base lg:text-lg text-white/70 max-w-2xl mx-auto leading-relaxed font-normal">
            Controle seu estoque de Ignite, Elfbar e Lost Mary, antecipe a recompra de cada cliente por contagem de puffs e tenha controle do lucro limpo da sua loja sem misturar com o dinheiro pessoal.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href="#planos"
              className="bg-white hover:bg-slate-100 text-black font-extrabold px-8 py-4 rounded-xl text-sm sm:text-base transition-all shadow-[0_0_35px_rgba(255,255,255,0.35)] hover:shadow-[0_0_45px_rgba(255,255,255,0.55)] flex items-center gap-2.5 active:scale-95 cursor-pointer"
            >
              <span>Quero Travar Minha Vaga de Lançamento</span>
              <ArrowRight className="size-4" />
            </a>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="bg-[#0e1713] hover:bg-[#13231c] border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 font-bold px-6 py-4 rounded-xl text-sm sm:text-base transition-all flex items-center gap-2.5 active:scale-95"
            >
              <MessageCircle className="size-4 fill-emerald-400/20 text-emerald-400" />
              <span>Tirar Dúvidas no WhatsApp</span>
            </a>
          </div>

          <div className="pt-2 text-xs text-white/40 flex items-center justify-center gap-2 font-medium">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>Garantia incondicional de 7 dias • Cancele quando quiser</span>
          </div>

        </div>

        {/* ==================================================================== */}
        {/* MOCKUP VISUAL INTERATIVO DO PAINEL (100% NICHADO EM PODS)           */}
        {/* ==================================================================== */}
        <div className="max-w-6xl mx-auto mt-14 relative">
          
          {/* Border Glow behind Mockup */}
          <div className="absolute -inset-1 bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-3xl blur-xl opacity-70 pointer-events-none" />

          <div className="relative bg-[#0b0b0b] border border-[#222] rounded-3xl p-4 sm:p-6 shadow-2xl overflow-hidden">
            
            {/* Mockup Window Top Bar */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1c1c1c] text-xs">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="size-2.5 rounded-full bg-red-500/80" />
                  <div className="size-2.5 rounded-full bg-amber-500/80" />
                  <div className="size-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono text-white/40 text-[11px] ml-2 hidden sm:inline">
                  app.smkflow.com.br — Central de Pedidos de Pods
                </span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-[11px] font-bold">
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                <span>OPERAÇÃO AO VIVO</span>
              </div>
            </div>

            {/* Mockup Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              
              {/* Kanban: Novos Pedidos */}
              <div className="bg-[#101010] border border-[#1f1f1f] rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-white/80 pb-1 border-b border-white/5">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-400" />
                    Novos Pedidos
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-white/60">2</span>
                </div>

                {/* Card 1 */}
                <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-1 hover:border-white/30 transition-colors">
                  <div className="flex justify-between text-[11px] font-bold text-white">
                    <span>#1048 • 2x Ignite V50</span>
                    <span className="text-emerald-400">R$ 230,00</span>
                  </div>
                  <p className="text-[10px] text-white/50">Sabor: Watermelon Ice • Marina S.</p>
                  <div className="text-[9px] text-white/40 flex items-center gap-1 pt-1 font-mono">
                    <span>WhatsApp</span> • <span>Há 3 min</span>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-1 hover:border-white/30 transition-colors">
                  <div className="flex justify-between text-[11px] font-bold text-white">
                    <span>#1047 • 1x Elfbar BC15k</span>
                    <span className="text-emerald-400">R$ 125,00</span>
                  </div>
                  <p className="text-[10px] text-white/50">Sabor: Blue Razz Ice • João M.</p>
                  <div className="text-[9px] text-white/40 flex items-center gap-1 pt-1 font-mono">
                    <span>WhatsApp</span> • <span>Há 8 min</span>
                  </div>
                </div>
              </div>

              {/* Kanban: Preparando */}
              <div className="bg-[#101010] border border-[#1f1f1f] rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-white/80 pb-1 border-b border-white/5">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-blue-400" />
                    Separando Sabor
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-white/60">2</span>
                </div>

                {/* Card 3 */}
                <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-1 hover:border-white/30 transition-colors">
                  <div className="flex justify-between text-[11px] font-bold text-white">
                    <span>#1046 • 1x Lost Mary 35k</span>
                    <span className="text-emerald-400">R$ 135,00</span>
                  </div>
                  <p className="text-[10px] text-white/50">Triple Berry • Camila A.</p>
                  <span className="inline-block text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">PIX PAGO</span>
                </div>

                {/* Card 4 */}
                <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-1 hover:border-white/30 transition-colors">
                  <div className="flex justify-between text-[11px] font-bold text-white">
                    <span>#1045 • 1x Ignite V80</span>
                    <span className="text-emerald-400">R$ 110,00</span>
                  </div>
                  <p className="text-[10px] text-white/50">Banana Ice • Lucas R.</p>
                  <span className="inline-block text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">PIX PAGO</span>
                </div>
              </div>

              {/* Kanban: Em Rota */}
              <div className="bg-[#101010] border border-[#1f1f1f] rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-white/80 pb-1 border-b border-white/5">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-purple-400" />
                    Em Rota (Uber/Moto)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-white/60">2</span>
                </div>

                {/* Card 5 */}
                <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-1 hover:border-white/30 transition-colors">
                  <div className="flex justify-between text-[11px] font-bold text-white">
                    <span>#1044 • 2x Oxbar G30k</span>
                    <span className="text-emerald-400">R$ 240,00</span>
                  </div>
                  <p className="text-[10px] text-white/50">Strawberry Ice • Pedro V.</p>
                  <p className="text-[9px] text-purple-400 font-mono">🛵 Uber Flash a caminho (12 min)</p>
                </div>

                {/* Card 6 */}
                <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-1 hover:border-white/30 transition-colors">
                  <div className="flex justify-between text-[11px] font-bold text-white">
                    <span>#1043 • 3x Elfbar TE30k</span>
                    <span className="text-emerald-400">R$ 260,70</span>
                  </div>
                  <p className="text-[10px] text-white/50">Menta e Uva • Bianca L.</p>
                  <p className="text-[9px] text-purple-400 font-mono">🛵 Entregador Próprio</p>
                </div>
              </div>

              {/* Live Financial Health Widget */}
              <div className="bg-[#121212] border border-white/20 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-[0_0_20px_rgba(255,255,255,0.08)]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-1">
                    Faturamento Acumulado
                  </span>
                  <div className="text-2xl font-extrabold text-white">R$ 94.545,00</div>
                  <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                    <TrendingUp className="size-3.5" />
                    <span>Margem Líquida Real: 25.3%</span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-3 text-xs">
                  <div className="flex justify-between text-white/70">
                    <span>Pods Vendidos:</span>
                    <span className="font-bold text-white">785 pods</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>Ticket Médio:</span>
                    <span className="font-bold text-white">R$ 175,08</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>Estoque Físico Atual:</span>
                    <span className="font-bold text-emerald-400">185 pods</span>
                  </div>
                </div>

                {/* Partner Equity Split Box */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-[11px] space-y-1">
                  <div className="font-bold text-white/80 flex items-center justify-between">
                    <span>Divisão de Sócios (50/50):</span>
                    <span className="text-[9px] text-white/50">Automático</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Sócio A (Comercial):</span>
                    <span className="text-white font-mono font-semibold">R$ 11.960,65</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Sócio B (Operações):</span>
                    <span className="text-white font-mono font-semibold">R$ 11.960,65</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </section>

      {/* ==================================================================== */}
      {/* 4. AS 4 DORES DO LOJISTA DE PODS (DIAGNÓSTICO)                        */}
      {/* ==================================================================== */}
      <section id="dores" className="py-20 px-4 sm:px-6 border-t border-[#161616] relative bg-[#070707]">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400 font-mono">
              O Custo da Desorganização
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              As 4 dores que quebram lojas de pods no primeiro ano
            </h2>
            <p className="text-xs sm:text-sm text-white/60">
              Se você se identificar com pelo menos duas, a sua operação está deixando dinheiro na mesa todos os dias.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            
            {/* Dor 1 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 p-6 rounded-2xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] group">
              <div className="size-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform">
                <Wallet className="size-6" />
              </div>
              <span className="text-xs font-mono text-white/40 block mb-1">01</span>
              <h3 className="text-base font-bold text-white mb-2">A Ilusão do Caixa e Falta de Reposição</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Você vende bem no fim de semana, mas na hora de comprar o próximo lote com o fornecedor o dinheiro sumiu. Isso acontece porque você misturou o Pix da loja com despesas pessoais achando que faturamento era lucro.
              </p>
            </div>

            {/* Dor 2 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 p-6 rounded-2xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] group">
              <div className="size-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform">
                <TrendingUp className="size-6" />
              </div>
              <span className="text-xs font-mono text-white/40 block mb-1">02</span>
              <h3 className="text-base font-bold text-white mb-2">O Cliente que Compra do Concorrente</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                O cliente comprou um pod de 15.000 ou 30.000 puffs com você. Você não sabe quando acaba, esquece de chamar e ele acaba comprando da loja vizinha da esquina porque você não estava lá na hora que o pod queimou.
              </p>
            </div>

            {/* Dor 3 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 p-6 rounded-2xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] group">
              <div className="size-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform">
                <MessageSquare className="size-6" />
              </div>
              <span className="text-xs font-mono text-white/40 block mb-1">03</span>
              <h3 className="text-base font-bold text-white mb-2">O Inferno de Mandar Foto de Sabores</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Passar 20 minutos no WhatsApp digitando lista de sabores de Ignite e Elfbar. Quando o cliente finalmente escolhe, aquele sabor já acabou no estoque e o cliente desiste da compra irritado com a demora.
              </p>
            </div>

            {/* Dor 4 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/40 p-6 rounded-2xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] group">
              <div className="size-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform">
                <Users className="size-6" />
              </div>
              <span className="text-xs font-mono text-white/40 block mb-1">04</span>
              <h3 className="text-base font-bold text-white mb-2">Briga entre Sócios no Escuro</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Dois ou três amigos tocam a loja sem saber o patrimônio real (caixa real + pods na prateleira a preço de venda). Fica sempre aquela desconfiança de quem trabalhou mais e quanto cada um pode retirar.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. A SOLUÇÃO SMK FLOW (OS RECURSOS TÉCNICOS NA PRÁTICA)             */}
      {/* ==================================================================== */}
      <section id="recursos" className="py-20 px-4 sm:px-6 border-t border-[#161616]">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 font-mono">
              Uma Operação. Uma Verdade.
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              A Solução SMK Flow: Controle cirúrgico da sua loja
            </h2>
            <p className="text-xs sm:text-sm text-white/60">
              Quatro pilares desenvolvidos na prática para resolver cada gargalo do mercado de pods descartáveis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Recurso 1 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/30 p-8 rounded-3xl transition-all duration-300 space-y-4">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Package className="size-5" />
                </div>
                <span className="text-xs font-mono text-white/40">01</span>
              </div>
              <h3 className="text-xl font-bold text-white">Painel Kanban de Pedidos em Tempo Real</h3>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                Chega de notas perdidas e mensagens esquecidas. Mova o pedido de <strong>Novo</strong> para <strong>Separando Sabor</strong> e <strong>Em Rota Uber</strong> em um clique. Baixa automática no estoque no momento em que o pedido é registrado.
              </p>
            </div>

            {/* Recurso 2 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/30 p-8 rounded-3xl transition-all duration-300 space-y-4">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Bell className="size-5" />
                </div>
                <span className="text-xs font-mono text-white/40">02</span>
              </div>
              <h3 className="text-xl font-bold text-white">Alerta de Recompra Preditiva por Puffs</h3>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                O cliente comprou um Lost Mary de 35.000 puffs? O SMK Flow calcula a taxa de consumo diário dele e dispara um alerta na sua tela: <em>"Chame o Matheus hoje! O pod dele está nos últimos 15%"</em>. Você vende de novo antes dele procurar outro.
              </p>
            </div>

            {/* Recurso 3 */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] hover:border-white/30 p-8 rounded-3xl transition-all duration-300 space-y-4">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <BarChart3 className="size-5" />
                </div>
                <span className="text-xs font-mono text-white/40">03</span>
              </div>
              <h3 className="text-xl font-bold text-white">DRE em Tempo Real e Divisão de Sócios</h3>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                O sistema desconta o custo unitário do pod (CMV), taxa de Uber e custos operacionais. Ele separa o <strong>Caixa de Recompra de Estoque</strong> e mostra exatamente a fatia líquida de cada sócio em R$ e %, acabando com discussões.
              </p>
            </div>

            {/* Recurso 4 */}
            <div className="bg-[#0b0b0b] border border-amber-500/30 hover:border-amber-400 p-8 rounded-3xl transition-all duration-300 space-y-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500/10 border-b border-l border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded-bl-xl">
                Super Bônus de Lançamento
              </div>
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <InstagramIcon className="size-5" />
                </div>
                <span className="text-xs font-mono text-white/40">04</span>
              </div>
              <h3 className="text-xl font-bold text-white">Catálogo de Pods Oficial na Bio do Instagram</h3>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                Seu cliente clica no link da Bio do Instagram e vê um cardápio responsivo em alta definição com fotos oficiais de Ignite, Elfbar e Lost Mary, badge de 'Mais Vendidos' e sabores disponíveis. O carrinho chega pronto no seu WhatsApp.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 6. PROVA SOCIAL REAL / CASE DE SUCESSO SMOKING PODS                  */}
      {/* ==================================================================== */}
      <section id="case" className="py-20 px-4 sm:px-6 border-t border-[#161616] bg-[#070707] relative">
        <div className="max-w-5xl mx-auto space-y-8 text-center">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-semibold">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>Testado e Validado no Campo de Batalha Real</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight max-w-3xl mx-auto">
            O mesmo sistema que gerencia a operação da Smoking Pods com mais de 10.000 pedidos entregues
          </h2>

          <p className="text-xs sm:text-sm text-white/70 max-w-2xl mx-auto leading-relaxed">
            O SMK Flow não foi desenhado em uma sala de escritório por teóricos. Ele nasceu dentro da nossa própria loja de pods em São Bernardo do Campo, resolvendo os problemas reais de entregadores, fornecedores e clientes exigentes.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] p-5 rounded-2xl">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">+10.000</div>
              <div className="text-[11px] text-white/50 mt-1">Pedidos entregues no ABC</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] p-5 rounded-2xl">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">25.3%</div>
              <div className="text-[11px] text-white/50 mt-1">Margem líquida média real</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] p-5 rounded-2xl">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">0 minutos</div>
              <div className="text-[11px] text-white/50 mt-1">Digitando sabores no WhatsApp</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] p-5 rounded-2xl">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">100%</div>
              <div className="text-[11px] text-white/50 mt-1">Controle de caixa e sócios</div>
            </div>
          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 7. TABELA DE PREÇOS (OFERTA DE LANÇAMENTO ANCORADA)                 */}
      {/* ==================================================================== */}
      <section id="planos" className="py-24 px-4 sm:px-6 border-t border-[#161616] relative">
        <div className="max-w-5xl mx-auto space-y-12">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            {/* Urgent Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold font-mono">
              <Flame className="size-3.5 fill-amber-400" />
              <span>Condição Especial de Lançamento</span>
            </div>

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
                  <p className="text-xs text-white/50 mt-1">Para organizar a operação, entregas e fluxo de caixa.</p>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-white/40 line-through">De R$ 149,90/mês</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">R$ 97</span>
                    <span className="text-white/50 text-sm font-semibold">,00 / mês</span>
                  </div>
                  <p className="text-[11px] text-amber-400 font-semibold font-mono">
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
                    <span>Controle de estoque de pods, marcas e sabores</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>DRE automático e divisão de lucros entre sócios</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Alerta inteligente de recompra preditiva por puffs</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Suporte via WhatsApp</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <a
                  href={`${whatsappLink}&text=Ol%C3%A1!%20Quero%20assinar%20o%20Plano%20SMK%20Gest%C3%A3o%20de%20R$%2097`}
                  className="w-full bg-[#161616] hover:bg-[#202020] border border-[#2a2a2a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95"
                >
                  <span>Assinar Plano Gestão</span>
                  <ArrowRight className="size-4" />
                </a>
              </div>
            </div>

            {/* PLANO 2: SMK PRO COMBO (MAIS VENDIDO) */}
            <div className="bg-[#0d0d0d] border-2 border-white/60 rounded-3xl p-8 flex flex-col justify-between relative shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300 group">
              
              {/* Gold Pill Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-amber-500 text-black text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                <Star className="size-3 fill-black" />
                <span>Mais Vendido • Recomendado</span>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">SMK Pro Combo</h3>
                    <Sparkles className="size-5 text-amber-400" />
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
                    <span>Fotos oficiais dos aparelhos em alta resolução</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Carrinho de compras que cai pronto no seu WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <span>Suporte prioritário VIP no WhatsApp</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <a
                  href={`${whatsappLink}&text=Ol%C3%A1!%20Quero%20aproveitar%20o%20lan%C3%A7amento%20do%20SMK%20Pro%20Combo%20(Sistema%20%2B%20Cat%C3%A1logo)%20de%20R$%20127,90`}
                  className="w-full bg-white hover:bg-slate-100 text-black font-extrabold py-4 rounded-xl transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95 cursor-pointer"
                >
                  <span>Garantir Combo com Catálogo →</span>
                </a>
              </div>
            </div>

          </div>

          <div className="text-center text-xs text-white/40 pt-4">
            Após os 30 dias de lançamento, os valores sobem para R$ 147,00 e R$ 167,90. Quem entrar agora tem o valor travado de forma vitalícia.
          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 8. FAQ ACCORDION                                                     */}
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
                q: "Preciso instalar algum programa pesado no computador?",
                a: "Não! O SMK Flow é 100% em nuvem. Você e seus sócios podem acessar de qualquer computador, notebook, tablet ou até direto do celular pelo navegador."
              },
              {
                q: "Como meus clientes acessam o catálogo de pods?",
                a: "Você recebe um link exclusivo (ex: sua-loja) para colocar direto na Bio do seu Instagram ou enviar no WhatsApp. O cliente clica, monta o pedido sem precisar baixar nenhum aplicativo e o pedido cai pronto no seu Kanban."
              },
              {
                q: "O que acontece se eu mudar o estoque ou acabar um sabor?",
                a: "A sincronização é instantânea! Se acabar o sabor 'Watermelon Ice' no seu estoque físico, o catálogo digital atualiza no mesmo segundo e para de exibir aquele sabor para os clientes."
              },
              {
                q: "E se eu não me adaptar ou não gostar do sistema?",
                a: "Você tem 7 dias de garantia incondicional. Se por qualquer motivo achar que o sistema não é para você, devolvemos 100% do seu dinheiro sem perguntas."
              },
              {
                q: "O valor de lançamento realmente não vai aumentar depois?",
                a: "Exatamente. Os clientes fundadores que assinarem durante a janela inicial de 30 dias terão o valor congelado de forma vitalícia (R$ 97 ou R$ 127,90), mesmo quando adicionarmos novas ferramentas."
              }
            ].map((faq, i) => (
              <div 
                key={i} 
                className="bg-[#0c0c0c] border border-[#1f1f1f] rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(i)}
                  className="w-full py-4 px-6 text-left flex items-center justify-between gap-4 font-bold text-sm text-white hover:text-white/90"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`size-4 text-white/40 transition-transform duration-200 ${openFaq === i ? 'rotate-180 text-white' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-xs text-white/60 leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ==================================================================== */}
      {/* 9. FINAL CALL TO ACTION (RODAPÉ DE IMPACTO)                         */}
      {/* ==================================================================== */}
      <section className="py-20 px-4 sm:px-6 border-t border-[#161616] text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />
        
        <div className="max-w-3xl mx-auto space-y-6 relative z-10">
          <div className="size-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto text-white shadow-[0_0_25px_rgba(255,255,255,0.2)]">
            <Store className="size-6" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Sua loja já cresceu. Agora sua gestão precisa acompanhar.
          </h2>

          <p className="text-sm text-white/60 max-w-xl mx-auto">
            Dê o passo profissional hoje e pare de perder clientes e dinheiro por desorganização.
          </p>

          <div className="pt-2">
            <a
              href="#planos"
              className="bg-white hover:bg-slate-100 text-black font-extrabold px-8 py-4 rounded-xl text-sm sm:text-base transition-all shadow-[0_0_35px_rgba(255,255,255,0.4)] hover:shadow-[0_0_45px_rgba(255,255,255,0.6)] inline-flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <span>Começar Agora no SMK Flow</span>
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 10. FOOTER                                                           */}
      {/* ==================================================================== */}
      <footer className="border-t border-[#161616] py-8 px-4 sm:px-6 bg-[#040404] text-xs text-white/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-white" />
            <span className="font-bold text-white">SMK Flow</span>
            <span>•</span>
            <span>© 2026 Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-2 text-white/60">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>Ambiente Seguro com Criptografia SSL</span>
          </div>
        </div>
      </footer>

      {/* ==================================================================== */}
      {/* 11. BOTÃO FLUTUANTE DE WHATSAPP                                      */}
      {/* ==================================================================== */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25d366] hover:bg-[#20bd5a] text-black size-14 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(37,211,102,0.4)] hover:scale-110 active:scale-95 transition-all cursor-pointer"
        title="Falar com especialista no WhatsApp"
      >
        <MessageCircle className="size-7 fill-black text-black" />
      </a>

    </div>
  );
}
export default LandingPage;
