import { useState, useEffect, useRef } from "react";
import {
  Store, Phone, Globe,
  Save, CheckCircle2, AlertCircle, Loader2,
  Type, Smartphone, Copy, Check, Sparkles, Lock, ExternalLink, Sun, Moon,
  Compass, Play, BookOpen, GraduationCap, Video, Laptop, HelpCircle, ChevronRight,
  ArrowLeft, Clock, Film, FolderOpen, Link2, Upload, RotateCcw, FileVideo, X
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { validateAndNormalizeBrazilianPhone, formatBrazilianPhone } from "@/lib/phoneUtils";
import { MobilePushSetupModal } from "./MobilePushSetupModal";
import { SYSTEM_TUTORIALS, TutorialDetailModal, type TutorialItem } from "./TutorialsModal";

export interface VideoLessonItem {
  id: string;
  lessonNumber: number;
  fileName: string;
  title: string;
  category: string;
  duration: string;
  description: string;
  keyTopics: string[];
  videoUrl?: string;
}

export const SMK_VIDEO_LESSONS: VideoLessonItem[] = [
  {
    id: "aula-1-pedidos",
    lessonNumber: 1,
    fileName: "AULA 1 PEDIDOS EDITADA.mp4",
    title: "Aula 1: Gestão de Pedidos & Operação no Kanban",
    category: "Pedidos & Vendas",
    duration: "7m 24s",
    description: "Aprenda a operar a esteira de pedidos: desde a entrada no cardápio digital, conferência de sabores, separação, envio com motoboy e baixa rápida.",
    keyTopics: [
      "Fluxo de colunas no Kanban (Novo, Em Separação, Em Rota, Entregue)",
      "Lançamento de venda manual no balcão (+ Nova Venda)",
      "Gestão de rotas de entrega e impressão de comprovantes",
    ],
    videoUrl: "https://youtu.be/lrTwyR-hU2o",
  },
  {
    id: "aula-2-financeiro",
    lessonNumber: 2,
    fileName: "AULA 2 EDITADA FINANCEIRO.mp4",
    title: "Aula 2: Controle Financeiro, DRE & Fluxo de Caixa",
    category: "Finanças & Caixa",
    duration: "11m 30s",
    description: "Domine as finanças da sua loja: fluxo de caixa diário, entradas de pagamentos (PIX, Cartão, Dinheiro), despesas operacionais, taxa de motoboy e lucro líquido real.",
    keyTopics: [
      "Leitura do Fluxo de Caixa e faturamento bruto vs líquido",
      "Lançamento de despesas operacionais e custos fixos",
      "Cálculo automático de margem de lucro e DRE em tempo real",
    ],
    videoUrl: "https://youtu.be/z6c8ayGob98",
  },
  {
    id: "aula-3-estoque",
    lessonNumber: 3,
    fileName: "AULA 3 EDITADA.mp4",
    title: "Aula 3: Gestão de Estoque, Lotes & Produtos Parados",
    category: "Estoque & Suprimentos",
    duration: "12m 10s",
    description: "Controle absoluto de estoque: cadastro de novos pods e marcas, gerenciamento de sabores, entrada de lotes com custo unitário e monitoramento de produtos parados.",
    keyTopics: [
      "Cadastro rápido de produtos, sabores e fotos",
      "Entrada de novos lotes e atualização do custo médio",
      "Identificação de produtos parados para criar promoções relâmpago",
    ],
  },
  {
    id: "aula-4-crm",
    lessonNumber: 4,
    fileName: "aula 4 editada crm.mp4",
    title: "Aula 4: CRM, Recompra Preditiva & Fidelização",
    category: "CRM & Clientes",
    duration: "7m 13s",
    description: "Transforme compradores eventuais em clientes fiéis: acompanhamento de hábitos de compra, matriz RFM e previsão de quando o pod do cliente vai acabar.",
    keyTopics: [
      "Base de clientes organizada por ticket médio e frequência",
      "Previsão de término de pod e timing perfeito de contato",
      "Recuperação de clientes inativos direto pelo WhatsApp",
    ],
  },
  {
    id: "aula-5-marketing",
    lessonNumber: 5,
    fileName: "aula 5 de Marketing Editada.mp4",
    title: "Aula 5: Marketing, Listas & Disparos no WhatsApp",
    category: "Marketing & Campanhas",
    duration: "11m 12s",
    description: "Alavanque suas vendas com campanhas de WhatsApp: criação de listas de transmissão segmentadas, modelos de mensagens de alta conversão e disparos seguros.",
    keyTopics: [
      "Segmentação de listas (Compradores VIP, Clientes Antigos, Grupo)",
      "Modelos de ofertas diárias com fotos e sabores disponíveis",
      "Cadência segura e intervalos anti-banimento no WhatsApp",
    ],
  },
];

export function parseVideoSource(rawUrl?: string): { type: "youtube" | "drive" | "direct" | "none"; embedUrl: string } {
  if (!rawUrl || !rawUrl.trim()) return { type: "none", embedUrl: "" };
  const trimmed = rawUrl.trim();

  // YouTube (watch?v=, youtu.be/, embed/)
  const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1&playsinline=1`,
    };
  }

  // Google Drive preview
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (driveMatch && driveMatch[1]) {
    return {
      type: "drive",
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
    };
  }

  return {
    type: "direct",
    embedUrl: trimmed,
  };
}

export default function SettingsPage() {
  const { theme, toggleTheme, setTheme } = useTheme();
  const { config, loading, saving, saveStatus, updateConfig, updateStoreWhatsApp } = useStoreConfig();
  const { company, refreshCompany } = (useAuth() as any) || {};

  // Aba ativa nas configurações
  const [activeTab, setActiveTab] = useState<"store" | "system" | "tutorials">("store");

  // Visualização da Área de Videoaulas (capa de apresentação ou sala de aula)
  const [tutorialsView, setTutorialsView] = useState<"cover" | "classroom">("cover");
  const [selectedLessonIndex, setSelectedLessonIndex] = useState<number>(0);

  // URLs de arquivos locais (.mp4 carregados da máquina)
  const [localVideoUrls, setLocalVideoUrls] = useState<Record<string, string>>({});

  // URLs personalizadas online (YouTube, Drive ou CDN) salvas no navegador
  const [customVideoUrls, setCustomVideoUrls] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("smk_custom_lesson_urls_v1");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modal para colar link do YouTube/Drive
  const [editingUrlLessonId, setEditingUrlLessonId] = useState<string | null>(null);
  const [tempUrlInput, setTempUrlInput] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregamento de arquivos locais com match inteligente
  const handleFilesSelect = (filesList: FileList | File[] | null) => {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);
    const updated = { ...localVideoUrls };

    files.forEach((file) => {
      const lower = file.name.toLowerCase();
      const objUrl = URL.createObjectURL(file);

      const matched = SMK_VIDEO_LESSONS.find((lesson) => {
        const lFile = lesson.fileName.toLowerCase();
        return (
          lower === lFile ||
          lower.includes(`aula ${lesson.lessonNumber}`) ||
          lower.includes(`aula${lesson.lessonNumber}`) ||
          (lesson.lessonNumber === 1 && lower.includes("pedidos")) ||
          (lesson.lessonNumber === 2 && lower.includes("financeiro")) ||
          (lesson.lessonNumber === 3 && lower.includes("aula 3")) ||
          (lesson.lessonNumber === 4 && lower.includes("crm")) ||
          (lesson.lessonNumber === 5 && lower.includes("marketing"))
        );
      });

      if (matched) {
        updated[matched.id] = objUrl;
      } else if (files.length === 1) {
        updated[SMK_VIDEO_LESSONS[selectedLessonIndex].id] = objUrl;
      }
    });

    setLocalVideoUrls(updated);
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  const handleSaveCustomUrl = (lessonId: string, url: string) => {
    const trimmed = url.trim();
    const updated = { ...customVideoUrls };
    if (trimmed) {
      updated[lessonId] = trimmed;
    } else {
      delete updated[lessonId];
    }
    setCustomVideoUrls(updated);
    try {
      localStorage.setItem("smk_custom_lesson_urls_v1", JSON.stringify(updated));
    } catch (err) {
      console.warn("Erro ao salvar URLs de aulas no localStorage:", err);
    }
    setEditingUrlLessonId(null);
  };

  // Modais integrados
  const [mobilePushModalOpen, setMobilePushModalOpen] = useState(false);
  const [selectedTutorial, setSelectedTutorial] = useState<TutorialItem | null>(null);
  const [videoStartedNotice, setVideoStartedNotice] = useState(false);

  // Form state local
  const [storeName, setStoreName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [waSaving, setWaSaving] = useState(false);
  const [waFeedback, setWaFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Copy link state
  const [copied, setCopied] = useState(false);

  // Slugifier seguro
  const generateSlug = (str: string) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");
  };

  // Dynamic Catalog Link (Neutro para SaaS: 'tabeladevalores-pods.vercel.app', 100% gratuito sem pagar domínio)
  const currentCompanyId = company?.id || (typeof window !== "undefined" ? localStorage.getItem("smk_auth_company_id") : null);
  const isOfficial = !currentCompanyId || currentCompanyId === "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
  const saasBaseUrl = (import.meta as any).env?.VITE_SAAS_CATALOG_BASE_URL || "https://tabeladevalores-pods.vercel.app";

  const currentSlug = generateSlug(storeName || company?.name || config?.store_name || "");

  // Para a loja oficial, o link oficial sempre fica ativo.
  // Para contas novas/SaaS, o link começa bloqueado até que o lojista salve o nome e gere o slug da sua loja
  const hasSlugConfigured = Boolean(
    config?.store_slug && 
    config.store_slug.trim().length >= 2 && 
    config.store_slug !== "smoking-pods"
  );

  const [linkUnlocked, setLinkUnlocked] = useState(isOfficial || hasSlugConfigured);

  useEffect(() => {
    if (isOfficial || hasSlugConfigured) {
      setLinkUnlocked(true);
    }
  }, [isOfficial, hasSlugConfigured]);

  const getCatalogUrl = () => {
    if (isOfficial) {
      return "https://smoking-pods-catalogo.vercel.app/";
    }
    // Link genérico neutro de Tabela de Valores: https://tabeladevalores-pods.vercel.app/?loja=nomedaloja
    return `${saasBaseUrl}/?loja=${currentSlug || 'loja'}`;
  };

  const catalogUrl = getCatalogUrl();

  const lastCompanyIdRef = useRef<string | null>(null);

  // Sync form state strictly with active company and ensure official store isolation
  useEffect(() => {
    if (!loading && (company || config)) {
      if (company?.id && company.id !== lastCompanyIdRef.current) {
        lastCompanyIdRef.current = company.id;
        const initialName = isOfficial ? "Smoking Pods" : (company.name || config?.store_name || "");
        setStoreName(initialName);
        setWhatsappNumber(formatBrazilianPhone(config?.whatsapp_number || company.phone || ""));
      } else if (!storeName) {
        const initialName = isOfficial ? "Smoking Pods" : (company?.name || config?.store_name || "");
        setStoreName(initialName);
        setWhatsappNumber(formatBrazilianPhone(config?.whatsapp_number || company?.phone || ""));
      }
    }
  }, [company?.id, company?.name, config, loading, isOfficial]);

  const handleSaveWhatsAppOnly = async () => {
    setWaFeedback(null);
    const validation = validateAndNormalizeBrazilianPhone(whatsappNumber);
    if (!validation.valid) {
      setWaFeedback({ type: 'error', message: validation.error || 'Número de WhatsApp inválido.' });
      return;
    }

    setWaSaving(true);
    const targetCompanyId = company?.id || (typeof window !== "undefined" ? localStorage.getItem("smk_auth_company_id") : null) || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
    const res = await updateStoreWhatsApp(validation.normalized, targetCompanyId);
    setWaSaving(false);

    if (res.success) {
      setWhatsappNumber(validation.formatted);
      setWaFeedback({ type: 'success', message: 'WhatsApp do catálogo salvo com sucesso!' });
      if (refreshCompany) await refreshCompany();
      setTimeout(() => setWaFeedback(null), 4000);
    } else {
      setWaFeedback({ type: 'error', message: res.error || 'Erro ao salvar WhatsApp no banco.' });
    }
  };

  const handleCopyCatalogLink = () => {
    navigator.clipboard.writeText(catalogUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = async () => {
    const finalStoreName = storeName.trim() || "Minha Loja";
    const waVal = validateAndNormalizeBrazilianPhone(whatsappNumber);
    const normalizedWhatsApp = waVal.valid ? waVal.normalized : (whatsappNumber ? whatsappNumber.replace(/\D/g, "") : "");

    await updateConfig({
      store_name: finalStoreName,
      store_slug: generateSlug(finalStoreName),
      whatsapp_number: normalizedWhatsApp,
    });

    // Sincroniza tabela companies e recarrega AuthContext para atualizar o nome no topo esquerdo imediatamente
    const targetCompanyId = company?.id || (typeof window !== "undefined" ? localStorage.getItem("smk_auth_company_id") : null) || "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
    try {
      await supabase.from('companies').update({
        name: finalStoreName,
        phone: normalizedWhatsApp
      }).eq('id', targetCompanyId);

      if (refreshCompany) {
        await refreshCompany();
      }
    } catch (e) {
      console.warn("Erro ao atualizar empresa:", e);
    }
  };

  const handleGenerateLink = async () => {
    if (!storeName.trim() || storeName.trim().toLowerCase() === "minha loja") {
      return;
    }
    await handleSave();
    setLinkUnlocked(true);
  };

  const handleStartTour = () => {
    window.dispatchEvent(new CustomEvent('open-system-tour'));
  };

  const hasChanges = () => {
    if (!config) return false;
    return (
      storeName !== (config.store_name || "") ||
      whatsappNumber.replace(/\D/g, "") !== (config.whatsapp_number || "").replace(/\D/g, "")
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050505] text-white">
        <Loader2 className="size-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#050505] text-white">
      
      {/* ━━━ Header Fixo com Identificação & Ações Rápidas ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="sticky top-0 z-20 bg-[#050505]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/15 shadow-[0_0_15px_rgba(255,255,255,0.06)] shrink-0">
              <Store className="size-4 sm:size-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-xl font-extrabold tracking-tight text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.2)] truncate">
                  Configurações da Loja
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
                  ERP SaaS
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-white/50 mt-0.5 truncate max-w-[200px] sm:max-w-md">
                Marca, catálogo, dispositivos e tutoriais da operação
              </p>
            </div>
          </div>

          {/* Ação do Topo: Salvar Alterações */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Botão Salvar Principal */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges()}
              className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs transition-all duration-300 cursor-pointer shrink-0 ${
                saveStatus === "success"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : saveStatus === "error"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : hasChanges()
                  ? "bg-white hover:bg-white/90 text-black shadow-[0_0_20px_rgba(255,255,255,0.25)] active:scale-95"
                  : "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : saveStatus === "success" ? (
                <CheckCircle2 className="size-3.5" />
              ) : saveStatus === "error" ? (
                <AlertCircle className="size-3.5" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>
                {saving
                  ? "Salvando..."
                  : saveStatus === "success"
                  ? "Salvo!"
                  : saveStatus === "error"
                  ? "Erro!"
                  : "Salvar"}
              </span>
            </button>
          </div>

        </div>

        {/* ─── Navegação por Abas Internas (Design Moderno & Categorizado) ─── */}
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 flex items-center gap-2 border-t border-white/5 pt-2 pb-2 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("store")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "store"
                ? "bg-white text-black shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Store className="size-3.5" />
            <span>Loja & Catálogo Digital</span>
          </button>

          <button
            type="button"
            data-tour="tab-system-settings"
            onClick={() => setActiveTab("system")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "system"
                ? "bg-white text-black shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Laptop className="size-3.5" />
            <span>Sistema & Dispositivos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tutorials")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "tutorials"
                ? "bg-white text-black shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <GraduationCap className="size-3.5 text-amber-400" />
            <span>Videoaulas e tutoriais</span>
          </button>
        </div>
      </div>

      {/* Conteúdo Central */}
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-28 md:pb-12">
        
        {/* ═══════════════════════════════════════════════════════════════════════════
            ABA 1: LOJA & CATÁLOGO DIGITAL (Identidade, Link Tabela e WhatsApp)
           ═══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "store" && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
            
            {/* ─── Seção 1: Identidade da Loja (Nome do Negócio) ─── */}
            <section className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Store className="size-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-white">Identidade da Loja</h2>
                    <p className="text-xs text-white/50">Nome oficial do seu negócio exibido no topo do catálogo e no painel admin</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/5 text-white/70 border border-white/10">
                  ID: {company?.id ? `${company.id.slice(0, 8)}...` : 'Oficial'}
                </span>
              </div>

              <div className="max-w-2xl space-y-3">
                <label className="text-xs uppercase font-bold text-white/70 tracking-wider flex items-center gap-2">
                  <Type className="size-3.5 text-white" />
                  Nome da Loja *
                </label>
                <div className="relative" data-tour="settings-store-name">
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ex: Minha Loja, Central Store, Distribuidora..."
                    className="w-full bg-[#121214] border border-white/15 rounded-2xl px-4 py-3.5 text-base text-white placeholder:text-white/30 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all font-semibold shadow-inner"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-white/40 pt-1">
                  <span>Este nome substitui o título principal do catálogo e atualiza o menu superior deste painel.</span>
                  {storeName && (
                    <span className="font-mono text-white/80 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 shrink-0 w-fit">
                      Slug: /{generateSlug(storeName)}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* ─── Seção 2: Link da Tabela de Valores / Catálogo (Compartilhamento) ─── */}
            <section className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Globe className="size-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-white">Link da sua Tabela de Valores</h2>
                    <p className="text-xs text-white/50">Endereço público da tabela de valores e estoque para divulgar aos seus clientes</p>
                  </div>
                </div>
                {linkUnlocked ? (
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Tabela Online Ativa
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5">
                    <Lock className="size-3" />
                    Aguardando Nome da Loja
                  </span>
                )}
              </div>

              {!linkUnlocked ? (
                <div className="rounded-2xl border border-dashed border-white/20 bg-[#121214] p-6 sm:p-8 text-center space-y-4">
                  <div className="size-14 mx-auto rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center text-white shadow-[0_0_20px_rgba(255,255,255,0.08)]">
                    <Sparkles className="size-6 text-white animate-pulse" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1.5">
                    <h3 className="text-base font-bold text-white">
                      Defina o Nome da Loja para Liberar sua Tabela de Valores
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Para que sua tabela de valores seja gerada com a identidade da sua marca, digite o <strong>Nome da Loja</strong> na Seção 1 e clique no botão abaixo.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleGenerateLink}
                      disabled={saving || !storeName.trim() || storeName.trim().toLowerCase() === "minha loja"}
                      className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-xs transition-all cursor-pointer shadow-lg ${
                        storeName.trim() && storeName.trim().toLowerCase() !== "minha loja"
                          ? "bg-white hover:bg-white/90 text-black shadow-[0_0_25px_rgba(255,255,255,0.3)] active:scale-95"
                          : "bg-white/10 text-white/30 border border-white/10 cursor-not-allowed"
                      }`}
                    >
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      <span>{saving ? "Gerando Link..." : "⚡ Salvar Nome e Gerar Tabela de Valores"}</span>
                    </button>
                    {(!storeName.trim() || storeName.trim().toLowerCase() === "minha loja") && (
                      <p className="text-[11px] text-amber-400/70 mt-2">
                        * Digite o nome da sua loja no campo acima para habilitar a geração do link.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Copie o link exclusivo da sua tabela de valores para enviar aos seus clientes no WhatsApp, campanhas de tráfego ou fixar na bio do Instagram. Todos os pedidos feitos por esse link caem diretamente no seu Kanban.
                  </p>

                  {/* Campo de URL com Botões de Copiar e Abrir */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex-1 bg-[#121214] border border-white/15 rounded-2xl px-4 py-3.5 text-xs text-white/90 font-mono flex items-center justify-between overflow-hidden shadow-inner">
                        <span className="truncate selection:bg-white/20">{catalogUrl}</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyCatalogLink}
                        className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-xs transition-all cursor-pointer shadow-lg shrink-0 ${
                          copied
                            ? "bg-emerald-500 text-black font-extrabold shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                            : "bg-white hover:bg-white/90 text-black shadow-[0_0_20px_rgba(255,255,255,0.25)] active:scale-[0.98]"
                        }`}
                      >
                        {copied ? <Check className="size-4 stroke-[3]" /> : <Copy className="size-4" />}
                        <span>{copied ? "Link Copiado!" : "Copiar Link"}</span>
                      </button>

                      <a
                        href={catalogUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
                        title="Abrir tabela em nova aba"
                      >
                        <ExternalLink className="size-4" />
                        <span>Abrir</span>
                      </a>
                    </div>

                    {!isOfficial && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-white/40 pt-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-emerald-400" />
                          <span>Link Neutro: identificador <strong>(?loja={currentSlug})</strong> sem menção a outras marcas.</span>
                        </span>
                        <a
                          href={`https://smoking-pods-catalogo.vercel.app/?loja=${currentSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/70 hover:text-white underline underline-offset-2 flex items-center gap-1 shrink-0 font-medium"
                          title="Link já ativo na Vercel para testes imediatos"
                        >
                          <span>Testar no link direto da Vercel</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Preview do Cabeçalho da Tabela de Valores */}
                  <div className="pt-2">
                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider block mb-3">
                      Preview da sua Tabela de Valores
                    </span>
                    <div className="rounded-2xl border border-white/10 bg-[#121214] p-6 text-center space-y-3 relative overflow-hidden">
                      <div className="absolute top-3 right-3">
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-white/40 border border-white/10">
                          Visão do Cliente
                        </span>
                      </div>
                      <div className="size-16 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        <Store className="size-7" />
                      </div>
                      <h3 className="text-xl font-extrabold text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                        {storeName || "Minha Loja"}
                      </h3>
                      <p className="text-xs text-white/50">
                        Pedido finalizado em segundos pelo WhatsApp.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* ─── Seção 3: Canais de Atendimento (Contato) ─── */}
            <section className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Phone className="size-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-white">Canais de Atendimento (Contato)</h2>
                    <p className="text-xs text-white/50">Configure o WhatsApp que recebe todos os pedidos do catálogo</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 max-w-xl">
                <div className="space-y-3 bg-[#121214] border border-white/10 rounded-2xl p-5 shadow-inner">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs uppercase font-bold text-white/80 tracking-wider flex items-center gap-2">
                      <Smartphone className="size-3.5 text-white" />
                      WhatsApp do Catálogo *
                    </label>
                    {config?.whatsapp_number ? (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        Ativo: {formatBrazilianPhone(config.whatsapp_number)}
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        Não configurado
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-white/50">
                    Quando o cliente clicar em "Finalizar Pedido no WhatsApp" no seu catálogo, a mensagem pré-formatada será enviada automaticamente para este número.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={whatsappNumber}
                      onChange={(e) => {
                        setWhatsappNumber(formatBrazilianPhone(e.target.value));
                        setWaFeedback(null);
                      }}
                      placeholder="(11) 97730-0561"
                      className="flex-1 bg-[#0a0a0a] border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white font-semibold shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={handleSaveWhatsAppOnly}
                      disabled={waSaving}
                      className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/15 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer shrink-0"
                    >
                      {waSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      Salvar Número
                    </button>
                  </div>

                  {waFeedback && (
                    <div className={`text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 border ${
                      waFeedback.type === 'success' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {waFeedback.type === 'success' ? <CheckCircle2 className="size-3.5 shrink-0" /> : <AlertCircle className="size-3.5 shrink-0" />}
                      <span>{waFeedback.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════
            ABA 2: SISTEMA & DISPOSITIVOS (Conectar no Celular, Aparência, Tour)
           ═══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "system" && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
            
            {/* Card de Destaque: Conectar Sistema no Celular */}
            <section className="bg-gradient-to-br from-emerald-950/20 via-[#0a0a0a] to-[#0a0a0a] border border-emerald-500/30 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <Smartphone className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      Conectar Painel no Celular
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                        PWA + Notificações
                      </span>
                    </h3>
                    <p className="text-xs text-white/50">
                      Receba alertas sonoros a cada nova venda e acesse o painel direto da tela inicial do seu celular
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  data-tour="settings-conectar-celular"
                  onClick={() => setMobilePushModalOpen(true)}
                  className="px-5 py-3 rounded-2xl font-extrabold text-xs bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2 shrink-0"
                >
                  <Smartphone className="size-4" />
                  <span>Configurar no Celular</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" /> 1. Sem App Store
                  </span>
                  <p className="text-[11px] text-white/50">Instale direto pelo navegador em 5 segundos sem burocracia.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" /> 2. Alerta Sonoro
                  </span>
                  <p className="text-[11px] text-white/50">Aviso imediato no bolso quando cair pedido novo no Kanban.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" /> 3. 100% Responsivo
                  </span>
                  <p className="text-[11px] text-white/50">Controle pedidos, financeiro e estoque onde você estiver.</p>
                </div>
              </div>
            </section>

            {/* Card de Destaque: Tour Guiado do Sistema */}
            <section className="bg-gradient-to-br from-amber-950/20 via-[#0a0a0a] to-[#0a0a0a] border border-amber-500/30 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                    <Compass className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      Tour Interativo Guiado
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                        12 Etapas
                      </span>
                    </h3>
                    <p className="text-xs text-white/50">
                      Um guia interativo que passa por cada tela do sistema mostrando os botões e regras essenciais
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartTour}
                  className="px-5 py-3 rounded-2xl font-extrabold text-xs bg-amber-400 hover:bg-amber-300 text-black shadow-lg shadow-amber-400/25 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2 shrink-0"
                >
                  <Compass className="size-4" />
                  <span>Iniciar Tour Agora</span>
                </button>
              </div>

              <p className="text-xs text-white/60 leading-relaxed">
                Recomendado para novos operadores e sócios. O tour navega sozinho pelos módulos de Pedidos, Caixa Real, Recompras, Estoque e CRM, destacando exatamente onde clicar.
              </p>
            </section>

            {/* Seletor de Tema e Aparência do Sistema */}
            <section className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Sun className="size-4 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-white">Aparência do Sistema</h2>
                    <p className="text-xs text-white/50">Alterne entre o Modo Escuro clássico ou o Modo Claro (Branco)</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/5 text-white/70 border border-white/10 uppercase">
                  Tema: {theme === 'light' ? 'Claro' : 'Escuro'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'border-white bg-white/10 ring-1 ring-white/40 shadow-lg'
                      : 'border-white/10 bg-[#121212] hover:border-white/20 text-white/60'
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-black border border-white/10 text-white mt-0.5 shrink-0">
                    <Moon className="size-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">Modo Escuro (Padrão)</div>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed">
                      Visual clássico escuro com alto contraste, ideal para ambientes de baixa luminosidade e economia de energia.
                    </p>
                    {theme === 'dark' && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-400">
                        <CheckCircle2 className="size-3" /> Ativo no momento
                      </span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'border-white bg-white/10 ring-1 ring-white/40 shadow-lg'
                      : 'border-white/10 bg-[#121212] hover:border-white/20 text-white/60'
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 mt-0.5 shrink-0">
                    <Sun className="size-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">Modo Claro (Branco)</div>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed">
                      Superfícies claras e arejadas com inversão inteligente, excelente para ambientes bem iluminados e trabalho diurno.
                    </p>
                    {theme === 'light' && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-400">
                        <CheckCircle2 className="size-3" /> Ativo no momento
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════
            ABA 3: VIDEOAULAS E TUTORIAIS (Capa e Central de Aulas)
           ═══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "tutorials" && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
            {tutorialsView === "cover" ? (
              <>
                {/* Header da Seção */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                      <Video className="size-6 text-amber-400" />
                      <span>Videoaulas e tutoriais</span>
                    </h2>
                    <p className="text-xs text-white/50 mt-1">
                      Treinamento prático da operação Smoking Pods: 5 aulas passo a passo.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartTour}
                    className="px-4 py-2 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2 self-start sm:self-auto"
                  >
                    <Compass className="size-3.5 text-amber-400" />
                    <span>Tour do Sistema</span>
                  </button>
                </div>

                {/* Card de Apresentação / Capa do Curso */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#141414] via-[#0c0c0c] to-black p-8 sm:p-12 text-center shadow-2xl flex flex-col items-center justify-center min-h-[380px]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(251,191,36,0.08),transparent_70%)] pointer-events-none" />
                  
                  <div className="relative z-10 max-w-xl mx-auto space-y-6 flex flex-col items-center">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/25 text-amber-300 text-xs font-bold">
                      <GraduationCap className="size-4" />
                      <span>Academia de Operação • 5 Aulas (~50 min)</span>
                    </div>

                    <div className="size-20 rounded-3xl bg-white/5 border border-white/15 flex items-center justify-center shadow-xl backdrop-blur-sm group hover:scale-105 transition-transform">
                      <div className="size-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
                        <Play className="size-6 text-amber-400 fill-amber-400 translate-x-0.5" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Videoaulas e tutoriais
                      </h3>
                      <p className="text-xs sm:text-sm text-white/60 leading-relaxed max-w-lg">
                        Aprenda em detalhes como operar cada engrenagem da sua loja: desde o controle de pedidos e caixa até reposição de estoque e disparos de marketing.
                      </p>
                    </div>

                    {/* Resumo das 5 Aulas */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full pt-1">
                      {SMK_VIDEO_LESSONS.map((l) => (
                        <div key={l.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-center space-y-1">
                          <span className="text-[10px] font-mono text-amber-400/80 font-bold block">Aula {l.lessonNumber}</span>
                          <span className="text-[11px] font-bold text-white block truncate">{l.category.split("&")[0].trim()}</span>
                          <span className="text-[10px] text-white/40 block font-mono">⏱️ {l.duration}</span>
                        </div>
                      ))}
                    </div>

                    {/* Botão Iniciar Tutorial */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTutorialsView("classroom");
                          setSelectedLessonIndex(0);
                        }}
                        className="inline-flex items-center gap-2.5 px-9 py-4 rounded-2xl bg-white hover:bg-white/90 text-black font-extrabold text-sm shadow-[0_0_30px_rgba(255,255,255,0.25)] hover:scale-105 transition-all cursor-pointer active:scale-95"
                      >
                        <Play className="size-4.5 fill-black" />
                        <span>Iniciar tutorial</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* MODO SALA DE AULA / VÍDEOS (Classroom) */
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Barra de Topo da Sala de Aula com Botão Voltar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setTutorialsView("cover")}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all cursor-pointer active:scale-95 flex items-center gap-2 text-xs font-bold"
                    >
                      <ArrowLeft className="size-4" />
                      <span>Voltar</span>
                    </button>
                    <div>
                      <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                        <span>Central de Videoaulas</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/25">
                          Aula {selectedLessonIndex + 1} de {SMK_VIDEO_LESSONS.length}
                        </span>
                      </h2>
                      <p className="text-xs text-white/50">
                        {SMK_VIDEO_LESSONS[selectedLessonIndex].title}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40 font-mono">
                      ⏱️ Duração: {SMK_VIDEO_LESSONS[selectedLessonIndex].duration}
                    </span>
                  </div>
                </div>

                {/* Grade Principal: Player à Esquerda/Topo + Playlist de Aulas à Direita/Abaixo */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Coluna 1 e 2: Player de Vídeo e Detalhes da Aula Atual */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Input invisível para seleção de arquivo(s) local(is) */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="video/mp4,video/webm,video/quicktime,video/*"
                      onChange={(e) => {
                        handleFilesSelect(e.target.files);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />

                    {/* Container do Player (Proporção 16:9) */}
                    {(() => {
                      const curLesson = SMK_VIDEO_LESSONS[selectedLessonIndex];
                      const activeUrl = localVideoUrls[curLesson.id] || customVideoUrls[curLesson.id] || curLesson.videoUrl || "";
                      const vSource = parseVideoSource(activeUrl);

                      return (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleDropFiles}
                          className="relative aspect-video w-full rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-b from-[#141414] via-[#0a0a0a] to-black shadow-2xl flex flex-col items-center justify-center group"
                        >
                          {vSource.type === "youtube" ? (
                            <iframe
                              src={vSource.embedUrl}
                              title={curLesson.title}
                              className="w-full h-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          ) : vSource.type === "drive" ? (
                            <iframe
                              src={vSource.embedUrl}
                              title={curLesson.title}
                              className="w-full h-full border-0"
                              allow="autoplay"
                              allowFullScreen
                            />
                          ) : vSource.type === "direct" ? (
                            <video
                              key={vSource.embedUrl}
                              src={vSource.embedUrl}
                              controls
                              autoPlay
                              className="w-full h-full object-contain bg-black"
                            >
                              Seu navegador não suporta a reprodução deste vídeo.
                            </video>
                          ) : (
                            <div className="p-6 sm:p-8 text-center space-y-4 max-w-lg">
                              <div className="size-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                                <Play className="size-8 fill-amber-400 translate-x-0.5" />
                              </div>
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/80 font-bold block mb-1">
                                  {curLesson.category}
                                </span>
                                <h3 className="text-lg font-bold text-white">
                                  {curLesson.title}
                                </h3>
                                <p className="text-xs text-white/50 mt-1">
                                  Arquivo no seu computador: <code className="text-amber-300 font-mono bg-white/5 px-2 py-0.5 rounded">{curLesson.fileName}</code>
                                </p>
                              </div>

                              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs transition-all shadow-lg shadow-amber-400/20 active:scale-95 cursor-pointer"
                                >
                                  <FolderOpen className="size-4" />
                                  <span>Carregar Vídeo do Computador</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUrlLessonId(curLesson.id);
                                    setTempUrlInput(customVideoUrls[curLesson.id] || "");
                                  }}
                                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer"
                                >
                                  <Link2 className="size-4 text-white/70" />
                                  <span>Colar Link (YouTube / Drive)</span>
                                </button>
                              </div>

                              <p className="text-[11px] text-white/40 pt-1">
                                💡 Toque no botão acima e selecione o arquivo correspondente para assistir agora mesmo em alta qualidade!
                              </p>
                            </div>
                          )}

                          {/* Barra superior de status do vídeo */}
                          {vSource.type !== "none" && (
                            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-xs shadow-xl">
                              <div className="flex items-center gap-2 text-white/90 font-medium truncate">
                                <span className="size-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                <span className="truncate">
                                  {localVideoUrls[curLesson.id]
                                    ? "Reproduzindo arquivo local do seu computador"
                                    : "Reproduzindo link online configurado"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 pointer-events-auto shrink-0">
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  title="Carregar outro arquivo de vídeo do computador"
                                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <FolderOpen className="size-3 text-amber-400" />
                                  <span>Trocar Arquivo</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUrlLessonId(curLesson.id);
                                    setTempUrlInput(customVideoUrls[curLesson.id] || "");
                                  }}
                                  title="Configurar Link Online (YouTube ou Google Drive)"
                                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <Link2 className="size-3 text-white/70" />
                                  <span>Link Online</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Descrição e Tópicos Chave da Aula Selecionada */}
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-3">
                      <div>
                        <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-bold">
                          Sobre esta aula
                        </span>
                        <h4 className="text-base font-bold text-white mt-0.5">
                          {SMK_VIDEO_LESSONS[selectedLessonIndex].title}
                        </h4>
                        <p className="text-xs text-white/60 mt-1 leading-relaxed">
                          {SMK_VIDEO_LESSONS[selectedLessonIndex].description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-white/5 space-y-1.5">
                        <span className="text-[11px] font-bold text-white/80 block">
                          Principais tópicos abordados no vídeo:
                        </span>
                        <div className="space-y-1">
                          {SMK_VIDEO_LESSONS[selectedLessonIndex].keyTopics.map((topic, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-white/70">
                              <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{topic}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Botões de Navegação entre Aulas */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                        <button
                          type="button"
                          disabled={selectedLessonIndex === 0}
                          onClick={() => setSelectedLessonIndex(prev => Math.max(0, prev - 1))}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            selectedLessonIndex === 0
                              ? "opacity-30 cursor-not-allowed text-white/40"
                              : "bg-white/5 hover:bg-white/10 text-white cursor-pointer active:scale-95"
                          }`}
                        >
                          ← Aula Anterior
                        </button>

                        <button
                          type="button"
                          disabled={selectedLessonIndex === SMK_VIDEO_LESSONS.length - 1}
                          onClick={() => setSelectedLessonIndex(prev => Math.min(SMK_VIDEO_LESSONS.length - 1, prev + 1))}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            selectedLessonIndex === SMK_VIDEO_LESSONS.length - 1
                              ? "opacity-30 cursor-not-allowed text-white/40"
                              : "bg-amber-400 hover:bg-amber-300 text-black cursor-pointer active:scale-95 shadow-md shadow-amber-400/20"
                          }`}
                        >
                          Próxima Aula →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Coluna 3: Playlist de Todas as Aulas */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Film className="size-3.5 text-amber-400" />
                        <span>Grade do Treinamento</span>
                      </span>
                      <span className="text-[10px] font-mono text-white/50">
                        {SMK_VIDEO_LESSONS.length} Aulas
                      </span>
                    </div>

                    <div className="space-y-2">
                      {SMK_VIDEO_LESSONS.map((lesson, idx) => {
                        const isCurrent = idx === selectedLessonIndex;
                        const hasVideo = Boolean(localVideoUrls[lesson.id] || customVideoUrls[lesson.id] || lesson.videoUrl);
                        return (
                          <div
                            key={lesson.id}
                            onClick={() => setSelectedLessonIndex(idx)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                              isCurrent
                                ? "bg-amber-500/10 border-amber-400/40 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/30"
                                : "bg-[#0a0a0a] border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 font-mono text-xs font-bold ${
                                isCurrent
                                  ? "bg-amber-400 text-black"
                                  : "bg-white/5 text-white/60 border border-white/10"
                              }`}>
                                {isCurrent ? <Play className="size-3.5 fill-black" /> : `0${lesson.lessonNumber}`}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 font-bold truncate">
                                    {lesson.category}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {hasVideo && (
                                      <span className="size-1.5 rounded-full bg-emerald-400" title="Vídeo pronto para assistir" />
                                    )}
                                    <span className="text-[10px] font-mono text-white/50">
                                      ⏱️ {lesson.duration}
                                    </span>
                                  </div>
                                </div>
                                <h5 className={`text-xs font-bold truncate ${isCurrent ? "text-amber-300" : "text-white"}`}>
                                  {lesson.title}
                                </h5>
                                <p className="text-[10px] text-white/40 truncate mt-0.5 font-mono">
                                  {hasVideo ? "🟢 Pronto para assistir" : lesson.fileName}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Barra Inferior de Ação (Salvar Alterações) ─── */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-4 pb-12">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Sparkles className="size-4 text-white/70" />
            <span>
              {hasChanges() ? "Você possui alterações não salvas." : "Todas as configurações estão sincronizadas no banco."}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            className={`flex items-center gap-2 px-7 py-3.5 rounded-2xl font-extrabold text-sm transition-all duration-300 cursor-pointer ${
              saveStatus === "success"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : saveStatus === "error"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : hasChanges()
                ? "bg-white hover:bg-white/90 text-black shadow-[0_0_30px_rgba(255,255,255,0.35)] active:scale-[0.98]"
                : "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saveStatus === "success" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            <span>
              {saving
                ? "Salvando alterações..."
                : saveStatus === "success"
                ? "Configurações salvas!"
                : "Salvar Alterações"}
            </span>
          </button>
        </div>

      </div>

      {/* Modal Dedicado de Conectar Sistema no Celular (PWA + Push) */}
      <MobilePushSetupModal
        isOpen={mobilePushModalOpen}
        onClose={() => setMobilePushModalOpen(false)}
        companyId={company?.id}
        storeName={storeName || "Smoking Pods"}
      />

      {/* Modal para configurar Link Online (YouTube / Google Drive) */}
      {editingUrlLessonId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#0d0d0d] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  <Link2 className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Configurar Link da Videoaula</h3>
                  <p className="text-[11px] text-white/50">
                    {SMK_VIDEO_LESSONS.find(l => l.id === editingUrlLessonId)?.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUrlLessonId(null)}
                className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/80 block">
                Link do Vídeo (YouTube, Google Drive ou URL direta .mp4):
              </label>
              <input
                type="url"
                value={tempUrlInput}
                onChange={(e) => setTempUrlInput(e.target.value)}
                placeholder="Ex: https://www.youtube.com/watch?v=... ou drive.google.com/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/15 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                autoFocus
              />
              <p className="text-[11px] text-white/40 leading-relaxed">
                💡 Para vídeos do YouTube, recomendamos subir como <strong>"Não Listado"</strong> para manter o conteúdo exclusivo para quem usa o sistema.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              {customVideoUrls[editingUrlLessonId] && (
                <button
                  type="button"
                  onClick={() => handleSaveCustomUrl(editingUrlLessonId, "")}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors mr-auto cursor-pointer"
                >
                  Remover Link
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingUrlLessonId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveCustomUrl(editingUrlLessonId, tempUrlInput)}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-black transition-all shadow-md shadow-amber-400/20 active:scale-95 cursor-pointer"
              >
                Salvar Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhado de Vídeo Aula & Tutorial */}
      <TutorialDetailModal
        tutorial={selectedTutorial}
        onClose={() => setSelectedTutorial(null)}
        onStartTour={handleStartTour}
      />

    </div>
  );
}
