import { useState, useRef, useEffect } from "react";
import {
  Store, Upload, Palette, Phone, Key, MapPin, Globe,
  Save, CheckCircle2, AlertCircle, Loader2, ImagePlus,
  Trash2, Eye, Type, X, Smartphone, CreditCard, Copy, ExternalLink, Check
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function SettingsPage() {
  const { config, loading, saving, saveStatus, updateConfig, uploadLogo } = useStoreConfig();
  const { company, refreshCompany } = useAuth() as any || {};

  // Form state local
  const [storeName, setStoreName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [address, setAddress] = useState("");
  const [originCep, setOriginCep] = useState("");
  const [baseFare, setBaseFare] = useState("8.50");
  const [includedKm, setIncludedKm] = useState("3.0");
  const [extraKmFee, setExtraKmFee] = useState("1.40");

  // Copy link state
  const [copied, setCopied] = useState(false);

  // Logo upload
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Slugifier seguro com suporte a acentos e caracteres especiais em Português
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

  // Dynamic Catalog Link (Suporta local e produção)
  const getCatalogUrl = () => {
    if (typeof window === 'undefined') return "http://localhost:5175";
    const { origin, port, hostname } = window.location;
    if (port === "5174" || port === "8082" || port === "3000") {
      return `${window.location.protocol}//${hostname}:5175`;
    }
    const slug = generateSlug(storeName || config?.store_name || "loja");
    return `${origin}/loja/${slug}`;
  };

  const catalogUrl = getCatalogUrl();

  // Sync form state when config loads (Protege edições locais em andamento)
  useEffect(() => {
    if (config && !loading) {
      // Sincroniza se o usuário ainda não modificou o formulário localmente
      if (!storeName && !whatsappNumber && !pixKey && !address) {
        setStoreName(config.store_name || "");
        setPrimaryColor(config.primary_color || "#10b981");
        setWhatsappNumber(config.whatsapp_number || "");
        setPixKey(config.pix_key || "");
        setLogoPreview(config.logo_url || null);
        setAddress(config.address || "Rua Alexandra Lunardi Fanani, 57 - Assunção, São Bernardo do Campo - SP, 09810-200");
        setOriginCep(config.origin_cep || "09810-200");
        setBaseFare(String(config.base_fare ?? 8.50));
        setIncludedKm(String(config.included_km ?? 3.0));
        setExtraKmFee(String(config.extra_km_fee ?? 1.40));
      }
    }
  }, [config, loading]);

  const handleLogoSelect = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleCopyCatalogLink = () => {
    navigator.clipboard.writeText(catalogUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = async () => {
    let logoUrl = config?.logo_url || null;

    // Upload logo if changed
    if (logoFile) {
      setUploadingLogo(true);
      const url = await uploadLogo(logoFile);
      setUploadingLogo(false);
      if (url) {
        logoUrl = url;
        setLogoFile(null);
      }
    }

    // Se removeu o logo
    if (!logoPreview && !logoFile) {
      logoUrl = null;
    }

    const finalStoreName = storeName.trim() || "Minha Loja";

    const parseDecimal = (val: string, fallback: number): number => {
      if (!val) return fallback;
      const normalized = val.toString().replace(',', '.').replace(/[^0-9.]/g, '');
      const num = parseFloat(normalized);
      return isNaN(num) ? fallback : num;
    };

    const success = await updateConfig({
      store_name: finalStoreName,
      store_slug: generateSlug(finalStoreName),
      description: "",
      primary_color: primaryColor,
      whatsapp_number: whatsappNumber.replace(/\D/g, ""),
      pix_key: pixKey,
      logo_url: logoUrl,
      address: address.trim(),
      origin_cep: originCep.trim(),
      base_fare: parseDecimal(baseFare, 8.50),
      included_km: parseDecimal(includedKm, 3.0),
      extra_km_fee: parseDecimal(extraKmFee, 1.40),
    });

    // Sincroniza tabela companies e refreshCompany() no AuthContext
    if (company?.id) {
      try {
        await supabase.from('companies').update({
          name: finalStoreName,
          logo_url: logoUrl,
          address: address.trim(),
          pix_key: pixKey,
          phone: whatsappNumber.replace(/\D/g, "")
        }).eq('id', company.id);
        if (refreshCompany) await refreshCompany();
      } catch (e) {
        console.warn("Erro ao atualizar empresa:", e);
      }
    }

    // Sincroniza fallback smoking_products (__STORE_CONFIG__) para o catálogo do cliente
    try {
      const configJson = JSON.stringify({
        store_name: finalStoreName,
        logo_url: logoUrl,
        primary_color: primaryColor,
        pix_key: pixKey,
        whatsapp_number: whatsappNumber.replace(/\D/g, ""),
        address: address.trim(),
      });
      await supabase
        .from('smoking_products')
        .upsert({
          brand: '__STORE_CONFIG__',
          name: finalStoreName,
          image_url: logoUrl,
          flavor: configJson,
          company_id: company?.id || null
        }, { onConflict: 'brand' });
    } catch (e) {
      console.warn("Erro ao sincronizar catálogo:", e);
    }
  };

  const hasChanges = () => {
    if (!config) return false;
    return (
      storeName !== (config.store_name || "") ||
      primaryColor !== (config.primary_color || "#10b981") ||
      whatsappNumber !== (config.whatsapp_number || "") ||
      pixKey !== (config.pix_key || "") ||
      address !== (config.address || "") ||
      originCep !== (config.origin_cep || "") ||
      baseFare !== String(config.base_fare ?? 8.50) ||
      includedKm !== String(config.included_km ?? 3.0) ||
      extraKmFee !== String(config.extra_km_fee ?? 1.40) ||
      logoFile !== null ||
      (logoPreview === null && config.logo_url !== null)
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Store className="size-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Configurações da Loja</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Defina a marca, logo e compartilhe seu catálogo</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || uploadingLogo || !hasChanges()}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 cursor-pointer ${
              saveStatus === "success"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : saveStatus === "error"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : hasChanges()
                ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-[0.97]"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            }`}
          >
            {saving || uploadingLogo ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saveStatus === "success" ? (
              <CheckCircle2 className="size-4" />
            ) : saveStatus === "error" ? (
              <AlertCircle className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saving || uploadingLogo
              ? "Salvando..."
              : saveStatus === "success"
              ? "Salvo com sucesso!"
              : saveStatus === "error"
              ? "Erro ao salvar"
              : "Salvar Alterações"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* ─── Seção 1: Identidade da Loja (Nome e Logo) ─── */}
        <section className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <Store className="size-4 text-emerald-400" />
            <h2 className="font-bold text-base text-white">Identidade da Loja</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Nome da Loja */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
                  <Type className="size-3.5 text-emerald-400" />
                  Nome da Loja *
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Ex: Smoking Pods, Vape House..."
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-semibold"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Este nome será exibido no topo da loja para os seus clientes.</span>
                  {storeName && (
                    <span className="font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      /{generateSlug(storeName)}
                    </span>
                  )}
                </div>
              </div>

              {/* Seletor de Cor Primária da Marca */}
              <div className="space-y-2.5 pt-2 border-t border-white/5">
                <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
                  <Palette className="size-3.5 text-emerald-400" />
                  Cor Primária da Marca
                </label>
                <div className="flex items-center gap-3">
                  {[
                    { name: "Esmeralda", hex: "#10b981" },
                    { name: "Azul Safira", hex: "#3b82f6" },
                    { name: "Roxo Neon", hex: "#8b5cf6" },
                    { name: "Âmbar Gold", hex: "#f59e0b" },
                    { name: "Ruby Red", hex: "#f43f5e" },
                    { name: "Ciano Light", hex: "#06b6d4" },
                  ].map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setPrimaryColor(color.hex)}
                      className={`size-7 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                        primaryColor.toLowerCase() === color.hex.toLowerCase()
                          ? "border-white scale-110 shadow-lg shadow-black"
                          : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                      {primaryColor.toLowerCase() === color.hex.toLowerCase() && (
                        <Check className="size-3.5 text-black stroke-[3]" />
                      )}
                    </button>
                  ))}

                  {/* Custom Hex Picker Input */}
                  <div className="relative flex items-center gap-2 ml-auto">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="size-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                      title="Escolher Cor Personalizada"
                    />
                    <span className="text-xs font-mono font-bold text-white uppercase">{primaryColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-3">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
                <ImagePlus className="size-3.5 text-emerald-400" />
                Logo do Negócio
              </label>

              <div
                className={`relative h-44 rounded-2xl border-2 border-dashed transition-all duration-300 flex items-center justify-center overflow-hidden cursor-pointer group ${
                  isDragging
                    ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
                    : logoPreview
                    ? "border-white/10 bg-[#0a0a0a]"
                    : "border-white/15 bg-[#0a0a0a] hover:border-emerald-500/40 hover:bg-emerald-500/5"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleLogoSelect(file);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {logoPreview ? (
                  <>
                    <img src={logoPreview} alt="Logo" className="max-h-36 max-w-full object-contain p-3" />
                    <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                        className="p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
                        title="Remover Logo"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="size-8 text-emerald-400/50" />
                    <span className="text-xs font-semibold text-white/80">Clique ou arraste a logo aqui</span>
                    <span className="text-[10px] text-muted-foreground">PNG, JPG ou SVG (recomendado 512×512px)</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoSelect(file);
                }}
              />
            </div>
          </div>
        </section>

        {/* ─── Seção 2: Link do Catálogo Front-End (Compartilhamento) ─── */}
        <section className="bg-card border border-emerald-500/20 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <Globe className="size-4 text-emerald-400" />
              <h2 className="font-bold text-base text-white">Link do seu Catálogo de Pods</h2>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold">
              🟢 Loja Online Ativa
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Copie o link do seu catálogo para enviar aos seus clientes no WhatsApp ou colocar na bio do Instagram.
          </p>

          {/* Campo de URL com Botões de Ação */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-xs text-emerald-400 font-mono flex items-center justify-between overflow-hidden">
              <span className="truncate">{catalogUrl}</span>
            </div>

            <button
              type="button"
              onClick={handleCopyCatalogLink}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                copied
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-[0.97]"
              }`}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Link Copiado!" : "Copiar Link"}
            </button>

            <a
              href={catalogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-elevated hover:bg-white/10 text-white font-semibold text-xs border border-border transition-all cursor-pointer"
            >
              <ExternalLink className="size-4 text-blue-400" />
              Abrir Loja
            </a>
          </div>

          {/* Mini Preview do Front-End */}
          <div className="pt-3">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block mb-3">
              Preview em Tempo Real
            </span>
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a0a] p-6 text-center space-y-3">
              {logoPreview ? (
                <div className="relative size-16 mx-auto rounded-2xl p-2 bg-black border border-white/15 shadow-xl flex items-center justify-center">
                  <img src={logoPreview} alt="Logo" className="size-full object-contain" />
                </div>
              ) : (
                <div className="size-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Store className="size-7 text-emerald-400" />
                </div>
              )}
              <h3 className="text-xl font-bold text-white tracking-tight">{storeName || "Minha Loja"}</h3>
            </div>
          </div>
        </section>

        {/* ─── Seção 3: Contato & Pagamentos ─── */}
        <section className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <Phone className="size-4 text-emerald-400" />
            <h2 className="font-bold text-base text-white">Contato & Pagamentos</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* WhatsApp */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
                <Smartphone className="size-3.5 text-emerald-400" />
                WhatsApp de Vendas
              </label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="5511999999999"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 font-semibold"
              />
            </div>

            {/* Chave Pix */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
                <CreditCard className="size-3.5 text-amber-400" />
                Chave Pix
              </label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Chave Pix para pagamentos"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-500/50 font-semibold"
              />
            </div>
          </div>
        </section>

        {/* ─── Seção 4: Logística, Origem & Regras de Frete ─── */}
        <section className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <MapPin className="size-4 text-blue-400" />
            <div>
              <h2 className="font-bold text-base text-white">Logística, Origem do Estoque & Cálculo de Frete</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Endereço de saída dos pedidos e regras de tarifa em KM para a IA calcular</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Endereço de Origem */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
                <MapPin className="size-3.5 text-blue-400" />
                Endereço Completo de Saída dos Motoboys *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, Número - Bairro, Cidade - UF"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 font-semibold"
              />
            </div>

            {/* CEP de Origem */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
                <Globe className="size-3.5 text-blue-400" />
                CEP da Origem *
              </label>
              <input
                type="text"
                value={originCep}
                onChange={(e) => setOriginCep(e.target.value)}
                placeholder="09810-200"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2 border-t border-white/5">
            {/* Tarifa Base */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                Tarifa Base (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs text-muted-foreground font-bold">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={baseFare}
                  onChange={(e) => setBaseFare(e.target.value)}
                  placeholder="8,50"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 font-semibold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Preço inicial fixo cobrado do cliente.</p>
            </div>

            {/* KM Incluso */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                KM Incluso na Base
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={includedKm}
                  onChange={(e) => setIncludedKm(e.target.value)}
                  placeholder="3,0"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 font-semibold"
                />
                <span className="absolute right-3.5 top-3 text-xs text-muted-foreground font-bold">KM</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Distância máxima coberta pela tarifa base.</p>
            </div>

            {/* Taxa por KM Extra */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                Taxa por KM Excedente
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs text-muted-foreground font-bold">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={extraKmFee}
                  onChange={(e) => setExtraKmFee(e.target.value)}
                  placeholder="1,40"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 font-semibold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Valor por cada KM além da distância inclusa.</p>
            </div>
          </div>
        </section>

        <div className="h-8" />
      </div>
    </div>
  );
}
