import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building2, 
  CreditCard, 
  Users, 
  Activity, 
  DollarSign, 
  ShieldAlert, 
  LogOut, 
  ArrowLeft,
  LayoutDashboard,
  Shield
} from 'lucide-react';

export function AdminLayout() {
  const { signOut, companyUser } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] text-white flex font-sans">
      {/* Super Admin Sidebar (Purple Theme for Visual Differentiation) */}
      <aside className="w-64 bg-[#09070f] border-r border-purple-500/20 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 pb-5 border-b border-purple-500/20">
            <div className="size-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <Shield className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Painel SaaS Admin</h2>
              <p className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">Super Administrator</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <LayoutDashboard className="size-4" />
              <span>Dashboard Global</span>
            </NavLink>

            <NavLink
              to="/admin/empresas"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Building2 className="size-4" />
              <span>Empresas</span>
            </NavLink>

            <NavLink
              to="/admin/planos"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <CreditCard className="size-4" />
              <span>Planos & Assinaturas</span>
            </NavLink>

            <NavLink
              to="/admin/usuarios"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Users className="size-4" />
              <span>Usuários</span>
            </NavLink>

            <NavLink
              to="/admin/logs"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Activity className="size-4" />
              <span>Logs do Sistema</span>
            </NavLink>

            <NavLink
              to="/admin/financeiro"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <DollarSign className="size-4" />
              <span>Financeiro SaaS</span>
            </NavLink>
          </nav>
        </div>

        {/* Footer actions */}
        <div className="space-y-2 pt-4 border-t border-purple-500/20">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-white/70 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            <span>Voltar ao App Tenant</span>
          </button>

          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <LogOut className="size-4" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
