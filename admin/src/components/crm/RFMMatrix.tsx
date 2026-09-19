import { useState, useEffect } from "react";
import { 
  Star, UserCheck, Crown, ShieldAlert, Phone, Loader2, MessageSquare, 
  Trophy, Filter, Sparkles, Megaphone, CheckSquare, Square, Search, 
  Flame, CheckCircle2, RefreshCw, Users
} from "lucide-react";
import { formatBRL } from "@/lib/cart";
import { fetchLiveClients, type RealClient, type FlavorProfileType } from "@/lib/crm";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export function RFMMatrix({ onSelectClient }: { onSelectClient: (client: RealClient) => void }) {
  const { company } = useAuth();
  const [clients, setClients] = useState<RealClient[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [filterSegment, setFilterSegment] = useState<string>('all');
  const [filterFlavor, setFilterFlavor] = useState<string>('all');
  const [filterVip, setFilterVip] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Seleção em lote para envio ao Módulo de Marketing
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

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

  useEffect(() => {
    loadClients();

    const channel = supabase
      .channel('rfm_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_orders' }, loadClients)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_clients' }, loadClients)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="size-8 text-emerald-400 animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Carregando Inteligência de Clientes e CRM...</p>
      </div>
    );
  }

  // Métricas para os Cards Superiores
  const champions = clients.filter(c => c && c.segment === 'champion');
  const loyals = clients.filter(c => c && c.segment === 'loyal');
  const atRisk = clients.filter(c => c && c.segment === 'at_risk');
  const vipGroupCount = clients.filter(c => c && c.inVipGroup).length;
  const iceLovers = clients.filter(c => c && c.flavorProfile === 'ice').length;
  const fruitLovers = clients.filter(c => c && c.flavorProfile === 'fruity').length;

  // Filtragem Dinâmica Combinada
  const filteredClients = clients.filter(client => {
    if (!client) return false;

    // Filtro por Segmento / Fidelidade
    if (filterSegment !== 'all' && client.segment !== filterSegment) {
      return false;
    }

    // Filtro por Perfil de Sabor
    if (filterFlavor !== 'all' && client.flavorProfile !== filterFlavor) {
      return false;
    }

    // Filtro por Grupo VIP
    if (filterVip === 'in_group' && !client.inVipGroup) return false;
    if (filterVip === 'out_group' && client.inVipGroup) return false;

    // Busca textual (nome, telefone, produto, sabor, endereço)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (client.name || '').toLowerCase().includes(q);
      const matchPhone = (client.phone || '').replace(/\D/g, '').includes(q);
      const matchProduct = (client.lastProduct || '').toLowerCase().includes(q);
      const matchFlavor = (client.lastFlavor || '').toLowerCase().includes(q);
      const matchAddress = (client.address || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchProduct && !matchFlavor && !matchAddress) {
        return false;
      }
    }

    return true;
  });

  // Seleção em massa
  const handleToggleSelectAll = () => {
    if (selectedClientIds.size === filteredClients.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(filteredClients.map(c => c.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const updated = new Set(selectedClientIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedClientIds(updated);
  };

  // Exportar selecionados para o Módulo de Marketing (Criar Lista de Transmissão)
  const handleCreateBroadcastList = () => {
    const selectedList = clients.filter(c => selectedClientIds.has(c.id));
    if (selectedList.length === 0) {
      alert("Selecione pelo menos 1 cliente na tabela para criar a lista de transmissão.");
      return;
    }

    const listName = prompt("Nome da Lista de Transmissão:", `Público CRM (${selectedList.length} contatos) - ${new Date().toLocaleDateString('pt-BR')}`);
    if (!listName) return;

    try {
      const LOCAL_STORAGE_LISTS = 'smoking_broadcast_lists_v1';
      const existingLists = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LISTS) || '[]');

      const newList = {
        id: `list_crm_${Date.now()}`,
        name: listName.trim(),
        description: `Exportado do CRM (${filterFlavor !== 'all' ? `Sabor: ${filterFlavor}` : 'Geral'})`,
        contacts: selectedList.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          cleanPhone: c.cleanPhone,
          isSaved: true
        })),
        color: '#10b981',
        createdAt: new Date().toISOString()
      };

      const updated = [newList, ...existingLists];
      localStorage.setItem(LOCAL_STORAGE_LISTS, JSON.stringify(updated));

      setExportSuccessMessage(`✅ Lista "${listName}" com ${selectedList.length} contatos criada com sucesso! Já está disponível na aba Marketing.`);
      setTimeout(() => setExportSuccessMessage(null), 5000);
    } catch (e: any) {
      alert("Erro ao criar lista: " + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. Cards de Categorização por Recorrência e LTV */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => setFilterSegment(filterSegment === 'champion' ? 'all' : 'champion')}
          className={`bg-[#0a0a0a] border rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-colors ${
            filterSegment === 'champion' 
              ? 'border-emerald-500/30 bg-emerald-500/5' 
              : 'border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Crown className="size-3.5 text-emerald-400" />
              VIP Champions
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/5">
              Alto LTV & Frequente
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{champions.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Compram pelo menos 1x a cada 15 dias ou possuem LTV superior a R$ 280.</p>
          </div>
        </div>

        <div 
          onClick={() => setFilterSegment(filterSegment === 'loyal' ? 'all' : 'loyal')}
          className={`bg-[#0a0a0a] border rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-colors ${
            filterSegment === 'loyal' 
              ? 'border-emerald-500/30 bg-emerald-500/5' 
              : 'border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="size-3.5 text-emerald-400" />
              Clientes Recorrentes
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/5">
              1x por Mês
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{loyals.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Compram pods com padrão estável de 15 a 35 dias.</p>
          </div>
        </div>

        <div 
          onClick={() => setFilterSegment(filterSegment === 'at_risk' ? 'all' : 'at_risk')}
          className={`bg-[#0a0a0a] border rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-colors ${
            filterSegment === 'at_risk' 
              ? 'border-red-500/30 bg-red-500/5' 
              : 'border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="size-3.5 text-red-400" />
              Em Risco / Churn
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/10">
              Sem compra +35d
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{atRisk.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Ultrapassaram o ciclo de reposição e precisam de oferta de resgate.</p>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros Rápidos & Ações em Lote */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        
        {/* Campo de Busca */}
        <div className="relative w-full md:w-72">
          <Search className="size-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Buscar por nome, telefone ou sabor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141414] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filtros Dropdown */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          
          {/* Filtro Perfil de Sabor */}
          <select
            value={filterFlavor}
            onChange={(e) => setFilterFlavor(e.target.value)}
            className="bg-[#141414] border border-white/10 text-white text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Todos os Sabores</option>
            <option value="ice">Mentolado / Ice ({iceLovers})</option>
            <option value="fruity">Frutado / Doce ({fruitLovers})</option>
            <option value="tobacco">Atabacado / Intenso</option>
            <option value="dessert">Sobremesa</option>
          </select>

          {/* Filtro Grupo VIP */}
          <select
            value={filterVip}
            onChange={(e) => setFilterVip(e.target.value)}
            className="bg-[#141414] border border-white/10 text-white text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Todos os Grupos</option>
            <option value="in_group">No Grupo VIP ({vipGroupCount})</option>
            <option value="out_group">Fora do Grupo VIP</option>
          </select>

          {/* Botão de Exportação para o Marketing */}
          {selectedClientIds.size > 0 && (
            <button
              onClick={handleCreateBroadcastList}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
            >
              <Megaphone className="size-3.5" />
              <span>Criar Lista de Disparo ({selectedClientIds.size})</span>
            </button>
          )}

          {(filterSegment !== 'all' || filterFlavor !== 'all' || filterVip !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setFilterSegment('all');
                setFilterFlavor('all');
                setFilterVip('all');
                setSearchQuery('');
              }}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-semibold"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {exportSuccessMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{exportSuccessMessage}</span>
        </div>
      )}

      {/* 3. Tabela Principal de Clientes */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSelectAll}
              className="p-1 rounded-lg text-white/60 hover:text-white transition-colors"
              title="Selecionar Todos"
            >
              {selectedClientIds.size > 0 && selectedClientIds.size === filteredClients.length ? (
                <CheckSquare className="size-4 text-emerald-400" />
              ) : (
                <Square className="size-4" />
              )}
            </button>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Users className="size-3.5 text-emerald-400" />
                Base Ativa de Clientes & CRM ({filteredClients.length})
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {selectedClientIds.size > 0 ? `${selectedClientIds.size} selecionados para ação em lote.` : 'Clique em qualquer linha para abrir o Perfil 360° com notas e histórico.'}
              </p>
            </div>
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm">Nenhum cliente encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] text-muted-foreground uppercase bg-black/60 border-b border-white/5 font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-5 py-3 text-muted-foreground font-semibold">Cliente & Telefone</th>
                  <th className="px-5 py-3 text-muted-foreground font-semibold">Perfil de Sabor</th>
                  <th className="px-5 py-3 text-muted-foreground font-semibold">Grupo VIP</th>
                  <th className="px-5 py-3 text-muted-foreground font-semibold">LTV (Total Gasto)</th>
                  <th className="px-5 py-3 text-muted-foreground font-semibold">Último Pod / Puffs</th>
                  <th className="px-5 py-3 text-muted-foreground font-semibold text-right">Ação WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredClients.map(client => {
                  if (!client) return null;
                  const isSelected = selectedClientIds.has(client.id);
                  const phoneClean = client.cleanPhone || (client.phone || '').replace(/\D/g, '');
                  const waUrl = client.whatsappUrl || `https://wa.me/${phoneClean}?text=${encodeURIComponent(`Olá ${client.name || 'Cliente'}, tudo bem? Aqui é da Smoking Pods!`)}`;

                  return (
                    <tr 
                      key={client.id || phoneClean} 
                      className={`hover:bg-white/5 transition-colors cursor-pointer group ${isSelected ? 'bg-emerald-500/5' : ''}`}
                    >
                      <td className="px-4 py-4" onClick={(e) => { e.stopPropagation(); handleToggleSelectOne(client.id); }}>
                        {isSelected ? (
                          <CheckSquare className="size-4 text-emerald-400" />
                        ) : (
                          <Square className="size-4 text-white/30 group-hover:text-white/60" />
                        )}
                      </td>

                      <td className="px-5 py-4" onClick={() => onSelectClient(client)}>
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-[#141414] flex items-center justify-center font-bold text-white border border-white/5 group-hover:border-white/20 transition-colors">
                            {(client.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                              {client.name || 'Cliente'}
                              {client.segment === 'champion' && (
                                <Crown className="size-3.5 text-emerald-400" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="size-3 text-muted-foreground/60" />
                              {client.phone || 'Sem telefone'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4" onClick={() => onSelectClient(client)}>
                        <span className="bg-[#141414] text-white/70 border border-white/5 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                          {client.flavorProfileLabel}
                        </span>
                      </td>

                      <td className="px-5 py-4" onClick={() => onSelectClient(client)}>
                        {client.inVipGroup ? (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Membro VIP
                          </span>
                        ) : (
                          <span className="bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded text-[11px] font-semibold">
                            Não Convidado
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 font-mono font-extrabold text-emerald-400 text-base" onClick={() => onSelectClient(client)}>
                        {formatBRL(client.spent || 0)}
                        <div className="text-[10px] font-normal text-muted-foreground font-sans">
                          {client.ordersCount || 1} {client.ordersCount === 1 ? 'pedido' : 'pedidos'}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs" onClick={() => onSelectClient(client)}>
                        <div className="font-semibold text-white truncate max-w-[180px]">{client.lastProduct || 'Ignite V50'}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {client.daysSinceLastOrder === 0 ? 'Hoje' : `há ${client.daysSinceLastOrder} dias`} ({client.lastPuffs} puffs)
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {phoneClean && !client.phone?.includes('Instagram') && !client.phone?.startsWith('INSTA_') ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
                          >
                            <MessageSquare className="size-3.5" />
                            WhatsApp
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-white/5 text-white/40 border border-white/10 px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wider">
                            Sem WhatsApp
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

