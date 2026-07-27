import { useState, useEffect, useRef } from "react";
import {
  Bot, QrCode, RefreshCw, CheckCircle2,
  Send, Sparkles, MessageSquare, Power,
  Clock, Shield, HeartHandshake, FileText, Check, Copy
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";

const DEFINITIVE_SYSTEM_PROMPT = `SCRIPT DEFINITIVO — IA SMOKING PODS (Eloisa)

REGRAS GLOBAIS (INQUEBRÁVEIS)
RG1 — Sem emojis (Apenas mensagens programadas contendo emojis)
RG2 — Máximo 2 linhas por mensagem
RG3 — Sem exclamações ("!")
RG4 — Erros de vírgula propositais para parecer humana (ex: "Olá tudo bem, como posso te ajudar?")
RG5 — Fracionamento de mensagens (envia msg1, msg2 em sequência com delay)
RG6 — Respostas programadas são lei (usar exatamente como escritas)
RG7 — Respostas não-programadas (sem emoji, sem "!", max 2 linhas, minúsculo)
RG8 — Tudo em minúsculo (exceto primeira letra do primeiro contato)
RG9 — Tratamento: "você" / "vc" (nunca "tu")
RG10 — Gírias autorizadas: blz, show, vc, amg
RG11 — Abreviações: vc, pra, td, msg
RG12 — Sem negrito, itálico ou listas
RG13 — Sem promoções espontâneas
RG14 — Somente produtos próprios do estoque
RG15 — Assuntos proibidos: política, religião, concorrentes
RG16 — Retomar fluxo de vendas se fizer pergunta avulsa
RG17 — Nome: Eloisa, assistente virtual da Smoking Pods (não se apresenta espontaneamente)
RG18 — Se perguntarem se é robô: fala a verdade que é a Eloisa assistente virtual

SAUDAÇÕES POR HORÁRIO:
06:00–11:59 → bom dia
12:00–17:59 → boa tarde
18:00–05:59 → boa noite

LINK DO CARDÁPIO:
https://smokingproject01.vercel.app/

TABELA DE DURAÇÃO PUFFS:
5.000 puffs → 10 dias
7.500 puffs → 12 dias
10.000 puffs → 14 dias
15.000 puffs → 17 dias
20.000 puffs → 21 dias
30.000 puffs → 35 dias`;

export function ChatbotPage() {
  const { config } = useStoreConfig();
  const [isConnected, setIsConnected] = useState(false);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrCodeVersion, setQrCodeVersion] = useState(1);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Form de personalidade da IA (Eloisa)
  const [systemPrompt, setSystemPrompt] = useState(DEFINITIVE_SYSTEM_PROMPT);
  const [isTyping, setIsTyping] = useState(false);

  // Chat Simulator State
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>([
    { sender: "bot", text: "Olá tudo bem, como posso te ajudar?", time: "14:30" },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const storeName = config?.store_name || "Smoking Pods";
  const catalogUrl = "https://smokingproject01.vercel.app/";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Função para retornar saudação de acordo com o horário real
  const getGreetingByHour = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "bom dia";
    if (hour >= 12 && hour < 18) return "boa tarde";
    return "boa noite";
  };

  // Processador de respostas de Eloisa
  const getEloisaResponses = (text: string): string[] => {
    const lower = text.toLowerCase();
    const greeting = getGreetingByHour();

    // P1 / P2 / P3 - Saudação genérica
    if (lower === "oi" || lower === "ola" || lower === "olá" || lower.includes("boa noite") || lower.includes("bom dia") || lower.includes("boa tarde")) {
      return ["Olá tudo bem, como posso te ajudar?"];
    }

    // P4 / Tabela / Cardápio
    if (lower.includes("cardapio") || lower.includes("cardápio") || lower.includes("tabela") || lower.includes("catálogo") || lower.includes("catalogo") || lower.includes("link") || lower.includes("tem pod") || lower.includes("comprar")) {
      return [
        "claro, vou te enviar a tabela aqui",
        catalogUrl,
        "se precisar de ajuda com algo só me avisar"
      ];
    }

    // P45 - Origem
    if (lower.includes("de onde") || lower.includes("onde fica") || lower.includes("localizacao") || lower.includes("localização")) {
      return ["somos aqui de sbc amg"];
    }

    // P46 - Horário
    if (lower.includes("horario") || lower.includes("horário") || lower.includes("funciona")) {
      return ["nosso horário de funcionamento é das 11:00 até as 23hrs"];
    }

    // P47 - Originalidade
    if (lower.includes("original")) {
      return ["sim, só trabalhamos com produtos 100% originais!"];
    }

    // P48 - Garantia
    if (lower.includes("garantia")) {
      return [
        "sim, temos garantia para produtos que podem ir com defeito",
        "porém para á garantia valer, você tem de gravar um vídeo abrindo o produto e testando, para termos certeza de que o produto veio dá nossa loja"
      ];
    }

    // P49 - Puffs / Duração
    if (lower.includes("puffs") || lower.includes("dura") || lower.includes("quanto tempo")) {
      if (lower.includes("5000") || lower.includes("5.000")) {
        return ["olha o de 5.000 puffs geralmente dura uns 10 dias, porém depende do uso"];
      }
      if (lower.includes("7500") || lower.includes("7.500")) {
        return ["olha o de 7.500 puffs geralmente dura uns 12 dias, porém depende do uso"];
      }
      if (lower.includes("15000") || lower.includes("15.000")) {
        return ["olha o de 15.000 puffs geralmente dura uns 17 dias, porém depende do uso"];
      }
      if (lower.includes("20000") || lower.includes("20.000")) {
        return ["olha o de 20.000 puffs geralmente dura uns 21 dias, porém depende do uso"];
      }
      if (lower.includes("30000") || lower.includes("30.000")) {
        return ["olha o de 30.000 puffs geralmente dura uns 35 dias, porém depende do uso"];
      }
      return ["olha o de 10.000 puffs geralmente dura uns 14 dias, porém depende do uso"];
    }

    // P50 - Recomendação de Sabor (Doce vs Gelado)
    if (lower.includes("sabor") || lower.includes("recomenda") || lower.includes("indica") || lower.includes("qual o melhor")) {
      if (lower.includes("gelado") || lower.includes("ice") || lower.includes("menta")) {
        return ["olha se vc gosta mais de pod gelado eu recomendaria o menta ou watermelon ice"];
      }
      if (lower.includes("doce") || lower.includes("fruta")) {
        return ["olha se vc gosta mais de pod doce eu recomendaria o morango ou uva"];
      }
      return ["vc gosta de pod mais gelado ou mais doce?"];
    }

    // P20 - Desconto / Promoção
    if (lower.includes("desconto") || lower.includes("promoção") || lower.includes("promocao") || lower.includes("mais barato")) {
      return [
        "temos desconto sim!",
        "se levar 3 unidades consigo frete grátis, oque acha?"
      ];
    }

    // P23 / P28 - Pagamento
    if (lower.includes("pagamento") || lower.includes("pix") || lower.includes("cartao") || lower.includes("cartão")) {
      return [
        "nossas opções de pagamento são pix, e link de pagamento",
        "no link de pagamento dá pra passar cartão de crédito e débito, também parcelamos, porém as taxas são repassadas beleza?"
      ];
    }

    // P17 / P18 - Preços
    if (lower.includes("quanto custa") || lower.includes("preco") || lower.includes("preço") || lower.includes("valor")) {
      return [
        `${greeting}, tudo bem?`,
        "qual modelo exato vc tá procurando?",
        `caso queira ver todos os valores, temos nossa tabela: ${catalogUrl}`
      ];
    }

    // RG18 - Se perguntar se é robô
    if (lower.includes("robo") || lower.includes("robô") || lower.includes("ia") || lower.includes("humano")) {
      return ["sou a eloisa, assistente virtual da smoking pods, tô aqui pra te ajudar com tudo que precisar!"];
    }

    // Resposta Padrão de Fluxo
    return [
      "perfeito, vou te enviar nossa tabela digital pra vc dar uma olhada com calma",
      catalogUrl
    ];
  };

  const handleSimulateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isTyping) return;

    const userText = inputMessage.trim();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [...prev, { sender: "user", text: userText, time: timeNow }]);
    setInputMessage("");
    setIsTyping(true);

    const botResponses = getEloisaResponses(userText);

    // Envia respostas sequencialmente simulando fracionamento de mensagens do WhatsApp (RG5)
    botResponses.forEach((respText, index) => {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: respText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
        ]);
        if (index === botResponses.length - 1) {
          setIsTyping(false);
        }
      }, (index + 1) * 1200);
    });
  };

  const handleGenerateNewQr = () => {
    setIsQrLoading(true);
    setTimeout(() => {
      setQrCodeVersion((prev) => prev + 1);
      setIsQrLoading(false);
    }, 800);
  };

  const handleToggleConnection = () => {
    setIsConnected(!isConnected);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(systemPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-background p-6 space-y-8">
      {/* Header com Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <Bot className="size-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              WhatsApp IA — Eloisa
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                Script Definitivo v3.0
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Atendente virtual oficial da loja {storeName} (Sem emojis, respostas programadas, fracionadas)
            </p>
          </div>
        </div>

        {/* Status Card Topo */}
        <div className="flex items-center gap-3 bg-card border border-border p-3 rounded-2xl">
          <div className={`size-3 rounded-full animate-pulse ${isConnected ? "bg-emerald-400 shadow-[0_0_10px_#10b981]" : "bg-amber-400"}`} />
          <div className="text-xs">
            <p className="font-semibold text-white">
              {isConnected ? "Eloisa Conectada" : "Aguardando Leitura do QR Code"}
            </p>
            <p className="text-muted-foreground text-[10px]">
              {isConnected ? "Sessão Ativa no WhatsApp" : "Escaneie o código para conectar"}
            </p>
          </div>
          <button
            onClick={handleToggleConnection}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              isConnected
                ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {isConnected ? "Desconectar" : "Conectar Eloisa"}
          </button>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Lado Esquerdo: Pareamento QR Code & Instruções (5 Colunas) */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">Conectar WhatsApp</h2>
              </div>
              <button
                onClick={handleGenerateNewQr}
                disabled={isQrLoading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                title="Atualizar QR Code"
              >
                <RefreshCw className={`size-4 ${isQrLoading ? "animate-spin text-emerald-400" : ""}`} />
              </button>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 bg-[#0a0a0a] border border-white/10 rounded-2xl relative overflow-hidden group">
              {isConnected ? (
                <div className="py-8 flex flex-col items-center text-center gap-3">
                  <div className="size-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Eloisa Ativa!</h3>
                    <p className="text-xs text-muted-foreground max-w-xs mt-1">
                      O número está vinculado ao WhatsApp e responderá mensagens seguindo o script de vendas.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* SVG QR Code */}
                  <div className="relative p-4 bg-white rounded-xl shadow-2xl border-4 border-white transition-all duration-300">
                    <svg viewBox="0 0 100 100" className="size-48 sm:size-56">
                      <path d="M 0 0 H 30 V 30 H 0 Z M 10 10 H 20 V 20 H 10 Z" fill="#000" />
                      <path d="M 70 0 H 100 V 30 H 70 Z M 80 10 H 90 V 20 H 80 Z" fill="#000" />
                      <path d="M 0 70 H 30 V 100 H 0 Z M 10 80 H 20 V 90 H 10 Z" fill="#000" />
                      <rect x="40" y="10" width="10" height="20" fill="#000" />
                      <rect x="50" y="40" width="20" height="10" fill="#000" />
                      <rect x="10" y="40" width="10" height="20" fill="#000" />
                      <rect x="80" y="50" width="10" height="30" fill="#000" />
                      <rect x="40" y="70" width="20" height="20" fill="#000" />
                      <rect x="70" y="80" width="20" height="10" fill="#000" />
                      <rect x="30" y="30" width="15" height="15" fill={qrCodeVersion % 2 === 0 ? "#10b981" : "#000"} />
                    </svg>
                    
                    {/* Badge Central */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="p-2 rounded-xl bg-black border border-white/20 shadow-xl">
                        <Bot className="size-5 text-emerald-400" />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center mt-4">
                    QR Code v{qrCodeVersion} • Validade renovada a cada 45s
                  </p>
                </>
              )}
            </div>

            {/* Passo a Passo */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Como vincular:</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="flex items-center justify-center size-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">1</span>
                  <span className="text-white/80">Abra o <strong>WhatsApp</strong> no celular</span>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="flex items-center justify-center size-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">2</span>
                  <span className="text-white/80">Acesse <strong>Dispositivos Conectados</strong></span>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="flex items-center justify-center size-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">3</span>
                  <span className="text-white/80">Escaneie o QR Code para conectar a Eloisa ao WhatsApp da loja</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Lado Direito: Script Definitivo da Eloisa & Simulador (7 Colunas) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Configurações do System Prompt */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">System Prompt — Eloisa (Script Oficial)</h2>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPrompt}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedPrompt ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  {copiedPrompt ? "Copiado!" : "Copiar Script"}
                </button>
                <button
                  onClick={() => setAiEnabled(!aiEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    aiEnabled
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/5 text-muted-foreground border border-white/10"
                  }`}
                >
                  <Power className="size-3.5" />
                  {aiEnabled ? "Ativa" : "Pausada"}
                </button>
              </div>
            </div>

            {/* Prompt Textarea */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center justify-between">
                <span>Regras e Respostas Programadas (OpenAI Prompt)</span>
                <span className="text-[10px] text-emerald-400 lowercase">Eloisa Vendas</span>
              </label>
              <textarea
                rows={6}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 resize-none font-mono custom-scrollbar"
              />
            </div>
          </section>

          {/* Simulador de Atendimento da Eloisa */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">Simulador de Conversa (Testar Eloisa)</h2>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-full font-semibold">
                Testes em Tempo Real
              </span>
            </div>

            {/* Chat Box */}
            <div className="h-64 bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 overflow-y-auto space-y-3 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                      msg.sender === "user"
                        ? "bg-emerald-500 text-black font-semibold rounded-br-none"
                        : "bg-white/10 text-white border border-white/10 rounded-bl-none font-normal"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-muted-foreground px-1 mt-1">{msg.time}</span>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl w-fit">
                  <span className="animate-pulse">Eloisa está digitando...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Form de Envio no Simulador */}
            <form onSubmit={handleSimulateSend} className="flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Envie uma mensagem de teste (ex: tem pod? quantos puffs dura?)..."
                className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="submit"
                disabled={isTyping}
                className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </form>
          </section>

        </div>

      </div>
    </div>
  );
}
