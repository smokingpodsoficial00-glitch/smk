import { useState } from "react";
import { LayoutDashboard, PackageSearch, Users, Settings, CircleDollarSign, MoreHorizontal } from "lucide-react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { FinanceDashboard } from "@/components/FinanceDashboard";
import { SupplyChainDashboard } from "@/components/SupplyChainDashboard";
import { CRMDashboard } from "@/components/CRMDashboard";

export default function App() {
  const [activeTab, setActiveTab] = useState("pedidos");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
          {!sidebarCollapsed && (
            <h1 className="text-lg font-bold tracking-tight text-silver truncate">
              Smoking Admin
            </h1>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            <MoreHorizontal className="size-5" />
          </button>
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
            title={sidebarCollapsed ? "Configurações" : undefined}
            className={`flex items-center gap-3 py-3 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-white w-full transition-all ${
              sidebarCollapsed ? 'justify-center px-3' : 'px-4'
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
      </main>
    </div>
  );
}
