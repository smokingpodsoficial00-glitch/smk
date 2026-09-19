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
  Star,
  AlertCircle
} from 'lucide-react';
import { generatePixPayload, getQrCodeImageUrl } from '../lib/pixUtils';

export function CheckoutPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPlan = searchParams.get('plano') === 'gestao' ? 'gestao' : 'combo';
  
  const [selectedPlan, setSelectedPlan] = useState<'gestao' | 'combo'>(initialPlan);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao'>('pix');

  // Customer Form
  const [storeName, setStoreName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // UI state
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutos de reserva do preço

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

  // Plan Details
  const planInfo = useMemo(() => {
    if (selectedPlan === 'gestao') {
      return {
        name: 'Plano SMK Gestão',
        price: 97.00,
        originalPrice: 147.00,
        description: 'Gestão Completa de Pedidos, Estoque, Finanças e CRM Preditivo',
        features: [
          'Painel Kanban de Pedidos (Preparando, Em Rota, Entregue)',
          'CRM Preditivo com Radar de Ciclo do Pod',
          'Radar de Estoque Parado & Sabores Encalhados',
          'Painel Financeiro, DRE e Caixa Real em Tempo Real',
          'Módulo de Divisão de Sócios e Proteção de Reposição',
          'Suporte Técnico VIP via WhatsApp'
        ],
        asaasUrl: (import.meta.env.VITE_ASAAS_GESTAO_URL as string) || 'https://wa.me/5511977300561?text=Ol%C3%A1!%20Quero%20o%20link%20do%20Asaas%20para%20pagar%20com%20cart%C3%A3o%20o%20Plano%20SMK%20Gest%C3%A3o'
      };
    }
    return {
      name: 'Plano SMK Pro Combo',
      price: 127.90,
      originalPrice: 167.90,
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
      asaasUrl: (import.meta.env.VITE_ASAAS_COMBO_URL as string) || 'https://wa.me/5511977300561?text=Ol%C3%A1!%20Quero%20o%20link%20do%20Asaas%20para%20pagar%20com%20cart%C3%A3o%20o%20Plano%20SMK%20Pro%20Combo'
    };
  }, [selectedPlan]);

  // Pix Payload & QR Code
  const pixKeyOfficial = '11977300561'; // WhatsApp / Pix oficial da loja
  const pixPayload = useMemo(() => {
    return generatePixPayload({
      pixKey: pixKeyOfficial,
      merchantName: 'SMK SYSTEM',
      merchantCity: 'SAO BERNARDO DO CAMPO',
      amount: planInfo.price,
      txId: selectedPlan === 'gestao' ? 'SMKGESTAO' : 'SMKPROCOMBO',
      description: `Assinatura ${planInfo.name}`
    });
  }, [planInfo, selectedPlan]);

  const qrCodeUrl = useMemo(() => {
    return getQrCodeImageUrl(pixPayload, 260);
  }, [pixPayload]);

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // WhatsApp confirmation message
  const whatsappConfirmLink = useMemo(() => {
    const text = `Olá! Acabei de realizar o Pix de R$ ${planInfo.price.toFixed(2).replace('.', ',')} referente ao *${planInfo.name}* (Preço de Lançamento Vitalício)!\n\n` +
      `*Dados da Minha Loja:*\n` +
      `• Loja: ${storeName || '(Nome da loja a preencher)'}\n` +
      `• Responsável: ${managerName || '(Nome do responsável)'}\n` +
      `• WhatsApp: ${phone || '(WhatsApp)'}\n` +
      `• E-mail: ${email || '(E-mail)'}\n\n` +
      `Estou enviando o comprovante em anexo para liberar o meu acesso ao SMK System! 🚀`;
    return `https://wa.me/5511977300561?text=${encodeURIComponent(text)}`;
  }, [planInfo, storeName, managerName, phone, email]);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased selection:bg-white/20 selection:text-white">
      
      {/* Background Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.03] blur-[180px] rounded-full pointer-events-none" />

      {/* Header do Checkout */}
      <header className="border-b border-white/10 bg-[#070707]/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/lp" className="flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="size-4" />
            <span>Voltar ao site</span>
          </Link>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              <Zap className="size-4 fill-white" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">SMK System</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white font-semibold">
              Checkout Seguro
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Lock className="size-3.5" />
            <span className="hidden sm:inline">SSL 256-bit</span>
          </div>
        </div>
      </header>

      {/* Banner de Urgência & Preço Travado */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-[#0c0c0c] to-emerald-950/40 border-b border-white/10 py-2.5 px-4 text-center">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
            <Sparkles className="size-3.5" />
            Preço de Lançamento Congelado Para Sempre
          </span>
          <span className="text-white/40 hidden md:inline">•</span>
          <span className="text-white/70">
            Sua vaga com valor vitalício está reservada por:
          </span>
          <div className="inline-flex items-center gap-1 bg-[#141414] border border-[#2a2a2a] px-2 py-0.5 rounded-md font-mono text-xs font-bold text-white shadow-inner">
            <Clock className="size-3 text-emerald-400" />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ==================================================================== */}
          {/* COLUNA ESQUERDA: DADOS DO LOJISTA & MEIO DE PAGAMENTO (7 COLUNAS)    */}
          {/* ==================================================================== */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. SELEÇÃO DO PLANO NO CHECKOUT */}
            <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-white/80 flex items-center gap-2">
                  <span className="size-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">1</span>
                  Selecione o Plano Ideal
                </h2>
                <span className="text-xs text-emerald-400 font-mono font-bold">Sem Fidelidade</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Opção 1: Gestão */}
                <button
                  type="button"
                  onClick={() => handlePlanChange('gestao')}
                  className={`p-4 rounded-xl border text-left transition-all relative ${
                    selectedPlan === 'gestao'
                      ? 'border-white bg-white/[0.07] ring-1 ring-white/50 shadow-[0_0_25px_rgba(255,255,255,0.1)]'
                      : 'border-white/10 bg-[#121212] hover:border-white/30 text-white/70'
                  }`}
                >
                  <div className="font-bold text-sm text-white">SMK Gestão</div>
                  <div className="text-xs text-white/50 mt-0.5">ERP, CRM & Estoque</div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-white">R$ 97</span>
                    <span className="text-xs text-white/40">/mês</span>
                  </div>
                </button>

                {/* Opção 2: Pro Combo */}
                <button
                  type="button"
                  onClick={() => handlePlanChange('combo')}
                  className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
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
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-white">R$ 127</span>
                    <span className="text-xs text-white/40">,90/mês</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. DADOS DO LOJISTA */}
            <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-white/80 flex items-center gap-2">
                <span className="size-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">2</span>
                Dados da Sua Loja / Cadastro
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      className="w-full bg-[#121212] border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/50 transition-colors"
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
                      className="w-full bg-[#121212] border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    WhatsApp para Liberação de Acesso
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: (11) 97730-0561"
                      className="w-full bg-[#121212] border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/50 transition-colors"
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
                      className="w-full bg-[#121212] border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. FORMA DE PAGAMENTO (PIX OU CARTÃO ASAAS) */}
            <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-white/80 flex items-center gap-2">
                  <span className="size-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono text-white">3</span>
                  Forma de Pagamento
                </h2>
                <span className="text-xs text-white/40">100% Criptografado</span>
              </div>

              {/* Tabs de Seleção de Pagamento */}
              <div className="grid grid-cols-2 gap-2 bg-[#121212] p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMethod === 'pix'
                      ? 'bg-white text-black shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <QrCode className="size-4" />
                  <span>Pix (Ativação Imediata)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cartao')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMethod === 'cartao'
                      ? 'bg-white text-black shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <CreditCard className="size-4" />
                  <span>Cartão de Crédito / Asaas</span>
                </button>
              </div>

              {/* CONTEÚDO DA ABA PIX */}
              {paymentMethod === 'pix' && (
                <div className="space-y-5 pt-2 animate-in fade-in-50 duration-200">
                  <div className="bg-[#121212] border border-emerald-500/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-6">
                    {/* QR Code Container */}
                    <div className="p-3 bg-white rounded-xl shadow-[0_0_25px_rgba(255,255,255,0.15)] shrink-0">
                      <img
                        src={qrCodeUrl}
                        alt="QR Code Pix SMK System"
                        className="size-44 sm:size-48 block"
                      />
                    </div>

                    {/* Instruções do Pix */}
                    <div className="space-y-3 flex-1 text-center sm:text-left">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Pix Pronto para Leitura
                      </div>

                      <div>
                        <div className="text-xs text-white/50">Valor com Preço de Lançamento:</div>
                        <div className="text-2xl font-extrabold text-white">
                          R$ {planInfo.price.toFixed(2).replace('.', ',')}
                        </div>
                      </div>

                      <div className="text-xs text-white/60 leading-relaxed">
                        1. Abra o app do seu banco e escolha <strong>Pagar com Pix / QR Code</strong>.<br />
                        2. Aponte a câmera ou use o botão de Copia e Cola abaixo.<br />
                        3. Envie o comprovante no WhatsApp para ativação instantânea!
                      </div>
                    </div>
                  </div>

                  {/* Pix Copia e Cola Input + Copiar */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-white/70">
                      Código Pix Copia e Cola:
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
                        className="bg-white hover:bg-slate-100 text-black font-extrabold px-4 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all active:scale-95 cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="size-4 text-emerald-600" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-4" />
                            <span>Copiar Pix</span>
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
                      className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-black font-black py-4 rounded-xl text-sm sm:text-base transition-all shadow-[0_0_30px_rgba(37,211,102,0.35)] hover:shadow-[0_0_40px_rgba(37,211,102,0.55)] flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer text-center"
                    >
                      <MessageCircle className="size-5 fill-black shrink-0" />
                      <span>Já Fiz o Pix ➔ Liberar Meu Acesso no WhatsApp</span>
                    </a>
                    <p className="text-[11px] text-center text-white/40 mt-2">
                      Seus dados e o comprovante são verificados diretamente pelo time oficial no WhatsApp (+55 11 97730-0561).
                    </p>
                  </div>
                </div>
              )}

              {/* CONTEÚDO DA ABA CARTÃO DE CRÉDITO (ASAAS) */}
              {paymentMethod === 'cartao' && (
                <div className="space-y-5 pt-2 animate-in fade-in-50 duration-200">
                  <div className="bg-[#121212] border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                        <CreditCard className="size-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Assinatura Mensal Recorrente no Cartão</div>
                        <div className="text-xs text-white/50">Cobrado mensalmente sem comprometer o limite total</div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-3 space-y-2 text-xs text-white/70">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                        <span>Checkout seguro e criptografado pela plataforma oficial do Asaas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                        <span>Cancela a qualquer momento com 1 clique sem taxas ou multas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                        <span>Liberação do login e onboarding enviada na hora por e-mail e WhatsApp</span>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Redirecionamento ao Asaas */}
                  <div>
                    <a
                      href={planInfo.asaasUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-white hover:bg-slate-100 text-black font-black py-4 rounded-xl text-sm sm:text-base transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] flex items-center justify-center gap-2 active:scale-95 cursor-pointer text-center"
                    >
                      <span>Pagar {planInfo.name} com Cartão no Asaas</span>
                      <ExternalLink className="size-4 shrink-0" />
                    </a>
                    <p className="text-[11px] text-center text-white/40 mt-2">
                      Você será direcionado para o checkout seguro de assinatura do Asaas.
                    </p>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* ==================================================================== */}
          {/* COLUNA DIREITA: RESUMO DO PEDIDO & GARANTIAS (5 COLUNAS)             */}
          {/* ==================================================================== */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            
            {/* Card de Resumo Financeiro */}
            <div className="bg-[#0b0b0b] border-2 border-white/30 rounded-3xl p-6 sm:p-7 shadow-[0_0_40px_rgba(255,255,255,0.08)] space-y-6">
              
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-white/50">Resumo da Assinatura</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    Oferta de Lançamento
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">{planInfo.name}</h3>
                <p className="text-xs text-white/50 mt-0.5">{planInfo.description}</p>
              </div>

              <div className="space-y-2 py-4 border-y border-white/10 text-xs">
                <div className="flex justify-between text-white/60">
                  <span>Valor normal pós-lançamento:</span>
                  <span className="line-through text-white/40">
                    R$ {planInfo.originalPrice.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Desconto vitalício de lançamento:</span>
                  <span>- R$ 40,00/mês</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 text-sm text-white font-bold">
                  <span>Total hoje:</span>
                  <div className="text-right">
                    <span className="text-2xl sm:text-3xl font-extrabold text-white">
                      R$ {planInfo.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-xs text-white/40 block font-normal">por mês, vitalício</span>
                  </div>
                </div>
              </div>

              {/* O que está incluso */}
              <div className="space-y-2.5 text-xs text-white/80">
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
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3 text-xs">
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
            <div className="p-4 rounded-2xl bg-[#0b0b0b] border border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="size-4 text-emerald-400" />
                <div>
                  <span className="text-white font-bold block">Precisa de ajuda para assinar?</span>
                  <span className="text-white/40 text-[11px]">Fale direto com a equipe oficial</span>
                </div>
              </div>
              <a
                href="https://wa.me/5511977300561?text=Ol%C3%A1!%20Estou%20na%20p%C3%A1gina%20de%20checkout%20do%20SMK%20System%20e%20preciso%20de%20ajuda%20para%20concluir%20a%20assinatura."
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2"
              >
                Chamar no WhatsApp
              </a>
            </div>

          </div>

        </div>

      </main>

      {/* Footer Minimalista */}
      <footer className="border-t border-white/10 py-8 px-4 text-center text-xs text-white/40 space-y-2">
        <div>© 2026 SMK System SaaS Pro. Todos os direitos reservados.</div>
        <div className="text-[11px] text-white/30">
          Pagamentos processados com segurança via Pix Banco Central e Asaas IP S.A.
        </div>
      </footer>

    </div>
  );
}
export default CheckoutPage;
