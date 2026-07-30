import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Company } from '../../contexts/AuthContext';
import { Building2, Search, CheckCircle2, XCircle, Calendar, Phone, Mail } from 'lucide-react';

export function AdminCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
      if (data) setCompanies(data as Company[]);
    } catch (err) {
      console.error('Erro ao carregar empresas:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = companies.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="size-6 text-purple-400" />
            <span>Gestão de Empresas</span>
          </h1>
          <p className="text-xs text-white/50 mt-1">Lista completa de tenants cadastrados no SaaS</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome da empresa ou e-mail..."
          className="w-full bg-[#0c0914] border border-purple-500/20 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/60"
        />
      </div>

      {/* Table */}
      <div className="bg-[#0c0914] border border-purple-500/20 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-purple-950/30 text-white/40 uppercase tracking-wider font-mono border-b border-purple-500/20">
            <tr>
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">Contato</th>
              <th className="px-6 py-4">Template</th>
              <th className="px-6 py-4">Onboarding</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-500/10 text-white/80">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-purple-500/5 transition-colors">
                <td className="px-6 py-4 font-bold text-white flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 font-bold shrink-0">
                    {c.logo_url ? <img src={c.logo_url} alt="" className="size-6 object-contain" /> : c.name.charAt(0)}
                  </div>
                  <div>
                    <div>{c.name}</div>
                    <div className="text-[10px] text-white/40 font-mono font-normal">ID: {c.id.slice(0, 8)}...</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1 text-[11px]">
                    {c.email && (
                      <span className="flex items-center gap-1.5 text-white/70">
                        <Mail className="size-3 text-purple-400" /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1.5 text-white/50">
                        <Phone className="size-3 text-purple-400" /> {c.phone}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 font-mono uppercase text-purple-300 font-semibold">
                  {c.template_type || 'pods'}
                </td>
                <td className="px-6 py-4">
                  {c.onboarding_done ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                      <CheckCircle2 className="size-3" /> Concluído
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                      Pendente
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-bold border border-purple-500/20">
                    Ativa
                  </span>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-white/30 font-medium">
                  {loading ? 'Carregando empresas...' : 'Nenhuma empresa encontrada.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
