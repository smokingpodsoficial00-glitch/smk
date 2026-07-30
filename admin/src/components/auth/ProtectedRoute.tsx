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
  const { user, company, loading, isSuperAdmin } = useAuth();
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

  // Se não estiver autenticado, vai para o login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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
