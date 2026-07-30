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
        // Se for um usuário legado ou sem registro em company_users, tenta pegar empresa padrão
        const { data: defaultComp } = await supabase.from('companies').select('*').limit(1).maybeSingle();
        if (defaultComp) {
          setCompany(defaultComp as Company);
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
      // 1. Cria a conta no Supabase Auth
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

      if (authError) throw authError;
      if (!authData.user) throw new Error('Não foi possível criar a conta do usuário.');

      // 2. Insere a nova Empresa
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

      // 3. Associa o usuário à nova empresa como Admin
      const { error: userLinkError } = await supabase
        .from('company_users')
        .insert({
          company_id: newCompany.id,
          auth_user_id: authData.user.id,
          name: data.managerName,
          email: data.email,
          role: 'admin',
          is_super_admin: false,
        });

      if (userLinkError) throw userLinkError;

      // Atualiza o estado local imediatamente
      setUser(authData.user);
      setCompany(newCompany as Company);
      setCompanyUser({
        id: 'new',
        company_id: newCompany.id,
        auth_user_id: authData.user.id,
        name: data.managerName,
        email: data.email,
        role: 'admin',
      });

      return { error: null };
    } catch (err: any) {
      console.error('Erro no registro:', err);
      return { error: err instanceof Error ? err : new Error(err?.message || 'Erro no cadastro') };
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
