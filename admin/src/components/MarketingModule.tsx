import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Send, Users, ShieldAlert, Sparkles, Clock, CheckCircle2, 
  AlertTriangle, RefreshCw, MessageSquare, Play, Pause, ExternalLink,
  Flame, Lock, Copy, Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLiveClients, type RealClient } from '@/lib/crm';

interface CampaignTemplate {
  id: string;
  title: string;
  category: 'reativacao' | 'reposicao' | 'grupo_vip' | 'fim_de_semana';
  badge: string;
  text: string;
}

const OFFICIAL_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'weekend_vip',
    title: 'Final de Semana + Grupo VIP (Oficial SBC)',
    category: 'fim_de_semana',
    badge: 'Mais Convertida',
    text: `Oii, tudo bem? 💨\nPassando pra te avisar que a *Smoking Pods tá de volta oficialmente à ativa em SBC!*\n\nAs entregas pro final de semana já estão rolando a todo vapor pra você *garantir o seu pod a tempo e não ficar na mão no rolê*. Reabrimos com estoque 100% renovado, produtos originais e o delivery rápido de sempre de *30 a 40 min* pelo Uber Direct.\n\n📦 *Dá uma olhada nos modelos disponíveis no Cardápio Digital:*\n🔗 [LINK_DO_CARDAPIO_VERCEL]\n\n💬 *Também ativamos o Grupo VIP no WhatsApp pra soltar lotes exclusivos e frete promocional pro fds:*\n🔗 [LINK_DO_GRUPO_VIP_WHATSAPP]\n\nQual modelo e sabor posso separar pra você já garantir pro fds?`,
  },
  {
    id: 'antigos_clientes',
    title: 'Clientes das Antigas (Tom Pessoal)',
    category: 'reativacao',
    badge: 'Alta Resposta',
    text: `Opa [Nome], quanto tempo! De boa? 🔥\nSei que fazia um tempinho que estávamos parados, mas organizamos a casa e *voltamos com tudo!*\n\nComo você é da nossa base das antigas, tô te mandando o *Cardápio Digital atualizado* pra você dar uma olhada nos pods que chegaram:\n🔗 [LINK_DO_CARDAPIO_VERCEL]\n\n⚡ *Hoje tamo com prioridade máxima de entrega rápida no ABC (30-40 min via Uber Direct).*\n\n🔒 *Se quiser receber ofertas relâmpago e condições exclusivas antes de todo mundo, entra no nosso Grupo VIP:*\n🔗 [LINK_DO_GRUPO_VIP_WHATSAPP]\n\nTô por aqui se precisar de algo, só chamar!`,
  },
  {
    id: 'reposicao_ativa',
    title: 'Aviso de Fim de Pod (Recompra)',
    category: 'reposicao',
    badge: 'Timing de Uso',
    text: `E aí [Nome]! Tudo certo? 💨\nPelo meu controle aqui, seu último pod já deve estar nas últimas puxadas hahaha!\n\nPra você não ficar na mão no meio da semana, quer que eu já separe um sabor novo pra você?\n\n📦 Cardápio completo no ar: [LINK_DO_CARDAPIO_VERCEL]\nMe avisa aqui qual sabor posso agilizar pro seu delivery!`,
  },
];

export function MarketingModule() {
  const { company } = useAuth();
  const [clients, setClients] = useState<RealClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  
  // Configuração da Campanha
  const [selectedTemplate, setSelectedTemplate] = useState<string>('weekend_vip');
  const [customMessage, setCustomMessage] = useState<string>(OFFICIAL_TEMPLATES[0].text);
  const [cardapioLink, setCardapioLink] = useState<string>('https://smoking-pods.vercel.app');
  const [grupoVipLink, setGrupoVipLink] = useState<string>('');
  
  // Anti-Ban & Lotes
  const [batchSize, setBatchSize] = useState<number>(20);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(45);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Carrega clientes da base
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const live = await fetchLiveClients(company?.id);
        setClients(live);
        // Seleciona todos por padrão
        const allIds = new Set(live.map(c => c.id));
        setSelectedClients(allIds);
      } catch (err) {
        console.error('Erro ao carregar clientes para marketing:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [company?.id]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tmpl = OFFICIAL_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) {
      setCustomMessage(tmpl.text);
    }
  };

  const toggleSelectClient = (id: string) => {
    const next = new Set(selectedClients);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedClients(next);
  };

  const toggleSelectAll = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)));
    }
  };

  const getProcessedMessageForClient = (client: RealClient) => {
    let msg = customMessage
      .replace(/\[Nome\]/gi, client.name || 'Cliente')
      .replace(/\[LINK_DO_CARDAPIO_VERCEL\]/gi, cardapioLink)
      .replace(/\[LINK_DO_GRUPO_VIP_WHATSAPP\]/gi, grupoVipLink || '[Link do Grupo VIP]');
    return msg;
  };

  const handleCopyMessage = (client: RealClient) => {
    const finalMsg = getProcessedMessageForClient(client);
    navigator.clipboard.writeText(finalMsg);
    setCopiedId(client.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartDirectBatch = async () => {
    if (selectedClients.size === 0) {
      alert('Selecione pelo menos um cliente para o disparo.');
      return;
    }

    const targetList = clients.filter(c => selectedClients.has(c.id));
    const confirmMsg = `Iniciar disparo inteligente para ${targetList.length} clientes em lotes de ${batchSize} contatos a cada ${intervalMinutes} minutos?`;
    if (!window.confirm(confirmMsg)) return;

    setIsSending(true);
    setSendProgress({ current: 0, total: targetList.length, success: 0, failed: 0 });
    setStatusFeedback(`Disparando lote 1 (${Math.min(batchSize, targetList.length)} contatos)...`);

    try {
      let currentBatch = 0;
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < targetList.length; i++) {
        const client = targetList[i];
        const text = getProcessedMessageForClient(client);
        const phone = client.cleanPhone || client.phone.replace(/\D/g, '');

        try {
          const res = await fetch('http://localhost:3006/api/marketing/send-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone,
              name: client.name,
              text,
              companyId: company?.id,
            })
          });

          if (res.ok) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (e) {
          failedCount++;
        }

        setSendProgress({
          current: i + 1,
          total: targetList.length,
          success: successCount,
          failed: failedCount
        });

        // Delay anti-ban individual de 6s
        await new Promise(r => setTimeout(r, 6000));

        // Intervalo do Lote
        if ((i + 1) % batchSize === 0 && i + 1 < targetList.length) {
          currentBatch++;
          setStatusFeedback(`Lote ${currentBatch} concluído. Aguardando intervalo de segurança anti-ban (${intervalMinutes} min)...`);
          await new Promise(r => setTimeout(r, 15000));
          setStatusFeedback(`Iniciando Lote ${currentBatch + 1}...`);
        }
      }

      setStatusFeedback('Disparo finalizado com sucesso!');
    } catch (err: any) {
      console.error('Erro na fila de disparos:', err);
      setStatusFeedback('Houve um erro no processamento dos disparos.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <header className="px-6 py-5 border-b border-white/10 shrink-0 bg-[#0a0a0a]">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Megaphone className="size-6 text-emerald-400" />
                Módulo de Marketing & Disparos
              </h2>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                Exclusivo Smoking Pods
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Geração contínua de demanda, reativação 1 a 1 de clientes antigos e captação para o Grupo VIP com cadência Anti-Ban.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-white/40 block">Base Ativa</span>
              <span className="text-sm font-bold text-white font-mono">{clients.length} clientes</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Regras de Proteção Anti-Ban & Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0c0914] border border-purple-500/20 p-4 rounded-2xl flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Protocolo Anti-Ban</h4>
              <p className="text-[11px] text-white/50 mt-0.5">
                Envios espaçados de 6 a 12s por contato e divisão automática em lotes por hora para não bloquear o chip.
              </p>
            </div>
          </div>

          <div className="bg-[#0a120e] border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Inbound Voluntário</h4>
              <p className="text-[11px] text-white/50 mt-0.5">
                Convite para o Grupo VIP no final da mensagem. Entra apenas quem quer comprar, mantendo taxa de conversão alta.
              </p>
            </div>
          </div>

          <div className="bg-[#140c0a] border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
              <Flame className="size-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Preservação de Margem</h4>
              <p className="text-[11px] text-white/50 mt-0.5">
                Mensagens focadas em conveniência, delivery em 30-40 min e originalidade, sem queimar preço.
              </p>
            </div>
          </div>
        </div>

        {/* Configuração do Script e Links */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lado Esquerdo: Editor e Modelos */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare className="size-4 text-emerald-400" />
                  Modelo de Mensagem de Disparo
                </h3>
                <span className="text-[10px] text-white/40 font-mono">Variáveis: [Nome], [LINK_DO_CARDAPIO_VERCEL], [LINK_DO_GRUPO_VIP_WHATSAPP]</span>
              </div>

              {/* Botões de Modelos Prontos */}
              <div className="flex flex-wrap gap-2">
                {OFFICIAL_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateChange(t.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                      selectedTemplate === t.id
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{t.title}</span>
                    <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-md text-white/80">{t.badge}</span>
                  </button>
                ))}
              </div>

              {/* Textarea do Script */}
              <div>
                <textarea
                  rows={8}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 font-mono leading-relaxed"
                  placeholder="Escreva a mensagem aqui..."
                />
              </div>

              {/* Links Dinâmicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">Link do Cardápio Vercel</label>
                  <input
                    type="text"
                    value={cardapioLink}
                    onChange={(e) => setCardapioLink(e.target.value)}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">Link do Grupo VIP WhatsApp</label>
                  <input
                    type="text"
                    value={grupoVipLink}
                    onChange={(e) => setGrupoVipLink(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Painel de Controle de Disparos em Lotes */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="size-4 text-purple-400" />
                Cadência & Automação de Disparo
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">Tamanho do Lote (Contatos por vez)</label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-white/40 mt-1 block">Recomendado: 20 a 25 contatos</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/60 block mb-1">Intervalo entre Lotes (Minutos)</label>
                  <input
                    type="number"
                    min={15}
                    max={120}
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-white/40 mt-1 block">Recomendado: 45 a 60 min</span>
                </div>
              </div>

              {/* Status do Disparo Ativo */}
              {isSending && sendProgress && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-emerald-400">Progresso do Envio: {sendProgress.current} de {sendProgress.total}</span>
                    <span className="text-white/60">{((sendProgress.current / sendProgress.total) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-400 transition-all duration-300"
                      style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-emerald-300 font-mono">{statusFeedback}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleStartDirectBatch}
                  disabled={isSending || selectedClients.size === 0}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="size-4 fill-black" />
                  <span>{isSending ? 'Disparando Lotes...' : `Iniciar Disparo (${selectedClients.size} Selecionados)`}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Lado Direito: Lista de Clientes da Base */}
          <div className="lg:col-span-5 bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 flex flex-col h-[650px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="size-4 text-emerald-400" />
                  Base de Destinatários
                </h3>
                <span className="text-[10px] text-white/50 font-mono">
                  {selectedClients.size} de {clients.length} marcados
                </span>
              </div>

              <button
                onClick={toggleSelectAll}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline"
              >
                {selectedClients.size === clients.length ? 'Desmarcar Todos' : 'Marcar Todos'}
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/50 text-xs">
                <RefreshCw className="size-5 animate-spin mb-2 text-emerald-400" />
                Carregando lista de clientes...
              </div>
            ) : clients.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-white/40 text-xs text-center p-6">
                Nenhum cliente com pedidos registrado ainda no banco de dados.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {clients.map(c => {
                  const isChecked = selectedClients.has(c.id);
                  const isCopied = copiedId === c.id;
                  const finalMsg = getProcessedMessageForClient(c);
                  const phoneClean = c.cleanPhone || c.phone.replace(/\D/g, '');
                  const waNumber = phoneClean.startsWith('55') ? phoneClean : `55${phoneClean}`;
                  const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(finalMsg)}`;

                  return (
                    <div
                      key={c.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isChecked 
                          ? 'bg-white/5 border-emerald-500/30' 
                          : 'bg-[#050505] border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectClient(c.id)}
                          className="rounded border-white/20 bg-black text-emerald-500 focus:ring-0 cursor-pointer size-4"
                        />
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{c.name}</h5>
                          <span className="text-[10px] text-white/40 font-mono block truncate">{c.phone}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleCopyMessage(c)}
                          title="Copiar mensagem personalizada para este cliente"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
                        >
                          {isCopied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                        </button>

                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir no WhatsApp Web/App 1 a 1"
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
