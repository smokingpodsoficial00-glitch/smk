import { useState } from "react";
import {
  LayoutDashboard, PackageSearch, Users, Settings, CircleDollarSign,
  MoreHorizontal, Store, ChevronRight, PanelLeftOpen, Bot
} from "lucide-react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { FinanceDashboard } from "@/components/FinanceDashboard";
import { SupplyChainDashboard } from "@/components/SupplyChainDashboard";
import { CRMDashboard } from "@/components/CRMDashboard";
import { SettingsPage } from "@/components/SettingsPage";
import { ChatbotPage } from "@/components/ChatbotPage";
import { useStoreConfig } from "@/lib/useStoreConfig";

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
        <div className={`h-16 flex items-center border-b border-white/10 w-full px-3.5 ${
          sidebarCollapsed ? 'justify-between px-2' : 'justify-between'
        }`}>
          {!sidebarCollapsed ? (
            <>
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
                <h1 className="text-base font-bold tracking-tight text-white truncate">
                  {displayName}
                </h1>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarCollapsed(true);
                }}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title="Recolher menu lateral"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full px-1">
              {config?.logo_url ? (
                <img 
                  src={config.logo_url} 
                  alt={displayName} 
                  className="w-6 h-6 rounded-md object-contain shrink-0" 
                />
              ) : (
                <Store className="size-4 text-emerald-400 shrink-0" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarCollapsed(false);
                }}
                className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/15 transition-all cursor-pointer"
                title="Expandir menu lateral"
              >
                <MoreHorizontal className="size-5" />
              </button>
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
        </nav>

        {/* Botão de Expansão no Rodapé (Quando Colapsado) */}
        {sidebarCollapsed && (
          <div className="p-2 border-t border-white/5 w-full flex flex-col items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSidebarCollapsed(false);
              }}
              className="w-full py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 transition-all flex items-center justify-center cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.15)]"
              title="Expandir Menu Lateral"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}

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
        {activeTab === 'pedidos' && <KanbanBoard />}
        {activeTab === 'financeiro' && <FinanceDashboard />}
        {activeTab === 'estoque' && <SupplyChainDashboard />}
        {activeTab === 'clientes' && <CRMDashboard />}
        {activeTab === 'chatbot' && <ChatbotPage />}
        {activeTab === 'configuracoes' && <SettingsPage />}
      </main>
    </div>
  );
}
