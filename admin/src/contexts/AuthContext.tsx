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
  auth_password?: string;
  manager_name?: string;
}

export interface CompanyUser {
  id: string;
  company_id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role: UserRole;
  is_super_admin?: boolean;
  auth_password?: string;
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
  completeOnboarding: (updatedData: Partial<Company>) => void;
}

const LOCAL_SESSION_KEY = 'saas_auth_session_v2';
const LOCAL_CREDS_KEY = 'saas_registered_creds_v2';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyUser, setCompanyUser] = useState<CompanyUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Auxiliar para persistir sessão local atômica
  const saveLocalSession = (usr: User, comp: Company, compUser: CompanyUser) => {
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user: usr, company: comp, companyUser: compUser }));
    } catch (e) {
      console.warn('Erro ao salvar sessão local:', e);
    }
  };

  const fetchUserData = async (authUser: User) => {
    try {
      // 1. Busca os dados do usuário em company_users
      const { data: compUserData } = await supabase
        .from('company_users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .eq('is_active', true)
        .maybeSingle();

      if (compUserData) {
        setCompanyUser(compUserData as CompanyUser);

        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', compUserData.company_id)
          .maybeSingle();

        if (companyData) {
          setCompany(companyData as Company);
          saveLocalSession(authUser, companyData as Company, compUserData as CompanyUser);
        }
      } else {
        // Tenta buscar empresa pelo e-mail
        const { data: companyByEmail } = await supabase
          .from('companies')
          .select('*')
          .eq('email', authUser.email || '')
          .maybeSingle();

        if (companyByEmail) {
          const mockUserComp: CompanyUser = {
            id: 'cuser-auto',
            company_id: companyByEmail.id,
            auth_user_id: authUser.id,
            name: authUser.user_metadata?.full_name || 'Administrador',
            email: authUser.email || '',
            role: 'admin',
          };
          setCompany(companyByEmail as Company);
          setCompanyUser(mockUserComp);
          saveLocalSession(authUser, companyByEmail as Company, mockUserComp);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados do usuário:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Tenta recuperar sessão salva no localStorage
    try {
      const savedSessionStr = localStorage.getItem(LOCAL_SESSION_KEY);
      if (savedSessionStr) {
        const saved = JSON.parse(savedSessionStr);
        if (saved?.user && saved?.company) {
          setUser(saved.user);
          setCompany(saved.company);
          setCompanyUser(saved.companyUser);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn('Erro ao ler sessão local:', e);
    }

    // 2. Sincroniza com Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      if (activeUser) {
        setUser(activeUser);
        fetchUserData(activeUser);
      } else {
        if (!localStorage.getItem(LOCAL_SESSION_KEY)) {
          setLoading(false);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshCompany = async () => {
    if (!company?.id) return;
    const { data } = await supabase.from('companies').select('*').eq('id', company.id).single();
    if (data) {
      setCompany(data as Company);
      if (user && companyUser) saveLocalSession(user, data as Company, companyUser);
    }
  };

  const completeOnboarding = (updatedData: Partial<Company>) => {
    const updatedCompany: Company = {
      ...(company || { id: `comp-${Date.now()}`, name: updatedData.name || 'Minha Loja' }),
      ...updatedData,
      onboarding_done: true,
    };

    setCompany(updatedCompany);

    const activeUser = user || ({ id: `usr-${Date.now()}`, email: updatedCompany.email || 'admin@saas.com' } as User);
    const activeCompUser = companyUser || ({ id: 'cuser-1', company_id: updatedCompany.id, auth_user_id: activeUser.id, name: 'Admin', email: activeUser.email || '', role: 'admin' } as CompanyUser);

    setUser(activeUser);
    setCompanyUser(activeCompUser);
    saveLocalSession(activeUser, updatedCompany, activeCompUser);
  };

  // LOGIN (Funciona em QUALQUER DISPOSITIVO / NAVEGADOR)
  // LOGIN (Real Supabase Auth + Supabase DB)
  const signIn = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Autenticação nativa no Supabase Auth Cloud
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (authError || !authData?.user) {
      return { 
        error: new Error(
          authError?.message?.includes('Invalid login credentials')
            ? 'E-mail ou senha incorretos.'
            : authError?.message || 'Erro ao realizar login.'
        ) 
      };
    }

    setUser(authData.user);
    await fetchUserData(authData.user);
    return { error: null };
  };

  // CADASTRO MULTI-TENANT (Registra REAL no Supabase Auth e no Supabase DB)
  const signUp = async (data: RegisterData) => {
    const cleanEmail = data.email.trim().toLowerCase();

    try {
      // 1. Cadastra no Supabase Auth Cloud
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            full_name: data.managerName,
            company_name: data.companyName,
          }
        }
      });

      if (authError || !authData?.user) {
        return { error: new Error(authError?.message || 'Erro ao criar conta no Supabase Auth.') };
      }

      const activeAuthUser = authData.user;

      // 2. Insere a nova empresa na tabela `companies` do Supabase DB
      const { data: newComp, error: compErr } = await supabase
        .from('companies')
        .insert({
          name: data.companyName,
          email: cleanEmail,
          phone: data.phone,
          onboarding_done: false,
        })
        .select()
        .single();

      let finalCompany: Company | null = (newComp as Company) || null;

      if (!finalCompany) {
        const { data: existingComp } = await supabase
          .from('companies')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (existingComp) finalCompany = existingComp as Company;
      }

      if (!finalCompany) {
        return { error: new Error('Não foi possível criar a empresa no banco de dados.') };
      }

      // 3. Vincula o usuário à empresa na tabela `company_users` do Supabase DB
      const { data: compUser, error: compUserErr } = await supabase
        .from('company_users')
        .insert({
          company_id: finalCompany.id,
          auth_user_id: activeAuthUser.id,
          name: data.managerName,
          email: cleanEmail,
          role: 'admin',
        })
        .select()
        .single();

      const finalCompUser: CompanyUser = (compUser as CompanyUser) || {
        id: `cuser-${Date.now()}`,
        company_id: finalCompany.id,
        auth_user_id: activeAuthUser.id,
        name: data.managerName,
        email: cleanEmail,
        role: 'admin',
      };

      setUser(activeAuthUser);
      setCompany(finalCompany);
      setCompanyUser(finalCompUser);
      saveLocalSession(activeAuthUser, finalCompany, finalCompUser);

      return { error: null };
    } catch (err: any) {
      console.error('Erro no signUp:', err);
      return { error: new Error(err.message || 'Erro ao cadastrar empresa.') };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    localStorage.removeItem(LOCAL_SESSION_KEY);
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
        completeOnboarding,
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
