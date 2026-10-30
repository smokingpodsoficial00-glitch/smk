import React, { useState } from "react";
import {
  X, Play, BookOpen, CheckCircle2, ChevronRight,
  Smartphone, PackageSearch, CircleDollarSign, Store, Users,
  ExternalLink, Sparkles, Clock, Compass
} from "lucide-react";

export interface TutorialItem {
  id: string;
  title: string;
  category: string;
  duration: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  videoUrl?: string; // URL opcional de embed (YouTube, Loom, etc)
  steps: {
    title: string;
    description: string;
    tip?: string;
  }[];
  actionButton?: {
    label: string;
    onClick: () => void;
  };
}

export const SYSTEM_TUTORIALS: TutorialItem[] = [
  {
    id: "celular-pwa",
    title: "Como Conectar o Sistema no seu Celular (iPhone & Android)",
    category: "Dispositivos & PWA",
    duration: "2 min",
    description: "Aprenda a instalar o painel como um aplicativo no seu celular e ativar notificações instantâneas a cada nova venda recebida.",
    icon: <Smartphone className="size-5 text-emerald-400" />,
    accentColor: "emerald",
    steps: [
      {
        title: "1. Abra no navegador do celular",
        description: "Acesse o painel pelo Safari (no iPhone) ou Chrome (no Android) através do link oficial ou escaneando o QR Code na aba de Dispositivos.",
        tip: "No iPhone, use obrigatoriamente o navegador Safari para poder fixar na tela de início."
      },
      {
        title: "2. Adicionar à Tela de Início",
        description: "No iPhone, toque no botão de Compartilhar (quadrado com seta para cima) e selecione 'Adicionar à Tela de Início'. No Android, toque nos 3 pontinhos e 'Instalar aplicativo'.",
        tip: "O ícone da sua loja aparecerá junto com seus outros aplicativos."
      },
      {
        title: "3. Ativar Notificações de Venda",
        description: "Abra o aplicativo pela tela de início e clique em 'Permitir Notificações'. Pronto! Você receberá avisos sonoros de cada pedido em tempo real.",
      }
    ]
  },
  {
    id: "catalogo-divulgacao",
    title: "Como Configurar e Divulgar seu Catálogo Digital",
    category: "Vendas & Catálogo",
    duration: "3 min",
    description: "Personalize o nome da sua marca, configure seu WhatsApp para receber os pedidos e compartilhe o link nas redes sociais.",
    icon: <Store className="size-5 text-sky-400" />,
    accentColor: "sky",
    steps: [
      {
        title: "1. Defina o Nome e WhatsApp da sua Loja",
        description: "Nas configurações, informe o nome comercial do seu negócio e o número de WhatsApp (com DDD) que deve receber as mensagens de pedido finalizado.",
        tip: "O sistema valida e formata o telefone automaticamente para o padrão internacional."
      },
      {
        title: "2. Copie o Link Oficial da Tabela",
        description: "Clique em 'Copiar Link' da sua Tabela de Valores. Esse link é otimizado para celular, ultrarrápido e carrega fotos em alta definição.",
      },
      {
        title: "3. Divulgue no Instagram e WhatsApp",
        description: "Cole o link na Bio do seu Instagram, envie para clientes frequentes no WhatsApp e use nos stories ou anúncios de tráfego pago.",
        tip: "Pedidos feitos pelos clientes caem automaticamente na coluna 'Novo' do seu painel de pedidos."
      }
    ]
  },
  {
    id: "pedidos-kanban",
    title: "Gestão de Pedidos & Expedição no Kanban",
    category: "Operação Diária",
    duration: "4 min",
    description: "Domine o fluxo de separação, montagem de pedidos, rotas de motoboy e baixa automática de estoque.",
    icon: <PackageSearch className="size-5 text-indigo-400" />,
    accentColor: "indigo",
    steps: [
      {
        title: "1. Recebimento do Pedido ('Novo')",
        description: "Quando um cliente finaliza o pedido ou você lança uma venda manual (+ Nova Venda), o card entra na coluna 'Novo' com os sabores e valor total.",
      },
      {
        title: "2. Separação e Rota",
        description: "Arraste o card para 'Em Separação' enquanto separa os pods no estoque. Quando sair para entrega com o motoboy, mova para 'Em Rota'.",
        tip: "Você pode clicar no card a qualquer momento para ver o endereço, comprovante ou falar com o cliente no WhatsApp."
      },
      {
        title: "3. Finalização e Fechamento",
        description: "Ao confirmar o recebimento do pagamento e a entrega, mova para 'Entregue'. O sistema atualiza o faturamento e histórico do cliente imediatamente.",
      }
    ]
  },
  {
    id: "financeiro-caixa",
    title: "Controle Financeiro, Caixa Real & Recompras",
    category: "Gestão Financeira",
    duration: "3 min",
    description: "Entenda a fórmula do Caixa Real, como lançar compras de fornecedores e nunca misturar faturamento bruto com lucro limpo.",
    icon: <CircleDollarSign className="size-5 text-amber-400" />,
    accentColor: "amber",
    steps: [
      {
        title: "1. Entenda o Caixa Real",
        description: "Caixa Real = Todo o dinheiro que entrou de vendas MENOS todas as recompras de mercadorias pagas a fornecedores. É o dinheiro livre da sua operação.",
      },
      {
        title: "2. Registre cada compra com Fornecedor",
        description: "Sempre que comprar lote de estoque, use o botão 'Registrar Recompra' no módulo Financeiro. Informe valor pago, frete e mercadorias.",
        tip: "Sem registrar recompras, seu lucro real não refletirá o custo da mercadoria."
      },
      {
        title: "3. Acompanhe a Meta Semanal",
        description: "Defina sua meta de faturamento mensal e monitore a barra de progresso semana a semana para manter o ritmo constante de vendas.",
      }
    ]
  },
  {
    id: "crm-reativacao",
    title: "CRM: Como Recuperar Clientes Parados no WhatsApp",
    category: "CRM & Retenção",
    duration: "3 min",
    description: "Use os filtros inteligentes de clientes para mandar mensagens direcionadas para quem comprou há mais de 15 ou 30 dias.",
    icon: <Users className="size-5 text-rose-400" />,
    accentColor: "rose",
    steps: [
      {
        title: "1. Filtre clientes por tempo sem comprar",
        description: "No CRM, ordene por 'Última Compra' para ver clientes que compravam com frequência e pararam de pedir.",
      },
      {
        title: "2. Chame no WhatsApp com 1 Clique",
        description: "O sistema disponibiliza botão direto para abrir o WhatsApp do cliente com mensagem pré-formatada amigável perguntando se ele precisa de reposição.",
        tip: "Mais de 30% dos clientes voltam a comprar apenas por receberem uma lembrança no momento em que o pod anterior acabou."
      }
    ]
  }
];

interface TutorialDetailModalProps {
  tutorial: TutorialItem | null;
  onClose: () => void;
  onStartTour?: () => void;
}

export function TutorialDetailModal({ tutorial, onClose, onStartTour }: TutorialDetailModalProps) {
  if (!tutorial) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#0d0d0f] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between gap-4 bg-white/[0.02]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              {tutorial.icon}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/50 block">
                {tutorial.category} • {tutorial.duration} de leitura
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {tutorial.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1 text-white">
          
          {/* Card Descritivo / Banner */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white/80 uppercase tracking-wider">
              <Sparkles className="size-4 text-amber-400" />
              Objetivo Deste Guia
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              {tutorial.description}
            </p>
          </div>

          {/* Player de Vídeo ou Guia Interativo */}
          {tutorial.videoUrl ? (
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/15 shadow-inner">
              <iframe
                src={tutorial.videoUrl}
                title={tutorial.title}
                className="size-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <BookOpen className="size-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Tutorial Passo a Passo Ilustrado</h4>
                <p className="text-xs text-white/50 mt-0.5">Siga as instruções práticas abaixo para aplicar no seu sistema agora mesmo.</p>
              </div>
            </div>
          )}

          {/* Lista de Passos Detalhados */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-extrabold text-white/50 tracking-wider">
              Passo a Passo Prático
            </h3>

            <div className="space-y-3">
              {tutorial.steps.map((st, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-2xl bg-[#121214] border border-white/10 space-y-2 transition-all hover:border-white/20"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="size-5 rounded-full bg-white/10 text-white font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="space-y-1 flex-1">
                      <h4 className="text-sm font-bold text-white">{st.title}</h4>
                      <p className="text-xs text-white/60 leading-relaxed">{st.description}</p>
                    </div>
                  </div>

                  {st.tip && (
                    <div className="ml-7 text-[11px] bg-white/5 border border-white/10 text-white/80 px-3 py-1.5 rounded-xl font-medium">
                      💡 <strong>Dica:</strong> {st.tip}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Rodapé de Ações */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            Fechar Tutorial
          </button>

          <div className="flex items-center gap-2">
            {onStartTour && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartTour();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black shadow-lg shadow-amber-400/20 transition-all cursor-pointer active:scale-95"
              >
                <Compass className="size-4" />
                <span>Iniciar Tour Guiado</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
