import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Zap,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Copy,
  Check,
  MessageCircle,
  CreditCard,
  QrCode,
  ArrowLeft,
  Sparkles,
  Building2,
  User,
  Phone,
  Mail,
  Clock,
  ExternalLink,
  Flame,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { generatePixPayload, generateQrCodeDataUrl } from '../lib/pixUtils';

export function CheckoutPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPlan = searchParams.get('plano') === 'gestao' ? 'gestao' : 'combo';
  
  const [selectedPlan, setSelectedPlan] = useState<'gestao' | 'combo'>(initialPlan);
  // Default to 'cartao' as requested: best pricing, lowest churn, automatic renewal
  const [paymentMethod, setPaymentMethod] = useState<'cartao' | 'pix'>('cartao');

  // Customer Form
  const [storeName, setStoreName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // UI state
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutos de reserva do preço

  // Dados Oficiais do Pix
  const pixKeyOfficial = 'cc0c1ec5-cf52-4481-ada0-af0a862a7462';
  const pixNameOfficial = 'Eduardo de Oliveira Pizza';

  // Sync with URL query param
  useEffect(() => {
    const p = searchParams.get('plano');
    if (p === 'gestao' || p === 'combo') {
      setSelectedPlan(p);
    }
  }, [searchParams]);

  const handlePlanChange = (plan: 'gestao' | 'combo') => {
    setSelectedPlan(plan);
    setSearchParams({ plano: plan });
  };

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Plan Details with special discount on Credit Card
  const planInfo = useMemo(() => {
    if (selectedPlan === 'gestao') {
      return {
        name: 'Plano SMK Gestão',
        pricePix: 97.00,
        priceCartao: 89.90, // Desconto exclusivo no cartão
        originalPrice: 147.00,
        cartaoDiscount: 7.10,
        description: 'Gestão Completa de Pedidos, Estoque, Finanças e CRM Preditivo',
        features: [
          'Painel Kanban de Pedidos (Preparando, Em Rota, Entregue)',
          'CRM Preditivo com Radar de Ciclo do Pod',
          'Radar de Estoque Parado & Sabores Encalhados',
          'Painel Financeiro, DRE e Caixa Real em Tempo Real',
          'Módulo de Divisão de Sócios e Proteção de Reposição',
          'Suporte Técnico VIP via WhatsApp'
        ],
        asaasUrl: (import.meta.env.VITE_ASAAS_GESTAO_URL as string) || 'https://wa.me/5511977300561?text=Ol%C3%A1!%20Quero%20o%20link%20do%20Asaas%20para%20pagar%20com%20cart%C3%A3o%20o%20Plano%20SMK%20Gest%C3%A3o%20por%20R$%2089,90'
      };
    }
    return {
      name: 'Plano SMK Pro Combo',
      pricePix: 127.90,
      priceCartao: 119.90, // Desconto exclusivo no cartão
      originalPrice: 167.90,
      cartaoDiscount: 8.00,
      description: 'Sistema de Gestão Completo + Catálogo Digital Oficial na Bio',
      features: [
        'TUDO incluso no Plano Gestão de Pods',
        'Catálogo Digital Oficial na Bio do Instagram',
        'Estoque e Sabores Sincronizados em Tempo Real',
        'Fotos Oficiais dos Modelos em Alta Resolução',
        'Carrinho de Compras Pronto Direto no WhatsApp',
        'Chega de Digitar Lista de Sabores Todo Santo Dia',
        'Suporte Prioritário VIP via WhatsApp'
      ],
      asaasUrl: (import.meta.env.VITE_ASAAS_COMBO_URL as string) || 'https://wa.me/5511977300561?text=Ol%C3%A1!%20Quero%20o%20link%20do%20Asaas%20para%20pagar%20com%20cart%C3%A3o%20o%20Plano%20SMK%20Pro%20Combo%20por%20R$%20119,90'
    };
  }, [selectedPlan]);

  const currentPrice = paymentMethod === 'cartao' ? planInfo.priceCartao : planInfo.pricePix;

  // Pix Payload & QR Code com dados oficiais e padrão estático Bacen
  const pixPayload = useMemo(() => {
    return generatePixPayload({
      pixKey: pixKeyOfficial,
      merchantName: 'EDUARDO DE OLIVEIRA PIZZA',
      merchantCity: 'SAO PAULO',
      amount: planInfo.pricePix,
      txId: '***'
    });
  }, [planInfo, pixKeyOfficial]);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    generateQrCodeDataUrl(pixPayload, 360)
      .then(url => {
        if (isMounted) setQrCodeDataUrl(url);
      })
      .catch(err => {
        console.error('Erro ao gerar QR Code local:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [pixPayload]);

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // WhatsApp confirmation message para Pix
  const whatsappConfirmLink = useMemo(() => {
    const text = `Olá! Acabei de realizar o Pix de R$ ${planInfo.pricePix.toFixed(2).replace('.', ',')} referente ao *${planInfo.name}* (Preço de Lançamento Vitalício)!\n\n` +
      `*Dados da Minha Loja:*\n` +
      `• Loja: ${storeName || '(Nome da loja a preencher)'}\n` +
      `• Responsável: ${managerName || '(Nome do responsável)'}\n` +
      `• WhatsApp: ${phone || '(WhatsApp)'}\n` +
      `• E-mail: ${email || '(E-mail)'}\n\n` +
      `Estou enviando o comprovante em anexo para liberar o meu acesso ao SMK System! 🚀`;
    return `https://wa.me/5511977300561?text=${encodeURIComponent(text)}`;
  }, [planInfo, storeName, managerName, phone, email]);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased selection:bg-white/20 selection:text-white overflow-x-hidden">
      
      {/* Background Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.03] blur-[180px] rounded-full pointer-events-none" />

      {/* Header do Checkout */}
      <header className="border-b border-white/10 bg-[#070707]/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/lp" className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-white/60 hover:text-white transition-colors shrink-0">
            <ArrowLeft className="size-3.5 sm:size-4" />
            <span>Voltar ao site</span>
          </Link>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="size-7 sm:size-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,255,255,0.2)] shrink-0">
              <Zap className="size-3.5 sm:size-4 fill-white" />
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-white whitespace-nowrap">SMK System</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white font-semibold hidden xs:inline-flex whitespace-nowrap">
              Checkout Seguro
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium shrink-0">
            <Lock className="size-3.5" />
            <span className="hidden sm:inline">SSL 256-bit</span>
          </div>
        </div>
      </header>

      {/* Banner de Urgência & Preço Travado */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-[#0c0c0c] to-emerald-950/40 border-b border-white/10 py-2.5 px-3 sm:px-4 text-center">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 sm:gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider text-[11px] shrink-0">
            <Sparkles className="size-3.5" />
            Preço Vitalício Congelado
          </span>
          <span className="text-white/40 hidden sm:inline">•</span>
          <span className="text-white/70 text-[11px] sm:text-xs">
            Vaga de lançamento reservada por:
          </span>
          <div className="inline-flex items-center gap-1 bg-[#141414] border border-[#2a2a2a] px-2 py-0.5 rounded-md font-mono text-xs font-bold text-white shadow-inner shrink-0">
            <Clock className="size-3 text-emerald-400" />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          
          {/* ==================================================================== */}
          {/* COLUNA ESQUERDA: PLANOS, DADOS & PAGAMENTO (7 COLUNAS)              */}
          {/* ==================================================================== */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            
            {/* 1. SELEÇÃO DO PLANO NO CHECKOUT */}
            <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white/80 flex items-center gap-2">
                  <span className="size-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">1</span>
                  Selecione o Plano Desejado
                </h2>
                <span className="text-xs text-emerald-400 font-mono font-bold">Sem Fidelidade</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Opção 1: Gestão */}
                <button
                  type="button"
                  onClick={() => handlePlanChange('gestao')}
                  className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
                    selectedPlan === 'gestao'
                      ? 'border-white bg-white/[0.08] ring-1 ring-white/50 shadow-[0_0_25px_rgba(255,255,255,0.1)]'
                      : 'border-white/10 bg-[#121212] hover:border-white/30 text-white/70'
                  }`}
                >
                  <div className="font-bold text-sm text-white">SMK Gestão</div>
                  <div className="text-xs text-white/50 mt-0.5">ERP, CRM & Estoque</div>
                  
                  <div className="mt-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold text-white">
                        R$ {paymentMethod === 'cartao' ? '89,90' : '97,00'}
                      </span>
                      <span className="text-xs text-white/40">/mês</span>
                    </div>
                    {paymentMethod === 'cartao' && (
                      <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                        🔥 Desconto de R$ 7,10 no Cartão
                      </span>
                    )}
                  </div>
                </button>

                {/* Opção 2: Pro Combo */}
                <button
                  type="button"
                  onClick={() => handlePlanChange('combo')}
                  className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                    selectedPlan === 'combo'
                      ? 'border-white bg-white/[0.08] ring-1 ring-white/60 shadow-[0_0_30px_rgba(255,255,255,0.15)]'
                      : 'border-white/15 bg-[#121212] hover:border-white/30 text-white/70'
                  }`}
                >
                  <div className="absolute -top-0.5 -right-0.5 bg-white text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg">
                    Recomendado
                  </div>
                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    <span>SMK Pro Combo</span>
                    <Sparkles className="size-3 text-white" />
                  </div>
                  <div className="text-xs text-emerald-400 font-medium mt-0.5">+ Catálogo Digital na Bio</div>
                  
                  <div className="mt-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold text-white">
                        R$ {paymentMethod === 'cartao' ? '119,90' : '127,90'}
                      </span>
                      <span className="text-xs text-white/40">/mês</span>
                    </div>
                    {paymentMethod === 'cartao' && (
                      <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                        🔥 Desconto de R$ 8,00 no Cartão
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* 2. DADOS DO LOJISTA */}
            <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4">
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white/80 flex items-center gap-2">
                <span className="size-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">2</span>
                Dados da Sua Loja / Cadastro
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Nome da Sua Loja / Empresa
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Ex: Smoking Pods ABC"
                      className="w-full bg-[#121212] border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Seu Nome Completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                    <input
                      type="text"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      placeholder="Ex: Gabriel Dias"
                      className="w-full bg-[#121212] border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    WhatsApp de Liberação
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: (11) 97730-0561"
                      className="w-full bg-[#121212] border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    E-mail do Administrador
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex: loja@gmail.com"
                      className="w-full bg-[#121212] border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. FORMA DE PAGAMENTO (CARTÃO COM DESCONTO OU PIX) */}
            <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white/80 flex items-center gap-2">
                  <span className="size-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">3</span>
                  Forma de Pagamento
                </h2>
                <span className="text-xs text-white/40">100% Seguro</span>
              </div>

              {/* Tabs de Seleção de Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#121212] p-1.5 rounded-xl border border-white/5">
                
                {/* Botão Tab Cartão de Crédito (DESTAQUE MÁXIMO) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cartao')}
                  className={`py-3 px-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer relative ${
                    paymentMethod === 'cartao'
                      ? 'bg-white text-black shadow-lg ring-1 ring-white/50'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="size-4" />
                    <span>Cartão de Crédito</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                      paymentMethod === 'cartao' ? 'bg-emerald-600 text-white' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      Mais Barato
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-extrabold">
                    R$ {planInfo.priceCartao.toFixed(2).replace('.', ',')}/mês
                  </span>
                </button>

                {/* Botão Tab Pix */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`py-3 px-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    paymentMethod === 'pix'
                      ? 'bg-white text-black shadow-lg ring-1 ring-white/50'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <QrCode className="size-4" />
                    <span>Pix Instantâneo</span>
                  </div>
                  <span className="text-[11px] font-mono text-white/60">
                    R$ {planInfo.pricePix.toFixed(2).replace('.', ',')}/mês
                  </span>
                </button>

              </div>

              {/* ================================================================ */}
              {/* CONTEÚDO DA ABA CARTÃO DE CRÉDITO (RECOMENDADO / ASAAS)           */}
              {/* ================================================================ */}
              {paymentMethod === 'cartao' && (
                <div className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
                  
                  {/* Banner de Vantagens do Cartão */}
                  <div className="bg-gradient-to-r from-emerald-950/30 via-[#101914] to-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                      <Flame className="size-4 text-emerald-400 fill-emerald-400/20" />
                      <span>Por que 87% dos lojistas preferem o Cartão de Crédito?</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-white/80">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>Preço Reduzido:</strong> De R$ {planInfo.pricePix.toFixed(2).replace('.', ',')} por apenas <strong>R$ {planInfo.priceCartao.toFixed(2).replace('.', ',')}/mês</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>Zero Risco de Bloqueio:</strong> Débito automático mensal sem risco de seu catálogo ou painel saírem do ar por esquecimento.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>Não Ocupa o Limite:</strong> É uma assinatura (como Netflix), consome apenas a mensalidade do mês, sem travar seu limite anual.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>100% Flexível:</strong> Cancele a qualquer momento com 1 clique, sem letras miúdas ou fidelidade.</span>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Redirecionamento ao Asaas */}
                  <div className="pt-1">
                    <a
                      href={planInfo.asaasUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-white hover:bg-slate-100 text-black font-black py-4 px-4 rounded-xl text-sm sm:text-base transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] flex items-center justify-center gap-2 active:scale-95 cursor-pointer text-center"
                    >
                      <span>Pagar {planInfo.name} com Desconto por R$ {planInfo.priceCartao.toFixed(2).replace('.', ',')}</span>
                      <ArrowRight className="size-4 shrink-0" />
                    </a>
                    <p className="text-[11px] text-center text-white/40 mt-2">
                      Ambiente seguro processado pela plataforma oficial de pagamentos do Asaas.
                    </p>
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* CONTEÚDO DA ABA PIX (CHAVE REAL EDUARDO DE OLIVEIRA PIZZA)       */}
              {/* ================================================================ */}
              {paymentMethod === 'pix' && (
                <div className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
                  
                  {/* Aviso de que no cartão tem desconto */}
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-4 shrink-0" />
                      <span>Dica: Pague no Cartão de Crédito e ganhe desconto por <strong>R$ {planInfo.priceCartao.toFixed(2).replace('.', ',')}/mês</strong>!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cartao')}
                      className="underline font-bold text-white shrink-0 hover:text-amber-200 cursor-pointer"
                    >
                      Ver Cartão →
                    </button>
                  </div>

                  {/* Bloco QR Code e Instruções */}
                  <div className="bg-[#121212] border border-emerald-500/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
                    {/* QR Code Container (Gerado localmente em alta resolução) */}
                    <div className="p-3 bg-white rounded-xl shadow-[0_0_25px_rgba(255,255,255,0.15)] shrink-0 flex items-center justify-center min-w-40 min-h-40">
                      {qrCodeDataUrl ? (
                        <img
                          src={qrCodeDataUrl}
                          alt="QR Code Pix SMK System"
                          className="size-40 sm:size-44 block object-contain"
                        />
                      ) : (
                        <div className="size-40 sm:size-44 flex items-center justify-center text-black/40 text-xs font-mono">
                          Gerando QR Code...
                        </div>
                      )}
                    </div>

                    {/* Instruções do Pix com Dados Reais */}
                    <div className="space-y-2.5 flex-1 text-center sm:text-left w-full">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Pix Oficial Pronto
                      </div>

                      <div>
                        <div className="text-xs text-white/50">Valor da Assinatura:</div>
                        <div className="text-2xl font-extrabold text-white">
                          R$ {planInfo.pricePix.toFixed(2).replace('.', ',')}
                        </div>
                      </div>

                      <div className="text-xs text-white/70 bg-black/40 p-2.5 rounded-lg border border-white/5 font-mono text-[11px]">
                        <div><strong>Titular:</strong> {pixNameOfficial}</div>
                      </div>

                      <div className="text-[11px] text-white/50 leading-relaxed">
                        Abra o app do seu banco, escolha <strong>Pix QR Code</strong> ou cole o código abaixo e confirme o pagamento.
                      </div>
                    </div>
                  </div>

                  {/* Pix Copia e Cola Input + Copiar */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-white/70">
                      Código Pix Copia e Cola Oficial:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={pixPayload}
                        className="w-full bg-[#121212] border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white/60 font-mono truncate focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="bg-white hover:bg-slate-100 text-black font-extrabold px-3.5 sm:px-4 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all active:scale-95 cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="size-4 text-emerald-600" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-4" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Botão de Liberação de Acesso no WhatsApp */}
                  <div className="pt-2">
                    <a
                      href={whatsappConfirmLink}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-black font-black py-4 px-3 rounded-xl text-sm sm:text-base transition-all shadow-[0_0_30px_rgba(37,211,102,0.35)] hover:shadow-[0_0_40px_rgba(37,211,102,0.55)] flex items-center justify-center gap-2 active:scale-95 cursor-pointer text-center"
                    >
                      <MessageCircle className="size-5 fill-black shrink-0" />
                      <span>Já Fiz o Pix ➔ Liberar Meu Acesso no WhatsApp</span>
                    </a>
                    <p className="text-[11px] text-center text-white/40 mt-2">
                      Envie o comprovante no WhatsApp oficial (+55 11 97730-0561) para liberação imediata da sua conta.
                    </p>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* ==================================================================== */}
          {/* COLUNA DIREITA: RESUMO DO PEDIDO & GARANTIAS (5 COLUNAS)             */}
          {/* ==================================================================== */}
          <div className="lg:col-span-5 space-y-5 sm:space-y-6 lg:sticky lg:top-20">
            
            {/* Card de Resumo Financeiro */}
            <div className="bg-[#0b0b0b] border-2 border-white/30 rounded-3xl p-5 sm:p-7 shadow-[0_0_40px_rgba(255,255,255,0.08)] space-y-5">
              
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-white/50">Resumo da Assinatura</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    Preço Vitalício
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">{planInfo.name}</h3>
                <p className="text-xs text-white/50 mt-0.5">{planInfo.description}</p>
              </div>

              <div className="space-y-2 py-3.5 border-y border-white/10 text-xs">
                <div className="flex justify-between text-white/60">
                  <span>Valor normal pós-lançamento:</span>
                  <span className="line-through text-white/40">
                    R$ {planInfo.originalPrice.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                
                {paymentMethod === 'cartao' ? (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Desconto no Cartão de Crédito:</span>
                    <span>- R$ {(planInfo.originalPrice - planInfo.priceCartao).toFixed(2).replace('.', ',')}/mês</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Desconto de lançamento:</span>
                    <span>- R$ {(planInfo.originalPrice - planInfo.pricePix).toFixed(2).replace('.', ',')}/mês</span>
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-2 text-sm text-white font-bold">
                  <span>Total hoje:</span>
                  <div className="text-right">
                    <span className="text-2xl sm:text-3xl font-extrabold text-white">
                      R$ {currentPrice.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-xs text-white/40 block font-normal">
                      {paymentMethod === 'cartao' ? 'por mês (no cartão com desconto)' : 'por mês (no Pix)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* O que está incluso */}
              <div className="space-y-2 text-xs text-white/80">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">
                  Tudo Incluso na Sua Licença:
                </div>
                {planInfo.features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Garantia Incondicional */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3 text-xs">
                <ShieldCheck className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold">Garantia Blindada de 7 Dias</strong>
                  <span className="text-white/60 text-[11px] leading-relaxed">
                    Se você não sentir sua loja mais organizada e profissional na primeira semana, devolvemos 100% do seu dinheiro sem perguntas.
                  </span>
                </div>
              </div>

              {/* Selos de Confiança */}
              <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-white/40 pt-1">
                <div className="p-2 rounded-lg bg-[#141414] border border-white/5">
                  🔒 Criptografia SSL
                </div>
                <div className="p-2 rounded-lg bg-[#141414] border border-white/5">
                  ⚡ Setup em 5 minutos
                </div>
              </div>

            </div>

            {/* Card de Suporte / Dúvidas */}
            <div className="p-4 rounded-2xl bg-[#0b0b0b] border border-white/10 flex items-center justify-between text-xs gap-3">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="size-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-white font-bold block">Precisa de ajuda?</span>
                  <span className="text-white/40 text-[11px]">Fale no WhatsApp oficial</span>
                </div>
              </div>
              <a
                href="https://wa.me/5511977300561?text=Ol%C3%A1!%20Estou%20na%20p%C3%A1gina%20de%20checkout%20do%20SMK%20System%20e%20preciso%20de%20ajuda%20para%20concluir%20a%20assinatura."
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 shrink-0"
              >
                Chamar Suporte
              </a>
            </div>

          </div>

        </div>

      </main>

      {/* Footer Minimalista */}
      <footer className="border-t border-white/10 py-6 sm:py-8 px-4 text-center text-xs text-white/40 space-y-2">
        <div>© 2026 SMK System SaaS Pro. Todos os direitos reservados.</div>
        <div className="text-[11px] text-white/30">
          Pagamentos processados com segurança via Pix Banco Central e Asaas IP S.A.
        </div>
      </footer>

    </div>
  );
}
export default CheckoutPage;
