import React, { Component, type ReactNode, useState } from "react";
import { Users, Crown, RefreshCw, AlertTriangle, Receipt, ShoppingCart } from "lucide-react";
import type { RealClient } from "@/lib/crm";
import { useAuth } from "../contexts/AuthContext";

// Componentes do CRM
import { RFMMatrix } from "./crm/RFMMatrix";
import { PredictiveReplenishment } from "./crm/PredictiveReplenishment";
import { SalesHistoryTab } from "./crm/SalesHistoryTab";
import { ClientProfileModal } from "./crm/ClientProfileModal";
import { ManualSaleModal } from "./ManualSaleModal";

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

export default function CRMDashboard() {
  const { company } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'rfm' | 'replenishment' | 'sales_history'>('rfm');
  const [selectedClient, setSelectedClient] = useState<RealClient | null>(null);
  const [isManualSaleModalOpen, setIsManualSaleModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const tabs = [
    { id: 'rfm', label: 'Ranking & Fidelidade', icon: <Crown className="size-4 text-amber-400" /> },
    { id: 'replenishment', label: 'Aviso de Fim de Pod & Recompra', icon: <RefreshCw className="size-4 text-white" /> },
    { id: 'sales_history', label: 'Histórico & Mural de Vendas', icon: <Receipt className="size-4 text-white/80" /> },
  ] as const;

  return (
    <CRMErrorBoundary>
      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 space-y-6 text-white custom-scrollbar">
        {/* ━━━ CABEÇALHO EXECUTIVO PADRONIZADO (DESIGN SYSTEM) ━━━━━━━━━━━ */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Users className="size-6 text-white shrink-0" />
              <span>Gestão de Clientes & CRM</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Ranking de Fidelidade, Previsão de Recompra e Histórico Técnico de Vendas.
            </p>
          </div>
          
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={() => setIsManualSaleModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] cursor-pointer active:scale-[0.97]"
            >
              <ShoppingCart className="size-3.5 text-black" />
              <span>Registrar Venda</span>
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20 shadow-sm">
              <div className="size-2 rounded-full bg-white animate-ping" />
              <span>Base Conectada</span>
            </div>
          </div>
        </header>

        {/* ━━━ ABAS SUPERIORES (ALTURAS, PADDING E RADIUS UNIFORMES) ━━━━━ */}
        <div data-tour="crm-tabs" className="flex flex-wrap items-center gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as 'rfm' | 'replenishment' | 'sales_history')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                activeSubTab === tab.id 
                  ? 'bg-white/10 text-white font-extrabold border border-white/25 shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
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
            {activeSubTab === 'rfm' && <RFMMatrix key={`rfm-${refreshKey}`} onSelectClient={setSelectedClient} />}
            {activeSubTab === 'replenishment' && <PredictiveReplenishment key={`rep-${refreshKey}`} onSelectClient={setSelectedClient} />}
            {activeSubTab === 'sales_history' && <SalesHistoryTab key={`sal-${refreshKey}`} />}
          </CRMErrorBoundary>
        </div>

        {/* Modal de Registro de Venda Manual */}
        <ManualSaleModal 
          isOpen={isManualSaleModalOpen}
          onClose={() => setIsManualSaleModalOpen(false)}
          onSaleSuccess={() => {
            setRefreshKey(prev => prev + 1);
          }}
          companyId={company?.id || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5"}
        />

        {/* Modal 360 do Cliente */}
        {selectedClient && (
          <CRMErrorBoundary>
            <ClientProfileModal 
              client={selectedClient} 
              onClose={() => setSelectedClient(null)} 
              onClientUpdated={() => {
                setSelectedClient(null);
                setRefreshKey(prev => prev + 1);
              }}
            />
          </CRMErrorBoundary>
        )}
      </div>
    </CRMErrorBoundary>
  );
}
