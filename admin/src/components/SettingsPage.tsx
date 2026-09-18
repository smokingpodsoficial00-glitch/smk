import { useState, useEffect } from "react";
import {
  Store, Phone, Globe,
  Save, CheckCircle2, AlertCircle, Loader2,
  Type, Smartphone, Copy, Check, Sparkles, Lock, ExternalLink
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { validateAndNormalizeBrazilianPhone, formatBrazilianPhone } from "@/lib/phoneUtils";

export default function SettingsPage() {
  const { config, loading, saving, saveStatus, updateConfig, updateStoreWhatsApp } = useStoreConfig();
  const { company, refreshCompany } = (useAuth() as any) || {};

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

  // Dynamic Catalog Link (Neutro para SaaS: 'gradedevalores-pods.vercel.app', 100% gratuito sem pagar domínio)
  const isOfficial = !company?.id || company?.id === "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";
  const saasBaseUrl = (import.meta as any).env?.VITE_SAAS_CATALOG_BASE_URL || "https://gradedevalores-pods.vercel.app";

  const currentSlug = generateSlug(storeName || company?.name || config?.store_name || "");

  // O link só é liberado se for a loja oficial OU se o lojista já definiu e salvou um nome de loja válido
  const isStoreConfigured = Boolean(
    (config?.store_name && config.store_name.trim().length >= 2 && config.store_name.trim().toLowerCase() !== "minha loja") ||
    (company?.name && company.name.trim().length >= 2 && company.name.trim().toLowerCase() !== "minha loja")
  );

  const [linkUnlocked, setLinkUnlocked] = useState(isOfficial || isStoreConfigured);

  useEffect(() => {
    if (isOfficial || isStoreConfigured) {
      setLinkUnlocked(true);
    }
  }, [isOfficial, isStoreConfigured]);

  const getCatalogUrl = () => {
    if (isOfficial) {
      return "https://smoking-pods-catalogo.vercel.app/";
    }
    // Link genérico neutro de Tabela de Valores: https://tabeladevalores-pods.vercel.app/?loja=nomedaloja
    return `${saasBaseUrl}/?loja=${currentSlug || 'loja'}`;
  };

  const catalogUrl = getCatalogUrl();

  // Sync form state when config loads
  useEffect(() => {
    if (config && !loading) {
      if (!storeName && !whatsappNumber) {
        setStoreName(config.store_name || "");
        setWhatsappNumber(formatBrazilianPhone(config.whatsapp_number || ""));
      }
    }
  }, [config, loading]);

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
      {/* Header Fixo */}
      <div className="sticky top-0 z-20 bg-[#050505]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/15 shadow-[0_0_15px_rgba(255,255,255,0.06)]">
              <Store className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
                  Configurações da Loja
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
                  ERP SaaS
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                Defina a marca, logo do sistema e o canal oficial de WhatsApp do seu catálogo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges()}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 cursor-pointer ${
                saveStatus === "success"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : saveStatus === "error"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : hasChanges()
                  ? "bg-white hover:bg-white/90 text-black shadow-[0_0_25px_rgba(255,255,255,0.3)] active:scale-[0.97]"
                  : "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saveStatus === "success" ? (
                <CheckCircle2 className="size-4" />
              ) : saveStatus === "error" ? (
                <AlertCircle className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              <span>
                {saving
                  ? "Salvando..."
                  : saveStatus === "success"
                  ? "Salvo com sucesso!"
                  : saveStatus === "error"
                  ? "Erro ao salvar"
                  : "Salvar Alterações"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Central */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
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
            <div className="relative">
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Smoking Pods, Vape House..."
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
                      <span>Link Neutro: identificador <strong>(?loja={currentSlug})</strong> sem menção a Smoking Pods.</span>
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
    </div>
  );
}
