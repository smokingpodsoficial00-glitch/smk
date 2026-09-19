import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Sparkles, ChevronRight, ChevronLeft, X, Check, Compass, 
  PackageSearch, CircleDollarSign, RefreshCw, BarChart3, 
  PlusCircle, Layers, Flame, Users, Megaphone, Rocket,
  ExternalLink, Volume2, FastForward
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
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "pedidos",
    badge: "Etapa 1 de 10 • Operação Diária",
    route: "/pedidos",
    title: "📦 Pedidos: Kanban & Expedição em Tempo Real",
    description: "Aqui é o coração da sua operação diária! Todos os pedidos feitos pelos clientes no catálogo caem instantaneamente na coluna 'Novo'. Conforme sua equipe trabalha, você arrasta os cards entre 'Em Separação', 'Em Rota' e 'Entregue'. No topo, use os filtros de 24h, Hoje, Ontem, 7 dias e 30 dias para acompanhar o volume de entregas com precisão.",
    tips: ["Arraste os cards para atualizar o status do pedido", "Filtros rápidos no topo para fechamento diário"],
    icon: <PackageSearch className="size-5 text-sky-400" />
  },
  {
    id: "financeiro_caixa",
    badge: "Etapa 2 de 10 • Saúde Financeira",
    route: "/financeiro",
    title: "💰 Financeiro: Raio-X do Caixa e Lucro Real",
    description: "Esqueça métricas de vaidade! Aqui você enxerga o dinheiro de verdade: Faturamento Bruto, CMV (custo da mercadoria vendida), Lucro Líquido Real, Caixa Real disponível e o Patrimônio Total da Loja (soma do seu dinheiro em caixa com o valor em pods na prateleira).",
    tips: ["Monitore o Lucro Líquido descontando todos os custos", "Veja seu Patrimônio Total atualizado em tempo real"],
    icon: <CircleDollarSign className="size-5 text-emerald-400" />
  },
  {
    id: "financeiro_recompra",
    badge: "Etapa 3 de 10 • Gestão de Compras",
    route: "/financeiro",
    title: "🔄 Recompra de Estoque & Gráficos a Longo Prazo",
    description: "Atenção máxima a este bloco: sempre que for repor mercadoria com seu fornecedor, clique em 'Registrar Recompra' para abater do caixa sem furos contábeis. Logo abaixo, acompanhe os gráficos de evolução mensal, semestral e anual para prever seu crescimento futuro.",
    tips: ["Clique em 'Registrar Recompra' sempre que pagar fornecedor", "Acompanhe o faturamento mensal e semestral"],
    icon: <RefreshCw className="size-5 text-indigo-400" />
  },
  {
    id: "estoque_ranking",
    badge: "Etapa 4 de 10 • Inteligência de Estoque",
    route: "/estoque",
    title: "📊 Reposição: Ranking dos Campeões de Venda",
    description: "Por que esse ranking é vital? Porque ele te mostra matematicamente quais marcas e modelos mais vendem. Você descobre exatamente o que deve recomprar em maior escala para nunca faltar estoque, e o que deve cortar ou queimar para não empatar seu capital de giro!",
    tips: ["Recompre os líderes do ranking sem medo", "Evite recomprar modelos sem giro"],
    icon: <BarChart3 className="size-5 text-amber-400" />
  },
  {
    id: "estoque_novo_produto",
    badge: "Etapa 5 de 10 • Catálogo & Produtos",
    route: "/estoque",
    title: "➕ Cadastrar Novo Produto na Prateleira",
    description: "Cadastrar novos pods é muito simples: basta clicar no botão '+ Novo Produto' no topo. Você preenche a marca, modelo, quantidade de pods, preço de custo, preço de venda e coloca a foto. Assim que salvar, o pod entra imediatamente na sua prateleira e no catálogo universal.",
    tips: ["Preencha o custo e venda para cálculo automático de margem", "Fotos limpas aumentam a conversão do catálogo"],
    icon: <PlusCircle className="size-5 text-white" />
  },
  {
    id: "estoque_sabores",
    badge: "Etapa 6 de 10 • Variações & Sabores",
    route: "/estoque",
    title: "🏷️ Prateleira & Gestão Rápida de Sabores",
    description: "Aqui você gerencia suas marcas. Clicando em 'Ver Sabores' em qualquer pod, você abre a gaveta de sabores onde pode ativar, pausar estoque zerado ou cadastrar novos sabores em segundos. O catálogo dos seus clientes atualiza em tempo real sem precisar recarregar a página.",
    tips: ["Clique em 'Ver Sabores' para pausar ou adicionar opções", "Sincronização instantânea com a tabela dos clientes"],
    icon: <Layers className="size-5 text-purple-400" />
  },
  {
    id: "estoque_parados",
    badge: "Etapa 7 de 10 • Queima de Estoque",
    route: "/estoque",
    title: "🔥 Radar de Produtos Parados & Modo Demonstração",
    description: "No seletor superior, alternando para 'Produtos Parados', o radar identifica mercadorias sem giro há mais de 7 dias e calcula o capital empatado. Como sua conta é nova, ativamos o Modo Demonstração para você simular ofertas relâmpago no botão '+ Promo' e criar avisos no botão 'VIP'!",
    tips: ["Use o botão '+ Promo' para queimar itens parados", "Dispare ofertas exclusivas para seu Grupo VIP"],
    icon: <Flame className="size-5 text-amber-500" />
  },
  {
    id: "crm_clientes",
    badge: "Etapa 8 de 10 • LTV & Retenção",
    route: "/clientes",
    title: "👥 Clientes & CRM Preditivo por Puffs",
    description: "O cérebro de retenção da sua loja! Na aba 'Ranking & Fidelidade', você monitora quem compra a cada 15 dias e quem está sumindo (Risco de Churn). Na aba 'Aviso de Fim de Pod & Recompra', o sistema calcula os puffs consumidos e te avisa a data exata de chamar o cliente no WhatsApp antes do pod acabar!",
    tips: ["Fidelize clientes com recompra a cada 15 dias", "Aborde preventivamente antes que o pod seque"],
    icon: <Users className="size-5 text-cyan-400" />
  },
  {
    id: "marketing_disparos",
    badge: "Etapa 9 de 10 • Escala de Vendas",
    route: "/marketing",
    title: "📢 Marketing & Disparos com Cadência Segura",
    description: "Chegou a hora de escalar! Conecte o WhatsApp oficial da sua loja no topo via QR Code. Criamos para você uma lista pronta em 'Listas de Transmissão' com contato de teste. Clique em '+ Nova Campanha' para selecionar o público, agendar o horário e enviar promoções com cadência anti-bloqueio.",
    tips: ["Conecte o WhatsApp oficial da sua loja via QR Code", "Use a 'Lista de Teste VIP' para simular disparos"],
    icon: <Megaphone className="size-5 text-pink-400" />
  },
  {
    id: "conclusao",
    badge: "Etapa 10 de 10 • Pronto para Operar",
    route: "/configuracoes",
    title: "🚀 Tudo Pronto! Sua Operação Vai Decolar",
    description: "Parabéns! Agora você conhece todas as engrenagens do sistema. O próximo passo é definir o nome da sua loja aqui nas configurações para gerar seu Link Universal do Catálogo, cadastrar seu estoque e começar a faturar. Boas vendas!",
    tips: ["Defina o nome da loja nas configurações", "Gere o link do catálogo e coloque na Bio"],
    icon: <Rocket className="size-5 text-emerald-400" />
  },
];

export function openSystemTour() {
  window.dispatchEvent(new CustomEvent("open-system-tour"));
}

export function SystemTourGuide() {
  const navigate = useNavigate();
  const location = useLocation();
  const { company } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Efeito Typewriter
  const [typedChars, setTypedChars] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const storageKey = `smk_tour_completed_${company?.id || "default"}`;

  // Verificação inicial: abrir boas-vindas se nunca completou o tour
  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      const t = setTimeout(() => {
        setIsWelcomeOpen(true);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [storageKey]);

  // Listener para evento customizado de reabertura manual via Sidebar
  useEffect(() => {
    const handleOpen = () => {
      setIsWelcomeOpen(false);
      setCurrentStep(0);
      setIsOpen(true);
    };

    window.addEventListener("open-system-tour", handleOpen);
    return () => window.removeEventListener("open-system-tour", handleOpen);
  }, []);

  const activeStep = TOUR_STEPS[currentStep] || TOUR_STEPS[0];

  // Sincronizar rota ao mudar de etapa
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
    }, 18);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, currentStep, activeStep]);

  // Pular o efeito typewriter e mostrar texto completo imediatamente ao clicar
  const handleFastForwardText = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTypedChars(activeStep.description.length);
    setIsTyping(false);
  };

  // Encerrar tour completo e salvar preferência no localStorage
  const handleSkipEntireTour = () => {
    localStorage.setItem(storageKey, "true");
    setIsWelcomeOpen(false);
    setIsOpen(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Iniciar tour a partir do modal de boas-vindas
  const handleStartTour = () => {
    setIsWelcomeOpen(false);
    setCurrentStep(0);
    setIsOpen(true);
  };

  // Avançar card / etapa
  const handleNextStep = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Concluir tour
      handleSkipEntireTour();
    }
  };

  // Voltar card / etapa
  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <>
      {/* ━━━ MODAL DE BOAS-VINDAS INICIAL (ESCOLHA: PULAR OU INICIAR) ━━━━━ */}
      {isWelcomeOpen && (
        <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#121214] border border-white/20 rounded-3xl max-w-lg w-full p-6 sm:p-8 text-white shadow-[0_25px_60px_rgba(0,0,0,0.9)] space-y-6 relative">
            <button
              type="button"
              onClick={handleSkipEntireTour}
              className="absolute top-5 right-5 size-8 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Pular tour completo"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <Compass className="size-6 animate-spin-slow" />
              </div>
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Boas-vindas ao Sistema
                </span>
                <h2 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
                  Conheça o seu Painel
                </h2>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
              Preparamos um <strong className="text-white">tour guiado interativo</strong> passando pelas áreas fundamentais da sua loja: pedidos, controle de lucro, reposição de estoque, CRM de retenção e marketing no WhatsApp.
            </p>

            <div className="space-y-2.5 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs">
              <div className="flex items-center gap-2.5 text-white/90">
                <div className="size-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="size-3 stroke-[3]" />
                </div>
                <span>Navegação dinâmica mostrando o que faz cada card e botão</span>
              </div>
              <div className="flex items-center gap-2.5 text-white/90">
                <div className="size-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="size-3 stroke-[3]" />
                </div>
                <span>Liberdade total: você pode <strong>pular card por card</strong> a qualquer momento</span>
              </div>
              <div className="flex items-center gap-2.5 text-white/90">
                <div className="size-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="size-3 stroke-[3]" />
                </div>
                <span>Duração rápida de ~3 minutos para dominar 100% da ferramenta</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSkipEntireTour}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer text-center"
              >
                Pular Tour Completo
              </button>

              <button
                type="button"
                onClick={handleStartTour}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl text-xs font-bold text-black bg-white hover:bg-slate-100 shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🚀 Iniciar Tour Guiado</span>
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ CARD FLUTUANTE DO TOUR ATIVO (CARD POR CARD COM TYPEWRITER) ━━ */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-[99999] max-w-lg w-[calc(100vw-2.5rem)] bg-[#101012]/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-5 text-white space-y-4 animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Cabeçalho do Card */}
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                {activeStep.icon}
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">
                  {activeStep.badge}
                </span>
                <h3 className="text-sm font-bold text-white leading-snug">
                  {activeStep.title}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSkipEntireTour}
              className="size-7 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Encerrar tour completo"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Área de Texto com Efeito Typewriter */}
          <div 
            onClick={handleFastForwardText}
            className="bg-black/50 border border-white/10 rounded-2xl p-3.5 text-xs text-white/90 leading-relaxed cursor-pointer hover:border-white/20 transition-all select-none group relative"
            title="Clique para acelerar o texto"
          >
            <p className="min-h-[60px]">
              {activeStep.description.slice(0, typedChars)}
              {isTyping && (
                <span className="inline-block w-1.5 h-3.5 bg-amber-400 ml-0.5 animate-pulse align-middle" />
              )}
            </p>

            {isTyping && (
              <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground group-hover:text-amber-300 transition-colors">
                <FastForward className="size-3" />
                <span>Clique para ler tudo rápido</span>
              </div>
            )}
          </div>

          {/* Dicas Rápidas da Etapa */}
          {activeStep.tips && activeStep.tips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeStep.tips.map((tip, idx) => (
                <span 
                  key={idx}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/5 border border-white/10 text-white/80 flex items-center gap-1.5"
                >
                  <Sparkles className="size-3 text-amber-400 shrink-0" />
                  <span>{tip}</span>
                </span>
              ))}
            </div>
          )}

          {/* Barra de Ações & Navegação Card a Card */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
            <div className="flex items-center gap-1.5">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  title="Voltar ao card anterior"
                >
                  <ChevronLeft className="size-3.5" />
                  <span className="hidden sm:inline">Voltar</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSkipEntireTour}
                className="px-2.5 py-2 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-white transition-colors cursor-pointer"
                title="Pular tour e fechar assistente"
              >
                Pular Tour
              </button>
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-white hover:bg-slate-100 text-black shadow-[0_0_20px_rgba(255,255,255,0.25)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <span>
                {currentStep === TOUR_STEPS.length - 1 ? "🎉 Concluir Tour" : "⏭️ Pular Card / Próximo"}
              </span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>

        </div>
      )}
    </>
  );
}
