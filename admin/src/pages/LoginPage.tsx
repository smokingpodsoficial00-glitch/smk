import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Login Container */}
      <div className="w-full max-w-md bg-[#0b0b0b] border border-[#1f1f1f] rounded-3xl p-8 shadow-2xl relative z-10 backdrop-blur-xl">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(16,185,129,0.15)] group">
            <Bot className="size-7 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Bem-vindo de volta</h1>
          <p className="text-xs text-white/40 mt-1">Acesse sua conta para gerenciar seu estabelecimento</p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400 text-center animate-shake">
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-white/60 mb-2 uppercase tracking-wider">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider">Senha</label>
              <Link
                to="/esqueci-senha"
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all font-medium"
              />
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded bg-[#141414] border-[#262626] text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer accent-emerald-500"
            />
            <label htmlFor="remember" className="text-xs text-white/50 cursor-pointer select-none font-medium">
              Lembrar de mim
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Entrando...</span>
              </>
            ) : (
              <>
                <span>Entrar no Painel</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer link to Register */}
        <div className="mt-8 pt-6 border-t border-[#1a1a1a] text-center text-xs text-white/40">
          Ainda não tem uma conta?{' '}
          <Link to="/cadastro" className="font-bold text-white hover:text-emerald-400 transition-colors">
            Criar conta grátis
          </Link>
        </div>
      </div>
    </div>
  );
}
