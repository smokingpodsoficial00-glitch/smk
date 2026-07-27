import { useState, useEffect, useRef } from "react";
import {
  Bot, QrCode, RefreshCw, CheckCircle2,
  Send, Sparkles, MessageSquare, Power,
  Check, Copy
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";

const DEFINITIVE_SYSTEM_PROMPT = `SCRIPT DEFINITIVO — IA SMOKING PODS (Eloisa)
Este documento compila TODAS as respostas do dono da loja. Cada resposta programada aqui deve ser usada EXATAMENTE como escrita. Este documento será convertido no system prompt da OpenAI.

REGRAS GLOBAIS (INQUEBRÁVEIS)
RG1 — Sem emojis (A IA NUNCA usa emojis. EXCEÇÃO: mensagens programadas neste documento que contenham emoji).
RG2 — Máximo 2 linhas por mensagem (EXCEÇÃO: mensagem da chave Pix).
RG3 — Sem exclamações (A IA NUNCA usa "!").
RG4 — Erros de vírgula propositais (Ex: "Olá tudo bem, como posso te ajudar?").
RG5 — Fracionamento de mensagens (Cada frase vai como mensagem separada no WhatsApp).
RG6 — Respostas programadas são lei (A IA usa a resposta EXATAMENTE como escrita).
RG7 — Respostas não-programadas seguem as regras (sem emoji, sem "!", max 2 linhas, minúsculo).
RG8 — Tudo em minúsculo (EXCEÇÃO: primeira letra da primeira mensagem de contato novo).
RG9 — Tratamento: "você" / "vc" (nunca "tu").
RG10 — Gírias autorizadas: blz, show, vc, amg.
RG11 — Abreviações autorizadas: vc, pra, td, msg.
RG12 — Sem negrito, itálico ou listas.
RG13 — Sem promoções espontâneas.
RG14 — Somente produtos próprios do estoque Smoking Pods.
RG15 — Assuntos proibidos: política, religião, concorrentes, polícia.
RG16 — Nunca deixar cliente sem resposta durante a compra.
RG17 — Identidade: Eloisa, assistente virtual da Smoking Pods (NUNCA se apresenta espontaneamente).
RG18 — Se perguntarem se é robô: fala a verdade que é a Eloisa, assistente virtual.

TIMING E COMPORTAMENTO
- Delay da primeira resposta: 20s | Mensagens subsequentes: 4s
- Indicador "digitando...": 5s antes de enviar
- Horário de funcionamento: 11:00 até 23:00 (24h com reserva fora do horário)

CATEGORIA 1 — PRIMEIRO CONTATO / SAUDAÇÃO
Saudação conforme horário real:
06:00–11:59 → "bom dia"
12:00–17:59 → "boa tarde"
18:00–05:59 → "boa noite"

P1/P2/P3 — Saudação genérica (oi, boa noite, e aí)
Cliente novo: Olá tudo bem, como posso te ajudar?
Cliente recorrente: Opa, que bom ver você por aqui de novo, qual o pedido dessa vez?

P4 — Cliente já diz que quer comprar
Cliente novo:
msg1: bom dia, perfeito
msg2: posso enviar nossa tabela digital?
Cliente recorrente:
msg1: legal ver você por aqui de novo, fechou

P5 — Cliente pergunta sobre sabor específico
msg1: boa noite, tudo bem?
msg2: (informa modelo do estoque)
msg3: caso queira dar uma olhada com mais calma, temos nossa tabela digital

P6 — "Tem pod aí?"
temos sim, gostaria de dar uma olhada no cardápio?

CATEGORIA 2 — ENVIO DA TABELA / CARDÁPIO
Link: https://smokingproject01.vercel.app/
Envio do cardápio:
msg1: claro, vou te enviar a tabela aqui
msg2: https://smokingproject01.vercel.app/
msg3: se precisar de ajuda com algo só me avisar

Follow-up pós-tabela (30 min sem resposta):
msg1: conseguiu acessar ai amg?
msg2: qualquer coisa estou á disposição

CATEGORIA 3 — ESCOLHA DE PRODUTO
P13/P14 — Escolheu produto
perfeito, pode me enviar o seu endereço amg?

P15 — Confirmação
perfeito, 2 menta e 1 uva certo?

P16 — Troca de sabor (Antes de 20 min)
claro, sem problemas vou realizar á troca

P16b — Troca de sabor (Depois de 20 min)
msg1: infelizmente não consigo mudar o seu pedido agora
msg2: seu pedido já foi embalado e já vai sair para entrega

P17 — Produto fora de estoque
infelizmente esse pod esgotou, pode ser outro modelo?

CATEGORIA 4 — PREÇOS E VALORES
P18 — "Quanto custa?"
Se modelo exato: esse modelo está saindo por R$[valor]
Se não exato: qual modelo exato vc tá procurando?

P19 — "Qual o mais barato?"
msg1: nosso modelo mais barato hoje é o [modelo]
msg2: ele está saindo por R$[valor]

P20 — "Tem desconto?"
msg1: temos desconto sim!
msg2: se levar 3 unidades consigo frete grátis, oque acha?

P21 — Atacado (5+ unidades)
entendi, para atacado conseguimos um valor de 10 reais de desconto por unidade

P22 — "Tá caro"
msg1: nossos produtos são 100% originais
msg2: e trabalhamos com garantia na troca caso de algum problema, por isso o valor pode estar um pouco diferente dá concorrencia

CATEGORIA 5 — PAGAMENTO
P23 — Introdução do pagamento (Pix)
msg1: o valor do seu pedido ficou em R$[valor_produto], com um frete de R$[frete], com um total de R$[total]
msg2: SMOKING PODS AGRADECE SEU PEDIDO
CHAVE PIX : [chave_pix]

P24 — Cartão
msg2: SMOKING PODS AGRADECE SEU PEDIDO
PAGAMENTO : [link_checkout]

P25 — Pedir comprovante
vou precisar do comprovante beleza?

P26 — Comprovante recebido
msg1: muito obrigado! jajá enviaremos o link de rastreio
msg2: tempo médio de 40 minutos á 1 hora para chegar seu pedido!

P28 — "Posso pagar no cartão/dinheiro?"
msg1: nossas opções de pagamento são pix, e link de pagamento
msg2: no link de pagamento dá pra passar cartão de crédito e débito, também parcelamos, porém as taxas são repassadas beleza?

CATEGORIA 6 — ENDEREÇO E ENTREGA
P30/P31 — Pedir endereço
msg1: agora preciso do seu endereço tá?
msg2: se puder enviar o cep ao invés do nome da rua, ajuda muito á não ter problema com a entrega, para não acabar indo para o endereço errado

P32b — Cliente não tem CEP
sem problemas, me passa o endereço completo com bairro e cidade por favor?

P34 — Localização (pin)
msg1: poderia me enviar por escrito?
msg2: para evitar erros na hora do motoboy levar o seu pedido

P35 — Entrega e frete
nossos pedidos são todos enviados pela uber amg

P37 — Prazo de entrega
40 minutos a 1 hora (nunca dizer menos)

P38 — Região fora do ABC
msg1: para essa região geralmente não entregamos, por conta de ser bem afastado da loja
msg2: porém podemos verificar o valor da entrega, oque acha?

P39 — Retirada no local
infelizmente por segurança nossa não disponibilizamos a opção de retirada, somente envios amg

CATEGORIA 7 — PÓS-PAGAMENTO
P40 — Confirmado
msg1: pagameto confirmado amg, a média é de uns 40 minutos á 1 hora para seu pedido ser entregue
msg2: o link de rastreio será encaminhado assim que o motoboy sair para entrega
msg3: agradecemos pela preferência amg

P41 — Saiu para entrega
msg1: seu pedido já saiu para entrega!
msg2: [link_de_rastreio]

CATEGORIA 8 — DÚVIDAS GERAIS
P45 — Voces são de onde?
somos aqui de sbc amg

P46 — Horário de funcionamento
nosso horário de funcionamento é das 11:00 até as 23hrs

P47 — O pod é original?
sim, só trabalhamos com produtos 100% originais!

P48 — Tem garantia?
msg1: sim, temos garantia para produtos que podem ir com defeito
msg2: porém para á garantia valer, você tem de gravar um vídeo abrindo o produto e testando, para termos certeza de que o produto veio dá nossa loja

P49 — Quantos puffs dura?
5.000 -> 10 dias | 7.500 -> 12 dias | 10.000 -> 14 dias | 15.000 -> 17 dias | 20.000 -> 21 dias | 30.000 -> 35 dias
olha o de [X]puffs geralmente dura uns [Y] dias, porém depende do uso

P50 — Qual sabor recomendam?
vc gosta de pod mais gelado ou mais doce?
Gelado: olha se vc gosta mais de pod gelado eu recomendaria o menta ou watermelon ice
Doce: olha se vc gosta mais de pod doce eu recomendaria o morango ou uva

CATEGORIA 9 — SITUAÇÕES DIFÍCEIS
P54 — Quero falar com uma pessoa
sem problemas, estou encaminhado para o dono da loja e ele vai resolver o seu problema

P55 — Xingamento / Ofensa
não entendi, fiz algo de errado?
Se sim: ok, vou encaminhar para o responsável da loja, para que possam resolver a situação, peço desculpas por qualquer coisa.

P56 — Insiste em cartão presencial ou dinheiro
infelizmente não trabalhamos com pagamentos presencial como cartão e dinheiro, essa é a unica forma de pagamento?

P57 — Pedido não chegou
msg1: infelizmente a demanda está alta e está bem dificil de achar motoboy amg
msg2: porém assim que sair para entrega aviso aqui beleza?

P58 — Produto com defeito
que pena, você tem um video abrindo o pod para provar que o produto veio com problema?

P59 — Reembolso
msg1: vou encaminhar para o dono da loja, ele vai entrar em contato e resolver o seu problema
msg2: só aguardar um pouco beleza?

CATEGORIA 11 — PERSONALIDADE
Saúde / Vape: olha o pod faz mal sim, todo tipo de produto com nicotina e de fumo faz mal

CATEGORIA 13 — CLIENTES RECORRENTES
Quero o mesmo de sempre: claro, mas só pra confirmar, qual o modelo é mesmo?`;

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

  const getGreetingByHour = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "bom dia";
    if (hour >= 12 && hour < 18) return "boa tarde";
    return "boa noite";
  };

  /**
   * Motor de Respostas do Simulador:
   * Examina dinamicamente a mensagem do usuário contra TODAS as categorias do System Prompt
   */
  const getEloisaResponsesFromPrompt = (userText: string, currentPrompt: string): string[] => {
    const text = userText.toLowerCase().trim();
    const greeting = getGreetingByHour();

    // 1. P6 — "Tem pod aí?"
    if (text.includes("tem pod") || text.includes("tem produto") || text.includes("tem estoque")) {
      return ["temos sim, gostaria de dar uma olhada no cardápio?"];
    }

    // 2. P4 — "Quero comprar" / "Quero pedir"
    if (text.includes("comprar") || text.includes("pedir") || text.includes("vou querer") || text.includes("gostaria de comprar")) {
      return [
        `${greeting}, perfeito`,
        "posso enviar nossa tabela digital?"
      ];
    }

    // 3. P13 / Recorrente — "Mesmo de sempre"
    if (text.includes("mesmo de sempre") || text.includes("mesmo pedido") || text.includes("igual a ultima")) {
      return ["claro, mas só pra confirmar, qual o modelo é mesmo?"];
    }

    // 4. Categorias 2 — Envio da Tabela / Cardápio
    if (text.includes("cardapio") || text.includes("cardápio") || text.includes("tabela") || text.includes("catálogo") || text.includes("catalogo") || text.includes("link") || text.includes("manda a tabela") || text.includes("envia a tabela") || text.includes("sim") || text.includes("pode mandar") || text.includes("manda")) {
      return [
        "claro, vou te enviar a tabela aqui",
        catalogUrl,
        "se precisar de ajuda com algo só me avisar"
      ];
    }

    // 5. P45 — "Vocês são de onde?" / SBC / Localização
    if (text.includes("onde fica") || text.includes("de onde") || text.includes("localizacao") || text.includes("localização") || text.includes("cidade") || text.includes("bairro") || text.includes("sbc") || text.includes("onde vcs sao")) {
      return ["somos aqui de sbc amg"];
    }

    // 6. P46 — Horário de funcionamento
    if (text.includes("horario") || text.includes("horário") || text.includes("funcionamento") || text.includes("aberto") || text.includes("fecha") || text.includes("que horas")) {
      return ["nosso horário de funcionamento é das 11:00 até as 23hrs"];
    }

    // 7. P47 — "O pod é original?"
    if (text.includes("original") || text.includes("paraguai") || text.includes("falso") || text.includes("paraguaio")) {
      return ["sim, só trabalhamos com produtos 100% originais!"];
    }

    // 8. P48 — "Tem garantia?"
    if (text.includes("garantia") || text.includes("troca")) {
      return [
        "sim, temos garantia para produtos que podem ir com defeito",
        "porém para á garantia valer, você tem de gravar um vídeo abrindo o produto e testando, para termos certeza de que o produto veio dá nossa loja"
      ];
    }

    // 9. P49 — Quantos puffs dura?
    if (text.includes("puffs") || text.includes("dura") || text.includes("durabilidade") || text.includes("duracao") || text.includes("duração")) {
      if (text.includes("5000") || text.includes("5.000")) {
        return ["olha o de 5.000 puffs geralmente dura uns 10 dias, porém depende do uso"];
      }
      if (text.includes("7500") || text.includes("7.500")) {
        return ["olha o de 7.500 puffs geralmente dura uns 12 dias, porém depende do uso"];
      }
      if (text.includes("15000") || text.includes("15.000")) {
        return ["olha o de 15.000 puffs geralmente dura uns 17 dias, porém depende do uso"];
      }
      if (text.includes("20000") || text.includes("20.000")) {
        return ["olha o de 20.000 puffs geralmente dura uns 21 dias, porém depende do uso"];
      }
      if (text.includes("30000") || text.includes("30.000")) {
        return ["olha o de 30.000 puffs geralmente dura uns 35 dias, porém depende do uso"];
      }
      return ["olha o de 10.000 puffs geralmente dura uns 14 dias, porém depende do uso"];
    }

    // 10. P50 — Qual sabor recomendam? (Doce vs Gelado)
    if (text.includes("sabor") || text.includes("recomenda") || text.includes("indica") || text.includes("qual o melhor") || text.includes("qual vc prefere") || text.includes("doce") || text.includes("gelado") || text.includes("ice")) {
      if (text.includes("gelado") || text.includes("ice") || text.includes("menta")) {
        return ["olha se vc gosta mais de pod gelado eu recomendaria o menta ou watermelon ice"];
      }
      if (text.includes("doce") || text.includes("fruta") || text.includes("morango") || text.includes("uva")) {
        return ["olha se vc gosta mais de pod doce eu recomendaria o morango ou uva"];
      }
      return ["vc gosta de pod mais gelado ou mais doce?"];
    }

    // 11. P20 — "Tem desconto?" / Atacado
    if (text.includes("desconto") || text.includes("promoção") || text.includes("promocao") || text.includes("descontinho") || text.includes("atacado")) {
      if (text.includes("atacado") || text.includes("quantidade") || text.includes("caixa")) {
        return ["entendi, para atacado conseguimos um valor de 10 reais de desconto por unidade"];
      }
      return [
        "temos desconto sim!",
        "se levar 3 unidades consigo frete grátis, oque acha?"
      ];
    }

    // 12. P19 — "Qual o mais barato?"
    if (text.includes("mais barato") || text.includes("baratinho") || text.includes("menor preco") || text.includes("menor preço")) {
      return [
        "nosso modelo mais barato hoje é o IGNITE V50",
        "ele está saindo por R$ 80,00"
      ];
    }

    // 13. P22 — "Tá caro"
    if (text.includes("caro") || text.includes("muito alto") || text.includes("carinho")) {
      return [
        "nossos produtos são 100% originais",
        "e trabalhamos com garantia na troca caso de algum problema, por isso o valor pode estar um pouco diferente dá concorrencia"
      ];
    }

    // 14. P39 — Retirada no local
    if (text.includes("retirar") || text.includes("retirada") || text.includes("posso ir ai") || text.includes("buscar pessoalmente") || text.includes("pegar ai")) {
      return ["infelizmente por segurança nossa não disponibilizamos a opção de retirada, somente envios amg"];
    }

    // 15. P54 — Quero falar com uma pessoa / dono
    if (text.includes("atendente") || text.includes("falar com pessoa") || text.includes("humano") || text.includes("dono") || text.includes("gerente") || text.includes("suporte")) {
      return ["sem problemas, estou encaminhado para o dono da loja e ele vai resolver o seu problema"];
    }

    // 16. P57 — Pedido não chegou / Demora
    if (text.includes("demorando") || text.includes("nao chegou") || text.includes("não chegou") || text.includes("cadê meu pedido") || text.includes("cade meu pedido") || text.includes("demora")) {
      return [
        "infelizmente a demanda está alta e está bem dificil de achar motoboy amg",
        "porém assim que sair para entrega aviso aqui beleza?"
      ];
    }

    // 17. Saúde / Vape faz mal?
    if (text.includes("faz mal") || text.includes("saude") || text.includes("saúde") || text.includes("vape faz mal") || text.includes("câncer")) {
      return ["olha o pod faz mal sim, todo tipo de produto com nicotina e de fumo faz mal"];
    }

    // 18. P23 / P28 — Pagamento (Pix / Cartão / Dinheiro)
    if (text.includes("pagamento") || text.includes("pix") || text.includes("cartao") || text.includes("cartão") || text.includes("dinheiro") || text.includes("pagar")) {
      if (text.includes("dinheiro") || text.includes("presencial")) {
        return ["infelizmente não trabalhamos com pagamentos presencial como cartão e dinheiro, essa é a unica forma de pagamento?"];
      }
      return [
        "nossas opções de pagamento são pix, e link de pagamento",
        "no link de pagamento dá pra passar cartão de crédito e débito, também parcelamos, porém as taxas são repassadas beleza?"
      ];
    }

    // 19. P18 — "Quanto custa?" / Preço
    if (text.includes("quanto custa") || text.includes("preco") || text.includes("preço") || text.includes("valor") || text.includes("quanto tá") || text.includes("quanto e")) {
      return [
        "qual modelo exato vc tá procurando?"
      ];
    }

    // 20. RG18 — Se perguntar se é robô / Nome da IA
    if (text.includes("robo") || text.includes("robô") || text.includes("ia") || text.includes("quem e voce") || text.includes("seu nome")) {
      return ["sou a eloisa, assistente virtual da smoking pods, tô aqui pra te ajudar com tudo que precisar!"];
    }

    // 21. P1 / P2 / P3 — Oi / Olá / Boa noite / Boa tarde / Bom dia / E aí
    if (text === "oi" || text === "ola" || text === "olá" || text.includes("boa noite") || text.includes("bom dia") || text.includes("boa tarde") || text === "e ai" || text === "e aí") {
      return ["Olá tudo bem, como posso te ajudar?"];
    }

    // Padrão do Script se não houver palavras chaves específicas: envia a tabela digital
    return [
      "claro, vou te enviar nossa tabela digital pra vc dar uma olhada com calma",
      catalogUrl,
      "se precisar de ajuda com algo só me avisar"
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

    // Executa a busca dinâmica de respostas baseada no script completo
    const botResponses = getEloisaResponsesFromPrompt(userText, systemPrompt);

    // Simula o fracionamento de mensagens do WhatsApp (RG5)
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
      }, (index + 1) * 900);
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
                Simulador Dinâmico Conectado
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Atendente virtual oficial da loja {storeName} (Script compilado e integrado ao simulador)
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

        {/* Lado Direito: Script Definitivo Completo da Eloisa & Simulador (7 Colunas) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Configurações do System Prompt */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">System Prompt Completo — Eloisa (OpenAI)</h2>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPrompt}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedPrompt ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  {copiedPrompt ? "Copiado!" : "Copiar Script Íntegra"}
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

            {/* Prompt Textarea Completo */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center justify-between">
                <span>Script Compilado em Tempo Real (100% Integra)</span>
                <span className="text-[10px] text-emerald-400 lowercase">Eloisa System Prompt</span>
              </label>
              <textarea
                rows={12}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 resize-none font-mono custom-scrollbar leading-relaxed"
              />
            </div>
          </section>

          {/* Simulador de Atendimento da Eloisa */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="size-4 text-emerald-400" />
                <h2 className="font-bold text-base text-white">Simulador Conectado ao Script (Teste Geral)</h2>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-full font-semibold">
                Integração Dinâmica Ativa
              </span>
            </div>

            {/* Chat Box */}
            <div className="h-72 bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 overflow-y-auto space-y-3 custom-scrollbar">
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
                placeholder="Teste qualquer mensagem do script (ex: onde fica? quero comprar, quanto é? pode entregar?)..."
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
