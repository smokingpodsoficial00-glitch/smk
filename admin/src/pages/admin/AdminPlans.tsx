import React from 'react';
import { CreditCard, Check, Sparkles } from 'lucide-react';

export function AdminPlans() {
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 'R$ 149',
      period: '/mês',
      features: ['Até 1.000 pedidos/mês', '1 Usuário Atendente', 'Atendente Virtual IA Basico', 'Suporte por Email'],
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro Multi-Vendas',
      price: 'R$ 299',
      period: '/mês',
      features: ['Pedidos ilimitados', 'Até 5 Usuários', 'Atendente Virtual IA Completa (Eloísa)', 'Frete dinâmico Uber Direct', 'Suporte Prioritário WhatsApp'],
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'R$ 599',
      period: '/mês',
      features: ['Multi-Empresas ilimitadas', 'Usuários ilimitados', 'Templates de Negócio Personalizados', 'Gerente de Conta Dedicado', 'SLA 99.9% garantido'],
      popular: false,
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="size-6 text-purple-400" />
            <span>Planos e Assinaturas</span>
          </h1>
          <p className="text-xs text-white/50 mt-1">Configuração de planos e precificação do SaaS</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`bg-[#0c0914] border p-6 rounded-3xl flex flex-col justify-between relative transition-all ${
              p.popular
                ? 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.2)]'
                : 'border-purple-500/20 hover:border-purple-500/40'
            }`}
          >
            {p.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-purple-500 text-black text-[10px] font-extrabold uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                <Sparkles className="size-3" /> Mais Popular
              </div>
            )}

            <div>
              <h3 className="font-bold text-lg text-white">{p.name}</h3>
              <div className="flex items-baseline gap-1 my-4">
                <span className="text-3xl font-extrabold text-white font-mono">{p.price}</span>
                <span className="text-xs text-white/40">{p.period}</span>
              </div>

              <ul className="space-y-2.5 my-6">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-white/70">
                    <Check className="size-4 text-purple-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer">
              Editar Configurações do Plano
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
