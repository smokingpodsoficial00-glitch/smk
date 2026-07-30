import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'gerente' | 'atendente' | 'financeiro' | 'estoquista';

export interface Company {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  instagram?: string;
  business_hours?: string;
  delivery_fee?: number;
  delivery_radius?: number;
  pix_key?: string;
  template_type?: string;
  onboarding_done?: boolean;
  is_active?: boolean;
}

export interface CompanyUser {
  id: string;
  company_id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role: UserRole;
  is_super_admin?: boolean;
}

interface RegisterData {
  companyName: string;
  managerName: string;
  phone: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  company: Company | null;
  companyUser: CompanyUser | null;
  role: UserRole;
  isSuperAdmin: boolean;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signUp: (data: RegisterData) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyUser, setCompanyUser] = useState<CompanyUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (authUser: User) => {
    try {
      // 1. Busca os dados do usuário em company_users
      const { data: compUserData, error: compUserErr } = await supabase
        .from('company_users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .eq('is_active', true)
        .maybeSingle();

      if (compUserErr) {
        console.warn('Erro ao buscar company_user:', compUserErr);
      }

      if (compUserData) {
        setCompanyUser(compUserData as CompanyUser);

        // 2. Busca a empresa associada
        const { data: companyData, error: compErr } = await supabase
          .from('companies')
          .select('*')
          .eq('id', compUserData.company_id)
          .maybeSingle();

        if (compErr) {
          console.warn('Erro ao buscar company:', compErr);
        } else if (companyData) {
          setCompany(companyData as Company);
        }
      } else {
        // Se o usuário não tiver empresa associada ainda, vincula ou cria a empresa
        const { data: defaultComp } = await supabase.from('companies').select('*').limit(1).maybeSingle();
        if (defaultComp) {
          setCompany(defaultComp as Company);
          // Cria vinculo de company_user para este usuário
          await supabase.from('company_users').insert({
            company_id: defaultComp.id,
            auth_user_id: authUser.id,
            name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Admin',
            email: authUser.email || '',
            role: 'admin',
          });
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados do usuário:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        fetchUserData(activeUser);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser);
      } else {
        setCompany(null);
        setCompanyUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshCompany = async () => {
    if (!company?.id) return;
    const { data } = await supabase.from('companies').select('*').eq('id', company.id).single();
    if (data) setCompany(data as Company);
  };

  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (data: RegisterData) => {
    try {
      let activeAuthUser: User | null = null;

      // 1. Tenta criar a conta no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.managerName,
            company_name: data.companyName,
          }
        }
      });

      if (authError) {
        // Se a conta já existir ou houver bloqueio de rate-limit no signUp, tenta fazer o login diretamente com as credenciais informadas!
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (!loginError && loginData?.user) {
          activeAuthUser = loginData.user;
        } else {
          // Trata erros amigáveis
          if (authError.message.includes('rate limit') || authError.message.includes('solicitação após')) {
            throw new Error('Essa conta já foi cadastrada ou houve um limite de tentativas. Faça login diretamente com seu e-mail e senha.');
          }
          throw authError;
        }
      } else {
        activeAuthUser = authData?.user || null;
      }

      if (!activeAuthUser) {
        throw new Error('Não foi possível registrar o usuário no sistema.');
      }

      // 2. Verifica se a empresa já existe para este usuário
      const { data: existingCompUser } = await supabase
        .from('company_users')
        .select('*, companies(*)')
        .eq('auth_user_id', activeAuthUser.id)
        .maybeSingle();

      if (existingCompUser && existingCompUser.companies) {
        setUser(activeAuthUser);
        setCompany(existingCompUser.companies as Company);
        setCompanyUser(existingCompUser as CompanyUser);
        return { error: null };
      }

      // 3. Insere a nova Empresa se não existir
      const { data: newCompany, error: compError } = await supabase
        .from('companies')
        .insert({
          name: data.companyName,
          email: data.email,
          phone: data.phone,
          onboarding_done: false,
        })
        .select()
        .single();

      if (compError) throw compError;

      // 4. Associa o usuário à nova empresa como Admin
      const { error: userLinkError } = await supabase
        .from('company_users')
        .insert({
          company_id: newCompany.id,
          auth_user_id: activeAuthUser.id,
          name: data.managerName,
          email: data.email,
          role: 'admin',
          is_super_admin: false,
        });

      if (userLinkError && !userLinkError.message.includes('duplicate')) {
        console.warn('Aviso ao vincular usuário:', userLinkError);
      }

      // Atualiza o estado local
      setUser(activeAuthUser);
      setCompany(newCompany as Company);
      setCompanyUser({
        id: 'new',
        company_id: newCompany.id,
        auth_user_id: activeAuthUser.id,
        name: data.managerName,
        email: data.email,
        role: 'admin',
      });

      return { error: null };
    } catch (err: any) {
      console.error('Erro no registro:', err);
      let msg = err instanceof Error ? err.message : 'Erro ao cadastrar';
      if (msg.includes('rate limit') || msg.includes('solicitação após')) {
        msg = 'O e-mail informado já possui cadastro. Clique em "Fazer login" abaixo para entrar na sua conta com essa mesma senha!';
      }
      return { error: new Error(msg) };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCompany(null);
    setCompanyUser(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? new Error(error.message) : null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        companyUser,
        role: companyUser?.role || 'admin',
        isSuperAdmin: !!companyUser?.is_super_admin,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        refreshCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
