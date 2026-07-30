import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Mail, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMsg(null);

    const { error } = await resetPassword(email);

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-[#0b0b0b] border border-[#1f1f1f] rounded-3xl p-8 shadow-2xl relative z-10 backdrop-blur-xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
            <Bot className="size-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Recuperar Senha</h1>
          <p className="text-xs text-white/40 mt-1">Informe seu e-mail cadastrado para receber as instruções</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400 text-center">
            {errorMsg}
          </div>
        )}

        {success ? (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center flex flex-col items-center gap-3">
            <CheckCircle2 className="size-10 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">E-mail enviado com sucesso!</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Verifique sua caixa de entrada ou spam no e-mail <strong className="text-white">{email}</strong> para redefinir sua senha.
            </p>
            <Link
              to="/login"
              className="mt-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Voltar ao login</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-white/60 mb-2 uppercase tracking-wider">E-mail Cadastrado</label>
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Enviando link...</span>
                </>
              ) : (
                <span>Enviar Link de Recuperação</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-[#1a1a1a] text-center text-xs text-white/40">
          Lembrou a senha?{' '}
          <Link to="/login" className="font-bold text-white hover:text-emerald-400 transition-colors">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
