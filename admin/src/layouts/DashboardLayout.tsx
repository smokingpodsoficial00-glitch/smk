import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, PackageSearch, Users, Settings, CircleDollarSign, 
  Store, ChevronRight, Bot, LogOut, Shield, User as UserIcon, Megaphone, Scale, CheckSquare, Compass, Crown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useStoreConfig } from '../lib/useStoreConfig';
import { SystemTourGuide } from '../components/tour/SystemTourGuide';
import { FloatingSupportButton } from '../components/FloatingSupportButton';

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { config } = useStoreConfig();
  const { company, companyUser, signOut, isSuperAdmin } = useAuth();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const isOfficial = !company?.id || company?.id === 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
  const displayName = isOfficial 
    ? 'Smoking Pods' 
    : (company?.name || config?.store_name || 'Minha Loja');

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <aside 
        onClick={() => {
          if (sidebarCollapsed) setSidebarCollapsed(false);
        }}
        className={`border-r border-white/10 bg-[#0a0a0a] flex flex-col shrink-0 transition-all duration-300 relative select-none ${
          sidebarCollapsed
            ? 'w-16 items-center cursor-pointer hover:border-white/30'
            : 'w-52 lg:w-64'
        }`}
        title={sidebarCollapsed ? "Clique em qualquer lugar para expandir o menu" : undefined}
      >
        {/* Header da Sidebar */}
        <div className="h-16 flex items-center border-b border-white/5 w-full px-4 justify-between">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              {company?.logo_url || config?.logo_url ? (
                <img 
                  src={(company?.logo_url || config?.logo_url) ?? undefined} 
                  alt={displayName} 
                  className="w-7 h-7 rounded-lg object-contain shrink-0" 
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                  <Store className="size-4 text-white" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <h1 className="text-sm font-bold tracking-tight text-white truncate">
                  {displayName}
                </h1>
                <span className="text-[9px] text-white/50 font-mono uppercase font-semibold">
                  {companyUser?.role || 'SaaS Tenant'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              {company?.logo_url || config?.logo_url ? (
                <img 
                  src={(company?.logo_url || config?.logo_url) ?? undefined} 
                  alt={displayName} 
                  className="w-6 h-6 rounded-md object-contain shrink-0" 
                />
              ) : (
                <Store className="size-4 text-white/80 shrink-0" />
              )}
            </div>
          )}
        </div>
        
        {/* Navegação Principal */}
        <nav className={`flex-1 py-4 flex flex-col gap-1.5 w-full ${sidebarCollapsed ? 'items-center px-1' : ''}`}>
          
          {canAccess('pedidos') && (
            <NavLink 
              to="/pedidos"
              title={sidebarCollapsed ? "Pedidos" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <LayoutDashboard className="size-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Pedidos</span>}
            </NavLink>
          )}

          {canAccess('financeiro') && (
            <NavLink 
              to="/financeiro"
              title={sidebarCollapsed ? "Financeiro" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <CircleDollarSign className="size-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Financeiro</span>}
            </NavLink>
          )}

          {canAccess('estoque') && (
            <NavLink 
              to="/estoque"
              title={sidebarCollapsed ? "Reposição" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <PackageSearch className="size-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Reposição</span>}
            </NavLink>
          )}

          {canAccess('clientes') && (
            <NavLink 
              to="/clientes"
              title={sidebarCollapsed ? "Clientes" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <Users className="size-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Clientes</span>}
            </NavLink>
          )}

          <div className="h-px bg-white/5 my-2 w-[85%] mx-auto" />

          {/* Aba Exclusiva de Marketing (Smoking Pods) */}
          {canAccess('marketing') && (
            <NavLink 
              to="/marketing"
              title={sidebarCollapsed ? "Marketing & Disparos" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <Megaphone className="size-4 shrink-0 text-white/80" />
              {!sidebarCollapsed && (
                <span className="truncate flex items-center gap-2">
                  Marketing
                  <span className="text-[9px] bg-white/10 text-white border border-white/20 px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                    VIP
                  </span>
                </span>
              )}
            </NavLink>
          )}

          {/* Aba de Sócios & Gestão de Equity */}
          {canAccess('socios') && (
            <NavLink 
              to="/socios"
              title={sidebarCollapsed ? "Sócios & Equity" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <Scale className="size-4 shrink-0 text-white/80" />
              {!sidebarCollapsed && (
                <span className="truncate flex items-center gap-2">
                  Sócios
                  <span className="text-[9px] bg-white/10 text-white border border-white/20 px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                    EQUITY
                  </span>
                </span>
              )}
            </NavLink>
          )}

          {/* Aba de Tarefas & Produtividade dos Sócios */}
          {canAccess('tarefas') && (
            <NavLink 
              to="/tarefas"
              title={sidebarCollapsed ? "Tarefas dos Sócios" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <CheckSquare className="size-4 shrink-0 text-white/80" />
              {!sidebarCollapsed && (
                <span className="truncate flex items-center gap-2">
                  Tarefas
                  <span className="text-[9px] bg-white/10 text-white border border-white/20 px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                    QG
                  </span>
                </span>
              )}
            </NavLink>
          )}

          {/* Aba Exclusiva de Gestão & Vendas do SaaS (Smoking Pods Master) */}
          {canAccess('gestao-saas') && (
            <NavLink 
              to="/gestao-saas"
              title={sidebarCollapsed ? "Vendas do SaaS" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-amber-500/15 text-amber-300 font-extrabold border-l-2 border-amber-400 pl-3.5 shadow-[0_0_15px_rgba(245,158,11,0.25)]' 
                    : 'text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300 border-l-2 border-transparent pl-4'
                }`
              }
            >
              <Crown className="size-4 shrink-0 text-amber-400" />
              {!sidebarCollapsed && (
                <span className="truncate flex items-center gap-2">
                  Vendas do SaaS
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-black shadow-sm tracking-wide">
                    MASTER
                  </span>
                </span>
              )}
            </NavLink>
          )}
        </nav>

        {/* Toggle Collapse Button */}
        <div className="px-3 py-2 w-full flex flex-col items-center">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center justify-center cursor-pointer border border-white/10 shadow-sm active:scale-95 ${
              sidebarCollapsed ? '' : 'gap-2 text-[11px] font-bold uppercase tracking-wider'
            }`}
            title={sidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="size-4 text-white/70" />
            ) : (
              <>
                <ChevronRight className="size-4 rotate-180 text-white/70" />
                <span>Recolher</span>
              </>
            )}
          </button>
        </div>

        {/* Rodapé / Configurações, Tour & Logout */}
        <div className={`p-3 border-t border-white/5 w-full flex flex-col gap-1 ${sidebarCollapsed ? 'items-center' : ''}`}>
          
          {/* Botão de Tour do Sistema */}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-system-tour'));
            }}
            title={sidebarCollapsed ? "Tour do Sistema" : undefined}
            className={`flex items-center gap-3 py-2 transition-all cursor-pointer w-full text-xs font-semibold rounded-xl text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 ${
              sidebarCollapsed ? 'justify-center px-3' : 'px-3'
            }`}
          >
            <Compass className="size-4 shrink-0 text-amber-400 animate-spin-slow" />
            {!sidebarCollapsed && <span className="truncate">Tour do Sistema</span>}
          </button>

          {canAccess('configuracoes') && (
            <NavLink 
              to="/configuracoes"
              title={sidebarCollapsed ? "Configurações" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2 transition-all cursor-pointer w-full text-xs font-semibold rounded-xl ${
                  sidebarCollapsed ? 'justify-center px-3' : 'px-3'
                } ${
                  isActive
                    ? 'bg-white/10 text-white font-extrabold shadow-[0_0_10px_rgba(255,255,255,0.15)]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Settings className="size-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Configurações</span>}
            </NavLink>
          )}

          <button
            onClick={signOut}
            title={sidebarCollapsed ? "Sair da conta" : undefined}
            className={`flex items-center gap-3 py-2 transition-all cursor-pointer w-full text-xs font-semibold rounded-xl text-red-400 hover:bg-red-500/10 ${
              sidebarCollapsed ? 'justify-center px-3' : 'px-3'
            }`}
          >
            <LogOut className="size-4 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Render */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>

      {/* Botão Flutuante Global de Suporte no WhatsApp */}
      <FloatingSupportButton />

      {/* Assistente do Tour Guiado */}
      <SystemTourGuide />
    </div>
  );
}
