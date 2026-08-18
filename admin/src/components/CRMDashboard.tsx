import React, { Component, type ReactNode, useState } from "react";
import { Users, Crown, RefreshCw, AlertTriangle, Target, Receipt } from "lucide-react";
import type { RealClient } from "@/lib/crm";

// Componentes do CRM
import { RFMMatrix } from "./crm/RFMMatrix";
import { PredictiveReplenishment } from "./crm/PredictiveReplenishment";
import { FollowUpsTab } from "./crm/FollowUpsTab";
import { SalesHistoryTab } from "./crm/SalesHistoryTab";
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
  const [activeSubTab, setActiveSubTab] = useState<'rfm' | 'replenishment' | 'followups' | 'sales_history'>('rfm');
  const [selectedClient, setSelectedClient] = useState<RealClient | null>(null);

  const tabs = [
    { id: 'rfm', label: 'Ranking & Fidelidade', icon: <Crown className="size-4 text-amber-400" /> },
    { id: 'replenishment', label: 'Aviso de Fim de Pod & Recompra', icon: <RefreshCw className="size-4 text-emerald-400" /> },
    { id: 'followups', label: 'Follow-ups de Vendas & Salário', icon: <Target className="size-4 text-purple-400" /> },
    { id: 'sales_history', label: 'Histórico & Mural de Vendas', icon: <Receipt className="size-4 text-blue-400" /> },
  ] as const;

  return (
    <CRMErrorBoundary>
      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 space-y-6 text-white custom-scrollbar">
        {/* ━━━ CABEÇALHO EXECUTIVO PADRONIZADO (DESIGN SYSTEM) ━━━━━━━━━━━ */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Users className="size-6 text-emerald-400 shrink-0" />
              <span>Gestão de Clientes & CRM</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Ranking de Fidelidade, Previsão de Recompra, Follow-ups e Histórico Técnico de Vendas.
            </p>
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
            <div className="size-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Base Conectada</span>
          </div>
        </header>

        {/* ━━━ ABAS SUPERIORES (ALTURAS, PADDING E RADIUS UNIFORMES) ━━━━━ */}
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as 'rfm' | 'replenishment' | 'followups' | 'sales_history')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                activeSubTab === tab.id 
                  ? 'bg-white/10 text-white font-bold border border-white/20 shadow-sm' 
                  : 'text-muted-foreground hover:text-white bg-[#0e0e10] border border-white/10 hover:border-white/20'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ━━━ CONTEÚDO DA ABA ATIVA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="space-y-6">
          <CRMErrorBoundary>
            {activeSubTab === 'rfm' && <RFMMatrix onSelectClient={setSelectedClient} />}
            {activeSubTab === 'replenishment' && <PredictiveReplenishment onSelectClient={setSelectedClient} />}
            {activeSubTab === 'followups' && <FollowUpsTab />}
            {activeSubTab === 'sales_history' && <SalesHistoryTab />}
          </CRMErrorBoundary>
        </div>

        {/* Modal 360 do Cliente */}
        {selectedClient && (
          <CRMErrorBoundary>
            <ClientProfileModal 
              client={selectedClient} 
              onClose={() => setSelectedClient(null)} 
              onClientUpdated={() => {
                setSelectedClient(null);
              }}
            />
          </CRMErrorBoundary>
        )}
      </div>
    </CRMErrorBoundary>
  );
}
