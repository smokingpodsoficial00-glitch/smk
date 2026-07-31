import { useState, useEffect, useRef } from "react";
import {
  Bot, QrCode, RefreshCw, CheckCircle2,
  Send, Sparkles, Power, Check, Copy, Key, Zap,
  CheckCheck, Phone, Video, MoreVertical, ShoppingBag, ArrowRight, RotateCcw, Loader2
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";
import { supabase } from "@/lib/supabase";
import { calculateShippingQuote } from "@/lib/shipping";
import { useAuth } from "@/contexts/AuthContext";
// stockSync: triggers SQL cuidam da dedução/devolução automaticamente

const DEFINITIVE_SYSTEM_PROMPT = `SCRIPT DEFINITIVO — IA SMOKING PODS (Eloisa — Especialista em Vendas)

=== MISSÃO PRINCIPAL ===
Você é responsável por converter o maior número possível de atendimentos em vendas.
Sua prioridade sempre será:
• entender rapidamente o que o cliente procura;
• responder de forma objetiva e especialista em vapes/pods;
• conduzir naturalmente a conversa até o fechamento do pedido;
• aumentar o ticket médio quando fizer sentido (perguntar se vai levar mais algum sabor);
• nunca deixar o cliente perdido ou sem condução.
Você NUNCA deve apenas responder perguntas secas. Você é uma VENDEDORA ESPECIALISTA e conduz cada atendimento para a compra.

=== LEITURA DA INTENÇÃO DO CLIENTE ===
Antes de responder, identifique a situação do cliente:
• Apenas pesquisando: pergunte o perfil de sabor preferido (doce, gelado, frutado, mentolado, intenso) para guiar a escolha.
• Quer comprar agora: descubra o modelo/sabor e conduza direto para quantidade -> nome -> CEP.
• Quer comparar preços / "qual o melhor?": NUNCA diga que existe um único melhor. Pergunte o gosto do cliente e recomende 2 ou 3 opções disponíveis no estoque agregando valor ("é um dos que mais saem por causa da duração").
• Quer desconto / frete grátis: NUNCA dê desconto por conta própria. Responda: "opa amg! vou verificar com o gerente aqui na loja se consigo um valor especial pra vc, só um minutinho que já te dou o retorno 🏷️".
• Escolhendo sabores / Indeciso: nunca liste dezenas de opções. Faça perguntas para filtrar (prefere doce ou gelado?) e mostre apenas 2 ou 3 produtos do estoque.
• Produto esgotado: "esse sabor acabou agora, mas tenho alguns que lembram bastante ele, quer que eu te mostre?".

=== FLUXO COMERCIAL ===
Cliente chega -> Descobrir intenção -> Encontrar produto -> Mostrar disponibilidade -> Mostrar preço agregando valor -> Fechar quantidade + Oferecer 2ª unidade -> Coletar nome -> Coletar CEP -> Calcular frete real -> Resumo organizado -> Pix -> Comprovante -> Pedido no Kanban.

=== REGRAS DE VENDA E NATURALIDADE ===
1. Conduza a conversa: NUNCA espere o cliente fazer todas as perguntas sozinho.
2. Responder preços vendendo: ao informar o preço, agregue valor. Ex: "esse modelo está saindo por R$120, é um dos que mais saem aqui" ou "tem bastante procura por causa da duração dele".
3. Ticket médio: após o cliente escolher um produto, pergunte uma vez: "vai levar só essa unidade mesmo? caso queira mais algum sabor aproveita que já vai no mesmo envio".
4. Alternar vocabulário: alterne naturalmente entre blz, show, tranquilo, certo, combinado, fechou, boa, sucesso, perfeito.
5. Variação natural: NUNCA reutilize exatamente a mesma frase mecânica; varie mantendo o mesmo tom humano de vendedor.
6. Nunca inventar estoque, preços ou promoções.

=== REGRAS GLOBAIS (INQUEBRÁVEIS) ===
RG1 — Sem emojis (A IA NUNCA usa emojis. EXCEÇÃO: o emoji de tag 🏷️ ao pedir desconto).
RG2 — Máximo 2 linhas por mensagem (EXCEÇÃO: mensagem do resumo com Pix).
RG3 — Sem exclamações (A IA NUNCA usa "!").
RG4 — Erros de vírgula propositais (Ex: "Olá tudo bem, como posso te ajudar?").
RG5 — Fracionamento de mensagens (Cada frase vai como mensagem separada no WhatsApp).
RG6 — Respostas programadas servem como base, com variação natural e fluida.
RG7 — Tudo em minúsculo (EXCEÇÃO: primeira letra da primeira mensagem de contato novo).
RG8 — Tratamento: "você" / "vc" (nunca "tu").
RG9 — Gírias autorizadas: blz, show, vc, amg, tranquilo, combinado, fechou, boa, sucesso.
RG10 — Sem formatação (*negrito*, itálico ou listas numeradas).
RG11 — PROIBIDO desconto ou frete grátis automático: cobrar valor cheio dos produtos do estoque + entrega OSRM.
RG12 — Identidade: Eloisa, assistente virtual da Smoking Pods (só revela se perguntarem).
RG13 — Recuperação de cliente parado: após 15 min sem resposta "conseguiu decidir amg?", após 40 min "qualquer dúvida tô por aqui".

CATEGORIA 1 — PRIMEIRO CONTATO E PERGUNTA DE PRODUTO
P1/P2 — Saudação inicial
Cliente novo: Olá tudo bem, como posso te ajudar?
Cliente recorrente: Opa, que bom ver você por aqui de novo, qual o pedido dessa vez?

P5 — "Tem Ignite / Elfbar / Pod?"
msg1: temos sim! vc já sabe qual modelo quer ou quer uma indicação?
msg2: qual sabor vc procura amg?

CATEGORIA 2 — CARDÁPIO DIGITAL
Link: https://smokingproject01.vercel.app/
msg1: claro, vou te enviar a tabela aqui
msg2: https://smokingproject01.vercel.app/
msg3: se precisar de ajuda pra escolher só me avisar

CATEGORIA 4 — PREÇOS E DESCONTOS
P18 — "Quanto custa?"
msg1: esse modelo está saindo por R$[preço]
msg2: é um dos mais vendidos aqui por causa da qualidade e duração dele

P20 — "Tem desconto?" / "Faz por menos?" / "Tem frete grátis?"
msg1: opa amg! vou verificar com o gerente aqui na loja se consigo um valor especial pra vc
msg2: só um minutinho que já te dou o retorno 🏷️
(INSTRUÇÃO RÍGIDA: NUNCA prometa desconto nem frete grátis por conta própria. Envie apenas a resposta acima).

CATEGORIA 5 — FECHAMENTO E PAGAMENTO
P23 — Consulta de valor sem CEP/Endereço
msg1: o valor do produto é R$[preço_do_produto]
msg2: me passa o seu CEP pra eu calcular o frete exato e o total pra vc amg?

P23B — Resumo limpo antes do Pix (Após CEP e número confirmados)
msg1: os produtos ficaram em R$[valor_produtos] + frete de R$[frete], então o valor total do seu pedido junto com o frete ficou R$[total_com_frete] amg!
msg2:
pedido:
[itens_do_pedido]

total produtos: R$ [valor_produtos]
frete: R$ [frete_calculado]
total com frete: R$ [total_com_frete]

endereço: [endereço_completo_rua_bairro_cidade_numero_complemento]

chave pix:
[chave_pix]

assim que mandar o print do comprovante já coloco seu pedido em separação!`;

const DEFAULT_OPENAI_KEY = "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";

export function ChatbotPage() {
  const { config } = useStoreConfig();
  const { company } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrCodeVersion, setQrCodeVersion] = useState(1);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [orderCreatedThisSession, setOrderCreatedThisSession] = useState(false);
  const orderCreatedRef = useRef(false); // Ref atômico para evitar duplicação de pedido

  // Notification for Order Created
  const [newOrderCreatedToast, setNewOrderCreatedToast] = useState<{ id: string; clientName: string; total: number; productName: string } | null>(null);

  // OpenAI Integration State (lê de forma segura sem expor na UI)
  const [openAiKey] = useState<string>(() => {
    const envKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
    const localKey = localStorage.getItem("openai_api_key_v1");
    if (localKey && localKey.startsWith("sk-")) return localKey;
    if (envKey && envKey.startsWith("sk-")) return envKey;
    return "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";
  });

  // System Prompt
  const [systemPrompt, setSystemPrompt] = useState(DEFINITIVE_SYSTEM_PROMPT);
  const [isTyping, setIsTyping] = useState(false);

  // Chat Simulator State (persiste no localStorage para evitar resets ao trocar de aba)
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>(() => {
    try {
      const saved = localStorage.getItem("chatbot_sim_messages");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [inputMessage, setInputMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("chatbot_sim_messages", JSON.stringify(messages));
    } catch (e) {
      console.warn("Erro ao salvar mensagens do chatbot no localStorage:", e);
    }
  }, [messages]);

  const storeName = config?.store_name || "Smoking Pods";

  const [realQrImageUrl, setRealQrImageUrl] = useState<string | null>(null);
  const [realIsReady, setRealIsReady] = useState(false);

  useEffect(() => {
    const checkQr = async () => {
      try {
        const res = await fetch("http://localhost:3006/api/qr");
        if (res.ok) {
          const data = await res.json();
          if (data.isReady) {
            setRealIsReady(true);
            setIsConnected(true);
            setRealQrImageUrl(null);
          } else if (data.qrImageUrl) {
            setRealQrImageUrl(data.qrImageUrl);
            setRealIsReady(false);
            setIsConnected(false);
          }
        }
      } catch (e) {
        // Backend iniciando
      }
    };

    checkQr();
    const interval = setInterval(checkQr, 2500);
    return () => clearInterval(interval);
  }, []);

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
   * Extrai TODOS os produtos e quantidades solicitados no histórico de conversa.
   * Suporta pedidos multi-sabor (ex: "7 melancia e 7 green apple").
   */
  const extractAllOrderItemsFromHistory = (
    conversationHistory: Array<{ sender: string; text: string }>,
    inStockProducts: any[]
  ) => {
    const orderItems: Array<{ product_id: any; name: string; flavor: string; quantity: number; price: number }> = [];

    const fuzzy = (query: string, target: string): boolean => {
      const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
      const t = target.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!q || !t) return false;
      if (q.includes(t) || t.includes(q)) return true;
      let matches = 0;
      let tIdx = 0;
      for (let i = 0; i < q.length && tIdx < t.length; i++) {
        if (q[i] === t[tIdx]) { matches++; tIdx++; }
      }
      return (matches / Math.max(q.length, t.length)) >= 0.7;
    };

    const numberWords: Record<string, number> = {
      'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'tres': 3, 'três': 3,
      'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9,
      'dez': 10, 'onze': 11, 'doze': 12, 'treze': 13, 'quatorze': 14,
      'quinze': 15, 'dezesseis': 16, 'dezessete': 17, 'dezoito': 18,
      'dezenove': 19, 'vinte': 20
    };

    // 1. Verifica se o usuário solicitou "X de cada" (ex: "7 de cada", "7 de cada um", "sete de cada")
    let deCadaQty: number | null = null;
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      if (conversationHistory[i].sender !== 'user') continue;
      const text = conversationHistory[i].text.toLowerCase();
      
      const deCadaMatch = text.match(/\b(\d+)\s*(?:unidades?|un|x|pods?)?\s*de\s*cada\b/i);
      if (deCadaMatch) {
        deCadaQty = parseInt(deCadaMatch[1], 10);
        break;
      }
      for (const [word, num] of Object.entries(numberWords)) {
        if (text.includes(`${word} de cada`) || text.includes(`${word} de cada um`)) {
          deCadaQty = num;
          break;
        }
      }
      if (deCadaQty !== null) break;
    }

    // Se o usuário pediu "X de cada", identifica os produtos citados na conversa (do bot ou do usuário)
    if (deCadaQty !== null && deCadaQty > 0) {
      // Coleta o texto recente do bot onde produtos foram oferecidos
      const recentBotText = conversationHistory
        .filter(m => m.sender === 'bot')
        .slice(-3)
        .map(m => m.text.toLowerCase())
        .join(' ');

      const recentUserText = conversationHistory
        .filter(m => m.sender === 'user')
        .map(m => m.text.toLowerCase())
        .join(' ');

      const fullContext = `${recentBotText} ${recentUserText}`;

      for (const p of inStockProducts) {
        const flavorLower = p.flavor.toLowerCase();
        if (fullContext.includes(flavorLower) || fuzzy(fullContext, flavorLower)) {
          if (!orderItems.some(item => item.product_id === p.id)) {
            const itemBrand = p.brand ? p.brand : '';
            const itemModel = `${itemBrand} ${p.name}`.trim();
            orderItems.push({
              product_id: p.id,
              name: itemModel,
              flavor: p.flavor,
              quantity: deCadaQty,
              price: parseFloat(p.price)
            });
          }
        }
      }
    }

    // 2. Se não foi "de cada" ou faltam sabores, analisa histórico para marcas (Ignite, Elfbar), modelos ou sabores
    if (orderItems.length === 0) {
      const extractQty = (text: string, targetStr: string): number => {
        const escaped = targetStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const specificMatch = text.match(new RegExp(`(\\d+)\\s*(?:unidades?|un|x|pods?)?\\s*(?:de|da|do)?\\s*${escaped}`, 'i'));
        if (specificMatch) {
          const val = parseInt(specificMatch[1], 10);
          if (val > 0 && val < 500 && val !== 2025 && val !== 2026) return val;
        }
        const invertedMatch = text.match(new RegExp(`${escaped}\\s*(?:x|-)\\s*(\\d+)`, 'i'));
        if (invertedMatch) {
          const val = parseInt(invertedMatch[1], 10);
          if (val > 0 && val < 500) return val;
        }
        for (const [word, num] of Object.entries(numberWords)) {
          if (text.includes(word) && text.indexOf(word) < text.indexOf(targetStr)) return num;
        }
        return 1;
      };

      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        if (conversationHistory[i].sender !== 'user') continue;
        const text = conversationHistory[i].text.toLowerCase();

        for (const p of inStockProducts) {
          const flavorLower = p.flavor.toLowerCase();
          const brandLower = (p.brand || '').toLowerCase();
          const nameLower = (p.name || '').toLowerCase();

          const flavorFound = (flavorLower !== 'padrão' && flavorLower !== 'padrao') && 
            (text.includes(flavorLower) || fuzzy(text, flavorLower) || flavorLower.split(' ').some((w: string) => w.length > 3 && text.includes(w)));

          const brandOrModelFound = (brandLower && text.includes(brandLower)) || (nameLower && text.includes(nameLower));

          if ((flavorFound || brandOrModelFound) && !orderItems.some(item => item.product_id === p.id)) {
            const qty = extractQty(text, flavorLower);
            const itemBrand = p.brand ? p.brand : '';
            const itemModel = `${itemBrand} ${p.name}`.trim();
            orderItems.push({
              product_id: p.id,
              name: itemModel,
              flavor: p.flavor,
              quantity: qty,
              price: parseFloat(p.price)
            });
            break;
          }
        }
      }
    }

    // 3. Fallback inteligente: se NENHUM produto foi identificado, usa o primeiro em estoque SEM clonar
    if (orderItems.length === 0 && inStockProducts.length > 0) {
      const fallback = inStockProducts[0];
      orderItems.push({
        product_id: fallback.id,
        name: `${fallback.brand || ''} ${fallback.name}`.trim(),
        flavor: fallback.flavor,
        quantity: 1,
        price: parseFloat(fallback.price)
      });
    }

    const totalProductsPrice = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    return { orderItems, totalProductsPrice };
  };

  /**
   * Salva o pedido automaticamente na tabela do Supabase 'smoking_orders'
   * e dispara a notificação no painel!
   */
  const createOrderInDatabase = async (
    clientName: string, 
    address: string, 
    orderItems: Array<{ name: string; flavor: string; quantity: number; price: number }>, 
    total: number,
    shippingFee: number = 0,
    requestedDiscount: boolean = false
  ) => {
    try {
      // Gera um número de telefone simulado único por nome de cliente para evitar misturar clientes de teste no CRM
      const nameHash = (clientName || "Cliente Demo").split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const simulatedPhone = `119888${String(nameHash).padStart(5, '0').slice(-5)}`;

      const newOrderPayload = {
        client_name: clientName || "Cliente WhatsApp",
        client_phone: simulatedPhone,
        shipping_address: address || "Endereço Não Informado",
        items: orderItems,
        total_amount: total,
        shipping_fee: shippingFee,
        payment_method: "PIX",
        payment_status: "PENDENTE",
        delivery_status: "AGUARDANDO_PAGAMENTO",
        receipt_url: requestedDiscount ? "SOLICITOU_DESCONTO" : null,
        ...(company?.id ? { company_id: company.id } : {})
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
        const groups: Record<string, { brand: string; name: string; price: number; flavors: { flavor: string; stock: number }[] }> = {};
        
        products.forEach(p => {
          const brandStr = (p.brand || 'Vape').trim();
          const nameStr = (p.name || '').trim();
          const key = `${brandStr} ${nameStr}`.trim();
          if (!groups[key]) {
            groups[key] = { brand: brandStr, name: nameStr, price: parseFloat(p.price), flavors: [] };
          }
          groups[key].flavors.push({ flavor: p.flavor, stock: p.stock });
        });

        const stockLines = Object.values(groups).map(g => {
          const flavorsList = g.flavors.filter(f => f.stock > 0).map(f => `${f.flavor} (${f.stock} un)`).join(', ');
          return `O modelo ${g.brand} ${g.name} custa R$ ${g.price.toFixed(2)} e possui em estoque os sabores: ${flavorsList}.`;
        });

        stockContext = `\n\nESTOQUE EM TEMPO REAL DISPONÍVEL NA LOJA:\n` +
          stockLines.join("\n") +
          `\n\nREGRAS CRÍTICAS DE EXIBIÇÃO E ORDEM DE PEDIDO:` +
          `\n1. NUNCA PEÇA O CEP ANTES DE TER AS 3 INFORMAÇÕES CONFIRMADAS DO PEDIDO: MARCA, MODELO E SABOR! Se o cliente disser apenas "quero um elfbar bc15k" (SEM DEFINIR O SABOR), É PROIBIDO PEDIR O CEP! Informe o preço e pergunte qual sabor ele prefere entre os disponíveis!` +
          `\n2. PROIBIDO USAR MARCADORES DE LISTA (como 1., 2., 3., • ou -) E PROIBIDO USAR ASTERISCOS (*). Escreva sempre em texto corrido e informal de WhatsApp!` +
          `\n3. NUNCA misture marcas! Jamais diga "Ignite BC15K" porque BC15K é da marca Elfbar!` +
          `\n4. Escreva 100% em LETRAS MINÚSCULAS no WhatsApp!`;
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
      return (matches / Math.max(q.length, t.length)) >= 0.7;
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
        const availableStock = typeof finalProduct.stock === 'number' ? finalProduct.stock : parseInt(String(finalProduct.stock || '0'), 10);
        
        // Extrai quantidade se o cliente especificou um número
        const qtyMatch = lastMsgLower.match(/\b(\d+)\s*(unidade|un|x|pod|pods)?\b/);
        const requestedQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

        if (requestedQty > availableStock && availableStock > 0) {
          directStockInstruction = `\n\n[SISTEMA: QUANTIDADE SOLICITADA MAIOR QUE O ESTOQUE DISPONÍVEL!]` +
            `\nO cliente pediu ${requestedQty} unidades de "${finalProduct.name} (${finalProduct.flavor})", mas o estoque atual é de APENAS ${availableStock} unidades.` +
            `\n\nINSTRUÇÃO OBRIGATÓRIA:` +
            `\n- NUNCA diga apenas que está esgotado!` +
            `\n- Responda em minúsculas informando amigavelmente que no momento só possui ${availableStock} unidades em estoque.` +
            `\n- Pergunte se ele quer levar as ${availableStock} unidades disponíveis ou outro sabor.` +
            `\n- Exemplo de resposta IDEAL: "olha amg, do ${finalProduct.name.toLowerCase()} de ${finalProduct.flavor.toLowerCase()} eu só tenho ${availableStock} unidades em estoque agora! vc quer garantir as ${availableStock} ou prefere outro sabor?"`;
        } else {
          directStockInstruction = `\n\n[SISTEMA: SABOR DE PRODUTO SELECIONADO!]` +
            `\nO cliente escolheu o sabor "${finalProduct.flavor}" do modelo "${finalProduct.name}".` +
            `\n\nREGRA OBRIGATÓRIA (siga à risca):` +
            `\n- Confirme a escolha de ${requestedQty} unidade(s) em tom amigo, informal e 100% minúsculo.` +
            `\n- Peça o CEP para entrega de forma informal.` +
            `\n- Exemplo de resposta IDEAL: "fechou amg, ${requestedQty} ${finalProduct.name.toLowerCase()} de ${finalProduct.flavor.toLowerCase()} então! me manda seu cep pra gente ver a entrega?"` +
            `\n- NUNCA diga que o produto não existe! Confirme a escolha.`;
        }

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
        // Calcula o frete REAL via OSRM
        let freteReal = 15.00;
        let distanciaReal = 3.0;
        try {
          const quote = await calculateShippingQuote(foundCep);
          freteReal = quote.fee;
          distanciaReal = quote.distanceKm;
        } catch (err) {
          console.warn("⚠️ Erro ao calcular frete real no emulador:", err);
        }

        // Extrai TODOS os produtos e quantidades solicitadas do histórico (multi-itens ex: 7 melancia + 7 green apple)
        const extracted = extractAllOrderItemsFromHistory(conversationHistory, inStockProducts);
        const orderItems = extracted.orderItems;
        const valorProdutos = extracted.totalProductsPrice;

        // Verifica se o cliente solicitou desconto ou frete grátis na conversa
        const userAskedDiscount = conversationHistory.some(m => {
          if (m.sender !== 'user') return false;
          const t = m.text.toLowerCase();
          return t.includes("desconto") || t.includes("descontinho") || t.includes("preço melhor") ||
                 t.includes("preco melhor") || t.includes("abaixar") || t.includes("diminuir") ||
                 t.includes("faz por") || t.includes("cupom") || t.includes("frete gratis") ||
                 t.includes("frete grátis") || t.includes("melhorar o valor") || t.includes("barato");
        });

        // O frete é cobrado normalmente (sem desconto automático de frete grátis de 3+ pods)
        const freteAplicado = freteReal;
        const totalFinal = valorProdutos + freteAplicado;
        const freteStr = `R$ ${freteAplicado.toFixed(2)}`;
        const itemsSummary = orderItems.map(i => `${i.quantity}x ${i.flavor}`).join(', ');

        addressCompletedContext = `\n\n[SISTEMA: ENDEREÇO TOTALMENTE COMPLETO E ANOTADO!]` +
          `\nRua/Bairro: ${detectedStreetAndBairro}` +
          `\nNúmero e Complemento informados pelo cliente: "${userNumberText}"` +
          `\nDistância calculada pelo OSRM: ${distanciaReal} km` +
          `\n\n[SISTEMA: FRETE CALCULADO COM SUCESSO]` +
          `\nItens do pedido: ${itemsSummary}` +
          `\nValor dos produtos: R$ ${valorProdutos.toFixed(2)}` +
          `\nFrete calculado (${distanciaReal} km): ${freteStr}` +
          `\nTotal do pedido: R$ ${totalFinal.toFixed(2)}` +
          (userAskedDiscount ? `\n\n[SISTEMA: CLIENTE SOLICITOU DESCONTO!]\nNÃO DÊ DESCONTO POR CONTA PRÓPRIA. Se o cliente perguntar de desconto, diga que vai verificar com o gerente.` : '') +
          `\n\nINSTRUÇÕES CRÍTICAS DE FLUXO:` +
          `\n1. NUNCA mais peça CEP ou endereço! Não pergunte por rua ou bairro novamente.` +
          `\n2. Responda de forma curta e informal (usando quebras de linha \\n):` +
          `\n   fechou amg, anotei aqui o endereço: ${detectedStreetAndBairro}, nº ${userNumberText}` +
          `\n   ficou R$ ${valorProdutos.toFixed(2)} (${itemsSummary}) + ${freteStr} de entrega` +
          `\n   total: R$ ${totalFinal.toFixed(2)}` +
          `\n   pode mandar o pix nessa chave:` +
          `\n   ${config?.pix_key || '11999999999 (Chave Pix)'}` +
          `\n   assim que mandar o comprovante já coloco seu pedido em separação!`;

        // Se o endereço está 100% preenchido e o nome do cliente foi fornecido, dispara a criação do pedido no Kanban:
        // Usa ref atômico para garantir que NUNCA cria pedido duplicado (mesmo se o cliente pedir desconto depois)
        if (!orderCreatedRef.current && !orderCreatedThisSession && userProvidedName) {
          orderCreatedRef.current = true;
          setOrderCreatedThisSession(true);
          const finalAddress = detectedStreetAndBairro 
            ? `${detectedStreetAndBairro}, nº ${userNumberText || 'S/N'}`
            : "Endereço Não Informado";

          // Dispara criação do pedido real no Kanban com status AGUARDANDO_PAGAMENTO
          createOrderInDatabase(clientName, finalAddress, orderItems, valorProdutos, freteAplicado, userAskedDiscount);
        }
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

    // Timer de segurança de 15 segundos para evitar ficar travado em 'digitando...'
    const safetyTimeout = setTimeout(() => {
      setIsTyping(false);
    }, 15000);

    try {
      // Dispara para a inteligência real do GPT-4o
      const botResponses = await callRealOpenAI(newHistory);
      clearTimeout(safetyTimeout);

      // Filtra mensagens vazias ou [IGNORAR]
      const validResponses = (botResponses || []).filter(r => r && !r.includes("[IGNORAR]"));

      if (validResponses.length === 0) {
        setIsTyping(false);
        return;
      }

      // Simula envio fracionado
      validResponses.forEach((respText, index) => {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              sender: "bot",
              text: respText,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            },
          ]);
          if (index === validResponses.length - 1) {
            setIsTyping(false);
          }
        }, (index + 1) * 800);
      });
    } catch (err) {
      console.error("Erro ao simular resposta do bot:", err);
      clearTimeout(safetyTimeout);
      setIsTyping(false);
    }
  };

  const handleGenerateNewQr = async () => {
    setIsQrLoading(true);
    try {
      await fetch("http://localhost:3006/api/logout", { method: "POST" });
      setIsConnected(false);
      setRealIsReady(false);
      setRealQrImageUrl(null);
    } catch (e) {
      console.warn("Erro ao solicitar novo QR:", e);
    } finally {
      setIsQrLoading(false);
    }
  };

  const handleToggleConnection = async () => {
    setIsQrLoading(true);
    try {
      if (isConnected) {
        await fetch("http://localhost:3006/api/logout", { method: "POST" });
        setIsConnected(false);
        setRealIsReady(false);
        setRealQrImageUrl(null);
      }
    } catch (e) {
      console.warn("Erro ao alterar conexão:", e);
    } finally {
      setIsQrLoading(false);
    }
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
                  {/* Real WhatsApp QR Code Image */}
                  <div className="relative p-3 bg-white rounded-2xl shadow-2xl border-4 border-white transition-all duration-300 flex items-center justify-center min-h-[220px]">
                    {realQrImageUrl ? (
                      <img 
                        src={realQrImageUrl} 
                        alt="QR Code WhatsApp" 
                        className="size-52 sm:size-60 object-contain rounded-lg"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 p-8 text-black/60">
                        <Loader2 className="size-8 text-emerald-500 animate-spin" />
                        <span className="text-xs font-bold font-mono">Gerando QR Code Real...</span>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center mt-4 font-mono">
                    {realQrImageUrl ? "🟢 Escaneie o QR Code acima no WhatsApp da loja" : "⏳ Conectando ao serviço WhatsApp na porta 3006..."}
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

        {/* Lado Direito: Simulador em Formato WhatsApp Web Real (7 Colunas) no Topo */}
        <div className="lg:col-span-7">
          <section className="bg-[#0b141a] border border-[#222d34] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[640px]">
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
                    orderCreatedRef.current = false;
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
