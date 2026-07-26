import { Star, AlertTriangle, TrendingUp, UserCheck, Crown, ShieldAlert } from "lucide-react";
import { formatBRL } from "@/lib/cart";

const rfmData = [
  { id: "c1", name: "Lucas Mendes", rfmScore: "555", segment: "champion", spent: 1250, orders: 8, lastOrder: "2 dias" },
  { id: "c2", name: "Maria Oliveira", rfmScore: "444", segment: "loyal", spent: 850, orders: 5, lastOrder: "15 dias" },
  { id: "c3", name: "João Silva", rfmScore: "213", segment: "at_risk", spent: 180, orders: 1, lastOrder: "45 dias" },
  { id: "c4", name: "Ana Souza", rfmScore: "554", segment: "champion", spent: 920, orders: 6, lastOrder: "5 dias" },
];

export function RFMMatrix({ onSelectClient }: { onSelectClient: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Crown className="size-4 text-yellow-500" />
            <h3 className="text-sm font-medium">Champions (VIPs)</h3>
          </div>
          <div className="text-2xl font-bold text-white">42 clientes</div>
          <p className="text-xs text-muted-foreground mt-1">Compram muito e frequentemente.</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <UserCheck className="size-4 text-emerald-400" />
            <h3 className="text-sm font-medium">Leais</h3>
          </div>
          <div className="text-2xl font-bold text-white">128 clientes</div>
          <p className="text-xs text-muted-foreground mt-1">Base sólida de recompra.</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <ShieldAlert className="size-4 text-red-400" />
            <h3 className="text-sm font-medium">Em Risco (Win-back)</h3>
          </div>
          <div className="text-2xl font-bold text-white">56 clientes</div>
          <p className="text-xs text-muted-foreground mt-1">Não compram há mais de 30 dias.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-elevated/30">
          <h3 className="font-semibold text-silver">Listagem de Clientes (Matriz)</h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-elevated/50">
            <tr>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Segmento (RFM)</th>
              <th className="px-6 py-4">LTV (Gasto Total)</th>
              <th className="px-6 py-4">Pedidos</th>
              <th className="px-6 py-4">Última Compra</th>
              <th className="px-6 py-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rfmData.map(client => (
              <tr key={client.id} className="hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => onSelectClient(client.id)}>
                <td className="px-6 py-4 font-medium text-white">{client.name}</td>
                <td className="px-6 py-4">
                  {client.segment === 'champion' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"><Crown className="size-3"/> Champion</span>}
                  {client.segment === 'loyal' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><UserCheck className="size-3"/> Leal</span>}
                  {client.segment === 'at_risk' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"><AlertTriangle className="size-3"/> Em Risco</span>}
                </td>
                <td className="px-6 py-4 text-silver">{formatBRL(client.spent)}</td>
                <td className="px-6 py-4 font-mono">{client.orders}x</td>
                <td className="px-6 py-4 text-muted-foreground">{client.lastOrder}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-xs font-medium text-primary hover:text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity">Ver Perfil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
