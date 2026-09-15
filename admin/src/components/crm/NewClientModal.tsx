import React, { useState } from 'react';
import { X, UserPlus, Phone, MapPin, User, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: () => void;
}

export function NewClientModal({ isOpen, onClose, onClientCreated }: NewClientModalProps) {
  const { company } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedName = name.trim();
    const cleanDigits = phone.replace(/\D/g, '');

    if (!trimmedName) {
      setErrorMsg('Por favor, informe o nome do cliente.');
      return;
    }

    if (cleanDigits.length < 10 || cleanDigits.length > 13) {
      setErrorMsg('Por favor, informe um telefone válido com DDD (10 ou 11 dígitos).');
      return;
    }

    // Normalizar telefone com DDI 55
    const normalizedPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;
    const effectiveCompanyId = company?.id || 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';

    setLoading(true);
    try {
      // 1. Verificar se já existe cliente cadastrado com esse telefone
      const { data: existing, error: checkErr } = await supabase
        .from('smoking_clients')
        .select('id, name')
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (checkErr) {
        console.warn('Aviso ao checar duplicidade:', checkErr.message);
      }

      if (existing) {
        setErrorMsg(`Já existe um cliente cadastrado com este telefone: "${existing.name}". Edite o perfil dele no CRM em vez de cadastrar novamente.`);
        setLoading(false);
        return;
      }

      // 2. Inserir em smoking_clients
      const clientPayload: any = {
        company_id: effectiveCompanyId,
        name: trimmedName,
        phone: normalizedPhone,
        address: address.trim() || 'Atendimento Balcão / WhatsApp',
        prospecting_status: 'base_antiga',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insErr } = await supabase
        .from('smoking_clients')
        .insert(clientPayload);

      if (insErr) {
        throw new Error(insErr.message);
      }

      setSuccessMsg(`✅ Cliente "${trimmedName}" cadastrado com sucesso!`);
      setTimeout(() => {
        onClientCreated();
        onClose();
      }, 1000);

    } catch (err: any) {
      console.error('Erro ao cadastrar cliente:', err);
      setErrorMsg(err.message || 'Erro inesperado ao salvar cliente no Supabase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#0e0e10] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#141416]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <UserPlus className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Novo Cliente Oficial</h2>
              <p className="text-[11px] text-muted-foreground">Cadastre um cliente direto no CRM mestre</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
              <User className="size-3 text-emerald-400" />
              Nome Completo *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Carlos Eduardo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#161619] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {/* Telefone / WhatsApp */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="size-3 text-emerald-400" />
              Telefone / WhatsApp *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: (11) 98888-7777"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-[#161619] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 font-mono transition-colors"
            />
            <p className="text-[10px] text-muted-foreground">O telefone é a chave de identificação do cliente no sistema.</p>
          </div>

          {/* Endereço (opcional) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="size-3 text-emerald-400" />
              Endereço de Entrega (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Av. Prestes Maia, 100 - SBC"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-[#161619] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 resize-none transition-colors"
            />
          </div>

          {/* Ações */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)] cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" />
                  <span>Cadastrar Cliente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
