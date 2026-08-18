import React from 'react';
import { 
  X, ShoppingBag, MapPin, Phone, Calendar, Clock, 
  CheckCircle2, DollarSign, User, MessageSquare, Copy, 
  Truck, ShieldCheck, Sparkles, Tag, ExternalLink, Receipt
} from 'lucide-react';
import { formatBRL } from '@/lib/cart';
import type { DetailedSale } from '@/lib/salesHistory';

interface SaleDetailModalProps {
  sale: DetailedSale | null;
  onClose: () => void;
  onSelectClient?: (phone: string) => void;
}

export function SaleDetailModal({ sale, onClose }: SaleDetailModalProps) {
  if (!sale) return null;

  const orderDate = new Date(sale.created_at).toLocaleDateString('pt-BR');
  const orderTime = new Date(sale.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const waNumber = sale.clean_phone.startsWith('55') ? sale.clean_phone : ('55' + sale.clean_phone);

  const copyOrderSummary = () => {
    const itemsText = sale.items
      .map(i => `- ${i.quantity}x ${i.name || 'Pod'} ${i.flavor || ''} (${formatBRL(i.price * i.quantity)})`)
      .join('\n');

    const text = `*Resumo do Pedido - Smoking Pods*\n` +
      `📅 Data: ${orderDate} às ${orderTime}\n` +
      `👤 Cliente: ${sale.client_name}\n` +
      `📱 Telefone: ${sale.client_phone}\n` +
      `📍 Endereço: ${sale.address}\n\n` +
      `*Itens:*\n${itemsText}\n\n` +
      `💰 *Total Pago:* ${formatBRL(sale.total_amount)}\n` +
      `🚚 Status: ${sale.delivery_status}`;

    navigator.clipboard.writeText(text);
    alert('Resumo do pedido copiado para a área de transferência!');
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#0e0e10] border border-white/15 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141416]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
              <Receipt className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Raio-X da Venda {sale.order_code ? `(${sale.order_code})` : ''}
                </h3>
                <span className="text-[10px] font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                  ID: {sale.id.slice(0, 8)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>{orderDate} às {orderTime}</span>
                <span>•</span>
                <span className="capitalize">{sale.source || 'WhatsApp'}</span>
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
          
          {/* Card do Cliente & CRM Context */}
          <div className="bg-[#141416] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-base shrink-0">
                {sale.client_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{sale.client_name}</h4>
                  {sale.is_vip && (
                    <span className="text-[9px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      ⭐ VIP
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/60 font-mono flex items-center gap-1.5 mt-0.5">
                  <Phone className="size-3 text-white/40" />
                  <span>{sale.client_phone}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5">
              <div className="text-left sm:text-right">
                <div className="text-[10px] uppercase font-bold text-white/40">Total Compras</div>
                <div className="text-xs font-bold text-white font-mono">{sale.client_total_orders} pedidos</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-white/40">LTV Acumulado</div>
                <div className="text-xs font-bold text-emerald-400 font-mono">{formatBRL(sale.client_ltv || sale.total_amount)}</div>
              </div>
            </div>
          </div>

          {/* Endereço de Entrega */}
          <div className="bg-[#141416] border border-white/10 rounded-2xl p-4 space-y-1">
            <div className="text-[10px] uppercase font-bold text-white/50 flex items-center gap-1.5">
              <MapPin className="size-3.5 text-emerald-400" />
              <span>Endereço / Destino</span>
            </div>
            <p className="text-xs text-white/90 font-medium">
              {sale.address || 'Endereço não informado'}
            </p>
          </div>

          {/* Discriminação de Itens */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Tag className="size-3.5 text-emerald-400" />
                <span>Itens do Pedido ({sale.items.length})</span>
              </h4>
              <span className="text-xs font-mono text-white/40">
                {sale.items.reduce((acc, i) => acc + (i.quantity || 1), 0)} unidades
              </span>
            </div>

            <div className="bg-[#141416] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
              {sale.items.map((item, idx) => {
                const itemTotal = (item.price || 0) * (item.quantity || 1);
                return (
                  <div key={idx} className="p-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="size-6 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-xs flex items-center justify-center font-mono shrink-0">
                        {item.quantity || 1}x
                      </span>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{item.name || 'Pod Descartável'}</span>
                          {item.puffs && (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              {item.puffs} puffs
                            </span>
                          )}
                        </div>
                        {item.flavor && (
                          <div className="text-[11px] text-white/60 mt-0.5">
                            Sabor: <span className="text-white font-medium">{item.flavor}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-white font-mono">
                        {formatBRL(itemTotal)}
                      </div>
                      {item.quantity > 1 && (
                        <div className="text-[10px] text-white/40 font-mono">
                          {formatBRL(item.price)} un
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumo Financeiro & Status */}
          <div className="bg-[#141416] border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Status de Entrega
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {sale.delivery_status}
                </span>
              </div>
              <div className="text-[11px] text-white/50">
                Pagamento: <span className="text-white font-bold">{sale.payment_status}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">Valor Total</span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono">
                {formatBRL(sale.total_amount)}
              </span>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#141416] flex items-center justify-between gap-3">
          <button
            onClick={copyOrderSummary}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border border-white/5"
          >
            <Copy className="size-4" />
            <span>Copiar Resumo</span>
          </button>

          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Fala ${sale.client_name}, tudo certo? 💨 Passando pra falar sobre seu pedido na Smoking Pods!`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <MessageSquare className="size-4" />
            <span>Chamar no WhatsApp</span>
          </a>
        </div>

      </div>
    </div>
  );
}
