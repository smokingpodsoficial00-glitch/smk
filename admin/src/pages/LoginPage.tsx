import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bot, Mail, Lock, Loader2, ArrowRight, Sparkles, 
  ShieldCheck, Zap, TrendingUp, CheckCircle2, Store
} from 'lucide-react';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor, preencha o e-mail e a senha.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { error } = await signIn(email, password);

    if (error) {
      setErrorMsg(
        error.message.includes('Invalid login credentials')
          ? 'E-mail ou senha incorretos.'
          : error.message
      );
      setLoading(false);
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row overflow-x-hidden font-sans relative selection:bg-white/20 selection:text-white">
      
      {/* Dynamic Ambient White Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-white/5 blur-[140px] rounded-full pointer-events-none" />

      {/* ==================================================================== */}
      {/* COLUNA ESQUERDA (ÁREA INSTITUCIONAL DE APRESENTAÇÃO DO SAAS) ~58%     */}
      {/* ==================================================================== */}
      <div className="lg:w-[58%] p-8 lg:p-16 flex flex-col justify-between relative z-10 border-b lg:border-b-0 lg:border-r border-[#191919]">
        
        {/* Top Header Logo */}
        <div className="flex items-center gap-3 mb-12">
          <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(255,255,255,0.25)]">
            <Store className="size-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            Smoking Pods <span className="text-white font-mono text-xs ml-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/20">SaaS Pro</span>
          </span>
        </div>

        {/* Hero Institutional Content */}
        <div className="max-w-xl space-y-8 my-auto py-8">
          
          {/* Discret Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/25 text-white text-xs font-bold shadow-[0_0_15px_rgba(255,255,255,0.15)]">
            <Zap className="size-3.5 text-white fill-white/20 animate-pulse" />
            <span>Gestão Comercial & Inteligência Financeira</span>
          </div>

          {/* Large Typographic Title with Bright White Highlight */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Automatize sua operação.{' '}
            <span className="bg-gradient-to-r from-white via-slate-200 to-gray-400 bg-clip-text text-transparent underline decoration-white/30 decoration-2 underline-offset-8">
              Venda mais.
            </span>{' '}
            Gerencie tudo em um único lugar.
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-white/70 leading-relaxed font-normal">
            Plataforma completa para distribuidores e lounges: Cardápio Digital sincronizado, Kanban de pedidos em tempo real, controle cirúrgico de CMV e divisão automática de cotas societárias.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/cadastro"
              className="bg-white hover:bg-slate-100 text-black font-extrabold px-7 py-3.5 rounded-xl transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] flex items-center gap-2 active:scale-95 text-xs sm:text-sm"
            >
              <span>Criar Conta Grátis</span>
              <ArrowRight className="size-4" />
            </Link>

            <a
              href="#conhecer"
              onClick={(e) => {
                e.preventDefault();
                alert('Conheça o SaaS: Painel Kanban em tempo real, DRE automático, gestão de estoque inteligente e fatias de lucros para sócios.');
              }}
              className="bg-[#121212] hover:bg-[#1c1c1c] border border-[#262626] text-white/90 hover:text-white font-semibold px-6 py-3.5 rounded-xl transition-all flex items-center gap-2 text-xs sm:text-sm active:scale-95"
            >
              <Sparkles className="size-4 text-white" />
              <span>Conhecer Plataforma</span>
            </a>
          </div>

          {/* Glass Feature Highlights Cards */}
          <div className="grid grid-cols-3 gap-3 pt-8 border-t border-[#191919]">
            <div className="bg-[#0b0b0b]/60 border border-[#1f1f1f] hover:border-white/30 p-3.5 rounded-2xl backdrop-blur-md transition-colors">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
                <TrendingUp className="size-3.5 text-white" />
                <span>+40% Margem</span>
              </div>
              <p className="text-[11px] text-white/50 font-medium">Gestão cirúrgica de compras e CMV</p>
            </div>

            <div className="bg-[#0b0b0b]/60 border border-[#1f1f1f] hover:border-white/30 p-3.5 rounded-2xl backdrop-blur-md transition-colors">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
                <ShieldCheck className="size-3.5 text-white" />
                <span>Multi-Tenant</span>
              </div>
              <p className="text-[11px] text-white/50 font-medium">Isolamento total de dados via RLS</p>
            </div>

            <div className="bg-[#0b0b0b]/60 border border-[#1f1f1f] hover:border-white/30 p-3.5 rounded-2xl backdrop-blur-md transition-colors">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
                <Store className="size-3.5 text-white" />
                <span>DRE em Tempo Real</span>
              </div>
              <p className="text-[11px] text-white/50 font-medium">Caixa real, estoque e cotas de sócios</p>
            </div>
          </div>

        </div>

        {/* Institutional Footer */}
        <div className="text-xs text-white/40 flex items-center gap-4 pt-6">
          <span>© 2026 Smoking Pods SaaS</span>
          <span>•</span>
          <span className="flex items-center gap-1 text-white/70">
            <CheckCircle2 className="size-3 text-white" /> Sistema Operacional e Seguro
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* COLUNA DIREITA (CARD DE LOGIN DO USUÁRIO SAAS) ~42%                   */}
      {/* ==================================================================== */}
      <div className="lg:w-[42%] p-6 lg:p-12 flex items-center justify-center relative z-10 bg-[#070707]">
        
        {/* Main Login Card Container (~450px) */}
        <div className="w-full max-w-[450px] bg-[#0b0b0b] border border-[#1f1f1f] rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative">
          
          {/* Card Header & Brand Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="size-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(255,255,255,0.2)] group">
              <Store className="size-6 text-white group-hover:scale-110 transition-transform duration-300" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Bem-vindo de volta</h2>
            <p className="text-xs text-white/50 mt-1">Entre na sua conta para acessar sua empresa</p>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400 text-center animate-shake">
              {errorMsg}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-white/70 mb-2 uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/60 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-white/70 uppercase tracking-wider">Senha</label>
                <Link
                  to="/esqueci-senha"
                  className="text-xs font-semibold text-white hover:text-slate-300 transition-colors underline underline-offset-4 decoration-white/30"
                >
                  Esqueceu minha senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/60 transition-all font-medium"
                />
              </div>
            </div>

            {/* Manter Conectado Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded bg-[#141414] border-[#262626] text-white focus:ring-white focus:ring-offset-0 cursor-pointer accent-white"
              />
              <label htmlFor="remember" className="text-xs text-white/60 cursor-pointer select-none font-medium">
                Manter conectado
              </label>
            </div>

            {/* Submit Entrar Button (Full Width, Bright White) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-slate-100 disabled:opacity-50 text-black font-extrabold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:shadow-[0_0_35px_rgba(255,255,255,0.5)] active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin text-black" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="size-4 text-black" />
                </>
              )}
            </button>
          </form>

          {/* Footer Register Link */}
          <div className="mt-8 pt-6 border-t border-[#1a1a1a] text-center text-xs text-white/50">
            Ainda não tem uma conta?{' '}
            <Link to="/cadastro" className="font-bold text-white hover:underline underline-offset-4 ml-1">
              Criar uma conta
            </Link>
          </div>
        </div>

      </div>

    </div>
  );
}
