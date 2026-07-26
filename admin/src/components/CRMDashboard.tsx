import { useState } from "react";
import { Users, Bot, Target, Zap, Activity } from "lucide-react";
import { RealClient } from "@/lib/crm";

// Componentes do CRM
import { RFMMatrix } from "./crm/RFMMatrix";
import { PredictiveReplenishment } from "./crm/PredictiveReplenishment";
import { LongTailMatch } from "./crm/LongTailMatch";
import { BotAutomations } from "./crm/BotAutomations";
import { ClientProfileModal } from "./crm/ClientProfileModal";

export function CRMDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'rfm' | 'replenishment' | 'match' | 'automations'>('rfm');
  const [selectedClient, setSelectedClient] = useState<RealClient | null>(null);

  const tabs = [
    { id: 'rfm', label: 'Matriz RFM', icon: <Target className="size-4" /> },
    { id: 'replenishment', label: 'Reposição Preditiva', icon: <Activity className="size-4" /> },
    { id: 'match', label: 'Match de Cauda Longa', icon: <Zap className="size-4" /> },
    { id: 'automations', label: 'Automações & Bot', icon: <Bot className="size-4" /> },
  ] as const;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header do CRM */}
      <header className="px-6 py-5 border-b border-border shrink-0 bg-[#0a0a0a]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-silver flex items-center gap-2">
              <Users className="size-6 text-primary" />
              Gestão de Clientes (CRM em Tempo Real)
            </h2>
            <p className="text-sm text-muted-foreground mt-1 tracking-wide">
              Métricas reais de Lifetime Value, Recompra e Ciclo de Vida por WhatsApp.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <div className="size-2 rounded-full bg-emerald-400 animate-ping" />
              Base de Clientes Reais Conectada
            </span>
          </div>
        </div>

        {/* Navegação Secundária */}
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSubTab === tab.id 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'text-muted-foreground hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar">
        {activeSubTab === 'rfm' && <RFMMatrix onSelectClient={setSelectedClient} />}
        {activeSubTab === 'replenishment' && <PredictiveReplenishment onSelectClient={setSelectedClient} />}
        {activeSubTab === 'match' && <LongTailMatch onSelectClient={() => {}} />}
        {activeSubTab === 'automations' && <BotAutomations />}
      </div>

      {/* Modal 360 do Cliente (Abre ao clicar em qualquer cliente) */}
      {selectedClient && (
        <ClientProfileModal client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}
    </div>
  );
}
