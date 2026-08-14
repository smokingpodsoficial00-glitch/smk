import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../contexts/AuthContext';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin:      ['pedidos', 'financeiro', 'estoque', 'clientes', 'chatbot', 'configuracoes', 'usuarios'],
  gerente:    ['pedidos', 'estoque', 'clientes'],
  atendente:  ['pedidos'],
  financeiro: ['financeiro'],
  estoquista: ['estoque'],
};

export function usePermissions() {
  const { role, isSuperAdmin, user, company, companyUser } = useAuth();

  // Verifica se o usuário logado é da conta proprietária da Smoking Pods
  const isSmokingPodsOfficial = 
    user?.email?.toLowerCase() === 'smokingpodsoficial00@gmail.com' ||
    companyUser?.email?.toLowerCase() === 'smokingpodsoficial00@gmail.com' ||
    company?.email?.toLowerCase() === 'smokingpodsoficial00@gmail.com' ||
    company?.name?.toLowerCase().includes('smoking pods') ||
    isSuperAdmin;

  const canAccess = (tabOrRoute: string): boolean => {
    // Rota de marketing/disparos é 100% restrita à conta oficial da Smoking Pods
    if (tabOrRoute === 'marketing') {
      return isSmokingPodsOfficial;
    }

    if (isSuperAdmin) return true;
    const allowedTabs = ROLE_PERMISSIONS[role] || ['pedidos'];
    return allowedTabs.includes(tabOrRoute);
  };

  return {
    role,
    isSuperAdmin,
    isSmokingPodsOfficial,
    canAccess,
    allowedTabs: ROLE_PERMISSIONS[role] || ['pedidos'],
  };
}

