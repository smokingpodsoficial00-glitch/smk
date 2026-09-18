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
  Sparkles,
  Search
} from 'lucide-react';

export function OnboardingPage() {
  const { company, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [companyName, setCompanyName] = useState(() => {
    if (company?.name && company.name !== 'Minha Empresa') return company.name;
    try {
      const savedCredsStr = localStorage.getItem('saas_registered_creds_v2');
      if (savedCredsStr) {
        const parsed = JSON.parse(savedCredsStr);
        if (parsed.companyName) return parsed.companyName;
      }
    } catch (e) {}
    return company?.name || '';
  });
  const [logoUrl, setLogoUrl] = useState(company?.logo_url || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState(company?.address || '');
  const [originCep, setOriginCep] = useState('');
  const [phone, setPhone] = useState(() => {
    if (company?.phone) return company.phone;
    try {
      const savedCredsStr = localStorage.getItem('saas_registered_creds_v2');
      if (savedCredsStr) {
        const parsed = JSON.parse(savedCredsStr);
        if (parsed.phone) return parsed.phone;
      }
    } catch (e) {}
    return '';
  });
  const [instagram, setInstagram] = useState(company?.instagram || '');
  const [businessHours, setBusinessHours] = useState('11:00 às 23:00 (Segunda a Sábado)');
  
  // Delivery State
  const [deliveryFee, setDeliveryFee] = useState(8.50);
  const [deliveryRadius, setDeliveryRadius] = useState(10);
  const [includedKm, setIncludedKm] = useState(3.0);
  const [extraKmFee, setExtraKmFee] = useState(1.40);

  // Payment State
  const [pixKey, setPixKey] = useState(company?.pix_key || '');

  // Autocomplete & CEP State
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepSuccessMsg, setCepSuccessMsg] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; postcode?: string }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const totalSteps = 6;

  // Busca CEP via ViaCEP / AwesomeAPI
  const fetchAddressByCep = async (cepInput: string) => {
    const clean = cepInput.replace(/\D/g, '');
    if (clean.length !== 8) return;

    setLoadingCep(true);
    setCepSuccessMsg(null);

    try {
      // 1. Tenta ViaCEP
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro && data.logradouro) {
          const formatted = `${data.logradouro}, ${data.bairro} - ${data.localidade}, ${data.uf}`;
          setAddress(formatted);
          setCepSuccessMsg(`Endereço localizado: ${data.logradouro}, ${data.bairro}`);
          setLoadingCep(false);
          return;
        }
      }

      // 2. Fallback AwesomeAPI
      const res2 = await fetch(`https://cep.awesomeapi.com.br/json/${clean}`);
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.address) {
          const formatted = `${data2.address}, ${data2.district} - ${data2.city}, ${data2.state}`;
          setAddress(formatted);
          setCepSuccessMsg(`Endereço localizado: ${data2.address}`);
          setLoadingCep(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar CEP:', e);
    } finally {
      setLoadingCep(false);
    }
  };

  // Autocomplete de Endereço via Nominatim (OSM)
  const fetchAddressSuggestions = async (query: string) => {
    if (query.trim().length < 4) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=5&addressdetails=1`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((item: any) => ({
            display_name: item.display_name,
            postcode: item.address?.postcode || '',
          }));
          setAddressSuggestions(mapped);
          setShowSuggestions(true);
        } else {
          setAddressSuggestions([]);
          setShowSuggestions(false);
        }
      }
    } catch (e) {
      console.warn('Erro na busca de sugestões:', e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddress(val);
    setCepSuccessMsg(null);

    if (val.length >= 4) {
      fetchAddressSuggestions(val);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (sugg: { display_name: string; postcode?: string }) => {
    setAddress(sugg.display_name);
    if (sugg.postcode) {
      setOriginCep(sugg.postcode);
    }
    setShowSuggestions(false);
    setCepSuccessMsg('Endereço selecionado!');
  };

  const handleNext = () => {
    if (step < totalSteps) setStep(prev => prev + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(prev => prev - 1);
  };

  const handleFinish = async () => {
    setLoading(true);

    const onboardingData = {
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
    };

    // 1. Atualiza a sessão e estado de onboarding no AuthContext sincronizadamente
    completeOnboarding(onboardingData);

    // 2. Atualiza o cache local do store_config (para useStoreConfig, header e SettingsPage)
    const storeConfigObj = {
      store_name: companyName,
      whatsapp_number: phone,
      pix_key: pixKey,
      address: address,
      instagram_url: instagram,
      logo_url: logoUrl,
      base_fare: deliveryFee,
      included_km: includedKm,
      extra_km_fee: extraKmFee,
      origin_cep: originCep,
    };
    localStorage.setItem('store_config_fallback_v4', JSON.stringify(storeConfigObj));

    try {
      const bc = new BroadcastChannel('store_config_channel_v4');
      bc.postMessage(storeConfigObj);
      bc.close();
    } catch (e) {}

    // 3. Salva no banco de dados do Supabase
    try {
      if (company?.id) {
        await supabase.from('companies').update(onboardingData).eq('id', company.id);

        const { data: existingConfig } = await supabase
          .from('store_config')
          .select('id')
          .eq('company_id', company.id)
          .maybeSingle();

        if (existingConfig) {
          await supabase.from('store_config').update({
            company_id: company.id,
            ...storeConfigObj
          }).eq('company_id', company.id);
        } else {
          await supabase.from('store_config').insert({
            company_id: company.id,
            ...storeConfigObj
          });
        }
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar onboarding com Supabase:', err);
    } finally {
      setLoading(false);
      navigate('/pedidos', { replace: true });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `logo_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('store-assets').upload(`logo/${fileName}`, file, { upsert: true });
      if (!upErr) {
        const { data } = supabase.storage.from('store-assets').getPublicUrl(`logo/${fileName}`);
        if (data?.publicUrl) {
          setLogoUrl(data.publicUrl);
          setUploadingLogo(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Storage upload falhou, fallback base64:', err);
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoUrl(ev.target?.result as string);
      setUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden selection:bg-white/20 selection:text-white">
      {/* Glow Effects */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white/10 blur-[180px] rounded-full pointer-events-none" />

      <div className="w-full max-w-2xl bg-[#0b0b0b] border border-[#1f1f1f] rounded-3xl p-8 shadow-2xl relative z-10 backdrop-blur-xl">
        
        {/* Onboarding Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#1a1a1a]">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest mb-1">
              <Sparkles className="size-3.5 text-white" />
              Configuração Inicial da Empresa
            </div>
            <h1 className="text-xl font-bold text-white">Assistente de Onboarding</h1>
          </div>
          <div className="text-xs font-mono text-white/50 bg-[#141414] border border-[#222] px-3 py-1.5 rounded-xl font-semibold">
            Passo {step} de {totalSteps}
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="w-full bg-[#141414] h-1.5 rounded-full overflow-hidden mb-8">
          <div 
            className="bg-white h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
            style={{ width: `${(step / totalSteps) * 100}%` }} 
          />
        </div>

        {/* Step Contents */}
        <div className="min-h-[300px] flex flex-col justify-between">
          
          {/* STEP 1: Identidade da Empresa */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Identidade da Empresa</h2>
                  <p className="text-xs text-white/50">Defina o nome da sua marca e sua logo oficial</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">Nome Comercial</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Vape King Lounge"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">URL da Logo (ou Upload)</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex gap-3 items-center">
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://exemplo.com/logo.png ou clique em Upload"
                    className="flex-1 bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="h-11 px-3.5 rounded-xl bg-[#141414] hover:bg-white/10 border border-[#262626] hover:border-white/40 flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer text-xs font-semibold text-white/80 hover:text-white"
                    title="Escolher imagem do computador"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="size-4 animate-spin text-white" />
                    ) : logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="size-6 object-contain rounded" />
                    ) : (
                      <>
                        <Upload className="size-4 text-white/60" />
                        <span className="hidden sm:inline">Upload</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Localização com Busca por CEP & Autocomplete em Tempo Real */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Endereço da Operação</h2>
                  <p className="text-xs text-white/50">Digite o CEP para buscar automaticamente ou escreva o nome da rua</p>
                </div>
              </div>

              {/* CEP Input com Auto-Busca */}
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                  <span>CEP de Origem (Busca automática)</span>
                  {loadingCep && (
                    <span className="text-[11px] text-white flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin text-white" /> Buscando CEP...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={originCep}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOriginCep(val);
                      if (val.replace(/\D/g, '').length === 8) {
                        fetchAddressByCep(val);
                      }
                    }}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono tracking-wider"
                  />
                  {originCep.replace(/\D/g, '').length === 8 && !loadingCep && (
                    <button
                      type="button"
                      onClick={() => fetchAddressByCep(originCep)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 border border-white/20 text-xs px-3 py-1.5 rounded-lg text-white font-semibold transition-colors flex items-center gap-1"
                    >
                      <Search className="size-3" />
                      <span>Buscar CEP</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Success Badge */}
              {cepSuccessMsg && (
                <div className="p-3 bg-white/10 border border-white/20 rounded-xl text-xs font-semibold text-white flex items-center gap-2 animate-fadeIn">
                  <Check className="size-4 text-white shrink-0" />
                  <span>{cepSuccessMsg}</span>
                </div>
              )}

              {/* Endereço Completo com Live Autocomplete Dropdown */}
              <div className="relative">
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                  <span>Endereço Completo</span>
                  {loadingSuggestions && (
                    <span className="text-[11px] text-white/50 flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" /> Buscando sugestões...
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={handleAddressChange}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="Escreva a rua ou número para ver sugestões..."
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-medium"
                />

                {/* Floating Autocomplete Dropdown */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-[#1e1e1e]">
                    {addressSuggestions.map((sugg, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSuggestion(sugg)}
                        className="p-3 hover:bg-[#1a1a1a] cursor-pointer transition-colors text-xs text-white flex items-start gap-2.5"
                      >
                        <MapPin className="size-4 text-white/60 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-white">{sugg.display_name}</div>
                          {sugg.postcode && (
                            <div className="text-[11px] text-white/40 font-mono mt-0.5">CEP: {sugg.postcode}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Canais de Atendimento */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                  <Phone className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Canais de Atendimento</h2>
                  <p className="text-xs text-white/50">Dados para o bot de IA e botões de contato</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">WhatsApp Oficial da Loja</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">Instagram (@usuario)</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@minhalojaoficial"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-medium"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Horário de Funcionamento */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                  <Clock className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Horário de Funcionamento</h2>
                  <p className="text-xs text-white/50">A IA avisará os clientes se estiver fora do horário de atendimento</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">Horário Padrão</label>
                <input
                  type="text"
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  placeholder="Ex: 11:00 às 23:00 (Segunda a Sábado)"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-medium"
                />
              </div>
            </div>
          )}

          {/* STEP 5: Regras de Entrega */}
          {step === 5 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                  <Truck className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Taxa e Raio de Entrega</h2>
                  <p className="text-xs text-white/50">Parâmetros para cálculo automático de frete no WhatsApp</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">Taxa Base (R$)</label>
                  <input
                    type="number"
                    step="0.50"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">KM Incluso na Base</label>
                  <input
                    type="number"
                    step="0.5"
                    value={includedKm}
                    onChange={(e) => setIncludedKm(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">Valor KM Excedente (R$)</label>
                  <input
                    type="number"
                    step="0.10"
                    value={extraKmFee}
                    onChange={(e) => setExtraKmFee(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">Raio Máximo (KM)</label>
                  <input
                    type="number"
                    value={deliveryRadius}
                    onChange={(e) => setDeliveryRadius(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Dados de Pagamento PIX */}
          {step === 6 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                  <QrCode className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Chave PIX da Empresa</h2>
                  <p className="text-xs text-white/50">Chave PIX que a atendente virtual enviará aos clientes</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">Chave PIX (CNPJ / Telefone / E-mail)</label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Ex: 00.000.000/0001-00 ou contato@loja.com"
                  className="w-full bg-[#141414] border border-[#262626] focus:border-white/60 rounded-xl py-3 px-4 text-sm text-white focus:outline-none font-mono"
                />
              </div>

              <div className="p-4 bg-white/10 border border-white/20 rounded-2xl text-xs text-white flex items-start gap-3">
                <Check className="size-5 shrink-0 text-white mt-0.5" />
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
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-black text-xs font-extrabold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
              >
                <span>Próximo Passo</span>
                <ArrowRight className="size-4 text-black" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleFinish}
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-black text-xs font-extrabold transition-all flex items-center gap-2 shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:shadow-[0_0_35px_rgba(255,255,255,0.5)] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-black" />
                    <span>Concluindo...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-4 text-black" />
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
