import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, PackageSearch, Users, Settings, CircleDollarSign, 
  Store, ChevronRight, LogOut, Megaphone, Scale, CheckSquare, Compass, Crown, Sun, Moon, Menu, X, Smartphone, Bell,
  Plus, MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { useStoreConfig } from '../lib/useStoreConfig';
import { SystemTourGuide } from '../components/tour/SystemTourGuide';
import { FloatingSupportButton } from '../components/FloatingSupportButton';
import { MobilePushSetupModal } from '../components/MobilePushSetupModal';
import { ManualSaleModal } from '../components/ManualSaleModal';

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [isManualSaleModalOpen, setIsManualSaleModalOpen] = useState(false);
  const [mobilePushModalOpen, setMobilePushModalOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { config } = useStoreConfig();
  const { company, companyUser, signOut } = useAuth();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  // Fecha o bottom sheet mobile automaticamente ao trocar de rota
  useEffect(() => {
    setIsMoreSheetOpen(false);
  }, [location.pathname]);

  // Listener para abertura de venda manual vinda de qualquer módulo
  useEffect(() => {
    const handleOpenManualSale = () => setIsManualSaleModalOpen(true);
    window.addEventListener('open-manual-sale', handleOpenManualSale);
    return () => window.removeEventListener('open-manual-sale', handleOpenManualSale);
  }, []);

  const isOfficial = !company?.id || company?.id === 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
  const displayName = isOfficial 
    ? 'Smoking Pods' 
    : (company?.name || config?.store_name || 'Minha Loja');

  const getCurrentPageTitle = () => {
    const p = location.pathname;
    if (p.includes('/pedidos')) return 'Pedidos';
    if (p.includes('/financeiro')) return 'Financeiro';
    if (p.includes('/estoque')) return 'Estoque';
    if (p.includes('/clientes')) return 'CRM & Últimas Vendas';
    if (p.includes('/marketing')) return 'Marketing';
    if (p.includes('/socios')) return 'Sócios & Equity';
    if (p.includes('/tarefas')) return 'Tarefas (QG)';
    if (p.includes('/gestao-saas')) return 'Vendas do SaaS';
    if (p.includes('/configuracoes')) return 'Configurações';
    return displayName;
  };

  const renderSidebarNavigation = () => {
    const collapsed = sidebarCollapsed;

    return (
      <>
        {/* Navegação Principal Desktop */}
        <nav className={`flex-1 py-3 flex flex-col gap-1 w-full overflow-y-auto custom-scrollbar ${collapsed ? 'items-center px-1' : ''}`}>
          
          {/* Pedidos */}
          {canAccess('pedidos') && (
            <NavLink 
              to="/pedidos"
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

          {/* Financeiro */}
          {canAccess('financeiro') && (
            <NavLink 
              to="/financeiro"
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

          {/* Estoque */}
          {canAccess('estoque') && (
            <NavLink 
              to="/estoque"
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

          {/* CRM */}
          {canAccess('clientes') && (
            <NavLink 
              to="/clientes"
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

          {/* Marketing */}
          {canAccess('marketing') && (
            <NavLink 
              to="/marketing"
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

          {/* Sócios & Equity */}
          {canAccess('socios') && (
            <NavLink 
              to="/socios"
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

          {/* Tarefas */}
          {canAccess('tarefas') && (
            <NavLink 
              to="/tarefas"
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

          {/* Vendas do SaaS */}
          {canAccess('gestao-saas') && (
            <NavLink 
              to="/gestao-saas"
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

        {/* Rodapé Desktop: Conectar no Celular, Modo Claro, Tour, Configurações & Sair */}
        <div className={`p-3 border-t border-white/5 w-full flex flex-col gap-1.5 ${collapsed ? 'items-center' : ''}`}>
          
          {/* Botão Conectar Sistema no Celular */}
          <button
            type="button"
            data-tour="sidebar-conectar-celular"
            onClick={() => setMobilePushModalOpen(true)}
            title={collapsed ? "Conectar Sistema no Celular" : undefined}
            className={`flex items-center gap-2.5 py-2 transition-all cursor-pointer w-full text-xs font-extrabold rounded-xl text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400/50 shadow-sm ${
              collapsed ? 'justify-center px-3' : 'px-3'
            }`}
          >
            <Smartphone className="size-4 shrink-0 text-emerald-400" />
            {!collapsed && <span className="truncate">Conectar no Celular</span>}
          </button>

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
            onClick={() => signOut()}
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
    <div className="flex flex-col md:flex-row h-[100dvh] w-full max-w-[100vw] bg-[#050505] text-white overflow-hidden font-sans">
      {/* ━━━ TOP BAR MOBILE COMPACTA (~48px) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="md:hidden h-12 px-3.5 flex items-center justify-between border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md shrink-0 z-30 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
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
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-xs font-extrabold text-white truncate max-w-[130px] sm:max-w-[200px]">
              {displayName}
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate max-w-[100px]">{getCurrentPageTitle()}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Botão rápido de Alertas / Notificações no Topo */}
          <button
            type="button"
            onClick={() => setMobilePushModalOpen(true)}
            className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
            title="Configurar Notificações"
          >
            <Bell className="size-3 text-emerald-400" />
            <span>Alertas</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/80 active:scale-95 transition-all cursor-pointer"
            title="Alternar Tema"
          >
            {theme === 'dark' ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5 text-sky-400" />}
          </button>
        </div>
      </header>

      {/* ━━━ BOTTOM SHEET "MAIS" (Módulos Secundários e Ajustes) ━━━━━━━━━ */}
      {isMoreSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end select-none">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setIsMoreSheetOpen(false)}
          />
          <div className="relative w-full bg-[#111113] border-t border-white/15 rounded-t-3xl shadow-2xl z-10 max-h-[85vh] flex flex-col pb-[calc(1rem+env(safe-area-inset-bottom,0px))] animate-in slide-in-from-bottom duration-200">
            {/* Barra de arraste */}
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header do Sheet */}
            <div className="h-12 flex items-center justify-between border-b border-white/10 px-5 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
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
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-xs font-bold text-white truncate">{displayName}</span>
                  <span className="text-[9px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-mono uppercase font-semibold">
                    {companyUser?.role || 'ADMIN'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreSheetOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Itens Agrupados */}
            <div className="overflow-y-auto custom-scrollbar px-4 py-3 space-y-4 flex-1">
              {/* Grupo 1: Gestão & Finanças */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-2">
                  Gestão & Finanças
                </span>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {canAccess('financeiro') && (
                    <NavLink
                      to="/financeiro"
                      onClick={() => setIsMoreSheetOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                          isActive 
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-bold' 
                            : 'bg-white/5 border-white/5 text-white/80 hover:bg-white/10'
                        }`
                      }
                    >
                      <CircleDollarSign className="size-4 shrink-0 text-emerald-400" />
                      <span className="text-xs font-semibold truncate">Financeiro</span>
                    </NavLink>
                  )}
                  {canAccess('socios') && (
                    <NavLink
                      to="/socios"
                      onClick={() => setIsMoreSheetOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                          isActive 
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-bold' 
                            : 'bg-white/5 border-white/5 text-white/80 hover:bg-white/10'
                        }`
                      }
                    >
                      <Scale className="size-4 shrink-0 text-white/70" />
                      <span className="text-xs font-semibold truncate">Sócios & Equity</span>
                    </NavLink>
                  )}
                </div>
              </div>

              {/* Grupo 2: Operações & Marketing */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-2">
                  Operações & Marketing
                </span>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {canAccess('marketing') && (
                    <NavLink
                      to="/marketing"
                      onClick={() => setIsMoreSheetOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                          isActive 
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-bold' 
                            : 'bg-white/5 border-white/5 text-white/80 hover:bg-white/10'
                        }`
                      }
                    >
                      <Megaphone className="size-4 shrink-0 text-white/70" />
                      <span className="text-xs font-semibold truncate">Marketing</span>
                    </NavLink>
                  )}
                  {canAccess('tarefas') && (
                    <NavLink
                      to="/tarefas"
                      onClick={() => setIsMoreSheetOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                          isActive 
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-bold' 
                            : 'bg-white/5 border-white/5 text-white/80 hover:bg-white/10'
                        }`
                      }
                    >
                      <CheckSquare className="size-4 shrink-0 text-white/70" />
                      <span className="text-xs font-semibold truncate">Tarefas (QG)</span>
                    </NavLink>
                  )}
                  {canAccess('gestao-saas') && (
                    <NavLink
                      to="/gestao-saas"
                      onClick={() => setIsMoreSheetOpen(false)}
                      className={({ isActive }) =>
                        `col-span-2 flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          isActive 
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 font-bold' 
                            : 'bg-amber-500/5 border-amber-500/20 text-amber-400 hover:bg-amber-500/10'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <Crown className="size-4 shrink-0 text-amber-400" />
                        <span className="text-xs font-semibold">Vendas do SaaS</span>
                      </div>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                        MASTER
                      </span>
                    </NavLink>
                  )}
                </div>
              </div>

              {/* Grupo 3: Sistema & Configurações */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-2">
                  Sistema & Ajustes
                </span>
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreSheetOpen(false);
                      setMobilePushModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 transition-all cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="size-4 shrink-0 text-emerald-400" />
                      <span className="text-xs font-bold">Conectar Sistema no Celular</span>
                    </div>
                    <span className="text-[9px] bg-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                      PUSH
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition-all cursor-pointer text-left"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="size-4 shrink-0 text-amber-400" />
                          <span className="text-xs font-semibold">Modo Claro</span>
                        </>
                      ) : (
                        <>
                          <Moon className="size-4 shrink-0 text-sky-400" />
                          <span className="text-xs font-semibold">Modo Escuro</span>
                        </>
                      )}
                    </button>

                    {canAccess('configuracoes') && (
                      <NavLink
                        to="/configuracoes"
                        onClick={() => setIsMoreSheetOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                            isActive 
                              ? 'bg-white/15 border-white/30 text-white font-bold' 
                              : 'bg-white/5 border-white/5 text-white/80 hover:bg-white/10'
                          }`
                        }
                      >
                        <Settings className="size-4 shrink-0 text-white/70" />
                        <span className="text-xs font-semibold truncate">Configurações</span>
                      </NavLink>
                    )}
                  </div>
                </div>
              </div>

              {/* Sair da conta */}
              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={() => {
                    setIsMoreSheetOpen(false);
                    signOut();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer"
                >
                  <LogOut className="size-4" />
                  <span>Sair da conta</span>
                </button>
              </div>
            </div>
          </div>
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
        {renderSidebarNavigation()}
      </aside>

      {/* ━━━ CONTEÚDO PRINCIPAL (100% da Largura no Mobile) ━━━━━━━━━━━━━━━━ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        <Outlet />
      </main>

      {/* ━━━ BARRA DE NAVEGAÇÃO INFERIOR ESTILO APP (Pedidos, Estoque, + Venda, CRM, Mais) ━━━━━━━ */}
      <nav className="md:hidden h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] px-2 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-around shrink-0 z-40 select-none">
        {/* 1. Pedidos */}
        {canAccess('pedidos') && (
          <NavLink
            to="/pedidos"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-emerald-400 font-extrabold' : 'text-white/50 hover:text-white font-medium'
              }`
            }
          >
            <LayoutDashboard className="size-5" />
            <span className="text-[10px] tracking-tight">Pedidos</span>
          </NavLink>
        )}

        {/* 2. Estoque */}
        {canAccess('estoque') && (
          <NavLink
            to="/estoque"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-emerald-400 font-extrabold' : 'text-white/50 hover:text-white font-medium'
              }`
            }
          >
            <PackageSearch className="size-5" />
            <span className="text-[10px] tracking-tight">Estoque</span>
          </NavLink>
        )}

        {/* 3. + Venda (Ação central destacada e ergonômica) */}
        <button
          type="button"
          onClick={() => setIsManualSaleModalOpen(true)}
          className="flex flex-col items-center justify-center -mt-3.5 group active:scale-95 transition-transform cursor-pointer"
          aria-label="Registrar Nova Venda"
        >
          <div className="size-11 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-[0_0_16px_rgba(16,185,129,0.35)] border border-emerald-400/40 transition-all">
            <Plus className="size-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-extrabold text-emerald-400 mt-0.5">Venda</span>
        </button>

        {/* 4. CRM */}
        {canAccess('clientes') && (
          <NavLink
            to="/clientes"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-emerald-400 font-extrabold' : 'text-white/50 hover:text-white font-medium'
              }`
            }
          >
            <Users className="size-5" />
            <span className="text-[10px] tracking-tight">CRM</span>
          </NavLink>
        )}

        {/* 5. Mais */}
        <button
          type="button"
          onClick={() => setIsMoreSheetOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            isMoreSheetOpen ? 'text-emerald-400 font-extrabold' : 'text-white/50 hover:text-white font-medium'
          }`}
        >
          <MoreHorizontal className="size-5" />
          <span className="text-[10px] tracking-tight">Mais</span>
        </button>
      </nav>

      {/* Modal Global de Conexão e Notificações no Celular */}
      <MobilePushSetupModal
        isOpen={mobilePushModalOpen}
        onClose={() => setMobilePushModalOpen(false)}
        companyId={company?.id || 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5'}
        storeName={displayName}
      />

      {/* Modal Global de Venda Manual Integrado */}
      <ManualSaleModal
        isOpen={isManualSaleModalOpen}
        onClose={() => setIsManualSaleModalOpen(false)}
        onSaleSuccess={() => {
          setIsManualSaleModalOpen(false);
          window.dispatchEvent(new CustomEvent('sale-created'));
        }}
        companyId={company?.id}
      />

      {/* Botão Flutuante Global de Suporte no WhatsApp (Oculto no Mobile para não cobrir botões) */}
      <div className="hidden md:block">
        <FloatingSupportButton />
      </div>

      {/* Assistente do Tour Guiado */}
      <SystemTourGuide />
    </div>
  );
}
