import { useState } from "react";
import { LayoutDashboard, PackageSearch, Users, Settings, CircleDollarSign, MoreHorizontal, Store } from "lucide-react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { FinanceDashboard } from "@/components/FinanceDashboard";
import { SupplyChainDashboard } from "@/components/SupplyChainDashboard";
import { CRMDashboard } from "@/components/CRMDashboard";
import { SettingsPage } from "@/components/SettingsPage";
import { useStoreConfig } from "@/lib/useStoreConfig";

export default function App() {
  const [activeTab, setActiveTab] = useState("pedidos");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { config, loading: configLoading } = useStoreConfig();

  const displayName = config?.store_name || "Minha Loja";

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`border-r border-white/10 bg-[#0a0a0a] flex flex-col shrink-0 transition-all duration-300 ${
          sidebarCollapsed ? 'w-16 items-center' : 'w-52 lg:w-64'
        }`}
      >
        {/* Header da Sidebar */}
        <div className={`h-16 flex items-center border-b border-white/10 w-full px-4 ${
          sidebarCollapsed ? 'justify-center' : 'justify-between'
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
                <h1 className="text-lg font-bold tracking-tight text-white truncate">
                  {displayName}
                </h1>
              </div>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title="Recolher menu lateral"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center border border-transparent hover:border-white/10"
              title="Expandir menu lateral"
            >
              {config?.logo_url ? (
                <img 
                  src={config.logo_url} 
                  alt={displayName} 
                  className="w-7 h-7 rounded-lg object-contain" 
                />
              ) : (
                <Store className="size-5 text-emerald-400" />
              )}
            </button>
          )}
        </div>
        
        {/* Navegação Principal */}
        <nav className={`flex-1 p-3 flex flex-col gap-2 w-full ${sidebarCollapsed ? 'items-center' : ''}`}>
          <button 
            onClick={() => setActiveTab("pedidos")}
            title={sidebarCollapsed ? "Pedidos" : undefined}
            className={`flex items-center gap-3 py-3 rounded-xl transition-all ${
              sidebarCollapsed ? 'justify-center px-3' : 'px-4'
            } ${
              activeTab === 'pedidos' 
                ? 'bg-primary text-primary-foreground shadow' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard className="size-5 shrink-0" />
            {!sidebarCollapsed && <span className="font-medium truncate">Pedidos</span>}
          </button>
          
          <button 
            onClick={() => setActiveTab("financeiro")}
            title={sidebarCollapsed ? "Financeiro" : undefined}
            className={`flex items-center gap-3 py-3 rounded-xl transition-all ${
              sidebarCollapsed ? 'justify-center px-3' : 'px-4'
            } ${
              activeTab === 'financeiro' 
                ? 'bg-primary text-primary-foreground shadow' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white'
            }`}
          >
            <CircleDollarSign className="size-5 shrink-0" />
            {!sidebarCollapsed && <span className="font-medium truncate">Financeiro</span>}
          </button>

          <button 
            onClick={() => setActiveTab("estoque")}
            title={sidebarCollapsed ? "Reposição" : undefined}
            className={`flex items-center gap-3 py-3 rounded-xl transition-all ${
              sidebarCollapsed ? 'justify-center px-3' : 'px-4'
            } ${
              activeTab === 'estoque' 
                ? 'bg-primary text-primary-foreground shadow' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white'
            }`}
          >
            <PackageSearch className="size-5 shrink-0" />
            {!sidebarCollapsed && <span className="font-medium truncate">Reposição</span>}
          </button>

          <button 
            onClick={() => setActiveTab("clientes")}
            title={sidebarCollapsed ? "Clientes" : undefined}
            className={`flex items-center gap-3 py-3 rounded-xl transition-all ${
              sidebarCollapsed ? 'justify-center px-3' : 'px-4'
            } ${
              activeTab === 'clientes' 
                ? 'bg-primary text-primary-foreground shadow' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white'
            }`}
          >
            <Users className="size-5 shrink-0" />
            {!sidebarCollapsed && <span className="font-medium truncate">Clientes</span>}
          </button>
        </nav>

        {/* Rodapé / Configurações */}
        <div className={`p-3 border-t border-white/10 w-full ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          <button 
            onClick={() => setActiveTab("configuracoes")}
            title={sidebarCollapsed ? "Configurações" : undefined}
            className={`flex items-center gap-3 py-3 rounded-xl w-full transition-all ${
              sidebarCollapsed ? 'justify-center px-3' : 'px-4'
            } ${
              activeTab === 'configuracoes'
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-white/5 hover:text-white'
            }`}
          >
            <Settings className="size-5 shrink-0" />
            {!sidebarCollapsed && <span className="font-medium truncate">Configurações</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'pedidos' && <KanbanBoard />}
        {activeTab === 'financeiro' && <FinanceDashboard />}
        {activeTab === 'estoque' && <SupplyChainDashboard />}
        {activeTab === 'clientes' && <CRMDashboard />}
        {activeTab === 'configuracoes' && <SettingsPage />}
      </main>
    </div>
  );
}
