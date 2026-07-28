import { useState, useEffect, useRef } from "react";
import {
  Bot, QrCode, RefreshCw, CheckCircle2,
  Send, Sparkles, Power, Check, Copy, Key, Zap,
  CheckCheck, Phone, Video, MoreVertical, ShoppingBag, ArrowRight, RotateCcw
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";
import { supabase } from "@/lib/supabase";
import { calculateShippingQuote } from "@/lib/shipping";

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
msg1: (APENAS se primeiro contato: "bom dia/boa tarde/boa noite, tudo bem?" conforme horário real. Se conversa já em andamento, NÃO envie mensagem de saudação)
msg2: (informa os sabores reais disponíveis em estoque)
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
msg2 (MENSAGEM ÚNICA EM BLOCO COM PIX — NUNCA SEPARAR EM DUAS MENSAGENS):
SMOKING PODS AGRADECE SEU PEDIDO
CHAVE PIX : [chave_pix]

P24 — Cartão
msg1: o valor do seu pedido ficou em R$[valor_produto], com um frete de R$[frete], com um total de R$[total]
msg2 (MENSAGEM ÚNICA EM BLOCO COM LINK):
SMOKING PODS AGRADECE SEU PEDIDO
PAGAMENTO : [link_checkout]

P25 — Pedir comprovante
vou precisar do comprovante beleza?

P26 — Comprovante recebido (foto, print ou documento)
Se o cliente enviar uma FOTO, IMAGEM, PRINT, DOCUMENTO ou ARQUIVO após a chave Pix ter sido enviada:
msg1: muito obrigado! jajá enviaremos o link de rastreio
msg2: tempo médio de 40 minutos á 1 hora para chegar seu pedido!

P26B — Cliente envia mensagem de TEXTO após o Pix (sem foto/doc)
Se o cliente enviar apenas uma mensagem de texto (ex: "paguei", "fiz o pix", "pronto", "transferi"), SEM ter enviado foto ou documento:
msg1: vc conseguiu fazer o pagamento amg?
msg2: preciso do print do comprovante pra confirmar aqui beleza

P28 — "Posso pagar no cartão/dinheiro?"
msg1: nossas opções de pagamento são pix, e link de pagamento
msg2: no link de pagamento dá pra passar cartão de crédito e débito, também parcelamos, porém as taxas são repassadas beleza?

CATEGORIA 6 — ENDEREÇO E ENTREGA
P30/P31 — Pedir endereço (APENAS se o cliente ainda NÃO enviou o CEP ou endereço. NUNCA enviar se o CEP ou endereço já foi informado)
msg1: perfeito amg, me manda o seu cep pra gente não correr risco e ficar bem certinha a localização do motoboy?

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

P49 — Quantos puffs dura? (APENAS se o cliente perguntar expressamente "quanto tempo dura?" ou "quantos dias dura?". NUNCA usar quando o cliente perguntar se TEM o pod em estoque!)
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

const DEFAULT_OPENAI_KEY = "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";

export function ChatbotPage() {
  const { config } = useStoreConfig();
  const [isConnected, setIsConnected] = useState(false);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrCodeVersion, setQrCodeVersion] = useState(1);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [orderCreatedThisSession, setOrderCreatedThisSession] = useState(false);

  // Notification for Order Created
  const [newOrderCreatedToast, setNewOrderCreatedToast] = useState<{ id: string; clientName: string; total: number; productName: string } | null>(null);

  // OpenAI Integration State
  const [openAiKey, setOpenAiKey] = useState<string>(() => {
    return localStorage.getItem("openai_api_key_v1") || DEFAULT_OPENAI_KEY;
  });
  const [showKeyInput, setShowKeyInput] = useState(false);

  // System Prompt
  const [systemPrompt, setSystemPrompt] = useState(DEFINITIVE_SYSTEM_PROMPT);
  const [isTyping, setIsTyping] = useState(false);

  // Chat Simulator State (inicia limpo para o usuário dar o primeiro oi)
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const storeName = config?.store_name || "Smoking Pods";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSaveOpenAiKey = (key: string) => {
    setOpenAiKey(key);
    localStorage.setItem("openai_api_key_v1", key);
  };

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Oscilador 1: Som principal (agudo e limpo)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      
      gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
      
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      
      // Oscilador 2: Segundo tom harmônico (suave)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1174.66, audioCtx.currentTime); // D6
      
      gain2.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
      
      osc1.stop(audioCtx.currentTime + 0.45);
      osc2.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.warn("Erro ao reproduzir áudio da notificação:", e);
    }
  };

  /**
   * Salva o pedido automaticamente na tabela do Supabase 'smoking_orders'
   * e dispara a notificação no painel!
   */
  const createOrderInDatabase = async (
    clientName: string, 
    address: string, 
    orderItems: Array<{ name: string; flavor: string; quantity: number; price: number }>, 
    total: number
  ) => {
    try {
      const newOrderPayload = {
        client_name: clientName || "Cliente WhatsApp",
        client_phone: "11988887777",
        shipping_address: address || "Endereço Não Informado",
        items: orderItems,
        total_amount: total,
        shipping_fee: 15,
        payment_method: "PIX",
        payment_status: "PENDENTE",
        delivery_status: "AGUARDANDO_PAGAMENTO"
      };

      const { data, error } = await supabase
        .from('smoking_orders')
        .insert(newOrderPayload)
        .select()
        .single();

      const primaryItem = orderItems[0];
      const itemDetail = primaryItem ? `${primaryItem.name} (${primaryItem.flavor})` : "Ignite V50";

      if (!error && data) {
        playNotificationSound();
        setNewOrderCreatedToast({
          id: data.id.substring(0, 8).toUpperCase(),
          clientName: data.client_name,
          total: parseFloat(data.total_amount),
          productName: itemDetail
        });
      } else {
        // Fallback local se a tabela Supabase estiver offline
        const simulatedId = "WXP-" + Math.floor(1000 + Math.random() * 9000);
        playNotificationSound();
        setNewOrderCreatedToast({
          id: simulatedId,
          clientName: clientName || "Cliente WhatsApp Demo",
          total: total || 175,
          productName: itemDetail
        });
      }
    } catch (err) {
      console.warn("Erro ao salvar pedido simulado:", err);
    }
  };

  /**
   * Chamada REAL para a API da OpenAI (GPT-4o) com Injeção de Estoque em Tempo Real
   */
  const callRealOpenAI = async (conversationHistory: Array<{ sender: "user" | "bot"; text: string }>) => {
    // 1. Busca os produtos ativos e em estoque direto do Supabase
    let stockContext = "";
    let inStockProducts: any[] = [];
    try {
      const { data: products } = await supabase
        .from('smoking_products')
        .select('id, name, brand, flavor, stock, price, puffs')
        .gt('stock', 0);

      if (products && products.length > 0) {
        inStockProducts = products;
        const stockLines = products.map(p => 
          `${p.brand ? p.brand + ' ' : ''}${p.name} (sabor: ${p.flavor}) - R$ ${parseFloat(p.price).toFixed(2)}`
        );
        stockContext = `\n\nESTOQUE EM TEMPO REAL DISPONÍVEL NA SMOKING PODS (ATUALIZADO AGORA):\n` +
          stockLines.join("\n") +
          `\n\nREGRAS CRÍTICAS DE ESTOQUE E FORMATO DA RESPOSTA:` +
          `\n1. Escreva 100% em LETRAS MINÚSCULA! (sem maiúsculas no início, ex: "temos sim amg", nunca "Infelizmente" ou "Elfbar").` +
          `\n2. NUNCA use marcadores de lista como traços (- ), asteriscos (* ) ou números (1. ). Escreva mensagens de texto normais de WhatsApp!` +
          `\n3. NUNCA invente marcas, modelos ou sabores fora da lista de estoque acima.`;
      } else {
        stockContext = `\n\nESTOQUE EM TEMPO REAL: Atualmente todos os produtos da loja estão sem estoque. Informe o cliente educadamente em minúsculo.`;
      }
    } catch (e) {
      console.warn("Erro ao carregar estoque em tempo real:", e);
    }

    // 2. Pre-checagem inteligente via JavaScript para modelo solicitado
    let directStockInstruction = "";
    const allUserMsgs = conversationHistory.filter(m => m.sender === 'user');
    const lastUserMsg = allUserMsgs[allUserMsgs.length - 1]?.text || "";
    const lastMsgLower = lastUserMsg.toLowerCase();

    // Função de fuzzy match para lidar com erros de digitação (aceita 70% de similaridade)
    const fuzzyMatch = (query: string, target: string): boolean => {
      const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
      const t = target.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!q || !t) return false;
      // Match direto ou contido
      if (q.includes(t) || t.includes(q)) return true;
      // Similaridade em sequencia
      let matches = 0;
      let tIdx = 0;
      for (let i = 0; i < q.length && tIdx < t.length; i++) {
        if (q[i] === t[tIdx]) { matches++; tIdx++; }
      }
      return matches >= t.length * 0.7;
    };

    if (inStockProducts.length > 0) {
      // 1. Verifica se o usuário escolheu algum sabor disponível (mesmo com pequenos erros de digitação)
      const matchedByFlavor = inStockProducts.filter(p => {
        const flavorLower = p.flavor.toLowerCase();
        return lastMsgLower.includes(flavorLower) || 
               fuzzyMatch(lastMsgLower, flavorLower) || 
               flavorLower.split(" ").some(word => word.length > 3 && lastMsgLower.includes(word));
      });

      // 2. Busca match por nome ou marca no estoque
      const matchedByModel = inStockProducts.filter(p => {
        const pName = (p.name || '').toLowerCase();
        const pBrand = (p.brand || '').toLowerCase();
        return fuzzyMatch(lastMsgLower, pName) || fuzzyMatch(lastMsgLower, pBrand);
      });

      if (matchedByFlavor.length > 0 && !lastMsgLower.match(/(elf\s*bar|elfbar|ignite|bc\s*15|bc15|v50|v80|waka|oxbar|lost\s*mary|10k|15k|20k|30k)/i)) {
        // O cliente citou um sabor que temos em estoque!
        // Descobre qual modelo estava sendo discutido no histórico
        let activeModel = matchedByFlavor[0].name;
        const botMsgs = conversationHistory.filter(m => m.sender === 'bot');
        if (botMsgs.length > 0) {
          const lastBotText = botMsgs[botMsgs.length - 1].text.toLowerCase();
          const foundModel = inStockProducts.find(p => lastBotText.includes(p.name.toLowerCase()));
          if (foundModel) activeModel = foundModel.name;
        }

        const finalProduct = matchedByFlavor.find(p => p.name === activeModel) || matchedByFlavor[0];
        const priceStr = parseFloat(finalProduct.price).toFixed(0);

        directStockInstruction = `\n\n[SISTEMA: SABOR DE PRODUTO SELECIONADO!]` +
          `\nO cliente escolheu o sabor "${finalProduct.flavor}" do modelo "${finalProduct.name}".` +
          `\n\nREGRA OBRIGATÓRIA (siga à risca):` +
          `\n- Confirme a escolha de 1 unidade em tom amigo, informal e 100% minúsculo.` +
          `\n- Peça o CEP para entrega de forma informal.` +
          `\n- Exemplo de resposta IDEAL: "fechou amg, 1 ${finalProduct.name.toLowerCase()} de ${finalProduct.flavor.toLowerCase()} então! me manda seu cep pra gente ver a entrega?"` +
          `\n- NUNCA diga que o produto não existe! Confirme a escolha.`;

      } else if (matchedByModel.length > 0) {
        // O cliente perguntou especificamente de um modelo disponível
        const modelName = matchedByModel[0].name;
        const brandName = matchedByModel[0].brand || '';
        const flavorsInformal = matchedByModel.map(p => p.flavor.toLowerCase()).join(' e ');
        const priceStr = parseFloat(matchedByModel[0].price).toFixed(0);

        directStockInstruction = `\n\n[SISTEMA: CONFIRMAÇÃO DIRETA — PRODUTO ENCONTRADO NO ESTOQUE!]` +
          `\nO cliente pediu "${lastUserMsg}". O sistema CONFIRMOU que "${brandName} ${modelName}" EXISTE no estoque.` +
          `\nSabores disponíveis desse modelo: ${flavorsInformal}. Preço: R$ ${priceStr} cada.` +
          `\n\nINSTRUÇÃO OBRIGATÓRIA (siga EXATAMENTE):` +
          `\n- Responda que TEMOS SIM, nunca diga que não tem!` +
          `\n- Fale de forma SUPER INFORMAL como no WhatsApp, 100% minúsculo, sem listas com traço/asterisco!` +
          `\n- Exemplo de resposta IDEAL: "temos sim amg! do ${modelName.toLowerCase()} a gente tem nos sabores ${flavorsInformal}, cada um sai por ${priceStr} reais, qual vc curte mais?"`;

      } else if (lastMsgLower.match(/(elf\s*bar|elfbar|ignite|bc\s*15|bc15|v50|v80|waka|oxbar|lost\s*mary|10k|15k|20k|30k)/i)) {
        // O cliente pediu um modelo/marca específico que NÃO está em estoque
        const disponiveisInformal = inStockProducts.reduce((acc: any[], p) => {
          const key = `${p.brand} ${p.name}`;
          if (!acc.find(a => a.key === key)) acc.push({ key, brand: p.brand, name: p.name, flavors: [p.flavor], price: p.price });
          else acc.find(a => a.key === key)!.flavors.push(p.flavor);
          return acc;
        }, []).map(g => `${g.brand ? g.brand.toLowerCase() + ' ' : ''}${g.name.toLowerCase()} (sabores: ${g.flavors.join(', ').toLowerCase()}) por ${parseFloat(g.price).toFixed(0)} reais`).join(', ');

        directStockInstruction = `\n\n[SISTEMA: PRODUTO NÃO ENCONTRADO NO ESTOQUE]` +
          `\nO cliente pediu "${lastUserMsg}" mas esse modelo/marca NÃO existe no estoque da loja.` +
          `\n\nINSTRUÇÃO OBRIGATÓRIA (siga EXATAMENTE):` +
          `\n- Diga de forma bem amigável que esse modelo específico a gente não tem no momento.` +
          `\n- Sugira os pods e sabores disponíveis de forma SUPER INFORMAL e corrida:` +
          `\n  "esse modelo a gente não tem no momento amg, mas a pronta entrega hoje temos ${disponiveisInformal}, quer algum desses?"`;
      }
    }

    // 3. Calcula a saudação do horário real do dia
    const currentHour = new Date().getHours();
    let timeGreeting = "boa noite";
    if (currentHour >= 6 && currentHour < 12) {
      timeGreeting = "bom dia";
    } else if (currentHour >= 12 && currentHour < 18) {
      timeGreeting = "boa tarde";
    }

    const isOngoingConversation = conversationHistory.length > 1;

    const timeContext = `\n\nHORÁRIO ATUAL DO SISTEMA: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
SAUDAÇÃO CORRETA DO HORÁRIO: "${timeGreeting}".
REGRA IMPERATIVA DE SAUDAÇÃO:
${isOngoingConversation 
  ? `ATENÇÃO SUPREMA: ESTA CONVERSA JÁ ESTÁ EM ANDAMENTO (MENSAGEM Nº ${conversationHistory.length})! NUNCA COMECE SUA RESPOSTA COM "bom dia", "boa tarde", "boa noite", "olá tudo bem" OU QUALQUER OUTRA SAUDAÇÃO! É PROIBIDO CUMPRIMENTAR NOVAMENTE. RESPONDA DIRETO À PERGUNTA DO CLIENTE COM LETRA MINÚSCULA!` 
  : `Esta é a 1ª mensagem da conversa. Comece com a primeira letra maiúscula: "${timeGreeting.charAt(0).toUpperCase() + timeGreeting.slice(1)}, tudo bem? como posso te ajudar?"`}`;

    // 3. Detecção Inteligente do Nome do Cliente
    let clientName = "Cliente WhatsApp";
    let nameContext = "";
    let botAskedForName = false;
    let userProvidedName = false;
    let nameMsgIndex = -1;

    // Scan do histórico para verificar se o bot já perguntou o nome
    for (let i = 0; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];
      if (msg.sender === 'bot' && (msg.text.toLowerCase().includes("qual o seu nome") || msg.text.toLowerCase().includes("como posso te chamar") || msg.text.toLowerCase().includes("como te chamo"))) {
        botAskedForName = true;
      }
      // Se o bot já perguntou o nome, a próxima mensagem do usuário (ou subsequente) deve ser o nome!
      if (botAskedForName && msg.sender === 'user' && nameMsgIndex === -1) {
        const cleanName = msg.text.replace(/meu nome é|meu nome e|sou o|sou a|pode chamar de|aqui é o|aqui é a/gi, "").trim();
        if (cleanName.length > 0 && cleanName.length < 35) {
          clientName = cleanName;
          userProvidedName = true;
          nameMsgIndex = i;
        }
      }
    }

    // Se o usuário falou espontaneamente o nome (ex: "meu nome é felipe" ou "aqui é o joão")
    if (!userProvidedName) {
      for (let i = 0; i < conversationHistory.length; i++) {
        const msg = conversationHistory[i];
        if (msg.sender === 'user') {
          const match = msg.text.match(/(?:meu nome é|meu nome e|sou o|sou a|aqui é o|aqui é a)\s+([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÓÔÕÚÇÑ\s]+)/i);
          if (match) {
            clientName = match[1].trim();
            userProvidedName = true;
            nameMsgIndex = i;
            break;
          }
        }
      }
    }

    // Define o contexto do nome
    if (userProvidedName) {
      nameContext = `\n\n[SISTEMA: NOME DO CLIENTE IDENTIFICADO]` +
        `\nNome do cliente: "${clientName}".` +
        `\nINSTRUÇÃO CRÍTICA:` +
        `\n1. NUNCA mais pergunte o nome! Trate o cliente pelo nome "${clientName}" nas respostas seguintes.` +
        `\n2. Use o nome "${clientName}" para se referir a ele de forma amigável no chat.`;
    } else {
      // Se ainda não temos o nome, e o usuário já escolheu o produto, devemos pedir o nome antes de pedir o CEP!
      const userSelectedProduct = conversationHistory.some(m => 
        m.sender === 'user' && inStockProducts.some(p => 
          m.text.toLowerCase().includes(p.flavor.toLowerCase()) || 
          fuzzyMatch(m.text, p.flavor.toLowerCase())
        )
      );

      if (userSelectedProduct) {
        nameContext = `\n\n[SISTEMA: PEDIR NOME DO CLIENTE]` +
          `\nO cliente já escolheu o produto/sabor. Agora, você PRECISA pedir o nome dele antes de pedir o CEP.` +
          `\nINSTRUÇÃO OBRIGATÓRIA (responda exatamente isto):` +
          `\nfechou amg! qual o seu nome pra eu colocar aqui no pedido?`;
      }
    }

    // 4. Detecção Inteligente de CEP e Residência via Máquina de Estados no Histórico
    let cepContext = "";
    let addressCompletedContext = "";
    
    // Procura se o cliente enviou CEP na conversa
    let foundCep = "";
    let cepMsgIndex = -1;
    for (let i = 0; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];
      if (msg.sender === 'user') {
        const match = msg.text.match(/\b\d{5}[-.\s]?\d{3}\b/);
        if (match) {
          foundCep = match[0].replace(/\D/g, "");
          cepMsgIndex = i;
          break;
        }
      }
    }

    let detectedStreetAndBairro = "";
    let detectedAddress = "";

    if (foundCep) {
      try {
        const cepRes = await fetch(`https://viacep.com.br/ws/${foundCep}/json/`);
        if (cepRes.ok) {
          const cepData = await cepRes.json();
          if (!cepData.erro) {
            const street = cepData.logradouro || "";
            const neighborhood = cepData.bairro || "";
            const cityState = `${cepData.localidade}/${cepData.uf}`;
            detectedStreetAndBairro = `${street}${neighborhood ? ' - ' + neighborhood : ''}`;
            detectedAddress = `${street}${neighborhood ? ', ' + neighborhood : ''} - ${cityState}`;
          }
        }
      } catch (err) {
        console.warn("Erro ao consultar CEP:", err);
      }
    }

    // Agora analisamos o histórico após o envio do CEP
    let botAskedForNumber = false;
    let userProvidedNumber = false;
    let userNumberText = "";

    if (cepMsgIndex !== -1) {
      // Procura se o bot pediu o número após o envio do CEP
      for (let i = cepMsgIndex + 1; i < conversationHistory.length; i++) {
        const msg = conversationHistory[i];
        if (msg.sender === 'bot' && (msg.text.toLowerCase().includes("número") || msg.text.toLowerCase().includes("numero"))) {
          botAskedForNumber = true;
        }
        // Procura se o usuário respondeu o número/complemento após o bot ter pedido
        if (botAskedForNumber && msg.sender === 'user') {
          const hasNumber = msg.text.match(/\b\d+\b/);
          const hasComplementoWords = msg.text.toLowerCase().includes("beco") || msg.text.toLowerCase().includes("ap") || msg.text.toLowerCase().includes("bloco") || msg.text.toLowerCase().includes("fundos") || msg.text.toLowerCase().includes("casa");
          if (hasNumber || hasComplementoWords) {
            userProvidedNumber = true;
            userNumberText = msg.text;
          }
        }
      }
    }

    // Define as instruções com base nos estados identificados no histórico
    if (foundCep) {
      if (userProvidedNumber) {
        // Estado 3: Endereço completo obtido com sucesso!
        // Calcula o frete REAL via OSRM (mesma lógica do backend/uberService.js)
        let freteReal = 15.00;
        let distanciaReal = 3.0;
        try {
          const quote = await calculateShippingQuote(foundCep);
          freteReal = quote.fee;
          distanciaReal = quote.distanceKm;
          console.log(`🚗 [Emulador] Frete real calculado: R$ ${freteReal.toFixed(2)} | ${distanciaReal} km`);
        } catch (err) {
          console.warn("⚠️ Erro ao calcular frete real no emulador, usando fallback R$ 15:", err);
        }

        // Calcula o valor total do pedido com base nos produtos selecionados
        let valorProdutos = 0;
        let qtdTotal = 0;
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
          if (conversationHistory[i].sender !== 'user') continue;
          const text = conversationHistory[i].text.toLowerCase();
          const found = inStockProducts.find(p =>
            text.includes(p.flavor.toLowerCase()) || fuzzyMatch(text, p.flavor.toLowerCase())
          );
          if (found) {
            const qtyMatch = text.match(/\b(\d+)\s*(unidade|un|x|pod|pods)?\b/);
            const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
            valorProdutos = parseFloat(found.price) * (qty > 0 && qty < 10 ? qty : 1);
            qtdTotal = qty > 0 && qty < 10 ? qty : 1;
            break;
          }
        }
        if (valorProdutos === 0 && inStockProducts.length > 0) {
          valorProdutos = parseFloat(inStockProducts[0].price);
          qtdTotal = 1;
        }

        // Regra de frete grátis: 3+ peças
        const freteAplicado = qtdTotal >= 3 ? 0 : freteReal;
        const totalFinal = valorProdutos + freteAplicado;
        const freteStr = freteAplicado === 0 ? "GRÁTIS (3+ pods)" : `R$ ${freteAplicado.toFixed(2)}`;

        addressCompletedContext = `\n\n[SISTEMA: ENDEREÇO TOTALMENTE COMPLETO E ANOTADO!]` +
          `\nRua/Bairro: ${detectedStreetAndBairro}` +
          `\nNúmero e Complemento informados pelo cliente: "${userNumberText}"` +
          `\nDistância calculada pelo OSRM: ${distanciaReal} km` +
          `\n\n[SISTEMA: FRETE CALCULADO COM SUCESSO]` +
          `\nValor dos produtos: R$ ${valorProdutos.toFixed(2)}` +
          `\nFrete calculado (${distanciaReal} km): ${freteStr}` +
          `\nTotal do pedido: R$ ${totalFinal.toFixed(2)}` +
          `\n\nINSTRUÇÕES CRÍTICAS DE FLUXO:` +
          `\n1. NUNCA mais peça CEP ou endereço! Não pergunte por rua ou bairro novamente.` +
          `\n2. Responda de forma curta e informal (usando quebras de linha \\n):` +
          `\n   fechou amg, anotei aqui o endereço: ${detectedStreetAndBairro}, nº ${userNumberText}` +
          `\n   o valor do seu pedido ficou em R$ ${valorProdutos.toFixed(2)}, com um frete de ${freteStr}, com um total de R$ ${totalFinal.toFixed(2)}` +
          `\n   SMOKING PODS AGRADECE SEU PEDIDO\\nCHAVE PIX : 1234567890` +
          `\n\nATENÇÃO SUPREMA: NUNCA SEPARE "SMOKING PODS AGRADECE SEU PEDIDO" DA "CHAVE PIX"! Elas DEVEM vir obrigatoriamente na MESMA MENSAGEM, juntas em um único bloco contínuo separado apenas por uma quebra de linha.`;
      } else if (botAskedForNumber) {
        // Estado 2: O bot pediu o número, mas o usuário ainda não respondeu o número
        const isUserConfirmingStreet = lastMsgLower.match(/sim|isso|eh|é|certo|ok|blz/);
        
        if (isUserConfirmingStreet) {
          // O usuário acabou de confirmar a rua (ex: "isso"). Agora o bot PRECISA pedir o número e o complemento de forma obrigatória!
          cepContext = `\n\n[SISTEMA: CONFIRMAÇÃO DE RUA RECEBIDA]` +
            `\nO cliente confirmou a rua do CEP ("${detectedStreetAndBairro}").` +
            `\n\nINSTRUÇÃO OBRIGATÓRIA (siga à risca):` +
            `\nVocê PRECISA pedir o número e complemento de forma super curta e informal no WhatsApp.` +
            `\nSua resposta DEVE conter exatamente esta pergunta:` +
            `\nqual o número do seu endereço amg? tem algum complemento?`;
        } else {
          // Se o usuário ainda não mandou o número e não é apenas confirmação da rua, reforce o pedido do número de forma amigável
          cepContext = `\n\n[SISTEMA: AGUARDANDO NÚMERO E COMPLEMENTO]` +
            `\nO cliente ainda não enviou o número da residência.` +
            `\nINSTRUÇÃO OBRIGATÓRIA:` +
            `\nSua resposta DEVE ser exatamente: "qual o número do seu endereço amg? tem algum complemento?"`;
        }
      } else {
        // Estado 1: O cliente acabou de enviar o CEP. O bot precisa confirmar a rua e pedir o número!
        cepContext = `\n\n[SISTEMA: CEP DETECTADO]` +
          `\nO cliente enviou o CEP ${foundCep}. A rua localizada foi: "${detectedStreetAndBairro}".` +
          `\n\nINSTRUÇÃO OBRIGATÓRIA DE RESPOSTA (siga à risca, use quebra de linha para separar as duas frases):` +
          `\nahh sim, localizei aqui amg! essa rua né: ${detectedStreetAndBairro}?` +
          `\nqual o número do seu endereço amg? tem algum complemento?`;
      }
    } else {
      // Estado 0: Ainda não temos o CEP do cliente.
      // Se já temos o nome do cliente, aí sim pedimos o CEP!
      if (userProvidedName) {
        cepContext = `\n\n[SISTEMA: PEDIR CEP AO CLIENTE]` +
          `\nComo já temos o nome do cliente ("${clientName}"), agora peça o CEP de forma super informal:` +
          `\n"perfeito ${clientName.toLowerCase()}, me manda o seu cep pra gente não correr risco e ficar bem certinha a localização do motoboy?"`;
      }
    }

    const dynamicSystemPrompt = systemPrompt + timeContext + stockContext + directStockInstruction + nameContext + cepContext + addressCompletedContext;

    const formattedMessages = [
      { role: "system", content: dynamicSystemPrompt },
      ...conversationHistory.map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      })),
    ];

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey.trim()}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: formattedMessages,
          temperature: 0.3,
          max_tokens: 250,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawAnswer = data.choices?.[0]?.message?.content || "Desculpe, tive um probleminha aqui. Pode me perguntar de novo?";
      
      // Checa se a resposta contem indicativo de finalizacao de pedido ou Pix
      const lowerRaw = rawAnswer.toLowerCase();
      if (
        !orderCreatedThisSession && (
          lowerRaw.includes("chave pix") ||
          lowerRaw.includes("agradece seu pedido") ||
          lowerRaw.includes("pagameto confirmado") ||
          lowerRaw.includes("pagamento confirmado") ||
          lowerRaw.includes("link_checkout") ||
          lowerRaw.includes("total de r$")
        )
      ) {
        setOrderCreatedThisSession(true);

        // 1. Tenta encontrar qual pod do estoque real o cliente pediu na conversa de trás para frente
        let matchedItem = null;
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
          if (conversationHistory[i].sender !== 'user') continue;
          const text = conversationHistory[i].text.toLowerCase();
          
          const found = inStockProducts.find(p => {
            const nameMatch = text.includes(p.name.toLowerCase()) || text.includes((p.brand || '').toLowerCase());
            const flavorMatch = text.includes(p.flavor.toLowerCase()) || fuzzyMatch(text, p.flavor.toLowerCase());
            return nameMatch && flavorMatch;
          });
          if (found) {
            matchedItem = found;
            break;
          }
        }

        if (!matchedItem) {
          for (let i = conversationHistory.length - 1; i >= 0; i--) {
            if (conversationHistory[i].sender !== 'user') continue;
            const text = conversationHistory[i].text.toLowerCase();
            const found = inStockProducts.find(p => 
              text.includes(p.flavor.toLowerCase()) || fuzzyMatch(text, p.flavor.toLowerCase())
            );
            if (found) {
              matchedItem = found;
              break;
            }
          }
        }

        const finalProduct = matchedItem || inStockProducts[0];
        const itemBrand = finalProduct && finalProduct.brand ? finalProduct.brand : "";
        const itemModel = finalProduct ? `${itemBrand} ${finalProduct.name}`.trim() : "Ignite V50";
        const itemFlavor = finalProduct ? finalProduct.flavor : "Watermelon Ice";
        const itemPrice = finalProduct ? parseFloat(finalProduct.price) : 80;

        // 2. Extrai quantidade do histórico
        let quantity = 1;
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
          if (conversationHistory[i].sender !== 'user') continue;
          const text = conversationHistory[i].text.toLowerCase();
          const qtyMatch = text.match(/\b(\d+)\s*(unidade|un|x|pod|pods)?\b/);
          if (qtyMatch) {
            const val = parseInt(qtyMatch[1]);
            if (val > 0 && val < 10) {
              quantity = val;
              break;
            }
          }
          if (text.includes("dois") || text.includes("duas")) {
            quantity = 2;
            break;
          }
          if (text.includes("tres") || text.includes("três")) {
            quantity = 3;
            break;
          }
        }

        // 3. Constrói o endereço real do histórico/GPS
        const finalAddress = detectedStreetAndBairro 
          ? `${detectedStreetAndBairro}, nº ${userNumberText || 'S/N'}`
          : "Endereço Não Informado";

        const orderItems = [
          {
            product_id: finalProduct ? finalProduct.id : null,
            name: itemModel,
            flavor: itemFlavor,
            quantity: quantity,
            price: itemPrice
          }
        ];

        const orderTotal = (itemPrice * quantity);

        // Dispara criação do pedido real no Kanban
        createOrderInDatabase(clientName, finalAddress, orderItems, orderTotal);
      }

      let lines: string[] = [];
      if (rawAnswer.includes("[QUEBRA]")) {
        lines = rawAnswer.split("[QUEBRA]").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      } else if (rawAnswer.includes("SMOKING PODS AGRADECE SEU PEDIDO")) {
        const match = rawAnswer.match(/([\s\S]*?)(SMOKING PODS AGRADECE SEU PEDIDO[\s\S]*)/i);
        if (match) {
          const firstPart = match[1].split("\n").map(l => l.trim()).filter(l => l.length > 0);
          const pixPart = match[2].trim();
          lines = [...firstPart, pixPart];
        } else {
          lines = rawAnswer.split("\n").filter((l: string) => l.trim().length > 0);
        }
      } else {
        lines = rawAnswer.split("\n").filter((l: string) => l.trim().length > 0);
      }
      return lines.length > 0 ? lines : [rawAnswer];
    } catch (e: any) {
      console.error("Erro na OpenAI:", e);
      return [`(Erro OpenAI: ${e.message || "Verifique sua chave de API"})`];
    }
  };

  const handleSimulateSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isTyping) return;

    const userText = inputMessage.trim();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newHistory = [...messages, { sender: "user" as const, text: userText, time: timeNow }];
    setMessages(newHistory);
    setInputMessage("");
    setIsTyping(true);

    // Dispara para a inteligência real do GPT-4o
    const botResponses = await callRealOpenAI(newHistory);

    // Simula envio fracionado
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
      }, (index + 1) * 800);
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
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-background p-6 space-y-8 relative">
      
      {/* Toast Notification: Pedido Criado no Kanban */}
      {newOrderCreatedToast && (
        <div 
          onClick={() => setNewOrderCreatedToast(null)}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#0c0c0c]/95 backdrop-blur-md border border-emerald-500/30 text-white px-5 py-3.5 rounded-2xl shadow-[0_10px_40px_rgba(16,185,129,0.2)] flex items-center gap-3.5 animate-in slide-in-from-top-5 duration-300 cursor-pointer hover:border-emerald-500/50 transition-all"
        >
          <div className="size-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ShoppingBag className="size-4.5" />
          </div>
          <div className="text-xs font-semibold tracking-wide">
            <span>Pedido novo no painel:</span>
            <span className="text-emerald-400 ml-1.5 font-bold">{newOrderCreatedToast.productName}</span>
          </div>
          <div className="h-4 w-px bg-white/10 ml-1" />
          <span className="text-[10px] text-white/40 hover:text-white/80 transition-colors font-bold px-1">X</span>
        </div>
      )}

      {/* Header com Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <Bot className="size-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              WhatsApp IA — Eloisa Real
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <Zap className="size-3 text-emerald-400" /> WhatsApp Sincronizado ao Kanban
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simulador em formato WhatsApp Web oficial com criação automática de pedidos na aba Pedidos
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
                      O número está vinculado ao WhatsApp e gerará os pedidos automaticamente no Kanban.
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

        {/* Lado Direito: Prompt da Eloisa & Simulador em Formato WhatsApp Web Real (7 Colunas) */}
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
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className="p-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 transition-all cursor-pointer"
                  title="Configurar Chave da OpenAI"
                >
                  <Key className="size-4" />
                </button>
              </div>
            </div>

            {showKeyInput && (
              <div className="p-3 bg-[#0a0a0a] border border-emerald-500/30 rounded-xl space-y-1.5">
                <label className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Key className="size-3" /> Chave de API da OpenAI (GPT-4o):
                </label>
                <input
                  type="password"
                  value={openAiKey}
                  onChange={(e) => handleSaveOpenAiKey(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Prompt Textarea Completo */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center justify-between">
                <span>Script Compilado em Tempo Real (100% Íntegra)</span>
                <span className="text-[10px] text-emerald-400 lowercase">OpenAI GPT-4o Engine</span>
              </label>
              <textarea
                rows={8}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 resize-none font-mono custom-scrollbar leading-relaxed"
              />
            </div>
          </section>

          {/* Simulador em Formato Real do WhatsApp Web */}
          <section className="bg-[#0b141a] border border-[#222d34] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[480px]">
            {/* Header WhatsApp Web */}
            <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-[#222d34] shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="size-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                    E
                  </div>
                  <div className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 border-2 border-[#202c33]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#e9edef] leading-tight">Eloisa • Smoking Pods</h3>
                  <p className="text-[11px] text-[#8696a0]">
                    {isTyping ? "digitando..." : "online no WhatsApp"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[#aebac1]">
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setOrderCreatedThisSession(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                  title="Limpar e reiniciar conversa do zero"
                >
                  <RotateCcw className="size-3.5" />
                  Resetar Chat
                </button>
                <div className="h-4 w-px bg-white/10" />
                <MoreVertical className="size-4 cursor-pointer hover:text-white" />
              </div>
            </div>

            {/* Chat Messages Wall (Estilo WhatsApp) */}
            <div className="flex-1 bg-[#0b141a] bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px] p-4 overflow-y-auto space-y-2.5 custom-scrollbar">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="size-12 rounded-full bg-[#202c33] border border-white/10 flex items-center justify-center text-[#8696a0]">
                    <Bot className="size-6 text-emerald-400" />
                  </div>
                  <div className="max-w-xs">
                    <p className="text-xs font-semibold text-[#e9edef]">Conversa iniciada do zero!</p>
                    <p className="text-[11px] text-[#8696a0] mt-1">
                      Envie uma mensagem abaixo (ex: "oi", "boa tarde" ou "tem pod aí?") para testar o primeiro contato com a Eloisa.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-lg px-3 py-2 text-xs relative text-[#e9edef] shadow-md ${
                      msg.sender === "user"
                        ? "bg-[#005c4b] rounded-tr-none"
                        : "bg-[#202c33] rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed select-text">{msg.text}</p>
                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-[#8696a0]">
                      <span>{msg.time}</span>
                      {msg.sender === "user" && <CheckCheck className="size-3 text-[#53bdeb]" />}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-1.5 text-xs text-[#8696a0] bg-[#202c33] px-3 py-2 rounded-lg rounded-tl-none w-fit">
                  <span className="animate-pulse">Eloisa está digitando...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar Estilo WhatsApp */}
            <form onSubmit={handleSimulateSend} className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-t border-[#222d34] shrink-0">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Mensagem (ex: quero 2 menta e 1 uva, meu CEP é 09700-000)..."
                className="flex-1 bg-[#2a3942] border-none rounded-xl px-4 py-2.5 text-xs text-[#e9edef] placeholder:text-[#8696a0] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isTyping}
                className="p-2.5 bg-[#00a884] hover:bg-[#029071] text-black font-bold rounded-xl transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                <Send className="size-4 text-white" />
              </button>
            </form>
          </section>

        </div>

      </div>
    </div>
  );
}
