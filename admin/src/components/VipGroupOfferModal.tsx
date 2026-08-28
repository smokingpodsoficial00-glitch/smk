import React, { useState } from "react";
import {
  X, Crown, Copy, Check, ExternalLink, Download, Share2, Sparkles, AlertTriangle, ArrowRight
} from "lucide-react";
import { DEFAULT_VIP_GROUP_URL, generateVipOfferMessage, logVipOfferBroadcast } from "../lib/vipGroupConfig";

interface VipGroupOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  promoPrice: number;
  discountPct: number;
  companyId?: string;
}

export const VipGroupOfferModal: React.FC<VipGroupOfferModalProps> = ({
  isOpen,
  onClose,
  product,
  promoPrice,
  discountPct,
  companyId,
}) => {
  const [copied, setCopied] = useState(false);
  const [isOpeningGroup, setIsOpeningGroup] = useState(false);

  if (!isOpen || !product) return null;

  const originalPrice = parseFloat(product.price || product.original_price || 0);
  const stock = parseInt(product.stock || 0);

  // Gerar mensagem comercial formatada
  const message = generateVipOfferMessage({
    brand: product.brand || "Pod",
    name: product.name || "Descartável",
    flavor: product.flavor || "Sabor Único",
    puffs: product.puffs,
    originalPrice,
    promoPrice,
    discountPct,
    stock,
  });

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);

      // Registrar auditoria
      logVipOfferBroadcast({
        productId: product.id,
        brand: product.brand,
        name: product.name,
        flavor: product.flavor,
        originalPrice,
        promoPrice,
        discountPct,
        companyId,
      });
    } catch (err) {
      console.warn("Erro ao copiar para clipboard:", err);
    }
  };

  const handleDownloadImage = async () => {
    if (!product.image_url) {
      alert("Este produto não possui imagem cadastrada.");
      return;
    }

    try {
      const response = await fetch(product.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `oferta_vip_${product.brand}_${product.name}_${product.flavor}.png`.replace(/\s+/g, "_").toLowerCase();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.open(product.image_url, "_blank");
    }
  };

  const handleOpenVipGroup = () => {
    setIsOpeningGroup(true);
    // Copiar automaticamente a mensagem antes de abrir para agilizar a experiência
    navigator.clipboard.writeText(message).catch(() => {});
    setCopied(true);

    logVipOfferBroadcast({
      productId: product.id,
      brand: product.brand,
      name: product.name,
      flavor: product.flavor,
      originalPrice,
      promoPrice,
      discountPct,
      companyId,
    });

    window.open(DEFAULT_VIP_GROUP_URL, "_blank", "noopener,noreferrer");
    setTimeout(() => setIsOpeningGroup(false), 1500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Oferta VIP: ${product.brand} ${product.name} (${product.flavor})`,
          text: message,
        });

        logVipOfferBroadcast({
          productId: product.id,
          brand: product.brand,
          name: product.name,
          flavor: product.flavor,
          originalPrice,
          promoPrice,
          discountPct,
          companyId,
        });
      } catch (err) {
        console.warn("Compartilhamento nativo cancelado:", err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#111111] border border-amber-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#161616] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Crown className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                👑 Oferta para o Grupo VIP
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Divulgação comercial pronta com dados reais da oferta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
          
          {/* Card do Produto Selecionado */}
          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-black/40 border border-white/10">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="size-14 rounded-lg object-contain bg-black/60 p-1 border border-white/10 shrink-0"
              />
            ) : (
              <div className="size-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-muted-foreground font-bold text-xs">
                {product.brand?.substring(0, 2) || "POD"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white truncate">{product.brand} {product.name}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {product.flavor}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                  -{discountPct}% OFF
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                <span>De: <strong className="line-through text-muted-foreground">R$ {originalPrice.toFixed(2)}</strong></span>
                <span>Por: <strong className="text-emerald-400 font-bold">R$ {promoPrice.toFixed(2)}</strong></span>
                <span>Estoque: <strong className="text-white">{stock} un.</strong></span>
              </div>
            </div>
          </div>

          {/* Guia Visual Rápido em 3 Passos */}
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between text-xs text-amber-300">
            <span className="font-semibold flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-400 shrink-0" />
              1. Copie a mensagem &nbsp;→&nbsp; 2. Baixe a foto &nbsp;→&nbsp; 3. Cole no Grupo VIP!
            </span>
          </div>

          {/* Prévia da Mensagem Formatada para WhatsApp */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold">Prévia da Mensagem (WhatsApp):</span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-amber-400 hover:text-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
              </button>
            </div>
            <div className="relative">
              <textarea
                readOnly
                value={message}
                rows={10}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs font-mono text-white/90 leading-relaxed focus:outline-none focus:border-amber-400 select-all resize-none custom-scrollbar"
              />
            </div>
          </div>

          {/* Ações de Apoio (Baixar Imagem / Compartilhar) */}
          <div className="flex items-center gap-2">
            {product.image_url && (
              <button
                type="button"
                onClick={handleDownloadImage}
                className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="size-3.5 text-muted-foreground" />
                <span>Baixar Foto do Produto</span>
              </button>
            )}

            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2 className="size-3.5 text-muted-foreground" />
                <span>Compartilhar</span>
              </button>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-[#141414] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMessage}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 border border-white/15 transition-all cursor-pointer active:scale-95"
            >
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span>{copied ? "Mensagem Copiada!" : "Copiar Mensagem"}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenVipGroup}
              disabled={stock <= 0}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-40"
            >
              <ExternalLink className="size-3.5 text-black" />
              <span>Abrir Grupo VIP no WhatsApp</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
