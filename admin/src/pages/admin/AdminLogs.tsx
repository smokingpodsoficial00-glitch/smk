import React from 'react';
import { Activity, Terminal, ShieldAlert } from 'lucide-react';

export function AdminLogs() {
  const sampleLogs = [
    { time: '15:32:10', type: 'AUTH', text: 'Novo usuário admin cadastrado para empresa Vape King' },
    { time: '15:20:45', type: 'SYSTEM', text: 'Migração RLS 001_saas_foundation executada com sucesso' },
    { time: '14:55:02', type: 'TENANT', text: 'Empresa Smoking Pods Matrix atualizou configurações de entrega' },
    { time: '14:10:18', type: 'AUTH', text: 'Login efetuado por admin@smokingpods.com' },
  ];

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="size-6 text-purple-400" />
            <span>Logs & Auditoria do Sistema</span>
          </h1>
          <p className="text-xs text-white/50 mt-1">Histórico de eventos, autenticação e alterações na plataforma</p>
        </div>
      </div>

      <div className="bg-[#0c0914] border border-purple-500/20 rounded-2xl p-6 font-mono text-xs space-y-3">
        <div className="flex items-center gap-2 text-purple-400 border-b border-purple-500/20 pb-3 font-bold">
          <Terminal className="size-4" />
          <span>System Audit Trail</span>
        </div>

        {sampleLogs.map((log, i) => (
          <div key={i} className="flex items-start gap-4 py-2 border-b border-white/5 text-white/80">
            <span className="text-white/30 shrink-0">{log.time}</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold text-[10px]">
              [{log.type}]
            </span>
            <span className="flex-1">{log.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
