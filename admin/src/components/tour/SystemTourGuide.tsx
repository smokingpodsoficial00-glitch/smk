import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Sparkles, ChevronRight, ChevronLeft, X, Check, Compass, 
  PackageSearch, CircleDollarSign, RefreshCw, BarChart3, 
  PlusCircle, Layers, Flame, Users, Megaphone, Rocket,
  FastForward, Minimize2, Maximize2, ShieldAlert
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export interface TourStep {
  id: string;
  badge: string;
  route: string;
  title: string;
  description: string;
  tips: string[];
  icon: React.ReactNode;
  targetSelector?: string;
  pointerText?: string;
  warningNote?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "pedidos",
    badge: "Etapa 1 de 11 • Operação Diária",
    route: "/pedidos",
    title: "📦 Pedidos: Kanban & Expedição em Tempo Real",
    targetSelector: '[data-tour="kanban-pedidos"]',
    pointerText: "👇 KANBAN DE EXPEDIÇÃO EM TEMPO REAL 👇",
    description: "Aqui é o coração da sua operação diária! Todos os pedidos feitos pelos clientes no catálogo caem instantaneamente na coluna 'Novo'. Conforme sua equipe trabalha, você arrasta os cards entre 'Em Separação', 'Em Rota' e 'Entregue'. No topo, use os filtros de 24h, Hoje, Ontem, 7 dias e 30 dias para acompanhar o volume de entregas com precisão.",
    tips: ["Arraste os cards para atualizar o status do pedido", "Filtros rápidos no topo para fechamento diário"],
    icon: <PackageSearch className="size-6 text-sky-400" />
  },
  {
    id: "financeiro_caixa",
    badge: "Etapa 2 de 11 • Saúde Financeira & Caixa",
    route: "/financeiro",
    title: "💰 Caixa Real & Recompras de Estoque",
    targetSelector: '[data-tour="financeiro-recompra-caixa"]',
    pointerText: "👇 CAIXA REAL & HISTÓRICO DE RECOMPRAS 👇",
    description: "Aqui você tem o verdadeiro controle do seu fluxo financeiro: o Caixa Real Calculado pelo sistema (faturamento total acumulado menos todas as compras de mercadoria), o total pago em reposições e o histórico completo de recompras para conferência sem furos contábeis!",
    tips: ["Monitore seu saldo de Caixa Real em tempo real", "Consulte a tabela de histórico de reposições"],
    icon: <CircleDollarSign className="size-6 text-emerald-400" />
  },
  {
    id: "financeiro_recompra",
    badge: "Etapa 3 de 11 • Gestão de Compras",
    route: "/financeiro",
    title: "🔄 Registrar Recompra de Estoque",
    targetSelector: '[data-tour="btn-registrar-recompra"]',
    pointerText: "👉 CLIQUE AQUI: REGISTRAR RECOMPRA 👈",
    description: "Atenção máxima a este botão: sempre que pagar mercadorias para o seu fornecedor, clique em 'Registrar Recompra'. Aqui você informa a data, os valores e anota os pods comprados. O sistema atualiza o estoque e abate do caixa instantaneamente!",
    tips: ["Clique sempre que fizer reposição com fornecedor", "Mantém seu Caixa Real 100% conciliado"],
    icon: <RefreshCw className="size-6 text-indigo-400" />
  },
  {
    id: "financeiro_longo_prazo",
    badge: "Etapa 4 de 11 • Inteligência de Escala",
    route: "/financeiro",
    title: "📈 Faturamento a Longo Prazo & Gráficos",
    targetSelector: '[data-tour="financeiro-longo-prazo"]',
    pointerText: "👇 HISTÓRICO & EVOLUÇÃO A LONGO PRAZO 👇",
    description: "O seu mapa de crescimento! Nesta seção exclusiva, acompanhe a evolução visual do seu negócio em ciclos Mensais, Trimestrais, Semestrais e Anuais. Alterne entre 'Histórico' para ver o DRE detalhado de períodos passados e 'Evolução' para analisar gráficos e projeções de faturamento.",
    tips: ["Alterne entre Histórico e Evolução nos gráficos", "Acompanhe seus ciclos mensais e trimestrais"],
    icon: <BarChart3 className="size-6 text-emerald-400" />
  },
  {
    id: "estoque_ranking",
    badge: "Etapa 5 de 11 • Inteligência de Estoque",
    route: "/estoque",
    title: "📊 Reposição: Ranking dos Campeões de Venda",
    targetSelector: '[data-tour="ranking-vendas"]',
    pointerText: "👇 RANKING DOS MAIS VENDIDOS 👇",
    description: "Por que esse ranking é vital? Porque ele te mostra matematicamente quais marcas e modelos mais vendem. Você descobre exatamente o que deve recomprar em maior escala para nunca faltar estoque, e o que deve cortar ou queimar para não empatar seu capital de giro!",
    tips: ["Recompre os líderes do ranking sem medo", "Evite recomprar modelos sem giro"],
    icon: <BarChart3 className="size-6 text-amber-400" />
  },
  {
    id: "estoque_novo_produto",
    badge: "Etapa 6 de 11 • Catálogo & Produtos",
    route: "/estoque",
    title: "➕ Cadastrar Novo Produto na Prateleira",
    targetSelector: '[data-tour="btn-novo-produto"]',
    pointerText: "👉 CLIQUE AQUI: + NOVO PRODUTO 👈",
    description: "Cadastrar novos pods é muito simples: basta clicar no botão '+ Novo Produto' no topo. Você preenche a marca, modelo, quantidade de pods, preço de custo, preço de venda e coloca a foto. Assim que salvar, o pod entra imediatamente na sua prateleira e no catálogo universal.",
    tips: ["Preencha o custo e venda para cálculo automático de margem", "Fotos limpas aumentam a conversão do catálogo"],
    icon: <PlusCircle className="size-6 text-white" />
  },
  {
    id: "estoque_sabores",
    badge: "Etapa 7 de 11 • Variações & Sabores",
    route: "/estoque",
    title: "🏷️ Prateleira & Gestão Rápida de Sabores",
    targetSelector: '[data-tour="btn-ver-sabores"]',
    pointerText: "👉 CLIQUE AQUI: VER SABORES 👈",
    description: "Aqui você gerencia suas marcas. Clicando no botão 'Ver Sabores' em qualquer pod, você abre a gaveta de sabores onde pode ativar, pausar estoque zerado ou cadastrar novos sabores em segundos. O catálogo dos seus clientes atualiza em tempo real sem precisar recarregar a página.",
    tips: ["Clique em 'Ver Sabores' para pausar ou adicionar opções", "Sincronização instantânea com a tabela dos clientes"],
    icon: <Layers className="size-6 text-purple-400" />
  },
  {
    id: "estoque_parados",
    badge: "Etapa 8 de 11 • Queima de Estoque",
    route: "/estoque",
    title: "🔥 Radar de Produtos Parados & Modo Demonstração",
    targetSelector: '[data-tour="tab-produtos-parados"]',
    pointerText: "👉 CLIQUE AQUI: PRODUTOS PARADOS 👈",
    description: "No seletor superior, alternando para a aba 'Produtos Parados', o radar identifica mercadorias sem giro há mais de 7 dias e calcula o capital empatado. Como sua conta é nova, ativamos o Modo Demonstração para você simular ofertas relâmpago no botão '+ Promo' e criar avisos no botão 'VIP'!",
    tips: ["Use o botão '+ Promo' para queimar itens parados", "Dispare ofertas exclusivas para seu Grupo VIP"],
    icon: <Flame className="size-6 text-amber-500" />
  },
  {
    id: "crm_clientes",
    badge: "Etapa 9 de 11 • LTV & Retenção",
    route: "/clientes",
    title: "👥 Clientes & CRM Preditivo por Puffs",
    targetSelector: '[data-tour="crm-tabs"]',
    pointerText: "👇 NAVEGUE PELAS ABAS DO CRM 👇",
    description: "O cérebro de retenção da sua loja! Na aba 'Ranking & Fidelidade', você monitora quem compra a cada 15 dias e quem está sumindo (Risco de Churn). Na aba 'Aviso de Fim de Pod & Recompra', o sistema calcula os puffs consumidos e te avisa a data exata de chamar o cliente no WhatsApp antes do pod acabar!",
    tips: ["Fidelize clientes com recompra a cada 15 dias", "Aborde preventivamente antes que o pod seque"],
    icon: <Users className="size-6 text-cyan-400" />
  },
  {
    id: "marketing_disparos",
    badge: "Etapa 10 de 11 • Escala de Vendas",
    route: "/marketing",
    title: "📢 Marketing & Disparos com Cadência Segura",
    targetSelector: '[data-tour="btn-nova-campanha"]',
    pointerText: "👉 CLIQUE AQUI: NOVA CAMPANHA 👈",
    description: "Chegou a hora de escalar suas vendas! Conecte seu WhatsApp via QR Code e sincronize suas listas. ⚠️ ATENÇÃO MÁXIMA: Tome muito cuidado com a quantia de disparos, pois NÃO nos responsabilizamos por eventuais bloqueios do WhatsApp pela Meta! A cadência ideal e segura recomendada é de 5 disparos com pausa de 35 minutos para proteger e aquecer o seu número.",
    warningNote: "Tome muito cuidado com a quantia de disparos. Não nos responsabilizamos por bloqueio do WhatsApp! A cadência ideal são 5 disparos com pausa de 35 minutos.",
    tips: [
      "⚠️ Não nos responsabilizamos por bloqueios do WhatsApp",
      "⏱️ Cadência ideal: 5 disparos com pausa de 35 minutos",
      "🛡️ Aquecimento seguro do chip respeitando os intervalos"
    ],
    icon: <Megaphone className="size-6 text-pink-400" />
  },
  {
    id: "conclusao",
    badge: "Etapa 11 de 11 • Pronto para Operar",
    route: "/configuracoes",
    title: "🚀 Tudo Pronto! Sua Operação Vai Decolar",
    targetSelector: '[data-tour="settings-store-name"]',
    pointerText: "👉 DEFINA O NOME DA SUA LOJA AQUI 👈",
    description: "Parabéns! Agora você conhece todas as engrenagens do sistema. O próximo passo é definir o nome da sua loja aqui nas configurações para gerar seu Link Universal do Catálogo, cadastrar seu estoque e começar a faturar. Boas vendas!",
    tips: ["Defina o nome da loja nas configurações", "Gere o link do catálogo e coloque na Bio"],
    icon: <Rocket className="size-6 text-emerald-400" />
  },
];

const TOUR_DISMISSED_KEY = "smk_tour_permanently_dismissed";

export function openSystemTour() {
  window.dispatchEvent(new CustomEvent("open-system-tour"));
}

export function SystemTourGuide() {
  const navigate = useNavigate();
  const location = useLocation();
  const { company } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Efeito Typewriter
  const [typedChars, setTypedChars] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estado da posição do elemento destacado (Spotlight)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const hasCheckedAutoOpen = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Notifica o ecossistema (ex: Botão Flutuante de Suporte) quando o tour estiver ocupando o canto inferior direito
  useEffect(() => {
    const isTourActive = (isOpen && !isMinimized) || isWelcomeOpen;
    window.dispatchEvent(
      new CustomEvent("tour-visibility-change", {
        detail: { isTourActive }
      })
    );
  }, [isOpen, isMinimized, isWelcomeOpen]);

  // Verificação inicial estrita: Abre automaticamente no primeiro acesso real de cada empresa
  useEffect(() => {
    if (!company?.id) return;
    if (hasCheckedAutoOpen.current) return;
    hasCheckedAutoOpen.current = true;

    const companyTourKey = `smk_tour_completed_${company.id}`;
    const isDismissed = localStorage.getItem(companyTourKey) === "true";

    if (!isDismissed) {
      const t = setTimeout(() => {
        setIsWelcomeOpen(true);
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [company?.id]);

  // Listener para evento customizado de reabertura manual via Sidebar
  useEffect(() => {
    const handleOpen = () => {
      setIsWelcomeOpen(false);
      setIsMinimized(false);
      setCurrentStep(0);
      setIsOpen(true);
    };

    window.addEventListener("open-system-tour", handleOpen);
    return () => window.removeEventListener("open-system-tour", handleOpen);
  }, []);

  const activeStep = TOUR_STEPS[currentStep] || TOUR_STEPS[0];

  // Sincronizar rota e iniciar typewriter ao mudar de etapa
  useEffect(() => {
    if (!isOpen) return;

    if (location.pathname !== activeStep.route) {
      navigate(activeStep.route);
    }

    // Iniciar animação do typewriter para a etapa atual
    setTypedChars(0);
    setIsTyping(true);

    if (timerRef.current) clearInterval(timerRef.current);

    const fullText = activeStep.description;
    let index = 0;

    timerRef.current = setInterval(() => {
      index += 1;
      setTypedChars(index);
      if (index >= fullText.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsTyping(false);
      }
    }, 14);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, currentStep, activeStep]);

  // Rastreamento e Spotlight dinâmico do elemento alvo da etapa (Zero Lag no Scroll & Auto-Resize Instantâneo)
  useEffect(() => {
    if (!isOpen || isMinimized) {
      setTargetRect(null);
      return;
    }

    let isMounted = true;
    let observedEl: Element | null = null;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const updateRect = () => {
      if (!isMounted) return;
      if (!activeStep.targetSelector) {
        setTargetRect(null);
        return;
      }
      const el = document.querySelector(activeStep.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);

        // Conecta observadores de redimensionamento e mutações de DOM no elemento ativo
        if (el !== observedEl) {
          if (observedEl && ro) ro.unobserve(observedEl);
          if (mo) mo.disconnect();
          observedEl = el;
          if (ro) ro.observe(el);
          if (mo) {
            mo.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
          }
        }
      } else {
        setTargetRect(null);
        if (observedEl && ro) {
          ro.unobserve(observedEl);
          observedEl = null;
        }
        if (mo) mo.disconnect();
      }
    };

    const handleScrollOrResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateRect);
    };

    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        handleScrollOrResize();
      });
    }

    if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(() => {
        handleScrollOrResize();
      });
    }

    // Listener global de cliques: qualquer clique em abas (Mensal/Trimestral/Anual/Evolução) dispara re-cálculo imediato
    const handleClickOrTouch = () => {
      handleScrollOrResize();
      setTimeout(handleScrollOrResize, 30);
      setTimeout(handleScrollOrResize, 100);
      setTimeout(handleScrollOrResize, 250);
      setTimeout(handleScrollOrResize, 450);
    };

    // Ticks para aguardar transições de rota e montagem de componentes
    const timers = [
      setTimeout(updateRect, 50),
      setTimeout(updateRect, 180),
      setTimeout(() => {
        updateRect();
        const el = document.querySelector(activeStep.targetSelector || "");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }
      }, 400),
      setTimeout(updateRect, 800),
      setTimeout(updateRect, 1400),
    ];

    // Polling contínuo leve (heartbeat a cada 200ms) enquanto o tour estiver aberto para garantir sincronização 100% à prova de falhas
    const interval = setInterval(updateRect, 200);

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("click", handleClickOrTouch, true);

    return () => {
      isMounted = false;
      timers.forEach(clearTimeout);
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (observedEl && ro) ro.unobserve(observedEl);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("click", handleClickOrTouch, true);
    };
  }, [isOpen, isMinimized, currentStep, activeStep, location.pathname]);

  // Pular o efeito typewriter e mostrar texto completo imediatamente ao clicar
  const handleFastForwardText = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTypedChars(activeStep.description.length);
    setIsTyping(false);
  };

  // Gravar preferência definitiva no localStorage para nunca reabrir sozinho nesta empresa
  const markTourPermanentlyDismissed = () => {
    if (company?.id) {
      localStorage.setItem(`smk_tour_completed_${company.id}`, "true");
    }
  };

  // Encerrar tour completo
  const handleSkipEntireTour = () => {
    markTourPermanentlyDismissed();
    setIsWelcomeOpen(false);
    setIsOpen(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Iniciar tour a partir do modal de boas-vindas
  const handleStartTour = () => {
    markTourPermanentlyDismissed();
    setIsWelcomeOpen(false);
    setIsMinimized(false);
    setCurrentStep(0);
    setIsOpen(true);
  };

  // Avançar card / etapa
  const handleNextStep = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSkipEntireTour();
    }
  };

  // Voltar card / etapa
  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Cálculo da posição da seta / indicador flutuante com guarda de visibilidade
  const badgePositionData = useMemo(() => {
    if (!targetRect) return null;
    
    // Oculta a seta caso o elemento scrollado saia completamente da tela
    const isTargetVisible = 
      targetRect.bottom > 20 && 
      targetRect.top < (typeof window !== "undefined" ? window.innerHeight - 20 : 1080);
    if (!isTargetVisible) return null;

    const badgeWidth = 340;
    const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
    
    // Centraliza horizontalmente sobre o elemento com limites de tela
    const left = Math.max(16, Math.min(screenWidth - badgeWidth - 16, targetRect.left + (targetRect.width / 2) - (badgeWidth / 2)));
    
    // Se o elemento estiver com folga acima, posiciona a seta acima dele
    if (targetRect.top > 75) {
      return {
        top: targetRect.top - 54,
        left,
        arrow: "👇",
      };
    }
    // Caso contrário, posiciona a seta logo abaixo
    return {
      top: targetRect.bottom + 14,
      left,
      arrow: "👆",
    };
  }, [targetRect]);

  const progressPercentage = Math.round(((currentStep + 1) / TOUR_STEPS.length) * 100);

  return (
    <>
      {/* ━━━ SPOTLIGHT + ANEL DE LUZ + SETA ANIMADA (SINALIZAÇÃO DO BOTÃO) ━━━━━ */}
      {isOpen && !isMinimized && targetRect && (
        <>
          {/* Anel de Luz cravado no elemento - Transição de tamanho instantânea/suave, zero atraso no scroll */}
          <div 
            className="fixed pointer-events-none z-[99990] transition-[opacity,box-shadow,border-color,width,height] duration-150 ease-out rounded-2xl"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 45px 10px rgba(245, 158, 11, 0.9), inset 0 0 20px rgba(245, 158, 11, 0.3)",
              border: "3px solid #f59e0b",
            }}
          />

          {/* Seta Animada Apontando Diretamente para o Botão / Card */}
          {badgePositionData && (
            <div
              className="fixed pointer-events-none z-[99995] transition-opacity duration-200 flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-black text-xs sm:text-sm tracking-wide bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-black shadow-[0_0_35px_rgba(245,158,11,1)] animate-bounce select-none w-max"
              style={{
                top: badgePositionData.top,
                left: badgePositionData.left,
              }}
            >
              <span className="text-base sm:text-lg">{badgePositionData.arrow}</span>
              <span className="uppercase tracking-wider font-black">
                {activeStep.pointerText || "OLHE AQUI"}
              </span>
            </div>
          )}
        </>
      )}

      {/* ━━━ MODAL DE BOAS-VINDAS INICIAL (APENAS 1º ACESSO REAL) ━━━━━ */}
      {isWelcomeOpen && (
        <div className="fixed inset-0 z-[999999] bg-black/85 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#121215] border-2 border-white/20 rounded-3xl max-w-xl w-full p-7 sm:p-9 text-white shadow-[0_30px_90px_rgba(0,0,0,0.95)] space-y-7 relative">
            <button
              type="button"
              onClick={handleSkipEntireTour}
              className="absolute top-6 right-6 size-9 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Pular tour completo"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)] shrink-0">
                <Compass className="size-7 animate-spin-slow" />
              </div>
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Boas-vindas ao Sistema
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1.5">
                  Conheça o seu Painel
                </h2>
              </div>
            </div>

            <p className="text-sm sm:text-base text-white/80 leading-relaxed font-medium">
              Preparamos um <strong className="text-amber-300 font-bold">tour guiado interativo</strong> passando pelas áreas fundamentais da sua loja: pedidos em tempo real, controle de lucro, reposição de estoque, CRM de retenção e marketing no WhatsApp.
            </p>

            <div className="space-y-3 bg-black/50 border border-white/10 rounded-2xl p-5 text-sm">
              <div className="flex items-center gap-3 text-white/95 font-medium">
                <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="size-3.5 stroke-[3]" />
                </div>
                <span>Sinalização com <strong>setas luminosas</strong> indicando cada botão e card</span>
              </div>
              <div className="flex items-center gap-3 text-white/95 font-medium">
                <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="size-3.5 stroke-[3]" />
                </div>
                <span>Liberdade total: você pode <strong>pular card por card</strong> a qualquer momento</span>
              </div>
              <div className="flex items-center gap-3 text-white/95 font-medium">
                <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="size-3.5 stroke-[3]" />
                </div>
                <span>Duração de apenas ~3 minutos para dominar 100% da ferramenta</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSkipEntireTour}
                className="w-full sm:w-1/2 py-3.5 px-5 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer text-center"
              >
                Pular Tour Completo
              </button>

              <button
                type="button"
                onClick={handleStartTour}
                className="w-full sm:w-1/2 py-3.5 px-5 rounded-2xl text-sm font-black text-black bg-white hover:bg-slate-100 shadow-[0_0_30px_rgba(255,255,255,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <span>🚀 Iniciar Tour Guiado</span>
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ BOTÃO FLUTUANTE DE TOUR MINIMIZADO (CASO O USUÁRIO MINIMIZE) ━━ */}
      {isOpen && isMinimized && (
        <div 
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 z-[99999] bg-amber-500 hover:bg-amber-400 text-black px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.6)] cursor-pointer flex items-center gap-3 font-black text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <Compass className="size-5 animate-spin-slow" />
          <span>Tour Ativo ({currentStep + 1}/{TOUR_STEPS.length}) • Clique para Expandir</span>
          <Maximize2 className="size-4 ml-1" />
        </div>
      )}

      {/* ━━━ CARD FLUTUANTE AMPLIADO DO TOUR ATIVO (LEITURA NÍTIDA & CONFORTÁVEL) ━━ */}
      {isOpen && !isMinimized && (
        <div className="fixed bottom-6 right-6 z-[99999] w-[620px] max-w-[calc(100vw-2rem)] bg-[#111114]/98 backdrop-blur-2xl border-2 border-white/20 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.98)] p-6 sm:p-7 text-white space-y-5 animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Barra de Progresso Superior */}
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-400 to-yellow-300 h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(245,158,11,0.8)]"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Cabeçalho do Card */}
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="size-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                {activeStep.icon}
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 block mb-0.5">
                  {activeStep.badge}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white leading-snug tracking-tight">
                  {activeStep.title}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="size-8 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Minimizar card do tour"
              >
                <Minimize2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleSkipEntireTour}
                className="size-8 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Encerrar tour completo"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Área de Texto Ampliada com Efeito Typewriter e Alta Legibilidade */}
          <div 
            onClick={handleFastForwardText}
            className="bg-black/60 border border-white/15 rounded-2xl p-5 sm:p-6 text-sm sm:text-base font-medium text-white/95 leading-relaxed cursor-pointer hover:border-amber-400/40 transition-all select-none group relative shadow-inner"
            title="Clique para acelerar o texto"
          >
            <p className="min-h-[75px] sm:min-h-[85px] leading-relaxed">
              {activeStep.description.slice(0, typedChars)}
              {isTyping && (
                <span className="inline-block w-2 h-5 bg-amber-400 ml-1 rounded-sm shadow-[0_0_12px_rgba(245,158,11,1)] animate-pulse align-middle" />
              )}
            </p>

            {isTyping && (
              <div className="mt-3 flex items-center justify-end gap-1.5 text-xs font-bold text-amber-400/80 group-hover:text-amber-300 transition-colors">
                <FastForward className="size-3.5" />
                <span>Clique para exibir o texto completo</span>
              </div>
            )}
          </div>

          {/* Alerta Destacado de Responsabilidade Anti-Ban */}
          {activeStep.warningNote && (
            <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 text-xs sm:text-sm text-amber-200/90 flex items-start gap-3 shadow-[0_0_25px_rgba(245,158,11,0.15)] animate-in fade-in duration-200">
              <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <ShieldAlert className="size-4 sm:size-5 text-amber-400" />
              </div>
              <div className="space-y-1">
                <strong className="text-amber-300 font-black uppercase tracking-wider block text-xs">
                  ⚠️ Aviso de Responsabilidade & Cadência Anti-Ban:
                </strong>
                <span className="leading-relaxed block">
                  {activeStep.warningNote}
                </span>
              </div>
            </div>
          )}

          {/* Dicas Rápidas da Etapa com Tamanho Legível */}
          {activeStep.tips && activeStep.tips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeStep.tips.map((tip, idx) => (
                <span 
                  key={idx}
                  className="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/5 border border-white/10 text-white/90 flex items-center gap-2"
                >
                  <Sparkles className="size-3.5 text-amber-400 shrink-0" />
                  <span>{tip}</span>
                </span>
              ))}
            </div>
          )}

          {/* Barra de Ações & Navegação Card a Card */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                  title="Voltar ao card anterior"
                >
                  <ChevronLeft className="size-4" />
                  <span>Voltar</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSkipEntireTour}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white transition-colors cursor-pointer"
                title="Pular tour e fechar assistente"
              >
                Pular Tour
              </button>
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-white hover:bg-slate-100 text-black shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            >
              <span>
                {currentStep === TOUR_STEPS.length - 1 ? "🎉 Concluir Tour" : "⏭️ Pular Card / Próximo"}
              </span>
              <ChevronRight className="size-4" />
            </button>
          </div>

        </div>
      )}
    </>
  );
}
