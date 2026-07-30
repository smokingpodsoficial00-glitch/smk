import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Shield, Mail, CheckCircle2 } from 'lucide-react';

export function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data } = await supabase.from('company_users').select('*, companies(name)');
        if (data) setUsers(data);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="size-6 text-purple-400" />
            <span>Gestão de Usuários Globais</span>
          </h1>
          <p className="text-xs text-white/50 mt-1">Todos os administradores e colaboradores cadastrados nas empresas</p>
        </div>
      </div>

      <div className="bg-[#0c0914] border border-purple-500/20 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-purple-950/30 text-white/40 uppercase tracking-wider font-mono border-b border-purple-500/20">
            <tr>
              <th className="px-6 py-4">Usuário</th>
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">Cargo / Role</th>
              <th className="px-6 py-4">Super Admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-500/10 text-white/80">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-purple-500/5 transition-colors">
                <td className="px-6 py-4 font-bold text-white">
                  <div>{u.name}</div>
                  <div className="text-[11px] text-white/40 font-normal flex items-center gap-1 mt-0.5">
                    <Mail className="size-3 text-purple-400" /> {u.email}
                  </div>
                </td>
                <td className="px-6 py-4 text-purple-300 font-semibold">
                  {u.companies?.name || 'N/A'}
                </td>
                <td className="px-6 py-4 font-mono uppercase text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {u.is_super_admin ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500 text-black font-extrabold text-[10px]">
                      <Shield className="size-3" /> SUPER ADMIN
                    </span>
                  ) : (
                    <span className="text-white/30 text-[11px]">Normal</span>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-white/30">
                  {loading ? 'Carregando usuários...' : 'Nenhum usuário encontrado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
