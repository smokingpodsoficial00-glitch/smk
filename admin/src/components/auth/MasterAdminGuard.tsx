import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

export function MasterAdminGuard({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const { isMasterAdmin } = usePermissions();

  if (loading) return null;

  if (!isMasterAdmin) {
    return <Navigate to="/pedidos" replace />;
  }

  return <>{children}</>;
}
