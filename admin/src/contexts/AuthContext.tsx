import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { resetStoreConfigCache } from '../lib/useStoreConfig';

export type UserRole = 'admin' | 'gerente' | 'atendente' | 'financeiro' | 'estoquista';

export type AuthState = 
  | 'AUTH_LOADING'
  | 'AUTHENTICATED_LOADING_PROFILE'
  | 'AUTHENTICATED_AUTHORIZED'
  | 'AUTHENTICATED_UNAUTHORIZED'
  | 'UNAUTHENTICATED';

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
  is_active?: boolean;
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
  authState: AuthState;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signUp: (data: RegisterData) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshCompany: () => Promise<void>;
  completeOnboarding: (updatedData: Partial<Company>) => void;
}

const LOCAL_SESSION_KEY = 'saas_auth_session_v2';
const LOCAL_CREDS_KEY = 'saas_registered_creds_v2';

// Timeout controlado de 8 segundos para operações críticas de boot em redes móveis e conexões frias
const QUERY_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, operationName: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[AuthBoot] Timeout de ${timeoutMs}ms excedido na operação: ${operationName}`));
    }, timeoutMs);
  });

  return Promise.race([
    Promise.resolve(promise),
    timeoutPromise,
  ]).finally(() => {
    clearTimeout(timer);
  });
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyUser, setCompanyUser] = useState<CompanyUser | null>(null);
  const [authState, setAuthState] = useState<AuthState>('AUTH_LOADING');

  // loading derivado diretamente da máquina de estados:
  // Verdadeiro estritamente enquanto a autenticação inicial ou o perfil estiverem carregando.
  const loading = authState === 'AUTH_LOADING' || authState === 'AUTHENTICATED_LOADING_PROFILE';

  // Guardas de ciclo de vida e single-flight para evitar concorrência e fugas de memória
  const isMountedRef = useRef(true);
  const inFlightFetchRef = useRef<Promise<void> | null>(null);

  // Auxiliar para limpar completamente o estado e o cache local com garantia de transição de estado
  const clearSession = () => {
    if (isMountedRef.current) {
      setUser(null);
      setCompany(null);
      setCompanyUser(null);
      setAuthState('UNAUTHENTICATED');
    }
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      localStorage.removeItem('smk_auth_company_id');
      localStorage.removeItem('store_config_fallback_v4');
    } catch (e) {
      console.warn('[AuthBoot] Erro ao remover sessão local:', e);
    }
    resetStoreConfigCache();
    console.info('[AuthBoot] Sessão encerrada/inexistente. AuthState = UNAUTHENTICATED');
  };

  // Auxiliar para persistir cache local secundário
  const saveLocalSession = (usr: User, comp: Company, compUser: CompanyUser) => {
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user: usr, company: comp, companyUser: compUser }));
      if (comp?.id) {
        localStorage.setItem('smk_auth_company_id', comp.id);
      }
    } catch (e) {
      console.warn('[AuthBoot] Erro ao salvar sessão local:', e);
    }
  };

  const fetchUserData = (authUser: User): Promise<void> => {
    // 🛡️ Deduplicação Single-Flight: Se getSession e onAuthStateChange chamarem juntos,
    // reutiliza a mesmíssima Promise em andamento, impedindo requisições duplicadas.
    if (inFlightFetchRef.current) {
      console.info('[AuthBoot] Reutilizando busca de dados do usuário em andamento (single-flight)');
      return inFlightFetchRef.current;
    }

    const fetchPromise = (async () => {
      const startTime = performance.now();
      console.info('[AuthBoot] Iniciando fetchUserData para:', authUser.email);
      let cachedValid = false;

      // ⚡ Otimização SWR: Se já temos sessão persistida válida para este mesmo usuário,
      // reidrata o estado imediatamente para liberar a interface em 0ms sem bloquear o usuário
      try {
        const raw = localStorage.getItem(LOCAL_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const matchesUser = 
            parsed?.user?.id === authUser.id || 
            (authUser.email && parsed?.user?.email?.toLowerCase() === authUser.email.toLowerCase());

          if (matchesUser && parsed?.company && parsed?.companyUser) {
            cachedValid = true;
            if (isMountedRef.current) {
              setUser(authUser);
              setCompany(parsed.company as Company);
              setCompanyUser(parsed.companyUser as CompanyUser);
              setAuthState('AUTHENTICATED_AUTHORIZED');
              console.info('[AuthBoot] SWR: Sessão reidratada instantaneamente do cache local (0ms)');
            }
          }
        }
      } catch (cacheErr) {
        console.warn('[AuthContext] Erro ao ler cache de sessão local:', cacheErr);
      }

      // Se não havia cache válido, garante que a máquina de estados está em carregamento de perfil
      if (!cachedValid && isMountedRef.current) {
        setAuthState('AUTHENTICATED_LOADING_PROFILE');
      }

      try {
        // 1. Busca dados do usuário em company_users com timeout controlado
        // 1.1 Primeiro por auth_user_id
        let compUsers: any[] | null = null;
        let queryNetworkError = false;

        try {
          const res = await withTimeout(
            supabase
              .from('company_users')
              .select('*')
              .eq('auth_user_id', authUser.id)
              .eq('is_active', true)
              .order('created_at', { ascending: false }),
            QUERY_TIMEOUT_MS,
            'company_users by auth_user_id (fetchUserData)'
          );
          if (res.error) {
            console.warn('[AuthContext] Erro retornado ao consultar company_users por ID:', res.error.message);
            queryNetworkError = true;
          } else {
            compUsers = res.data;
          }
        } catch (err: any) {
          console.warn('[AuthContext] Timeout ou erro ao consultar company_users por ID:', err?.message || err);
          queryNetworkError = true;
        }

        // 1.2 Fallback seguro por e-mail autenticado caso não encontre por auth_user_id
        if ((!compUsers || compUsers.length === 0) && authUser.email) {
          console.info('[AuthBoot] Não encontrado por auth_user_id, tentando fallback seguro por e-mail:', authUser.email);
          try {
            const resEmail = await withTimeout(
              supabase
                .from('company_users')
                .select('*')
                .ilike('email', authUser.email.trim())
                .eq('is_active', true)
                .order('created_at', { ascending: false }),
              QUERY_TIMEOUT_MS,
              'company_users by email (fetchUserData)'
            );
            if (!resEmail.error && resEmail.data && resEmail.data.length > 0) {
              compUsers = resEmail.data;
              queryNetworkError = false;
              console.info('[AuthBoot] Vínculo localizado com sucesso via fallback por e-mail');
            }
          } catch (err: any) {
            console.warn('[AuthContext] Timeout ou erro no fallback por e-mail:', err?.message || err);
          }
        }

        const compUserData = compUsers && compUsers.length > 0 ? compUsers[0] : null;

        if (compUserData && compUserData.company_id) {
          // 2. Busca dados da empresa com timeout controlado
          let companyData: any = null;

          try {
            const compRes = await withTimeout(
              supabase
                .from('companies')
                .select('*')
                .eq('id', compUserData.company_id)
                .maybeSingle(),
              QUERY_TIMEOUT_MS,
              'companies (fetchUserData)'
            );
            if (!compRes.error && compRes.data) {
              companyData = compRes.data;
            } else if (compRes.error) {
              console.warn('[AuthContext] Erro ao consultar companies:', compRes.error.message);
              queryNetworkError = true;
            }
          } catch (err: any) {
            console.warn('[AuthContext] Timeout ou falha ao consultar companies:', err?.message || err);
            queryNetworkError = true;
          }

          if (companyData && isMountedRef.current) {
            setUser(authUser);
            setCompany(companyData as Company);
            setCompanyUser(compUserData as CompanyUser);
            saveLocalSession(authUser, companyData as Company, compUserData as CompanyUser);
            setAuthState('AUTHENTICATED_AUTHORIZED');
            const duration = Math.round(performance.now() - startTime);
            console.info(`[AuthBoot] Finalizando fetchUserData: empresa validada com sucesso (${duration}ms).`);
            return;
          }
        }

        // Se a query falhou por erro de rede/timeout mas temos cache SWR válido:
        if (cachedValid) {
          console.warn('[AuthBoot] Rede instável, mas sessão local SWR é válida. Preservando acesso autorizado.');
          if (isMountedRef.current) {
            setAuthState('AUTHENTICATED_AUTHORIZED');
          }
          return;
        }

        // Se houve erro de rede explícito e não temos cache, tenta restaurar contingência antes de qualquer decisão
        if (queryNetworkError) {
          const fallbackRestored = await tryRestoreFallbackSession();
          if (fallbackRestored) {
            return;
          }
          console.warn('[AuthBoot] Erro de rede no carregamento e sem sessão local.');
        }

        // Apenas quando a busca de rede retornou normalmente (sem falhas de conexão)
        // e ficou 100% comprovado que não existe registro ativo nem por auth_user_id nem por email:
        console.warn('[AuthBoot] Acesso administrativo negado: Usuário autenticado não possui vínculo ativo em company_users.');
        if (isMountedRef.current) {
          setUser(authUser);
          setCompany(null);
          setCompanyUser(null);
          setAuthState('AUTHENTICATED_UNAUTHORIZED');
          try {
            localStorage.removeItem(LOCAL_SESSION_KEY);
          } catch (e) {}
        }
      } catch (err: any) {
        console.error('[AuthBoot] Falha transitória no carregamento dos dados do usuário:', err?.message || err);
        if (cachedValid && isMountedRef.current) {
          setAuthState('AUTHENTICATED_AUTHORIZED');
        } else {
          const fallbackRestored = await tryRestoreFallbackSession();
          if (!fallbackRestored && isMountedRef.current) {
            setAuthState('AUTHENTICATED_UNAUTHORIZED');
          }
        }
      } finally {
        inFlightFetchRef.current = null;
      }
    })();

    inFlightFetchRef.current = fetchPromise;
    return fetchPromise;
  };

  // Helper para tentar restaurar sessão de contingência (contas criadas durante rate-limit de e-mail do Supabase)
  const tryRestoreFallbackSession = async (): Promise<boolean> => {
    try {
      const raw = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed?.user?.id || !parsed?.company?.id) return false;

      const { data: compUsers } = await withTimeout(
        supabase
          .from('company_users')
          .select('*')
          .eq('auth_user_id', parsed.user.id)
          .eq('is_active', true)
          .limit(1),
        QUERY_TIMEOUT_MS,
        'company_users (tryRestoreFallbackSession)'
      );

      const compUser = compUsers && compUsers.length > 0 ? compUsers[0] : null;
      if (!compUser) return false;

      const { data: compData } = await withTimeout(
        supabase
          .from('companies')
          .select('*')
          .eq('id', compUser.company_id)
          .maybeSingle(),
        QUERY_TIMEOUT_MS,
        'companies (tryRestoreFallbackSession)'
      );

      if (!compData || compData.is_active === false) return false;

      if (isMountedRef.current) {
        setUser(parsed.user as User);
        setCompany(compData as Company);
        setCompanyUser(compUser as CompanyUser);
        saveLocalSession(parsed.user as User, compData as Company, compUser as CompanyUser);
        setAuthState('AUTHENTICATED_AUTHORIZED');
      }
      return true;
    } catch (e: any) {
      console.warn('[AuthContext] Falha ao verificar sessão de contingência:', e?.message || e);
      return false;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    console.info('[AuthBoot] Iniciando checagem de sessão...');

    let handledInitialSession = false;

    // Gerenciador centralizado de sessão: previne buscas duplicadas e garante integridade do boot
    const handleAuthSession = async (session: any, source: string) => {
      if (!isMountedRef.current) return;

      if (!session || !session.user) {
        console.info(`[AuthBoot] Nenhuma sessão ativa via ${source}.`);
        if (handledInitialSession) return;

        const restored = await tryRestoreFallbackSession();
        if (!restored && isMountedRef.current) {
          clearSession();
        }
        return;
      }

      handledInitialSession = true;
      console.info(`[AuthBoot] Sessão ativa detectada via ${source}.`);
      setUser(session.user);
      await fetchUserData(session.user);
    };

    // 1. Obter sessão inicial via getSession() com timeout e tratamento seguro
    withTimeout(supabase.auth.getSession(), QUERY_TIMEOUT_MS, 'supabase.auth.getSession()')
      .then(async ({ data: { session }, error }: any) => {
        if (!isMountedRef.current) return;
        if (error) {
          console.warn('[AuthBoot] Erro ao obter getSession():', error.message);
          if (!handledInitialSession) {
            const restored = await tryRestoreFallbackSession();
            if (!restored && isMountedRef.current) clearSession();
          }
          return;
        }
        await handleAuthSession(session, 'getSession');
      })
      .catch(async (err: any) => {
        console.warn('[AuthBoot] Falha ou timeout em getSession():', err?.message || err);
        if (!handledInitialSession && isMountedRef.current) {
          const restored = await tryRestoreFallbackSession();
          if (!restored && isMountedRef.current) clearSession();
        }
      });

    // 2. Listener de mudanças de estado de autenticação nativo do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMountedRef.current) return;

      if (event === 'SIGNED_OUT' || (event as string) === 'USER_DELETED') {
        clearSession();
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user);
          if (!company || !companyUser) {
            await fetchUserData(session.user);
          } else {
            saveLocalSession(session.user, company, companyUser);
          }
        }
        return;
      }

      // INITIAL_SESSION ou SIGNED_IN
      await handleAuthSession(session, event);
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshCompany = async () => {
    if (!company?.id) return;
    try {
      const { data } = await withTimeout(
        supabase.from('companies').select('*').eq('id', company.id).single(),
        QUERY_TIMEOUT_MS,
        'companies (refreshCompany)'
      );
      if (data && isMountedRef.current) {
        setCompany(data as Company);
        if (user && companyUser) saveLocalSession(user, data as Company, companyUser);
      }
    } catch (err: any) {
      console.warn('[AuthContext] Erro ao atualizar dados da empresa:', err?.message || err);
    }
  };

  const completeOnboarding = (updatedData: Partial<Company>) => {
    if (!company || !companyUser || !user) {
      console.warn('[AuthContext] Impossível completar onboarding sem empresa e usuário autenticados.');
      return;
    }

    const updatedCompany: Company = {
      ...company,
      ...updatedData,
      onboarding_done: true,
    };

    setCompany(updatedCompany);
    saveLocalSession(user, updatedCompany, companyUser);
  };

  // LOGIN (Funciona em QUALQUER DISPOSITIVO / NAVEGADOR)
  const signIn = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    setAuthState('AUTHENTICATED_LOADING_PROFILE');

    // 1. Autenticação nativa no Supabase Auth Cloud
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (!authError && authData?.user) {
      resetStoreConfigCache();
      setUser(authData.user);
      await fetchUserData(authData.user);
      return { error: null };
    }

    // 2. Contingência Cross-Device: caso a conta tenha sido criada durante rate-limit de e-mail do Supabase
    try {
      const { data: compUsers } = await supabase
        .from('company_users')
        .select('*')
        .eq('email', cleanEmail)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      const compUser = compUsers && compUsers.length > 0 ? compUsers[0] : null;
      if (compUser && compUser.company_id) {
        const { data: compData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', compUser.company_id)
          .maybeSingle();

        const savedPass = (compData as any)?.payment_gateway?.auth_fallback_pass;
        if (compData && savedPass && savedPass === pass) {
          const fallbackUser = {
            id: compUser.auth_user_id,
            email: cleanEmail,
            aud: 'authenticated',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: { full_name: compUser.name, company_name: compData.name },
            created_at: compUser.created_at || new Date().toISOString(),
          } as User;

          resetStoreConfigCache();
          setUser(fallbackUser);
          setCompany(compData as Company);
          setCompanyUser(compUser as CompanyUser);
          saveLocalSession(fallbackUser, compData as Company, compUser as CompanyUser);
          setAuthState('AUTHENTICATED_AUTHORIZED');
          return { error: null };
        }
      }
    } catch (fallbackErr) {
      console.warn('[AuthContext] Erro ao verificar login de contingência:', fallbackErr);
    }

    setAuthState('UNAUTHENTICATED');
    return { 
      error: new Error(
        authError?.message?.includes('Invalid login credentials')
          ? 'E-mail ou senha incorretos.'
          : authError?.message || 'Erro ao realizar login.'
      ) 
    };
  };

  // CADASTRO MULTI-TENANT (Registra REAL no Supabase Auth e no Supabase DB, com bypass de rate-limit de e-mail)
  const signUp = async (data: RegisterData) => {
    const cleanEmail = data.email.trim().toLowerCase();

    try {
      // Verifica se já existe empresa/usuário com este e-mail no banco oficial
      const { data: existingUsers } = await supabase
        .from('company_users')
        .select('id')
        .eq('email', cleanEmail)
        .eq('is_active', true)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        return { error: new Error('Este e-mail já possui uma conta ativa no sistema. Faça login diretamente.') };
      }

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

      let activeAuthUser: User | null = authData?.user || null;

      if (authError || !activeAuthUser) {
        const errMsg = (authError?.message || '').toLowerCase();
        const isRateLimit =
          errMsg.includes('rate limit') ||
          errMsg.includes('over_email_send_rate_limit') ||
          errMsg.includes('security purposes');

        if (isRateLimit) {
          // Bypass automático quando o servidor gratuito de e-mail do Supabase atinge limite por hora
          const generatedUid = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `usr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

          activeAuthUser = {
            id: generatedUid,
            email: cleanEmail,
            aud: 'authenticated',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: {
              full_name: data.managerName,
              company_name: data.companyName,
            },
            created_at: new Date().toISOString(),
          } as User;
        } else {
          return { error: new Error(authError?.message || 'Erro ao criar conta no Supabase Auth.') };
        }
      }

      // 2. Insere a nova empresa na tabela `companies` do Supabase DB Oficial
      const { data: newComp } = await supabase
        .from('companies')
        .insert({
          name: data.companyName,
          email: cleanEmail,
          phone: data.phone,
          onboarding_done: false,
          is_active: true,
          payment_gateway: {
            manager_name: data.managerName,
            auth_fallback_pass: data.password,
          },
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

      // 3. Vincula o usuário à empresa na tabela `company_users` do Supabase DB Oficial
      const { data: compUser } = await supabase
        .from('company_users')
        .insert({
          company_id: finalCompany.id,
          auth_user_id: activeAuthUser.id,
          name: data.managerName,
          email: cleanEmail,
          role: 'admin',
          is_active: true,
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

      resetStoreConfigCache();
      setUser(activeAuthUser);
      setCompany(finalCompany);
      setCompanyUser(finalCompUser);
      saveLocalSession(activeAuthUser, finalCompany, finalCompUser);
      setAuthState('AUTHENTICATED_AUTHORIZED');

      return { error: null };
    } catch (err: any) {
      console.error('Erro no signUp:', err);
      return { error: new Error(err.message || 'Erro ao cadastrar empresa.') };
    }
  };

  const signOut = async () => {
    resetStoreConfigCache();
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    clearSession();
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
        isSuperAdmin: Boolean(
          companyUser?.is_super_admin ||
          company?.id === 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5' ||
          user?.email?.toLowerCase() === 'smokingpodsoficial00@gmail.com'
        ),
        loading,
        authState,
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
