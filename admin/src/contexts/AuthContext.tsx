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
  const signIn = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Tenta autenticação nativa no Supabase Auth Cloud
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (!authError && authData?.user) {
      setUser(authData.user);
      await fetchUserData(authData.user);
      return { error: null };
    }

    // 2. Fallback Universal Cross-Device: busca empresa no Supabase DB
    try {
      const { data: dbCompany } = await supabase
        .from('companies')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      // Verifica credenciais salvas no Supabase DB ou credenciais locais
      const savedCredsStr = localStorage.getItem(LOCAL_CREDS_KEY);
      const savedCreds = savedCredsStr ? JSON.parse(savedCredsStr) : null;
      const isLocalMatch = savedCreds && savedCreds.email?.toLowerCase() === cleanEmail && savedCreds.password === pass;

      if (dbCompany || isLocalMatch) {
        // Se houver senha salva no DB e ela não bater com a digitada (e não for local match)
        if (dbCompany && dbCompany.auth_password && dbCompany.auth_password !== pass && !isLocalMatch) {
          return { error: new Error('E-mail ou senha incorretos.') };
        }

        const activeCompany = dbCompany || {
          id: `comp-${Date.now()}`,
          name: savedCreds?.companyName || 'Smoking Pods',
          email: cleanEmail,
          phone: savedCreds?.phone || '',
          onboarding_done: true,
        };

        const mockUserId = `usr-${cleanEmail.replace(/[^a-z0-9]/g, '')}`;
        const activeUser = {
          id: mockUserId,
          email: cleanEmail,
          app_metadata: {},
          user_metadata: { full_name: activeCompany.manager_name || savedCreds?.managerName || 'Administrador' },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as User;

        const activeCompanyUser: CompanyUser = {
          id: `cuser-${Date.now()}`,
          company_id: activeCompany.id,
          auth_user_id: mockUserId,
          name: activeCompany.manager_name || savedCreds?.managerName || 'Administrador',
          email: cleanEmail,
          role: 'admin',
        };

        setUser(activeUser);
        setCompany(activeCompany as Company);
        setCompanyUser(activeCompanyUser);
        saveLocalSession(activeUser, activeCompany as Company, activeCompanyUser);

        return { error: null };
      }
    } catch (e) {
      console.warn('Erro no login cross-device:', e);
    }

    return { error: new Error('E-mail ou senha incorretos.') };
  };

  // CADASTRO MULTI-TENANT (Registra no Supabase DB para acesso universal)
  const signUp = async (data: RegisterData) => {
    const cleanEmail = data.email.trim().toLowerCase();

    try {
      // Salva credenciais locais no dispositivo atual
      localStorage.setItem(LOCAL_CREDS_KEY, JSON.stringify({
        email: cleanEmail,
        password: data.password,
        companyName: data.companyName,
        managerName: data.managerName,
        phone: data.phone,
      }));

      // 1. Tenta cadastrar no Supabase Auth Cloud
      let activeAuthUser: User | null = null;
      const { data: authData } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            full_name: data.managerName,
            company_name: data.companyName,
          }
        }
      });

      if (authData?.user) {
        activeAuthUser = authData.user;
      } else {
        activeAuthUser = {
          id: `usr-${cleanEmail.replace(/[^a-z0-9]/g, '')}`,
          email: cleanEmail,
          app_metadata: {},
          user_metadata: { full_name: data.managerName, company_name: data.companyName },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as User;
      }

      // 2. Insere/Atualiza a empresa no Supabase DB com auth_password para liberar login cross-device
      let finalCompany: Company | null = null;

      const { data: newComp } = await supabase
        .from('companies')
        .upsert({
          name: data.companyName,
          email: cleanEmail,
          phone: data.phone,
          auth_password: data.password,
          manager_name: data.managerName,
          onboarding_done: false,
        }, { onConflict: 'email' })
        .select()
        .single();

      if (newComp) {
        finalCompany = newComp as Company;
      } else {
        const { data: existingComp } = await supabase.from('companies').select('*').eq('email', cleanEmail).maybeSingle();
        if (existingComp) finalCompany = existingComp as Company;
      }

      if (!finalCompany) {
        finalCompany = {
          id: `comp-${Date.now()}`,
          name: data.companyName,
          email: cleanEmail,
          phone: data.phone,
          auth_password: data.password,
          manager_name: data.managerName,
          onboarding_done: false,
        };
      }

      const finalCompUser: CompanyUser = {
        id: `cuser-${Date.now()}`,
        company_id: finalCompany.id,
        auth_user_id: activeAuthUser.id,
        name: data.managerName,
        email: cleanEmail,
        role: 'admin',
        auth_password: data.password,
      };

      await supabase.from('company_users').upsert({
        company_id: finalCompany.id,
        auth_user_id: activeAuthUser.id,
        name: data.managerName,
        email: cleanEmail,
        role: 'admin',
        auth_password: data.password,
      }, { onConflict: 'company_id,auth_user_id' }).catch(() => {});

      setUser(activeAuthUser);
      setCompany(finalCompany);
      setCompanyUser(finalCompUser);
      saveLocalSession(activeAuthUser, finalCompany, finalCompUser);

      return { error: null };
    } catch (err: any) {
      console.error('Erro no signUp:', err);
      const mockUsr = { id: `usr-${Date.now()}`, email: cleanEmail } as User;
      const mockComp = { id: `comp-${Date.now()}`, name: data.companyName, email: cleanEmail, auth_password: data.password, onboarding_done: false };
      const mockCompUser = { id: 'cuser-mock', company_id: mockComp.id, auth_user_id: mockUsr.id, name: data.managerName, email: cleanEmail, role: 'admin' as UserRole };

      setUser(mockUsr);
      setCompany(mockComp);
      setCompanyUser(mockCompUser);
      saveLocalSession(mockUsr, mockComp, mockCompUser);

      return { error: null };
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
