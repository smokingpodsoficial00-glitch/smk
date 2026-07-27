import { useState, useEffect, useCallback } from "react";
import {
  Bot, QrCode, Smartphone, Wifi, WifiOff, RefreshCw, CheckCircle2,
  AlertTriangle, Send, Sparkles, Sliders, MessageSquare, Power,
  ShieldCheck, ArrowRight, Zap, Copy, Check, Server, Key, Terminal, LogOut
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";
import {
  getEvolutionConfig,
  saveEvolutionConfig,
  fetchInstanceStatus,
  connectInstance,
  createInstance,
  sendTextMessage,
  logoutInstance,
} from "@/lib/evolutionApi";
import type { EvolutionConfig } from "@/lib/evolutionApi";

export function ChatbotPage() {
  const { config } = useStoreConfig();

  // Settings da Evolution API
  const [evolutionConfig, setEvolutionConfig] = useState<EvolutionConfig>(getEvolutionConfig());
  const [apiUrlInput, setApiUrlInput] = useState(evolutionConfig.apiUrl);
  const [apiKeyInput, setApiKeyInput] = useState(evolutionConfig.apiKey);
  const [instanceNameInput, setInstanceNameInput] = useState(evolutionConfig.instanceName);

  // Status Real da Conexão
  const [connectionState, setConnectionState] = useState<"open" | "connecting" | "close" | "offline">("offline");
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>();
  const [realQrBase64, setRealQrBase64] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // IA Settings
  const [aiEnabled, setAiEnabled] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState(
    "Você é a Maya, assistente virtual de vendas especializada em pods descartáveis. Seja educada, ágil, tire dúvidas sobre sabores/puffs e envie o link do nosso catálogo para fechamento do pedido via PIX ou cartão."
  );
  const [greetingMessage, setGreetingMessage] = useState(
    "Olá! 💨 Bem-vindo à nossa loja! Como posso te ajudar a escolher o seu pod ideal hoje?"
  );

  // Chat Simulator & Real Message Test
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>([
    { sender: "bot", text: greetingMessage, time: "14:30" },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [targetNumber, setTargetNumber] = useState("");
  const [sendingReal, setSendingReal] = useState(false);

  const storeName = config?.store_name || "Smoking Pods";

  // Carrega e testa status da instância
  const checkStatus = useCallback(async (cfg = evolutionConfig) => {
    setIsLoadingStatus(true);
    const res = await fetchInstanceStatus(cfg);
    setIsLoadingStatus(false);

    if (res.connected) {
      setConnectionState("open");
      setPhoneNumber(res.phoneNumber);
      setRealQrBase64(null);
      setStatusMessage("Instância conectada e pronta!");
    } else {
      setConnectionState(res.state === "connecting" ? "connecting" : "offline");
      setStatusMessage("Instância desconectada ou aguardando leitura.");
    }
  }, [evolutionConfig]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Salvar alterações da API
  const handleSaveApiSettings = async () => {
    const updated: EvolutionConfig = {
      apiUrl: apiUrlInput.trim(),
      apiKey: apiKeyInput.trim(),
      instanceName: instanceNameInput.trim() || "smoking-pods",
    };
    saveEvolutionConfig(updated);
    setEvolutionConfig(updated);
    setStatusMessage("Configurações da Evolution API salvas!");
    await checkStatus(updated);
  };

  // Buscar QR Code real na API
  const handleFetchQrCode = async () => {
    setIsLoadingStatus(true);
    setStatusMessage("Solicitando QR Code à Evolution API...");
    
    // Tenta criar se necessário
    await createInstance(evolutionConfig);
    const res = await connectInstance(evolutionConfig);
    setIsLoadingStatus(false);

    if (res.connected) {
      setConnectionState("open");
      setRealQrBase64(null);
      setStatusMessage("Instância já está conectada no WhatsApp!");
    } else if (res.base64) {
      setConnectionState("connecting");
      setRealQrBase64(res.base64.startsWith("data:") ? res.base64 : `data:image/png;base64,${res.base64}`);
      setStatusMessage("QR Code recebido! Escaneie pelo WhatsApp.");
    } else if (res.error) {
      setStatusMessage(res.error);
    } else {
      setStatusMessage("Evolution API não retornou QR Code. Verifique URL e API Key.");
    }
  };

  // Desconectar / Logout
  const handleLogout = async () => {
    setIsLoadingStatus(true);
    await logoutInstance(evolutionConfig);
    setConnectionState("offline");
    setRealQrBase64(null);
    setPhoneNumber(undefined);
    setIsLoadingStatus(false);
    setStatusMessage("Sessão desconectada.");
  };

  // Simulador de Envio
  const handleSimulateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userText = inputMessage.trim();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [...prev, { sender: "user", text: userText, time: timeNow }]);
    setInputMessage("");

    setTimeout(() => {
      let botResponse = "Perfeito! Temos várias opções disponíveis a pronta entrega. Dê uma olhada no nosso catálogo digital!";
      const lower = userText.toLowerCase();

      if (lower.includes("sabor") || lower.includes("quais")) {
        botResponse = "Temos sabores como Watermelon Ice, Blueberry Ice, Grape Ice e Mango! Qual é o seu preferido?";
      } else if (lower.includes("preço") || lower.includes("quanto") || lower.includes("valor")) {
        botResponse = "Os nossos pods descartáveis começam a partir de R$ 80,00 com entrega super rápida!";
      } else if (lower.includes("pagamento") || lower.includes("pix")) {
        botResponse = "Aceitamos pagamento via Pix com aprovação instantânea ou cartão de crédito no momento da entrega!";
      } else if (lower.includes("link") || lower.includes("catálogo") || lower.includes("catalogo")) {
        botResponse = `Acesse nosso catálogo completo aqui: ${window.location.origin.replace(":5174", ":5173")}`;
      }

      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: botResponse, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    }, 1000);
  };

  // Enviar Mensagem Real pelo WhatsApp via Evolution API
  const handleSendRealMessage = async () => {
    if (!targetNumber.trim() || !inputMessage.trim()) return;
    setSendingReal(true);
    const res = await sendTextMessage(evolutionConfig, targetNumber, inputMessage);
    setSendingReal(false);

    if (res.success) {
      setStatusMessage(`Mensagem enviada com sucesso para ${targetNumber}!`);
      setInputMessage("");
    } else {
      setStatusMessage(`Erro ao enviar: ${res.message}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-background p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <Bot className="size-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              WhatsApp Evolution API
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                Evolution v1.8/v2.0
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conecte sua instância da Evolution API e gerencie as respostas da IA da loja {storeName}
            </p>
          </div>
        </div>

        {/* Status Card Topo */}
        <div className="flex items-center gap-3 bg-card border border-border p-3 rounded-2xl">
          <div className={`size-3 rounded-full ${
            connectionState === "open"
              ? "bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse"
              : connectionState === "connecting"
              ? "bg-amber-400 animate-ping"
              : "bg-red-400"
          }`} />
          <div className="text-xs">
            <p className="font-semibold text-white">
              {connectionState === "open"
                ? "WhatsApp Conectado"
                : connectionState === "connecting"
                ? "Aguardando Leitura"
                : "Desconectado"}
            </p>
            <p className="text-muted-foreground text-[10px]">
              {phoneNumber ? `+${phoneNumber}` : evolutionConfig.instanceName}
            </p>
          </div>
          <button
            onClick={() => checkStatus()}
            disabled={isLoadingStatus}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
            title="Atualizar Status da API"
          >
            <RefreshCw className={`size-4 ${isLoadingStatus ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-white/40 hover:text-white">✕</button>
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Lado Esquerdo: Configurações da Evolution API & QR Code (5 Colunas) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Seção 1: Configurações do Servidor Evolution API */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Server className="size-4 text-emerald-400" />
              <h2 className="font-bold text-base text-white">Servidor Evolution API</h2>
            </div>

            <div className="space-y-4">
              {/* URL da API */}
              <div className="space-y-1.5">
                <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <Server className="size-3 text-emerald-400" />
                  URL da Evolution API
                </label>
                <input
                  type="text"
                  value={apiUrlInput}
                  onChange={(e) => setApiUrlInput(e.target.value)}
                  placeholder="http://localhost:8080 ou https://api.seu-servidor.com"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
              </div>

              {/* API Key Global */}
              <div className="space-y-1.5">
                <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <Key className="size-3 text-amber-400" />
                  API Key Global
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Sua Global API Key da Evolution API"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>

              {/* Nome da Instância */}
              <div className="space-y-1.5">
                <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <Terminal className="size-3 text-blue-400" />
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={instanceNameInput}
                  onChange={(e) => setInstanceNameInput(e.target.value)}
                  placeholder="smoking-pods"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>

              <button
                onClick={handleSaveApiSettings}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                Salvar & Testar Conexão da API
              </button>
            </div>
          </section>

          {/* Seção 2: QR Code da Instância */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">QR Code do WhatsApp</h2>
              </div>
              <button
                onClick={handleFetchQrCode}
                disabled={isLoadingStatus}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-semibold text-xs cursor-pointer transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`size-3.5 ${isLoadingStatus ? "animate-spin" : ""}`} />
                Buscar QR Code Real
              </button>
            </div>

            {/* Display do QR Code */}
            <div className="flex flex-col items-center justify-center p-6 bg-[#0a0a0a] border border-white/10 rounded-2xl relative overflow-hidden">
              {connectionState === "open" ? (
                <div className="py-6 flex flex-col items-center text-center gap-3">
                  <div className="size-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">WhatsApp Conectado!</h3>
                    <p className="text-xs text-muted-foreground max-w-xs mt-1">
                      A instância <strong>{evolutionConfig.instanceName}</strong> na Evolution API está pronta para disparos e respostas.
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="size-3.5" />
                    Desconectar WhatsApp
                  </button>
                </div>
              ) : realQrBase64 ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={realQrBase64}
                    alt="QR Code Evolution API"
                    className="size-56 object-contain rounded-xl p-2 bg-white border-4 border-white shadow-2xl"
                  />
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider animate-pulse">
                    🟢 QR Code Real Carregado da Evolution API
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
                  <QrCode className="size-12 opacity-30" />
                  <p className="text-xs font-semibold text-white/80">Nenhum QR Code ativo no momento</p>
                  <p className="text-[10px] max-w-xs">
                    Clique no botão <strong>"Buscar QR Code Real"</strong> para solicitar a imagem de pareamento ao seu servidor Evolution API.
                  </p>
                </div>
              )}
            </div>

            {/* Passo a Passo */}
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <span className="flex items-center justify-center size-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[9px]">1</span>
                <span className="text-white/80">Abra o WhatsApp no celular e acesse <strong>Dispositivos Conectados</strong></span>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <span className="flex items-center justify-center size-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[9px]">2</span>
                <span className="text-white/80">Aponte a câmera para o QR Code acima para vincular com a Evolution API</span>
              </div>
            </div>
          </section>
        </div>

        {/* Lado Direito: IA & Teste de Disparo (7 Colunas) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Configurações da IA */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">Agente de IA & Atendimento</h2>
              </div>
              
              <button
                onClick={() => setAiEnabled(!aiEnabled)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  aiEnabled
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-muted-foreground border border-white/10"
                }`}
              >
                <Power className="size-3.5" />
                {aiEnabled ? "IA Ativada" : "IA Pausada"}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center justify-between">
                <span>Personalidade & Regras do Atendente Virtual</span>
                <span className="text-[10px] text-emerald-400 lowercase">Prompt Evolution IA</span>
              </label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 resize-none font-sans"
              />
            </div>
          </section>

          {/* Envio de Mensagem Real via Evolution API */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Send className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">Teste de Disparo Real de Mensagem</h2>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-full font-semibold">
                Evolution REST API
              </span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                  Número de Destino (com DDD)
                </label>
                <input
                  type="text"
                  value={targetNumber}
                  onChange={(e) => setTargetNumber(e.target.value)}
                  placeholder="Ex: 5511999999999"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                  Mensagem de Teste
                </label>
                <textarea
                  rows={2}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Digite a mensagem que deseja enviar via Evolution API..."
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 resize-none font-sans"
                />
              </div>

              <button
                onClick={handleSendRealMessage}
                disabled={sendingReal || !targetNumber.trim() || !inputMessage.trim()}
                className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  sendingReal || !targetNumber.trim() || !inputMessage.trim()
                    ? "bg-white/5 text-white/30 cursor-not-allowed"
                    : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                }`}
              >
                <Send className="size-4" />
                {sendingReal ? "Enviando pelo WhatsApp..." : "Disparar Mensagem Real via Evolution API"}
              </button>
            </div>
          </section>

          {/* Simulador de Respostas em Tela */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">Simulador Local do Atendimento</h2>
              </div>
            </div>

            <div className="h-48 bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 overflow-y-auto space-y-3 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                      msg.sender === "user"
                        ? "bg-emerald-500 text-black font-semibold rounded-br-none"
                        : "bg-white/10 text-white border border-white/10 rounded-bl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-muted-foreground px-1 mt-1">{msg.time}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}
