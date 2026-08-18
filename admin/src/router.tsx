import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { OnboardingPage } from './pages/OnboardingPage';

import { DashboardLayout } from './layouts/DashboardLayout';
import { KanbanBoard } from './components/KanbanBoard';
import { FinanceDashboard } from './components/FinanceDashboard';
import { SupplyChainDashboard } from './components/SupplyChainDashboard';
import { CRMDashboard } from './components/CRMDashboard';
import { ChatbotPage } from './components/ChatbotPage';
import { MarketingModule } from './components/MarketingModule';
import { PartnersDashboard } from './components/PartnersDashboard';
import { SettingsPage } from './components/SettingsPage';

import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminCompanies } from './pages/admin/AdminCompanies';
import { AdminPlans } from './pages/admin/AdminPlans';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminLogs } from './pages/admin/AdminLogs';
import { AdminFinance } from './pages/admin/AdminFinance';

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
        element: <KanbanBoard />,
      },
      {
        path: 'financeiro',
        element: <FinanceDashboard />,
      },
      {
        path: 'estoque',
        element: <SupplyChainDashboard />,
      },
      {
        path: 'clientes',
        element: <CRMDashboard />,
      },
      {
        path: 'chatbot',
        element: <ChatbotPage />,
      },
      {
        path: 'marketing',
        element: <MarketingModule />,
      },
      {
        path: 'socios',
        element: <PartnersDashboard />,
      },
      {
        path: 'configuracoes',
        element: <SettingsPage />,
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
