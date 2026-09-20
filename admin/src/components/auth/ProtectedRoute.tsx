import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Loader2, ShieldAlert, MessageCircle, CreditCard, ExternalLink } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requireSuperAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requireSuperAdmin,
}) => {
  const { user, company, companyUser, loading, isSuperAdmin, signOut } = useAuth();
  const { canAccess } = usePermissions();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4 text-white">
        <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-pulse">
          <Loader2 className="size-6 text-emerald-400 animate-spin" />
        </div>
        <p className="text-xs font-mono text-white/50 tracking-wider uppercase">Carregando sistema...</p>
      </div>
    );
  }

  // Se não estiver autenticado no Supabase Auth, vai para o login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se estiver autenticado no Supabase Auth mas NÃO possuir vínculo válido/ativo em company_users
  if (!companyUser || !company || !companyUser.is_active) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-[#111111] border border-red-500/30 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
          <div className="size-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-2xl font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Acesso Administrativo Negado</h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Sua conta autenticada (<span className="text-white/80 font-mono text-xs">{user.email}</span>) não possui permissão de acesso vinculada a nenhuma empresa ativa neste painel.
          </p>
          <div className="w-full pt-4 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={() => signOut()}
              className="w-full py-2.5 px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-medium transition-colors cursor-pointer"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se a empresa foi suspensa/bloqueada pelo Master Admin
  if (company && company.is_active === false) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-white text-center font-sans">
        <div className="max-w-md w-full bg-[#0e0e0e] border border-amber-500/30 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-5">
          <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ShieldAlert className="size-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Assinatura da Loja Suspensa</h2>
            <p className="text-xs text-white/60 mt-2 leading-relaxed">
              O acesso ao painel do sistema da loja <strong className="text-white">{company.name}</strong> está temporariamente pausado devido a pendência na renovação ou cancelamento.
            </p>
          </div>
          <div className="w-full pt-2 flex flex-col gap-2.5">
            <a
              href="https://www.asaas.com/c/57rnm1clcavvd8nc"
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-black text-xs font-black transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95 cursor-pointer text-center"
            >
              <CreditCard className="size-4 text-black shrink-0" />
              <span>Renovar Assinatura no Cartão (Asaas)</span>
              <ExternalLink className="size-3 text-black/60 shrink-0" />
            </a>

            <a
              href="https://wa.me/5511977300561?text=Ol%C3%A1!%20Sou%20o%20respons%C3%A1vel%20pela%20loja%20e%20meu%20painel%20est%C3%A1%20com%20aviso%20de%20suspens%C3%A3o.%20Gostaria%20de%20regularizar%20o%20acesso%20via%20Pix."
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <MessageCircle className="size-4 fill-[#25D366]" />
              <span>Regularizar via Pix no WhatsApp</span>
            </a>

            <button
              onClick={() => signOut()}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se precisar de super admin e o usuário não for
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  // Se a empresa ainda não completou o onboarding e não estivermos na página de onboarding
  if (company && !company.onboarding_done && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Se a rota exige uma permissão específica que o cargo do usuário não possui
  if (requiredPermission && !canAccess(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
