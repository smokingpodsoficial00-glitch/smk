import { useState, lazy, Suspense } from "react";
import {
  LayoutDashboard, PackageSearch, Users, Settings, CircleDollarSign,
  MoreHorizontal, Store, ChevronRight, PanelLeftOpen, Bot, Megaphone, Scale, Loader2
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";

// Lazy loading sob demanda de cada dashboard para acelerar o carregamento inicial
const KanbanBoard = lazy(() => import("@/components/KanbanBoard"));
const FinanceDashboard = lazy(() => import("@/components/FinanceDashboard"));
const SupplyChainDashboard = lazy(() => import("@/components/SupplyChainDashboard"));
const CRMDashboard = lazy(() => import("@/components/CRMDashboard"));
const SettingsPage = lazy(() => import("@/components/SettingsPage"));
const ChatbotPage = lazy(() => import("@/components/ChatbotPage"));
const MarketingModule = lazy(() => import("@/components/MarketingModule"));
const PartnersDashboard = lazy(() => import("@/components/PartnersDashboard"));

function TabLoadingFallback() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#050505] text-white/60 gap-3">
      <Loader2 className="size-8 text-emerald-400 animate-spin" />
      <span className="text-xs font-semibold tracking-wide text-white/40 uppercase">Carregando módulo...</span>
    </div>
  );
}


export default function App() {
  const [activeTab, setActiveTab] = useState("pedidos");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { config } = useStoreConfig();

  const displayName = config?.store_name || "Smoking Pods";

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">
      {/* Sidebar */}
      <aside 
        onClick={() => {
          if (sidebarCollapsed) {
            setSidebarCollapsed(false);
          }
        }}
        className={`border-r border-white/10 bg-[#0a0a0a] flex flex-col shrink-0 transition-all duration-300 relative select-none ${
          sidebarCollapsed
            ? 'w-16 items-center cursor-pointer hover:border-emerald-500/30'
            : 'w-52 lg:w-64'
        }`}
        title={sidebarCollapsed ? "Clique em qualquer lugar para expandir o menu" : undefined}
      >
        {/* Header da Sidebar */}
        <div className="h-16 flex items-center border-b border-white/5 w-full px-4">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              {config?.logo_url ? (
                <img 
                  src={config.logo_url} 
                  alt={displayName} 
                  className="w-7 h-7 rounded-lg object-contain shrink-0" 
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Store className="size-4 text-emerald-400" />
                </div>
              )}
              <h1 className="text-sm font-bold tracking-tight text-white truncate">
                {displayName}
              </h1>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              {config?.logo_url ? (
                <img 
                  src={config.logo_url} 
                  alt={displayName} 
                  className="w-6 h-6 rounded-md object-contain shrink-0" 
                />
              ) : (
                <Store className="size-4 text-emerald-400 shrink-0" />
              )}
            </div>
          )}
        </div>
        
        {/* Navegação Principal */}
        <nav className={`flex-1 py-4 flex flex-col gap-1.5 w-full ${sidebarCollapsed ? 'items-center px-1' : ''}`}>
          <button 
            onClick={(e) => {
              if (sidebarCollapsed) e.stopPropagation();
              setActiveTab("pedidos");
            }}
            title={sidebarCollapsed ? "Pedidos" : undefined}
            className={`flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
              sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
            } ${
              activeTab === 'pedidos' 
                ? 'bg-white/5 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-3.5' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
            }`}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Pedidos</span>}
          </button>
          
          <button 
            onClick={(e) => {
              if (sidebarCollapsed) e.stopPropagation();
              setActiveTab("financeiro");
            }}
            title={sidebarCollapsed ? "Financeiro" : undefined}
            className={`flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
              sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
            } ${
              activeTab === 'financeiro' 
                ? 'bg-white/5 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-3.5' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
            }`}
          >
            <CircleDollarSign className="size-4 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Financeiro</span>}
          </button>

          <button 
            onClick={(e) => {
              if (sidebarCollapsed) e.stopPropagation();
              setActiveTab("estoque");
            }}
            title={sidebarCollapsed ? "Reposição" : undefined}
            className={`flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
              sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
            } ${
              activeTab === 'estoque' 
                ? 'bg-white/5 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-3.5' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
            }`}
          >
            <PackageSearch className="size-4 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Reposição</span>}
          </button>

          <button 
            onClick={(e) => {
              if (sidebarCollapsed) e.stopPropagation();
              setActiveTab("clientes");
            }}
            title={sidebarCollapsed ? "Clientes" : undefined}
            className={`flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
              sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
            } ${
              activeTab === 'clientes' 
                ? 'bg-white/5 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-3.5' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
            }`}
          >
            <Users className="size-4 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Clientes</span>}
          </button>

          <div className="h-px bg-white/5 my-2 w-[85%] mx-auto" />

          {/* Nova Aba Chatbot */}
          <button 
            onClick={(e) => {
              if (sidebarCollapsed) e.stopPropagation();
              setActiveTab("chatbot");
            }}
            title={sidebarCollapsed ? "Chatbot IA" : undefined}
            className={`flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
              sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
            } ${
              activeTab === 'chatbot' 
                ? 'bg-white/5 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-3.5' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
            }`}
          >
            <Bot className="size-4 shrink-0 text-emerald-400" />
            {!sidebarCollapsed && (
              <span className="truncate flex items-center gap-2">
                Chatbot
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                  IA
                </span>
              </span>
            )}
          </button>

          {/* Aba Marketing */}
          <button 
            onClick={(e) => {
              if (sidebarCollapsed) e.stopPropagation();
              setActiveTab("marketing");
            }}
            title={sidebarCollapsed ? "Marketing & Disparos" : undefined}
            className={`flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
              sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
            } ${
              activeTab === 'marketing' 
                ? 'bg-white/5 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-3.5' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
            }`}
          >
            <Megaphone className="size-4 shrink-0 text-emerald-400" />
            {!sidebarCollapsed && (
              <span className="truncate flex items-center gap-2">
                Marketing
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                  VIP
                </span>
              </span>
            )}
          </button>

          {/* Aba Sócios */}
          <button 
            onClick={(e) => {
              if (sidebarCollapsed) e.stopPropagation();
              setActiveTab("socios");
            }}
            title={sidebarCollapsed ? "Sócios & Equity" : undefined}
            className={`flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
              sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
            } ${
              activeTab === 'socios' 
                ? 'bg-white/5 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-3.5' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
            }`}
          >
            <Scale className="size-4 shrink-0 text-emerald-400" />
            {!sidebarCollapsed && (
              <span className="truncate flex items-center gap-2">
                Sócios
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                  EQUITY
                </span>
              </span>
            )}
          </button>
        </nav>

        {/* Botão de Toggle do Menu Lateral */}
        <div className="px-3 py-2 w-full flex flex-col items-center">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all flex items-center justify-center cursor-pointer border border-white/5 shadow-sm active:scale-95 ${
              sidebarCollapsed ? '' : 'gap-2 text-[11px] font-bold uppercase tracking-wider'
            }`}
            title={sidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="size-4 text-emerald-400" />
            ) : (
              <>
                <ChevronRight className="size-4 rotate-180 text-emerald-400" />
                <span>Recolher</span>
              </>
            )}
          </button>
        </div>

        {/* Rodapé / Configurações */}
        <div className={`p-3 border-t border-white/5 w-full ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          <button 
            onClick={(e) => {
              if (sidebarCollapsed) e.stopPropagation();
              setActiveTab("configuracoes");
            }}
            title={sidebarCollapsed ? "Configurações" : undefined}
            className={`flex items-center gap-3 py-2.5 transition-all cursor-pointer w-full text-xs font-semibold ${
              sidebarCollapsed ? 'justify-center px-3 rounded-xl' : 'pr-4'
            } ${
              activeTab === 'configuracoes'
                ? 'bg-white/5 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-3.5'
                : 'text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4'
            }`}
          >
            <Settings className="size-4 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Configurações</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Suspense fallback={<TabLoadingFallback />}>
          {activeTab === 'pedidos' && <KanbanBoard />}
          {activeTab === 'financeiro' && <FinanceDashboard />}
          {activeTab === 'estoque' && <SupplyChainDashboard />}
          {activeTab === 'clientes' && <CRMDashboard />}
          {activeTab === 'chatbot' && <ChatbotPage />}
          {activeTab === 'marketing' && <MarketingModule />}
          {activeTab === 'socios' && <PartnersDashboard />}
          {activeTab === 'configuracoes' && <SettingsPage />}
        </Suspense>
      </main>

    </div>
  );
}
