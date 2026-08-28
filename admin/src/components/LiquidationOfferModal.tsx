import React, { useState, useEffect } from "react";
import { X, Tag, DollarSign, TrendingUp, AlertTriangle, Check, Sparkles } from "lucide-react";
import { updateProductPromotion } from "../lib/productPromotions";

interface LiquidationOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  companyId?: string;
  onOfferSaved?: () => void;
}

export const LiquidationOfferModal: React.FC<LiquidationOfferModalProps> = ({
  isOpen,
  onClose,
  product,
  companyId,
  onOfferSaved,
}) => {
  const [selectedDiscount, setSelectedDiscount] = useState<number | null>(15);
  const [customPrice, setCustomPrice] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (product) {
      const currentPrice = parseFloat(product.price) || 0;
      setSelectedDiscount(15);
      const defaultPromoPrice = (currentPrice * 0.85).toFixed(2);
      setCustomPrice(defaultPromoPrice);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const currentPrice = parseFloat(product.price) || 0;
  const costPrice = parseFloat(product.cost_price) || 0;
  const stock = parseInt(product.stock) || 0;

  let promoPrice = parseFloat(customPrice) || 0;

  const handleSelectDiscount = (pct: number) => {
    setSelectedDiscount(pct);
    const newP = currentPrice * (1 - pct / 100);
    setCustomPrice(newP.toFixed(2));
  };

  const handleCustomPriceChange = (val: string) => {
    setSelectedDiscount(null);
    setCustomPrice(val);
  };

  const unitProfit = promoPrice - costPrice;
  const totalProfit = unitProfit * stock;
  const newMarginPct = promoPrice > 0 ? ((promoPrice - costPrice) / promoPrice) * 100 : 0;
  const isBelowCost = promoPrice > 0 && promoPrice < costPrice;
  const currentMarginPct = currentPrice > 0 ? ((currentPrice - costPrice) / currentPrice) * 100 : 0;

  const handleSaveOffer = async () => {
    if (promoPrice <= 0) {
      alert("Por favor, informe um preço promocional válido.");
      return;
    }

    if (isBelowCost) {
      const confirmBelowCost = window.confirm(
        `ATENÇÃO: O preço promocional (R$ ${promoPrice.toFixed(2)}) está ABAIXO do custo unitário (R$ ${costPrice.toFixed(2)}).\n\nVocê terá um prejuízo estimado de R$ ${Math.abs(totalProfit).toFixed(2)} se vender todo o estoque.\n\nDeseja confirmar assim mesmo?`
      );
      if (!confirmBelowCost) return;
    }

    setIsSaving(true);
    try {
      const discountPctCalculated = currentPrice > 0 ? Math.round(((currentPrice - promoPrice) / currentPrice) * 100) : 0;

      await updateProductPromotion({
        productId: product.id,
        isPromotional: true,
        promoPrice,
        discountPct: Math.max(0, discountPctCalculated),
        companyId,
      });

      alert(`Oferta de Queima salva com sucesso para ${product.brand} ${product.name} (${product.flavor})!`);
      if (onOfferSaved) onOfferSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar oferta.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#111111] border border-amber-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#161616] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Tag className="size-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                Oferta de Queima de Estoque
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Liquidação e promoção de rápida saída de capital
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
          <div className="flex items-center gap-3 p-3 rounded-xl bg-black/40 border border-white/10">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="size-12 rounded-lg object-contain bg-black/60 p-1 border border-white/10 shrink-0" />
            ) : (
              <div className="size-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-muted-foreground font-bold text-xs">
                {product.brand?.substring(0, 2) || "POD"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate">{product.brand} {product.name}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {product.flavor}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                <span>Estoque: <strong className="text-white">{stock} un.</strong></span>
                <span>Custo: <strong className="text-white">R$ {costPrice.toFixed(2)}</strong></span>
                <span>Atual: <strong className="text-emerald-400">R$ {currentPrice.toFixed(2)}</strong></span>
              </div>
            </div>
          </div>

          {/* Botões Rápidos de Desconto */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground block">
              Sugestões Rápidas de Desconto:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20, 25].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleSelectDiscount(pct)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    selectedDiscount === pct
                      ? "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20"
                      : "bg-black/40 hover:bg-white/5 text-white border-white/10"
                  }`}
                >
                  -{pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Input de Preço Promocional Personalizado */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground block">
              Preço Promocional Personalizado (R$):
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">R$</span>
              <input
                type="number"
                step="0.01"
                value={customPrice}
                onChange={(e) => handleCustomPriceChange(e.target.value)}
                className="w-full bg-black/60 border border-amber-500/40 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Alerta de Prejuízo (Abaixo do Custo) */}
          {isBelowCost && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertTriangle className="size-4 shrink-0 text-red-400" />
              <span>Preço promocional abaixo do custo unitário (R$ {costPrice.toFixed(2)}). Haverá prejuízo no lote.</span>
            </div>
          )}

          {/* Quadro de Simulação Financeira em Tempo Real */}
          <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <span className="text-muted-foreground">Novo Preço de Venda:</span>
              <strong className="text-base text-amber-400">R$ {promoPrice.toFixed(2)}</strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Lucro por Unidade:</span>
              <strong className={unitProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                R$ {unitProfit.toFixed(2)}
              </strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Lucro Total Se Vender Todo o Estoque:</span>
              <strong className={totalProfit >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                R$ {totalProfit.toFixed(2)}
              </strong>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-white/5">
              <span className="text-muted-foreground">Nova Margem de Lucro:</span>
              <strong className={newMarginPct >= 0 ? "text-white" : "text-red-400"}>
                {newMarginPct.toFixed(1)}% (antes: {currentMarginPct.toFixed(1)}%)
              </strong>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-[#141414] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSaveOffer}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="size-3.5 text-black" />
            <span>{isSaving ? "Salvando..." : "Salvar Oferta de Queima"}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
