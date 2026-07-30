import { useAuth, UserRole } from '../contexts/AuthContext';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin:      ['pedidos', 'financeiro', 'estoque', 'clientes', 'chatbot', 'configuracoes', 'usuarios'],
  gerente:    ['pedidos', 'estoque', 'clientes'],
  atendente:  ['pedidos'],
  financeiro: ['financeiro'],
  estoquista: ['estoque'],
};

export function usePermissions() {
  const { role, isSuperAdmin } = useAuth();

  const canAccess = (tabOrRoute: string): boolean => {
    if (isSuperAdmin) return true;
    const allowedTabs = ROLE_PERMISSIONS[role] || ['pedidos'];
    return allowedTabs.includes(tabOrRoute);
  };

  return {
    role,
    isSuperAdmin,
    canAccess,
    allowedTabs: ROLE_PERMISSIONS[role] || ['pedidos'],
  };
}
