import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Building2, 
  Phone, 
  ArrowRight, 
  Loader2,
  Sparkles,
  Zap,
  Globe,
  LayoutGrid,
  TrendingUp,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export function OnboardingPage() {
  const { company, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  // Form State Inicial (puxa o que foi preenchido no /cadastro)
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

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const cleanName = companyName.trim() || company?.name || 'Minha Empresa';
    const cleanPhone = phone.trim() || company?.phone || '';

    const onboardingData = {
      name: cleanName,
      phone: cleanPhone,
      onboarding_done: true,
    };

    // 1. Atualiza a sessão e estado de onboarding no AuthContext sincronizadamente
    completeOnboarding(onboardingData);

    // 2. Atualiza o cache local do store_config (para useStoreConfig e SettingsPage)
    const storeConfigObj = {
      store_name: cleanName,
      whatsapp_number: cleanPhone,
    };
    try {
      localStorage.setItem('store_config_fallback_v4', JSON.stringify(storeConfigObj));
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

        const generatedSlug = cleanName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "");

        if (existingConfig) {
          await supabase.from('store_config').update({
            company_id: company.id,
            store_name: cleanName,
            store_slug: generatedSlug,
            whatsapp_number: cleanPhone,
          }).eq('company_id', company.id);
        } else {
          await supabase.from('store_config').insert({
            company_id: company.id,
            store_name: cleanName,
            store_slug: generatedSlug,
            whatsapp_number: cleanPhone,
          });
        }
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar ativação com Supabase:', err);
    } finally {
      setLoading(false);
      // Redireciona direto para as Configurações para liberar/gerar o catálogo imediatamente
      navigate('/configuracoes', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden font-sans selection:bg-white/20 selection:text-white">
      
      {/* Background ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white/10 blur-[180px] rounded-full pointer-events-none" />

      <div className="w-full max-w-xl bg-[#0b0b0b] border border-[#1f1f1f] rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 backdrop-blur-xl">
        
        {/* Welcome Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-16 rounded-3xl bg-white/10 border border-white/25 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
            <Sparkles className="size-8 text-white animate-pulse" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-3">
            <CheckCircle2 className="size-3.5" />
            <span>Cadastro Concluído com Sucesso!</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Bem-vindo ao Sistema
          </h1>
          <p className="text-xs sm:text-sm text-white/50 mt-1.5 max-w-md">
            Sua conta está ativa e seu ambiente isolado já foi configurado na nuvem.
          </p>
        </div>

        <form onSubmit={handleFinish} className="space-y-6">
          
          {/* Confirmação Rápida de Identidade */}
          <div className="space-y-4 bg-[#101010] border border-[#202020] rounded-2xl p-5">
            <div className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
              <Zap className="size-3.5 text-white" />
              <span>Confirmar Identidade da sua Loja</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Nome Comercial da Loja</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Vape Lounge SBC"
                  className="w-full bg-[#161616] border border-[#2c2c2c] focus:border-white/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none transition-all font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">WhatsApp de Atendimento</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-[#161616] border border-[#2c2c2c] focus:border-white/60 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none transition-all font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Cards de Recursos Ativos */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3 text-center">
              <Globe className="size-4 text-white mx-auto mb-1.5 opacity-80" />
              <div className="text-[11px] font-bold text-white">Catálogo Próprio</div>
              <div className="text-[10px] text-white/40">Tabela de Valores</div>
            </div>

            <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3 text-center">
              <LayoutGrid className="size-4 text-white mx-auto mb-1.5 opacity-80" />
              <div className="text-[11px] font-bold text-white">Kanban Pedidos</div>
              <div className="text-[10px] text-white/40">Tempo Real</div>
            </div>

            <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3 text-center">
              <TrendingUp className="size-4 text-white mx-auto mb-1.5 opacity-80" />
              <div className="text-[11px] font-bold text-white">DRE & Sócios</div>
              <div className="text-[10px] text-white/40">Controle Total</div>
            </div>
          </div>

          {/* Botão de Ativação e Entrada */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-slate-100 disabled:opacity-50 text-black font-extrabold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:shadow-[0_0_35px_rgba(255,255,255,0.5)] active:scale-[0.99] text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin text-black" />
                <span>Ativando ambiente...</span>
              </>
            ) : (
              <>
                <span>Ativar meu Sistema e Ir ao Painel</span>
                <ArrowRight className="size-4 text-black" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-white/40 flex items-center justify-center gap-2">
          <ShieldCheck className="size-3.5 text-white/60" />
          <span>Isolamento total de banco de dados e dados protegidos</span>
        </div>

      </div>
    </div>
  );
}
