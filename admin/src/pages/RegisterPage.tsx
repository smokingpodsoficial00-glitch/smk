import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Building2, User, Phone, Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { error } = await signUp({
      companyName,
      managerName,
      phone,
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      navigate('/onboarding', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg bg-[#0b0b0b] border border-[#1f1f1f] rounded-3xl p-8 shadow-2xl relative z-10 backdrop-blur-xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
            <Bot className="size-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Criar Nova Conta SaaS</h1>
          <p className="text-xs text-white/40 mt-1">Cadastre sua empresa e comece a escalar suas vendas com IA</p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400 text-center animate-shake">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Nome da Empresa */}
          <div>
            <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Nome da Empresa / Loja</label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Vape King Lounge"
                className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all font-medium"
              />
            </div>
          </div>

          {/* Nome do Responsável + WhatsApp (Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Seu Nome</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
                <input
                  type="text"
                  required
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">E-mail Corporativo</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@empresa.com"
                className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all font-medium"
              />
            </div>
          </div>

          {/* Senha e Confirmar Senha (Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 dígitos"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-3 shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Criando sua empresa...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                <span>Finalizar Cadastro e Iniciar</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#1a1a1a] text-center text-xs text-white/40">
          Já possui uma empresa cadastrada?{' '}
          <Link to="/login" className="font-bold text-white hover:text-emerald-400 transition-colors">
            Fazer login
          </Link>
        </div>
      </div>
    </div>
  );
}
