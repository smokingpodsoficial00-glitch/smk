import { useState, useRef, useEffect } from "react";
import {
  Store, Upload, Palette, Phone, Key, MapPin, Globe,
  Save, CheckCircle2, AlertCircle, Loader2, ImagePlus,
  Trash2, Eye, Type, X, Smartphone, CreditCard
} from "lucide-react";
import { useStoreConfig } from "@/lib/useStoreConfig";

const PRESET_COLORS = [
  "#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6",
  "#10b981", "#22c55e", "#eab308", "#f97316", "#ef4444",
  "#ec4899", "#d946ef", "#a855f7", "#64748b", "#ffffff",
];

export function SettingsPage() {
  const { config, loading, saving, saveStatus, updateConfig, uploadLogo } = useStoreConfig();

  // Form state local
  const [storeName, setStoreName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
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
      setPrimaryColor(config.primary_color || "#10b981");
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
      description: "",
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
      primaryColor !== (config.primary_color || "#10b981") ||
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
              <p className="text-xs text-muted-foreground mt-0.5">Defina a marca e a logo do seu negócio</p>
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
                <p className="text-[11px] text-muted-foreground">Este nome será exibido no topo da loja para os seus clientes.</p>
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

        {/* ─── Seção 2: Contato & Pagamento (opcional) ─── */}
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
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50"
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
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
        </section>

        {/* ─── Seção 3: Preview do Front-End ─── */}
        <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <Eye className="size-4 text-emerald-400" />
            <h2 className="font-bold text-base text-white">Visualização no Front-End</h2>
          </div>

          <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a0a] p-8 text-center space-y-4">
            {logoPreview ? (
              <div className="relative size-20 mx-auto rounded-2xl p-2 bg-black border border-white/15 shadow-2xl flex items-center justify-center">
                <img src={logoPreview} alt="Logo" className="size-full object-contain" />
              </div>
            ) : (
              <div className="size-20 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Store className="size-8 text-emerald-400" />
              </div>
            )}
            <h3 className="text-2xl font-bold text-white tracking-tight">{storeName || "Minha Loja"}</h3>
          </div>
        </section>

        <div className="h-8" />
      </div>
    </div>
  );
}
