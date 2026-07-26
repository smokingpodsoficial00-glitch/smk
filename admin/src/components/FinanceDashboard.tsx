import { DollarSign, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/cart";

// Mock de dados financeiros simulando o mês atual
const financeData = {
  grossRevenue: 12500.00,
  cmv: 4350.00, // Custo Médio Ponderado das mercadorias vendidas
  logisticsSubsidy: 680.00, // Prejuízo no frete pago vs cobrado
  netProfit: 7470.00,
  profitMargin: 59.7, // %
};

export function FinanceDashboard() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-6">
      <header className="mb-8">
        <h2 className="text-2xl font-semibold text-silver">Inteligência Financeira</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Demonstrativo de Resultado (DRE) projetado para proteção contra Ilusão de Lucro.
        </p>
      </header>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard 
          title="Faturamento Bruto" 
          value={formatBRL(financeData.grossRevenue)} 
          icon={<DollarSign className="size-5 text-emerald-400" />} 
          description="Total faturado no mês" 
        />
        <KPICard 
          title="Custo Reposição (CMV)" 
          value={formatBRL(financeData.cmv)} 
          icon={<TrendingDown className="size-5 text-red-400" />} 
          description="Custo médio ponderado do lote" 
          negative
        />
        <KPICard 
          title="Subsídio de Frete" 
          value={formatBRL(financeData.logisticsSubsidy)} 
          icon={<AlertTriangle className="size-5 text-orange-400" />} 
          description="Perda cobrindo motoboys/Uber" 
          negative
        />
        <KPICard 
          title="Lucro Líquido Real" 
          value={formatBRL(financeData.netProfit)} 
          icon={<TrendingUp className="size-5 text-primary" />} 
          description={`Margem Líquida: ${financeData.profitMargin}%`} 
          highlight
        />
      </div>

      {/* DRE Simplificado - Visual */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-6">Detalhamento de Margem</h3>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-48 text-sm text-muted-foreground">Faturamento (100%)</div>
            <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500/80 w-full rounded-full" />
            </div>
            <div className="w-24 text-right font-medium">{formatBRL(financeData.grossRevenue)}</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-48 text-sm text-muted-foreground">Reposição (34.8%)</div>
            <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden relative">
              <div className="h-full bg-red-500/80 w-[34.8%] rounded-full relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 to-red-400/30" />
              </div>
            </div>
            <div className="w-24 text-right font-medium text-red-400">-{formatBRL(financeData.cmv)}</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-48 text-sm text-muted-foreground">Logística (5.4%)</div>
            <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden relative">
              <div className="h-full bg-orange-500/80 w-[5.4%] rounded-full relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 to-orange-400/30" />
              </div>
            </div>
            <div className="w-24 text-right font-medium text-orange-400">-{formatBRL(financeData.logisticsSubsidy)}</div>
          </div>

          <div className="h-px bg-border my-2" />

          <div className="flex items-center gap-4">
            <div className="w-48 font-semibold text-silver">Lucro Líquido ({financeData.profitMargin}%)</div>
            <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden relative">
              <div className="h-full bg-primary w-[59.7%] rounded-full relative shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20" />
              </div>
            </div>
            <div className="w-24 text-right font-bold text-silver">{formatBRL(financeData.netProfit)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, description, negative, highlight }: { title: string, value: string, icon: React.ReactNode, description: string, negative?: boolean, highlight?: boolean }) {
  return (
    <div className={`p-5 rounded-2xl border transition-colors ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-card border-border hover:border-white/10'}`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className={`p-2 rounded-lg ${highlight ? 'bg-primary/20' : 'bg-elevated'}`}>
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-bold tracking-tight mb-1 ${negative ? 'text-red-400' : 'text-white'}`}>
        {value}
      </div>
      <p className={`text-xs ${highlight ? 'text-primary' : 'text-muted-foreground'}`}>{description}</p>
    </div>
  );
}
