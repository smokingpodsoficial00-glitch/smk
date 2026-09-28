import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, PackageSearch, Users, Settings, CircleDollarSign, 
  Store, ChevronRight, Bot, LogOut, Shield, User as UserIcon, Megaphone, Scale, CheckSquare, Compass, Crown, Sun, Moon, Menu, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { useStoreConfig } from '../lib/useStoreConfig';
import { SystemTourGuide } from '../components/tour/SystemTourGuide';
import { FloatingSupportButton } from '../components/FloatingSupportButton';

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { config } = useStoreConfig();
  const { company, companyUser, signOut, isSuperAdmin } = useAuth();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  // Fecha a gaveta mobile automaticamente ao trocar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isOfficial = !company?.id || company?.id === 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
  const displayName = isOfficial 
    ? 'Smoking Pods' 
    : (company?.name || config?.store_name || 'Minha Loja');

  const getCurrentPageTitle = () => {
    const p = location.pathname;
    if (p.includes('/pedidos')) return 'Pedidos';
    if (p.includes('/financeiro')) return 'Financeiro';
    if (p.includes('/estoque')) return 'Estoque';
    if (p.includes('/clientes')) return 'CRM & Clientes';
    if (p.includes('/marketing')) return 'Marketing';
    if (p.includes('/socios')) return 'Sócios & Equity';
    if (p.includes('/tarefas')) return 'Tarefas (QG)';
    if (p.includes('/gestao-saas')) return 'Vendas do SaaS';
    if (p.includes('/configuracoes')) return 'Configurações';
    return displayName;
  };

  const renderSidebarNavigation = (isMobileDrawer = false) => {
    const collapsed = isMobileDrawer ? false : sidebarCollapsed;

    return (
      <>
        {/* Navegação Principal */}
        <nav className={`flex-1 py-3 flex flex-col gap-1 w-full overflow-y-auto custom-scrollbar ${collapsed ? 'items-center px-1' : ''}`}>
          
          {canAccess('pedidos') && (
            <NavLink 
              to="/pedidos"
              onClick={() => isMobileDrawer && setMobileMenuOpen(false)}
              title={collapsed ? "Pedidos" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  collapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <LayoutDashboard className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">Pedidos</span>}
            </NavLink>
          )}

          {canAccess('financeiro') && (
            <NavLink 
              to="/financeiro"
              onClick={() => isMobileDrawer && setMobileMenuOpen(false)}
              title={collapsed ? "Financeiro" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  collapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <CircleDollarSign className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">Financeiro</span>}
            </NavLink>
          )}

          {canAccess('estoque') && (
            <NavLink 
              to="/estoque"
              onClick={() => isMobileDrawer && setMobileMenuOpen(false)}
              title={collapsed ? "Estoque" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  collapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <PackageSearch className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">Estoque</span>}
            </NavLink>
          )}

          {canAccess('clientes') && (
            <NavLink 
              to="/clientes"
              onClick={() => isMobileDrawer && setMobileMenuOpen(false)}
              title={collapsed ? "CRM" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  collapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <Users className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">CRM</span>}
            </NavLink>
          )}

          <div className="h-px bg-white/5 my-2 w-[85%] mx-auto" />

          {/* Aba Exclusiva de Marketing (Smoking Pods) */}
          {canAccess('marketing') && (
            <NavLink 
              to="/marketing"
              onClick={() => isMobileDrawer && setMobileMenuOpen(false)}
              title={collapsed ? "Marketing & Disparos" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  collapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <Megaphone className="size-4 shrink-0 text-white/80" />
              {!collapsed && (
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
              onClick={() => isMobileDrawer && setMobileMenuOpen(false)}
              title={collapsed ? "Sócios & Equity" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  collapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <Scale className="size-4 shrink-0 text-white/80" />
              {!collapsed && (
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
              onClick={() => isMobileDrawer && setMobileMenuOpen(false)}
              title={collapsed ? "Tarefas dos Sócios" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  collapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white font-extrabold border-l-2 border-white pl-3.5 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
                }`
              }
            >
              <CheckSquare className="size-4 shrink-0 text-white/80" />
              {!collapsed && (
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
              onClick={() => isMobileDrawer && setMobileMenuOpen(false)}
              title={collapsed ? "Vendas do SaaS" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
                  collapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
                } ${
                  isActive 
                    ? 'bg-amber-500/15 text-amber-300 font-extrabold border-l-2 border-amber-400 pl-3.5 shadow-[0_0_15px_rgba(245,158,11,0.25)]' 
                    : 'text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300 border-l-2 border-transparent pl-4'
                }`
              }
            >
              <Crown className="size-4 shrink-0 text-amber-400" />
              {!collapsed && (
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

        {/* Toggle Collapse Button (Somente Desktop) */}
        {!isMobileDrawer && (
          <div className="px-3 py-2 w-full flex flex-col items-center">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center justify-center cursor-pointer border border-white/10 shadow-sm active:scale-95 ${
                collapsed ? '' : 'gap-2 text-[11px] font-bold uppercase tracking-wider'
              }`}
              title={collapsed ? "Expandir Menu" : "Recolher Menu"}
            >
              {collapsed ? (
                <ChevronRight className="size-4 text-white/70" />
              ) : (
                <>
                  <ChevronRight className="size-4 rotate-180 text-white/70" />
                  <span>Recolher</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Rodapé / Configurações, Tour & Logout */}
        <div className={`p-3 border-t border-white/5 w-full flex flex-col gap-1 ${collapsed ? 'items-center' : ''}`}>
          
          {/* Botão Alternador Modo Claro / Modo Escuro */}
          <button
            type="button"
            onClick={toggleTheme}
            title={collapsed ? (theme === 'dark' ? "Ativar Modo Claro" : "Ativar Modo Escuro") : undefined}
            className={`flex items-center gap-3 py-2 transition-all cursor-pointer w-full text-xs font-semibold rounded-xl text-white/70 hover:text-white hover:bg-white/5 border border-white/5 ${
              collapsed ? 'justify-center px-3' : 'px-3'
            }`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="size-4 shrink-0 text-amber-400" />
                {!collapsed && <span className="truncate">Modo Claro</span>}
              </>
            ) : (
              <>
                <Moon className="size-4 shrink-0 text-sky-400" />
                {!collapsed && <span className="truncate">Modo Escuro</span>}
              </>
            )}
          </button>

          {/* Botão de Tour do Sistema */}
          <button
            type="button"
            onClick={() => {
              if (isMobileDrawer) setMobileMenuOpen(false);
              window.dispatchEvent(new CustomEvent('open-system-tour'));
            }}
            title={collapsed ? "Tour do Sistema" : undefined}
            className={`flex items-center gap-3 py-2 transition-all cursor-pointer w-full text-xs font-semibold rounded-xl text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 ${
              collapsed ? 'justify-center px-3' : 'px-3'
            }`}
          >
            <Compass className="size-4 shrink-0 text-amber-400 animate-spin-slow" />
            {!collapsed && <span className="truncate">Tour do Sistema</span>}
          </button>

          {canAccess('configuracoes') && (
            <NavLink 
              to="/configuracoes"
              onClick={() => isMobileDrawer && setMobileMenuOpen(false)}
              title={collapsed ? "Configurações" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2 transition-all cursor-pointer w-full text-xs font-semibold rounded-xl ${
                  collapsed ? 'justify-center px-3' : 'px-3'
                } ${
                  isActive
                    ? 'bg-white/10 text-white font-extrabold shadow-[0_0_10px_rgba(255,255,255,0.15)]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Settings className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">Configurações</span>}
            </NavLink>
          )}

          <button
            onClick={() => {
              if (isMobileDrawer) setMobileMenuOpen(false);
              signOut();
            }}
            title={collapsed ? "Sair da conta" : undefined}
            className={`flex items-center gap-3 py-2 transition-all cursor-pointer w-full text-xs font-semibold rounded-xl text-red-400 hover:bg-red-500/10 ${
              collapsed ? 'justify-center px-3' : 'px-3'
            }`}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">Sair</span>}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-[#050505] text-white overflow-hidden font-sans">
      {/* ━━━ TOP BAR MOBILE (Visível apenas em telas < 768px) ━━━━━━━━━━━━━━ */}
      <header className="md:hidden h-14 px-4 flex items-center justify-between border-b border-white/10 bg-[#0a0a0a] shrink-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white active:scale-95 transition-all cursor-pointer"
            aria-label="Abrir Menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            {company?.logo_url || config?.logo_url ? (
              <img 
                src={(company?.logo_url || config?.logo_url) ?? undefined} 
                alt={displayName} 
                className="w-6 h-6 rounded-md object-contain shrink-0" 
              />
            ) : (
              <div className="w-6 h-6 rounded-md bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <Store className="size-3.5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-white truncate leading-tight">
                {getCurrentPageTitle()}
              </div>
              <div className="text-[9px] text-white/45 font-mono truncate leading-tight">
                {displayName}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/80 active:scale-95 transition-all"
            title="Alternar Tema"
          >
            {theme === 'dark' ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-sky-400" />}
          </button>
        </div>
      </header>

      {/* ━━━ DRAWER MENU MOBILE (Gaveta Deslizante no Celular) ━━━━━━━━━━━━━ */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] h-full bg-[#0a0a0a] border-r border-white/15 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200 select-none">
            <div className="h-14 flex items-center justify-between border-b border-white/10 px-4 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                  <Store className="size-4 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-white truncate">{displayName}</span>
                  <span className="text-[9px] text-white/50 font-mono uppercase font-semibold">
                    {companyUser?.role || 'ADMIN'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            {renderSidebarNavigation(true)}
          </aside>
        </div>
      )}

      {/* ━━━ SIDEBAR DESKTOP (Visível apenas em telas >= 768px) ━━━━━━━━━━━━ */}
      <aside 
        onClick={() => {
          if (sidebarCollapsed) setSidebarCollapsed(false);
        }}
        className={`hidden md:flex border-r border-white/10 bg-[#0a0a0a] flex-col shrink-0 transition-all duration-300 relative select-none ${
          sidebarCollapsed
            ? 'w-16 items-center cursor-pointer hover:border-white/30'
            : 'w-52 lg:w-64'
        }`}
        title={sidebarCollapsed ? "Clique em qualquer lugar para expandir o menu" : undefined}
      >
        {/* Header da Sidebar Desktop */}
        <div className="h-16 flex items-center border-b border-white/5 w-full px-4 justify-between shrink-0">
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
        {renderSidebarNavigation(false)}
      </aside>

      {/* ━━━ CONTEÚDO PRINCIPAL (100% da Largura no Mobile) ━━━━━━━━━━━━━━━━ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        <Outlet />
      </main>

      {/* ━━━ BARRA DE NAVEGAÇÃO INFERIOR ESTILO APP (Somente Mobile) ━━━━━━━ */}
      <nav className="md:hidden h-16 px-1 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-around shrink-0 z-30 select-none">
        {canAccess('pedidos') && (
          <NavLink
            to="/pedidos"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/50 hover:text-white'
              }`
            }
          >
            <LayoutDashboard className="size-4" />
            <span>Pedidos</span>
          </NavLink>
        )}

        {canAccess('financeiro') && (
          <NavLink
            to="/financeiro"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/50 hover:text-white'
              }`
            }
          >
            <CircleDollarSign className="size-4" />
            <span>Financeiro</span>
          </NavLink>
        )}

        {canAccess('estoque') && (
          <NavLink
            to="/estoque"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/50 hover:text-white'
              }`
            }
          >
            <PackageSearch className="size-4" />
            <span>Estoque</span>
          </NavLink>
        )}

        {canAccess('socios') && (
          <NavLink
            to="/socios"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/50 hover:text-white'
              }`
            }
          >
            <Scale className="size-4" />
            <span>Sócios</span>
          </NavLink>
        )}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl text-[10px] font-bold text-white/60 hover:text-white transition-all cursor-pointer"
        >
          <Menu className="size-4" />
          <span>Mais</span>
        </button>
      </nav>

      {/* Botão Flutuante Global de Suporte no WhatsApp (Oculto no Mobile para não cobrir botões) */}
      <div className="hidden md:block">
        <FloatingSupportButton />
      </div>

      {/* Assistente do Tour Guiado */}
      <SystemTourGuide />
    </div>
  );
}
