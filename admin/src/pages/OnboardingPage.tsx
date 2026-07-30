import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Clock, 
  Truck, 
  QrCode, 
  Upload, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Loader2,
  Sparkles
} from 'lucide-react';

export function OnboardingPage() {
  const { company, refreshCompany } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [companyName, setCompanyName] = useState(company?.name || '');
  const [logoUrl, setLogoUrl] = useState(company?.logo_url || '');
  const [address, setAddress] = useState(company?.address || '');
  const [originCep, setOriginCep] = useState('');
  const [phone, setPhone] = useState(company?.phone || '');
  const [instagram, setInstagram] = useState(company?.instagram || '');
  const [businessHours, setBusinessHours] = useState('11:00 às 23:00 (Segunda a Sábado)');
  
  // Delivery State
  const [deliveryFee, setDeliveryFee] = useState(8.50);
  const [deliveryRadius, setDeliveryRadius] = useState(10);
  const [includedKm, setIncludedKm] = useState(3.0);
  const [extraKmFee, setExtraKmFee] = useState(1.40);

  // Payment State
  const [pixKey, setPixKey] = useState(company?.pix_key || '');

  const totalSteps = 6;

  const handleNext = () => {
    if (step < totalSteps) setStep(prev => prev + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(prev => prev - 1);
  };

  const handleFinish = async () => {
    if (!company?.id) return;
    setLoading(true);

    try {
      // 1. Atualiza a tabela Companies
      const { error: compErr } = await supabase
        .from('companies')
        .update({
          name: companyName,
          address,
          phone,
          instagram,
          business_hours: businessHours,
          delivery_fee: deliveryFee,
          delivery_radius: deliveryRadius,
          pix_key: pixKey,
          logo_url: logoUrl,
          onboarding_done: true,
        })
        .eq('id', company.id);

      if (compErr) console.warn('Erro ao atualizar empresa:', compErr);

      // 2. Insere ou atualiza o store_config
      const { data: existingConfig } = await supabase
        .from('store_config')
        .select('id')
        .eq('company_id', company.id)
        .maybeSingle();

      if (existingConfig) {
        await supabase
          .from('store_config')
          .update({
            store_name: companyName,
            whatsapp_number: phone,
            pix_key: pixKey,
            address,
            instagram_url: instagram,
            logo_url: logoUrl,
            base_fare: deliveryFee,
            included_km: includedKm,
            extra_km_fee: extraKmFee,
            origin_cep: originCep,
          })
          .eq('company_id', company.id);
      } else {
        await supabase.from('store_config').insert({
          company_id: company.id,
          store_name: companyName,
          whatsapp_number: phone,
          pix_key: pixKey,
          address,
          instagram_url: instagram,
          logo_url: logoUrl,
          base_fare: deliveryFee,
          included_km: includedKm,
          extra_km_fee: extraKmFee,
          origin_cep: originCep,
        });
      }

      await refreshCompany();
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Erro ao salvar onboarding:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-2xl bg-[#0b0b0b] border border-[#1f1f1f] rounded-3xl p-8 shadow-2xl relative z-10 backdrop-blur-xl">
        
        {/* Onboarding Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#1a1a1a]">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-1">
              <Sparkles className="size-3.5" />
              Configuração Inicial da Empresa
            </div>
            <h1 className="text-xl font-bold text-white">Assistente de Onboarding</h1>
          </div>
          <div className="text-xs font-mono text-white/40 bg-[#141414] border border-[#222] px-3 py-1.5 rounded-xl font-semibold">
            Passo {step} de {totalSteps}
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="w-full bg-[#141414] h-1.5 rounded-full overflow-hidden mb-8">
          <div 
            className="bg-emerald-500 h-full transition-all duration-500 ease-out" 
            style={{ width: `${(step / totalSteps) * 100}%` }} 
          />
        </div>

        {/* Step Contents */}
        <div className="min-h-[300px] flex flex-col justify-between">
          
          {/* STEP 1: Identidade da Empresa */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Identidade da Empresa</h2>
                  <p className="text-xs text-white/40">Defina o nome da sua marca e sua logo oficial</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Nome Comercial</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Smoking Pods Express"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">URL da Logo (ou Upload)</label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://exemplo.com/logo.png"
                    className="flex-1 bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none"
                  />
                  <div className="size-11 rounded-xl bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="size-8 object-contain rounded" />
                    ) : (
                      <Upload className="size-4 text-white/30" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Localização */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Endereço da Operação</h2>
                  <p className="text-xs text-white/40">Endereço de partida dos entregadores para cálculo de frete</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Endereço Completo</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, Número, Bairro - Cidade, Estado"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">CEP de Origem</label>
                <input
                  type="text"
                  value={originCep}
                  onChange={(e) => setOriginCep(e.target.value)}
                  placeholder="00000-000"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Canais de Atendimento */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Phone className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Canais de Atendimento</h2>
                  <p className="text-xs text-white/40">Dados para o bot de IA e botões de contato</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">WhatsApp Oficial da Loja</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Instagram (@usuario)</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@minhalojaoficial"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Horário de Funcionamento */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Clock className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Horário de Funcionamento</h2>
                  <p className="text-xs text-white/40">A IA avisará os clientes se estiver fora do horário de atendimento</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Horário Padrão</label>
                <input
                  type="text"
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  placeholder="Ex: 11:00 às 23:00 (Segunda a Sábado)"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* STEP 5: Regras de Entrega */}
          {step === 5 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Truck className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Taxa e Raio de Entrega</h2>
                  <p className="text-xs text-white/40">Parâmetros para cálculo automático de frete no WhatsApp</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Taxa Base (R$)</label>
                  <input
                    type="number"
                    step="0.50"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">KM Incluso na Base</label>
                  <input
                    type="number"
                    step="0.5"
                    value={includedKm}
                    onChange={(e) => setIncludedKm(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Valor KM Excedente (R$)</label>
                  <input
                    type="number"
                    step="0.10"
                    value={extraKmFee}
                    onChange={(e) => setExtraKmFee(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Raio Máximo (KM)</label>
                  <input
                    type="number"
                    value={deliveryRadius}
                    onChange={(e) => setDeliveryRadius(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Dados de Pagamento PIX */}
          {step === 6 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <QrCode className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Chave PIX da Empresa</h2>
                  <p className="text-xs text-white/40">Chave PIX que a atendente virtual enviará aos clientes</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Chave PIX (CNPJ / Telefone / E-mail)</label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Ex: 00.000.000/0001-00 ou contato@loja.com"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-emerald-500/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono"
                />
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 flex items-start gap-3">
                <Check className="size-5 shrink-0 text-emerald-400 mt-0.5" />
                <p>Tudo pronto! Sua empresa está configurada com suporte a múltiplos atendentes e isolamento completo de dados.</p>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-[#1a1a1a] mt-6">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] text-white/70 hover:text-white text-xs font-bold transition-all flex items-center gap-2"
              >
                <ArrowLeft className="size-4" />
                Anterior
              </button>
            ) : <div />}

            {step < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                <span>Próximo Passo</span>
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleFinish}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Concluindo...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    <span>Finalizar e Ir ao Painel</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
