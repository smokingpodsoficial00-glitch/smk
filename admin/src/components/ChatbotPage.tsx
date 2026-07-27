import { useState, useEffect } from "react";
import {
  Bot, QrCode, Smartphone, Wifi, WifiOff, RefreshCw, CheckCircle2,
  AlertTriangle, Send, Sparkles, Sliders, MessageSquare, Power,
  ShieldCheck, ArrowRight, Zap, Copy, Check
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";

export function ChatbotPage() {
  const { config } = useStoreConfig();
  const [isConnected, setIsConnected] = useState(false);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrCodeVersion, setQrCodeVersion] = useState(1);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form de personalidade da IA
  const [systemPrompt, setSystemPrompt] = useState(
    "Você é a Maya, assistente virtual de vendas especializada em pods descartáveis. Seja educada, ágil, tire dúvidas sobre sabores/puffs e envie o link do nosso catálogo para fechamento do pedido via PIX ou cartão."
  );
  const [greetingMessage, setGreetingMessage] = useState(
    "Olá! 💨 Bem-vindo à nossa loja! Como posso te ajudar a escolher o seu pod ideal hoje?"
  );

  // Chat Simulator State
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>([
    { sender: "bot", text: greetingMessage, time: "14:30" },
  ]);
  const [inputMessage, setInputMessage] = useState("");

  const storeName = config?.store_name || "Smoking Pods";

  const handleSimulateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userText = inputMessage.trim();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setMessages((prev) => [...prev, { sender: "user", text: userText, time: timeNow }]);
    setInputMessage("");

    // Simulação da resposta da IA
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

  const handleGenerateNewQr = () => {
    setIsQrLoading(true);
    setTimeout(() => {
      setQrCodeVersion((prev) => prev + 1);
      setIsQrLoading(false);
    }, 800);
  };

  const handleSimulateConnection = () => {
    setIsConnected(!isConnected);
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
              WhatsApp IA & Chatbot
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                v2.4 Online
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conecte seu WhatsApp via QR Code e automatize os atendimentos da loja {storeName}
            </p>
          </div>
        </div>

        {/* Status Card Topo */}
        <div className="flex items-center gap-3 bg-card border border-border p-3 rounded-2xl">
          <div className={`size-3 rounded-full animate-pulse ${isConnected ? "bg-emerald-400 shadow-[0_0_10px_#10b981]" : "bg-amber-400"}`} />
          <div className="text-xs">
            <p className="font-semibold text-white">
              {isConnected ? "WhatsApp Conectado" : "Aguardando Leitura do QR Code"}
            </p>
            <p className="text-muted-foreground text-[10px]">
              {isConnected ? "+55 11 97730-0561" : "Escaneie o código abaixo para conectar"}
            </p>
          </div>
          <button
            onClick={handleSimulateConnection}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              isConnected
                ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {isConnected ? "Desconectar" : "Simular Conexão"}
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
                    <h3 className="text-lg font-bold text-white">WhatsApp Ativo!</h3>
                    <p className="text-xs text-muted-foreground max-w-xs mt-1">
                      O seu número está conectado e pronto para responder mensagens automaticamente com a IA.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* SVG / Imagem de QR Code Dinâmico Simulado */}
                  <div className="relative p-4 bg-white rounded-xl shadow-2xl border-4 border-white transition-all duration-300">
                    <svg viewBox="0 0 100 100" className="size-48 sm:size-56">
                      {/* Simulação de padrões de QR code */}
                      <path d="M 0 0 H 30 V 30 H 0 Z M 10 10 H 20 V 20 H 10 Z" fill="#000" />
                      <path d="M 70 0 H 100 V 30 H 70 Z M 80 10 H 90 V 20 H 80 Z" fill="#000" />
                      <path d="M 0 70 H 30 V 100 H 0 Z M 10 80 H 20 V 90 H 10 Z" fill="#000" />
                      {/* Pontos randômicos baseados na versão */}
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
                    QR Code v{qrCodeVersion} • Atualiza a cada 45s para segurança
                  </p>
                </>
              )}
            </div>

            {/* Passo a Passo de Instruções */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Como conectar:</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="flex items-center justify-center size-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">1</span>
                  <span className="text-white/80">Abra o <strong>WhatsApp</strong> no seu celular</span>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="flex items-center justify-center size-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">2</span>
                  <span className="text-white/80">Toque em <strong>Menu (•••)</strong> ou <strong>Configurações</strong> e selecione <strong>Dispositivos Conectados</strong></span>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="flex items-center justify-center size-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">3</span>
                  <span className="text-white/80">Toque em <strong>Conectar um dispositivo</strong> e aponte a câmera para o QR Code acima</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Lado Direito: Personalidade da IA & Simulador ao Vivo (7 Colunas) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Configurações da IA */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">Agente de IA & Atendimento</h2>
              </div>
              
              {/* Toggle IA ON/OFF */}
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

            {/* Prompt de Comportamento */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center justify-between">
                <span>Personalidade & Instruções da IA</span>
                <span className="text-[10px] text-emerald-400 lowercase">Prompt do Sistema</span>
              </label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Defina o tom de voz da IA, regras de desconto, frete e saudações..."
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 resize-none font-sans"
              />
            </div>

            {/* Mensagem de Saudação */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                Mensagem Inicial (Saudação)
              </label>
              <input
                type="text"
                value={greetingMessage}
                onChange={(e) => setGreetingMessage(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </section>

          {/* Simulador de Atendimento ao Vivo */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">Testar Respostas da IA (Simulador)</h2>
              </div>
              <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded-full text-muted-foreground">
                Ambiente de Testes
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
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs ${
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

            {/* Form de Envio no Simulador */}
            <form onSubmit={handleSimulateSend} className="flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Digite como se fosse um cliente (ex: quais sabores tem?)..."
                className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="submit"
                className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
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
