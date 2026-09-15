import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Loader2 } from 'lucide-react';

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
