import { useState, useRef, useEffect } from "react";
import {
  Store, Upload, Palette, Phone, Key, MapPin, Instagram,
  Save, CheckCircle2, AlertCircle, Loader2, ImagePlus,
  Trash2, Eye, Type, FileText, X, Smartphone, CreditCard
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";

const PRESET_COLORS = [
  "#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6",
  "#10b981", "#22c55e", "#eab308", "#f97316", "#ef4444",
  "#ec4899", "#d946ef", "#a855f7", "#64748b", "#ffffff",
];

export function SettingsPage() {
  const { config, loading, saving, saveStatus, updateConfig, uploadLogo } = useStoreConfig();

  // Form state local (espelha o config para edição)
  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#8b5cf6");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixName, setPixName] = useState("");
  const [address, setAddress] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  // Logo upload
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom color picker
  const [showCustomColor, setShowCustomColor] = useState(false);

  // Sync form state when config loads
  useEffect(() => {
    if (config && !loading) {
      setStoreName(config.store_name || "");
      setDescription(config.description || "");
      setPrimaryColor(config.primary_color || "#8b5cf6");
      setWhatsappNumber(config.whatsapp_number || "");
      setPixKey(config.pix_key || "");
      setPixName(config.pix_name || "");
      setAddress(config.address || "");
      setInstagramUrl(config.instagram_url || "");
      setLogoPreview(config.logo_url || null);
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

  const handleSave = async () => {
    let logoUrl = config.logo_url;

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

    await updateConfig({
      store_name: storeName.trim() || "Minha Loja",
      store_slug: (storeName.trim() || "minha-loja").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description,
      primary_color: primaryColor,
      whatsapp_number: whatsappNumber.replace(/\D/g, ""),
      pix_key: pixKey,
      pix_name: pixName,
      address,
      instagram_url: instagramUrl,
      logo_url: logoUrl,
    });
  };

  const hasChanges = () => {
    if (!config) return false;
    return (
      storeName !== (config.store_name || "") ||
      description !== (config.description || "") ||
      primaryColor !== (config.primary_color || "#8b5cf6") ||
      whatsappNumber !== (config.whatsapp_number || "") ||
      pixKey !== (config.pix_key || "") ||
      pixName !== (config.pix_name || "") ||
      address !== (config.address || "") ||
      instagramUrl !== (config.instagram_url || "") ||
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
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#050505]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Store className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-silver">Configurações da Loja</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Personalize a identidade visual e dados da sua loja</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || uploadingLogo || !hasChanges()}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
              saveStatus === "success"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : saveStatus === "error"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : hasChanges()
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02]"
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
              ? "Salvo!"
              : saveStatus === "error"
              ? "Erro ao salvar"
              : "Salvar Alterações"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* ─── Seção 1: Identidade da Loja ─── */}
        <section className="glass rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <Store className="size-4 text-primary" />
            <h2 className="font-semibold text-base">Identidade da Loja</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
            {/* Campos de texto */}
            <div className="space-y-5">
              {/* Nome da Loja */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                  <Type className="size-3.5 text-muted-foreground" />
                  Nome da Loja
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Ex: Smoking Pods, Vape House, Pod Store..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                />
                <p className="text-xs text-muted-foreground">Este nome aparecerá no cabeçalho do painel admin e na loja do cliente.</p>
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                  <FileText className="size-3.5 text-muted-foreground" />
                  Descrição Curta
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Os melhores pods descartáveis com entrega rápida..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all resize-none"
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-3 lg:w-56">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <ImagePlus className="size-3.5 text-muted-foreground" />
                Logo da Loja
              </label>

              <div
                className={`relative aspect-square rounded-2xl border-2 border-dashed transition-all duration-300 flex items-center justify-center overflow-hidden cursor-pointer group ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[1.02]"
                    : logoPreview
                    ? "border-white/10 bg-white/5"
                    : "border-white/15 bg-white/5 hover:border-primary/40 hover:bg-primary/5"
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
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-4" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="size-8 opacity-40" />
                    <span className="text-xs text-center px-4">Arraste uma imagem ou clique para selecionar</span>
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
              <p className="text-[10px] text-muted-foreground text-center">PNG, JPG ou SVG. Recomendado: 512×512px</p>
            </div>
          </div>
        </section>

        {/* ─── Seção 2: Cor Primária ─── */}
        <section className="glass rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <Palette className="size-4 text-primary" />
            <h2 className="font-semibold text-base">Cor Primária da Marca</h2>
          </div>

          <p className="text-xs text-muted-foreground">Essa cor será usada nos botões, destaques e elementos interativos da loja e do painel.</p>

          <div className="flex flex-wrap items-center gap-3">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => { setPrimaryColor(color); setShowCustomColor(false); }}
                className={`w-9 h-9 rounded-xl transition-all duration-200 hover:scale-110 border-2 ${
                  primaryColor === color
                    ? "border-white shadow-lg scale-110"
                    : "border-transparent hover:border-white/30"
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}

            {/* Custom color */}
            <div className="relative">
              <button
                onClick={() => setShowCustomColor(!showCustomColor)}
                className={`w-9 h-9 rounded-xl border-2 transition-all duration-200 hover:scale-110 flex items-center justify-center ${
                  showCustomColor ? "border-white" : "border-white/20 hover:border-white/40"
                }`}
                style={{
                  background: !PRESET_COLORS.includes(primaryColor) ? primaryColor : "linear-gradient(135deg, #ff0000, #00ff00, #0000ff)",
                }}
                title="Cor personalizada"
              >
                {PRESET_COLORS.includes(primaryColor) && <span className="text-[10px] font-bold text-white drop-shadow">+</span>}
              </button>
              {showCustomColor && (
                <div className="absolute top-12 left-0 z-10 glass-strong rounded-xl p-3 space-y-2 shadow-2xl">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full h-10 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-28 bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-center"
                    placeholder="#8b5cf6"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Preview da cor */}
          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Preview:</span>
              <button className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all" style={{ backgroundColor: primaryColor }}>
                Botão Primário
              </button>
              <span className="px-3 py-1 rounded-full text-[10px] font-medium border" style={{ borderColor: primaryColor, color: primaryColor }}>
                Badge
              </span>
            </div>
          </div>
        </section>

        {/* ─── Seção 3: Contato & Pagamento ─── */}
        <section className="glass rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <Phone className="size-4 text-primary" />
            <h2 className="font-semibold text-base">Contato & Pagamento</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* WhatsApp */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <Smartphone className="size-3.5 text-emerald-400" />
                WhatsApp para Pedidos
              </label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="5511999999999"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-all"
              />
              <p className="text-[10px] text-muted-foreground">Formato: código do país + DDD + número (ex: 5511977300561)</p>
            </div>

            {/* Chave Pix */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <CreditCard className="size-3.5 text-amber-400" />
                Chave Pix
              </label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/25 transition-all"
              />
            </div>

            {/* Nome do titular Pix */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <Key className="size-3.5 text-amber-400" />
                Nome do Titular (Pix)
              </label>
              <input
                type="text"
                value={pixName}
                onChange={(e) => setPixName(e.target.value)}
                placeholder="Nome que aparece ao pagar"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/25 transition-all"
              />
            </div>

            {/* Endereço */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <MapPin className="size-3.5 text-blue-400" />
                Endereço
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número — bairro, cidade"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all"
              />
            </div>

            {/* Instagram */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <Instagram className="size-3.5 text-pink-400" />
                Instagram
              </label>
              <input
                type="text"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/sualoja"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all"
              />
            </div>
          </div>
        </section>

        {/* ─── Seção 4: Preview em Tempo Real ─── */}
        <section className="glass rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <Eye className="size-4 text-primary" />
            <h2 className="font-semibold text-base">Preview — Como sua loja aparecerá</h2>
          </div>

          {/* Preview: Header do frontend */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a]">
            {/* Mini navbar */}
            <div className="h-12 px-5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-7 h-7 rounded-lg object-contain" />
                ) : (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor + "20" }}>
                    <Store className="size-4" style={{ color: primaryColor }} />
                  </div>
                )}
                <span className="text-sm font-semibold">{storeName || "Minha Loja"}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
              </div>
            </div>

            {/* Mini hero */}
            <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
              <span className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                {description || "Configure sua loja nas configurações"}
              </span>
              <h3 className="text-2xl font-bold text-silver">{storeName || "Minha Loja"}</h3>
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="px-5 py-2 rounded-full text-xs font-medium text-white shadow-lg transition-transform hover:scale-105"
                  style={{ backgroundColor: primaryColor }}
                >
                  Ver Catálogo
                </button>
                <button className="px-5 py-2 rounded-full text-xs font-medium text-white/60 border border-white/15 hover:border-white/30 transition-colors">
                  Contato
                </button>
              </div>
            </div>
          </div>

          {/* Preview: Sidebar do admin */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a]">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest">
              Preview do Painel Admin
            </div>
            <div className="p-4 flex items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-8 h-8 rounded-xl object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: primaryColor + "20" }}>
                  <Store className="size-4" style={{ color: primaryColor }} />
                </div>
              )}
              <div>
                <p className="text-sm font-bold">{storeName || "Minha Loja"} <span className="text-white/30 font-normal">Admin</span></p>
                <p className="text-[10px] text-muted-foreground">{description ? description.substring(0, 50) : "Painel Administrativo"}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Spacer bottom */}
        <div className="h-8" />
      </div>
    </div>
  );
}
