import React, { Component, type ReactNode, useState } from "react";
import { Users, Crown, RefreshCw, AlertTriangle } from "lucide-react";
import type { RealClient } from "@/lib/crm";

// Componentes do CRM
import { RFMMatrix } from "./crm/RFMMatrix";
import { PredictiveReplenishment } from "./crm/PredictiveReplenishment";
import { ClientProfileModal } from "./crm/ClientProfileModal";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CRMErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("CRM Error Boundary capturou um erro:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col items-center text-center my-6">
          <AlertTriangle className="size-10 text-red-400 mb-3 animate-bounce" />
          <h3 className="text-lg font-bold text-white mb-1">Aviso no CRM de Clientes</h3>
          <p className="text-xs text-red-300 font-mono mb-4 max-w-lg overflow-auto p-3 bg-black/60 rounded-xl border border-red-500/20">
            {this.state.error?.toString()}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md"
          >
            <RefreshCw className="size-4" /> Recarregar CRM
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function CRMDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'rfm' | 'replenishment'>('rfm');
  const [selectedClient, setSelectedClient] = useState<RealClient | null>(null);

  const tabs = [
    { id: 'rfm', label: 'Ranking & Fidelidade', icon: <Crown className="size-4 text-amber-400" /> },
    { id: 'replenishment', label: 'Aviso de Fim de Pod & Recompra', icon: <RefreshCw className="size-4 text-emerald-400" /> },
  ] as const;

  return (
    <CRMErrorBoundary>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Header do CRM */}
        <header className="px-6 py-5 border-b border-border shrink-0 bg-[#0a0a0a]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-silver flex items-center gap-2">
                <Users className="size-6 text-primary" />
                Gestão de Clientes (CRM WhatsApp)
              </h2>
              <p className="text-sm text-muted-foreground mt-1 tracking-wide">
                Ranking de clientes leais, histórico de compras e previsão de término de pods para recompra.
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
                onClick={() => setActiveSubTab(tab.id as 'rfm' | 'replenishment')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeSubTab === tab.id 
                    ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
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
          <CRMErrorBoundary>
            {activeSubTab === 'rfm' && <RFMMatrix onSelectClient={setSelectedClient} />}
            {activeSubTab === 'replenishment' && <PredictiveReplenishment onSelectClient={setSelectedClient} />}
          </CRMErrorBoundary>
        </div>

        {/* Modal 360 do Cliente */}
        {selectedClient && (
          <CRMErrorBoundary>
            <ClientProfileModal client={selectedClient} onClose={() => setSelectedClient(null)} />
          </CRMErrorBoundary>
        )}
      </div>
    </CRMErrorBoundary>
  );
}
