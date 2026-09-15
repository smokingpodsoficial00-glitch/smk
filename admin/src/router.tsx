import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { OnboardingPage } from './pages/OnboardingPage';

import { DashboardLayout } from './layouts/DashboardLayout';

// Lazy-loaded dashboard modules — cada um carrega sob demanda (~80% redução no bundle inicial)
const KanbanBoard = lazy(() => import('./components/KanbanBoard'));
const FinanceDashboard = lazy(() => import('./components/FinanceDashboard'));
const SupplyChainDashboard = lazy(() => import('./components/SupplyChainDashboard'));
const CRMDashboard = lazy(() => import('./components/CRMDashboard'));
const ChatbotPage = lazy(() => import('./components/ChatbotPage'));
const MarketingModule = lazy(() => import('./components/MarketingModule'));
const PartnersDashboard = lazy(() => import('./components/PartnersDashboard'));
const TasksDashboard = lazy(() => import('./components/TasksDashboard'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));

import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminCompanies } from './pages/admin/AdminCompanies';
import { AdminPlans } from './pages/admin/AdminPlans';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminLogs } from './pages/admin/AdminLogs';
import { AdminFinance } from './pages/admin/AdminFinance';

function LazyFallback() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#050505] text-white/60 gap-3">
      <div className="size-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold tracking-wide text-white/40 uppercase">Carregando módulo...</span>
    </div>
  );
}

function SuspenseWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LazyFallback />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  // Public Auth Routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/cadastro',
    element: <RegisterPage />,
  },
  {
    path: '/esqueci-senha',
    element: <ForgotPasswordPage />,
  },

  // Onboarding Wizard Route
  {
    path: '/onboarding',
    element: (
      <ProtectedRoute>
        <OnboardingPage />
      </ProtectedRoute>
    ),
  },

  // Tenant Main App Routes (Wrapped in ProtectedRoute and DashboardLayout)
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/pedidos" replace />,
      },
      {
        path: 'pedidos',
        element: <SuspenseWrap><KanbanBoard /></SuspenseWrap>,
      },
      {
        path: 'financeiro',
        element: <SuspenseWrap><FinanceDashboard /></SuspenseWrap>,
      },
      {
        path: 'estoque',
        element: <SuspenseWrap><SupplyChainDashboard /></SuspenseWrap>,
      },
      {
        path: 'clientes',
        element: <SuspenseWrap><CRMDashboard /></SuspenseWrap>,
      },
      {
        path: 'chatbot',
        element: <SuspenseWrap><ChatbotPage /></SuspenseWrap>,
      },
      {
        path: 'marketing',
        element: <SuspenseWrap><MarketingModule /></SuspenseWrap>,
      },
      {
        path: 'socios',
        element: <SuspenseWrap><PartnersDashboard /></SuspenseWrap>,
      },
      {
        path: 'tarefas',
        element: <SuspenseWrap><TasksDashboard /></SuspenseWrap>,
      },
      {
        path: 'configuracoes',
        element: <SuspenseWrap><SettingsPage /></SuspenseWrap>,
      },
    ],
  },

  // SaaS Super Admin Internal Panel Routes
  {
    path: '/admin',
    element: (
      <ProtectedRoute requireSuperAdmin>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/admin/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <AdminDashboard />,
      },
      {
        path: 'empresas',
        element: <AdminCompanies />,
      },
      {
        path: 'planos',
        element: <AdminPlans />,
      },
      {
        path: 'usuarios',
        element: <AdminUsers />,
      },
      {
        path: 'logs',
        element: <AdminLogs />,
      },
      {
        path: 'financeiro',
        element: <AdminFinance />,
      },
    ],
  },

  // Fallback Wildcard Route
  {
    path: '*',
    element: <Navigate to="/pedidos" replace />,
  },
]);
