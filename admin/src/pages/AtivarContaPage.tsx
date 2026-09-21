import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  Lock, 
  Loader2, 
  CheckCircle2, 
  ShieldCheck, 
  ShieldAlert, 
  Sparkles, 
  ArrowRight, 
  Zap,
  MessageCircle
} from 'lucide-react';

export function AtivarContaPage() {
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Verificação de Autorização de Acesso:
  // Só permite ativar se veio com parâmetros do Asaas (origem=asaas, status=sucesso/success),
  // ou com token/liberação de Pix ou e-mail pré-identificado.
  const isAuthorized = 
    searchParams.get('origem') === 'asaas' ||
    searchParams.get('origem') === 'pix' ||
    searchParams.get('status') === 'sucesso' ||
    searchParams.get('status') === 'success' ||
    Boolean(searchParams.get('token')) ||
    Boolean(searchParams.get('email'));

  // Form State pré-preenchido caso venha na URL
  const [companyName, setCompanyName] = useState(searchParams.get('loja') || searchParams.get('empresa') || '');
  const [managerName, setManagerName] = useState(searchParams.get('nome') || '');
  const [phone, setPhone] = useState(searchParams.get('phone') || searchParams.get('whatsapp') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    document.title = 'Ativar Conta | SMK System';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('A senha de acesso deve ter no mínimo 6 dígitos.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { error } = await signUp({
      companyName: companyName.trim(),
      managerName: managerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      password,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('user already registered') || msg.includes('already exists')) {
        setErrorMsg('Este e-mail já possui uma conta no sistema. Faça login diretamente ou use outro e-mail.');
      } else {
        setErrorMsg(error.message || 'Erro ao ativar a conta. Tente novamente.');
      }
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        navigate('/onboarding', { replace: true });
      }, 1500);
    }
  };

  // Se o usuário tentar acessar a tela sem vir de um fluxo de pagamento ou convite autorizado:
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-white/20 selection:text-white">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-500/5 blur-[180px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md bg-[#0b0b0b] border border-[#222] rounded-3xl p-8 shadow-2xl relative z-10 text-center">
          <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-5 text-amber-400">
            <ShieldAlert className="size-8" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Acesso Restrito a Assinantes
          </h1>

          <p className="text-xs sm:text-sm text-white/60 mt-3 leading-relaxed">
            Esta página é exclusiva para a ativação de lojas com assinatura confirmada pelo Asaas ou liberação oficial via Pix.
          </p>

          <div className="mt-8 space-y-3">
            <a
              href="https://smk-system.vercel.app/checkout"
              className="w-full bg-white hover:bg-slate-100 text-black font-extrabold py-3.5 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(255,255,255,0.2)] block text-center"
            >
              <span>Ver Planos e Assinar Agora</span>
              <ArrowRight className="size-4" />
            </a>

            <Link
              to="/login"
              className="w-full bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-white/80 hover:text-white font-semibold py-3 px-4 rounded-xl text-xs transition-all block text-center"
            >
              Já tenho conta (Fazer Login)
            </Link>

            <a
              href="https://wa.me/5511977300561?text=Ol%C3%A1!%20Fiz%20o%20pagamento%20do%20SMK%20System%20e%20preciso%20do%20link%20de%20ativa%C3%A7%C3%A3o%20da%20minha%20loja."
              target="_blank"
              rel="noreferrer"
              className="w-full text-emerald-400 hover:text-emerald-300 text-xs font-semibold py-2 transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="size-4" />
              <span>Já paguei e preciso de ajuda no WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden font-sans selection:bg-white/20 selection:text-white">
      {/* Dynamic Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-emerald-500/10 blur-[180px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg bg-[#0b0b0b] border border-white/10 rounded-3xl p-6 sm:p-9 shadow-2xl relative z-10 backdrop-blur-xl">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>Pagamento Confirmado • Ativação Imediata</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Ative o seu Acesso ao SMK System
          </h1>
          <p className="text-xs sm:text-sm text-white/60 mt-1.5 max-w-sm">
            Configure o nome da sua loja e crie a sua senha para liberar o painel operacional agora mesmo.
          </p>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-400 text-center flex items-center justify-center gap-2 animate-in fade-in-50">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Conta ativada com sucesso! Redirecionando para o seu painel...</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400 text-center animate-shake">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Nome da Loja */}
          <div>
            <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
              Nome da Empresa / Loja
            </label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Smoke Prime Lounge"
                className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/60 transition-all font-medium"
              />
            </div>
          </div>

          {/* Nome do Responsável + WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
                Seu Nome
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <input
                  type="text"
                  required
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/60 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
                WhatsApp
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/60 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* E-mail de Acesso */}
          <div>
            <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
              E-mail para Login
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/60 transition-all font-medium"
              />
            </div>
          </div>

          {/* Senha e Confirmação de Senha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
                Crie sua Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 dígitos"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/60 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/60 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Botão de Concluir Ativação */}
          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-white hover:bg-slate-100 disabled:opacity-50 text-black font-extrabold py-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-3 shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] active:scale-[0.99] text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin text-black" />
                <span>Ativando sua conta e criando sua loja...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-4 text-black" />
                <span>Ativar Minha Conta e Acessar Painel</span>
                <ArrowRight className="size-4 text-black" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-white/40">
          <ShieldCheck className="size-4 text-emerald-400" />
          <span>Ambiente com criptografia militar SSL 256-bit</span>
        </div>
      </div>
    </div>
  );
}
