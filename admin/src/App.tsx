import { useState } from "react";
import { LayoutDashboard, PackageSearch, Users, Settings, CircleDollarSign } from "lucide-react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { FinanceDashboard } from "@/components/FinanceDashboard";
import { SupplyChainDashboard } from "@/components/SupplyChainDashboard";
import { CRMDashboard } from "@/components/CRMDashboard";

export default function App() {
  const [activeTab, setActiveTab] = useState("pedidos");

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-[#0a0a0a] flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <h1 className="text-xl font-bold tracking-tight text-silver">Smoking Admin</h1>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab("pedidos")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'pedidos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-white/5'}`}
          >
            <LayoutDashboard className="size-5" />
            <span className="font-medium">Pedidos</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("financeiro")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'financeiro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-white/5'}`}
          >
            <CircleDollarSign className="size-5" />
            <span className="font-medium">Financeiro</span>
          </button>

          <button 
            onClick={() => setActiveTab("estoque")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'estoque' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-white/5'}`}
          >
            <PackageSearch className="size-5" />
            <span className="font-medium">Reposição</span>
          </button>

          <button 
            onClick={() => setActiveTab("clientes")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'clientes' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-white/5'}`}
          >
            <Users className="size-5" />
            <span className="font-medium">Clientes</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-white/5 w-full transition-all">
            <Settings className="size-5" />
            <span className="font-medium">Configurações</span>
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
