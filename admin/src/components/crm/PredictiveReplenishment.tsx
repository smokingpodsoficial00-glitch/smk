import { useState, useEffect, useRef } from "react";
import { Clock, Send, Loader2, Sparkles, MessageCircle, AlertTriangle, Flame, CheckCircle2, Calendar, Search, X } from "lucide-react";
import { fetchLiveClients, invalidateLiveClientsCache, recordReplenishmentAlert, matchesVisualSearch, type RealClient } from "@/lib/crm";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

function formatReplenishmentAlertDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `Último aviso: ${day}/${month}/${year} às ${hours}:${minutes}`;
}

export function PredictiveReplenishment({ onSelectClient }: { onSelectClient: (client: RealClient) => void }) {
  const { company } = useAuth();
  const [clients, setClients] = useState<RealClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'urgent' | 'warning' | 'ok'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [submittingAlerts, setSubmittingAlerts] = useState<Set<string>>(new Set());
  const [alertErrors, setAlertErrors] = useState<Record<string, string | null>>({});
  const realtimeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadClients = async () => {
    try {
      const live = await fetchLiveClients(company?.id);
      setClients(Array.isArray(live) ? live : []);
    } catch (err) {
      console.error("Erro no loadClients:", err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsSent = async (clientId: string) => {
    if (!clientId || submittingAlerts.has(clientId)) return;

    // Proteção contra double-click: trava o botão imediatamente
    setSubmittingAlerts(prev => new Set(prev).add(clientId));
    setAlertErrors(prev => ({ ...prev, [clientId]: null }));

    try {
      const res = await recordReplenishmentAlert({
        clientId,
        companyId: company?.id,
      });

      if (res.success && res.timestamp) {
        // Atualização reativa imediata no estado local do CRM
        setClients(prev =>
          prev.map(c =>
            c.id === clientId ? { ...c, lastReplenishmentAlertAt: res.timestamp } : c
          )
        );
      } else {
        setAlertErrors(prev => ({
          ...prev,
          [clientId]: res.error || 'Falha ao registrar envio no Supabase',
        }));
      }
    } catch (err: any) {
      console.error('Erro ao marcar aviso de recompra como enviado:', err);
      setAlertErrors(prev => ({
        ...prev,
        [clientId]: err?.message || 'Erro inesperado ao salvar envio.',
      }));
    } finally {
      setSubmittingAlerts(prev => {
        const next = new Set(prev);
        next.delete(clientId);
        return next;
      });
    }
  };

  useEffect(() => {
    loadClients();

    const handleRealtime = () => {
      invalidateLiveClientsCache(company?.id);
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
      realtimeDebounceTimerRef.current = setTimeout(() => {
        loadClients();
      }, 300);
    };

    const channel = supabase
      .channel('replenishment_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_orders' }, handleRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_clients' }, handleRealtime)
      .subscribe();

    return () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="size-8 text-emerald-400 animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Calculando estimativa de término de pods e datas de recompra...</p>
      </div>
    );
  }

  const urgentClients = clients.filter(c => c && c.urgencyLevel === 'urgent');
  const warningClients = clients.filter(c => c && c.urgencyLevel === 'warning');
  const okClients = clients.filter(c => c && c.urgencyLevel === 'ok');
  const alertedClients = clients.filter(c => c && Boolean(c.lastReplenishmentAlertAt));

  const filteredClients = clients.filter((c) => {
    if (!c) return false;
    if (urgencyFilter !== 'all' && c.urgencyLevel !== urgencyFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      return matchesVisualSearch(c.name, searchQuery);
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      
      {/* Banner Explicativo com Estatísticas */}
      <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="bg-[#141414] border border-white/5 p-3.5 rounded-xl text-emerald-400 shrink-0">
            <Clock className="size-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
              Radar Preditivo de Recompra
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase font-mono">
                IA Ativa
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Monitora a capacidade do pod e estima a data de esgotamento. Dispare antes que o cliente compre na concorrência.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-[#141414] border border-red-500/20 text-red-400 text-[11px] font-bold uppercase tracking-wider">
            {urgentClients.length} Pods Secos
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-[#141414] border border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider">
            {warningClients.length} Secando
          </span>
          {alertedClients.length > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-[#141414] border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-emerald-400" />
              {alertedClients.length} Avisos Enviados
            </span>
          )}
        </div>
      </div>

      {/* Seletor de Abas de Criticidade & Barra de Pesquisa de Clientes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filtros de Criticidade */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setUrgencyFilter('all')}
            className={`px-4 py-2 rounded-xl text-[11px] uppercase tracking-wider font-bold transition-all cursor-pointer ${
              urgencyFilter === 'all'
                ? 'bg-[#141414] text-white border border-white/10'
                : 'text-muted-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            Todos ({clients.length})
          </button>

          <button
            type="button"
            onClick={() => setUrgencyFilter('urgent')}
            className={`px-4 py-2 rounded-xl text-[11px] uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              urgencyFilter === 'urgent'
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'text-muted-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
            Disparo Urgente ({urgentClients.length})
          </button>

          <button
            type="button"
            onClick={() => setUrgencyFilter('warning')}
            className={`px-4 py-2 rounded-xl text-[11px] uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              urgencyFilter === 'warning'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'text-muted-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            Fim Próximo ({warningClients.length})
          </button>

          <button
            type="button"
            onClick={() => setUrgencyFilter('ok')}
            className={`px-4 py-2 rounded-xl text-[11px] uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              urgencyFilter === 'ok'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-muted-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            Pod em Uso ({okClients.length})
          </button>
        </div>

        {/* Campo de Pesquisa de Clientes */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="size-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar cliente..."
            className="w-full bg-[#141414] border border-white/10 rounded-xl pl-10 pr-9 py-2 text-base sm:text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-500/60 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer p-0.5"
              title="Limpar pesquisa"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-12 text-center text-muted-foreground">
          <p className="text-sm">
            {searchQuery.trim()
              ? "Nenhum cliente encontrado."
              : "Nenhum cliente com compras nessa categoria de urgência."}
          </p>
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
            >
              Limpar pesquisa
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map(item => {
            const progress = Math.min((item.daysSinceLastOrder / item.expectedCycleDays) * 100, 100);
            const isOverdue = item.urgencyLevel === 'urgent';
            const isNearEnd = item.urgencyLevel === 'warning';
            const isSending = submittingAlerts.has(item.id);
            const hasAlertSent = Boolean(item.lastReplenishmentAlertAt);
            const errorMsg = alertErrors[item.id];

            const phoneClean = item.cleanPhone || item.phone.replace(/\D/g, '');
            const msg = `E aí ${item.name}! Tudo certo? 💨 Vi que já faz um tempinho desde a sua última compra do ${item.lastProduct}. Seu pod já tá na final? Já quer ir garantindo o próximo para não ficar na mão no rolê? Me avisa aqui!`;
            const waUrl = item.whatsappUrl || `https://wa.me/${phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean}?text=${encodeURIComponent(msg)}`;

            return (
              <div 
                key={item.id} 
                className={`bg-[#0a0a0a] border rounded-2xl p-5 flex flex-col md:flex-row gap-6 md:items-center justify-between transition-colors ${
                  isOverdue 
                    ? 'border-red-500/30 hover:border-red-500/50' 
                    : isNearEnd
                    ? 'border-amber-500/30 hover:border-amber-500/50'
                    : 'border-white/5 hover:border-white/10'
                }`}
              >
                <div 
                  className="flex items-center gap-4 cursor-pointer min-w-[280px]" 
                  onClick={() => onSelectClient(item)}
                >
                  <div className="size-10 rounded-full bg-[#141414] flex items-center justify-center font-bold text-white border border-white/5 shrink-0 text-sm">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm hover:text-emerald-400 transition-colors flex flex-wrap items-center gap-2">
                      {item.name}
                      {isOverdue ? (
                        <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                          Pod Secou
                        </span>
                      ) : isNearEnd ? (
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                          Faltam ~{item.estimatedDaysLeft}d
                        </span>
                      ) : (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                          Pod Novo
                        </span>
                      )}

                      {hasAlertSent && (
                        <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          <CheckCircle2 className="size-3 text-emerald-400" />
                          Recompra Enviada
                        </span>
                      )}
                    </h4>
                    <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
                      <span>Último: <strong className="text-white/80 font-medium">{item.lastProduct}</strong> ({item.lastPuffs} puffs)</span>
                      <span>•</span>
                      <span className="text-white/50">compra em {item.lastOrderDate}</span>
                    </div>
                    {hasAlertSent && (
                      <div className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1.5">
                        <Clock className="size-3 text-emerald-400/80" />
                        <span>{formatReplenishmentAlertDate(item.lastReplenishmentAlertAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Barra de Progresso do Ciclo */}
                <div className="flex-1 max-w-sm">
                  <div className="flex justify-between text-[11px] mb-2 font-semibold">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3 text-muted-foreground/70" />
                      Reposição: {item.nextReplenishmentDate}
                    </span>
                    <span className={isOverdue ? 'text-red-400' : isNearEnd ? 'text-amber-400' : 'text-emerald-400'}>
                      {isOverdue ? `Atrasado há ${item.daysSinceLastOrder - item.expectedCycleDays}d` : `${progress.toFixed(0)}% do ciclo`}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#141414] rounded-full overflow-hidden border border-white/5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOverdue ? 'bg-red-500' : 
                        isNearEnd ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Botões de Ação (Disparo WhatsApp e Registro de Envio) */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold transition-all cursor-pointer uppercase tracking-wider"
                      title="Abrir conversa no WhatsApp com mensagem de recompra pré-pronta"
                    >
                      <MessageCircle className="size-3.5" />
                      <span>Recompra</span>
                    </a>

                    <button
                      type="button"
                      disabled={isSending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsSent(item.id);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        hasAlertSent
                          ? 'bg-[#141414] hover:bg-[#1f1f1f] text-zinc-300 border border-white/10 hover:border-emerald-500/40'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 border border-emerald-500'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={hasAlertSent ? "Clique para registrar nova data de envio caso tenha mandado novo aviso" : "Confirmar explicitamente que a mensagem de recompra foi enviada no WhatsApp"}
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : hasAlertSent ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-emerald-400" />
                          <span>Atualizar Envio</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          <span>Marcar como Enviado</span>
                        </>
                      )}
                    </button>
                  </div>

                  {errorMsg && (
                    <span className="text-[10px] text-red-400 font-medium max-w-[220px] text-right">
                      {errorMsg}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

