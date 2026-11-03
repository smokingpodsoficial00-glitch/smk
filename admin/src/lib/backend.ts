/**
 * Resolução centralizada da URL do backend Node.js (API).
 * 
 * Regras de prioridade:
 * 1. Customização manual configurada pelo usuário via localStorage ('SP_CUSTOM_BACKEND_URL').
 * 2. Em ambiente web remoto (Vercel ou HTTPS), SEMPRE utiliza o túnel seguro Cloudflare
 *    para evitar bloqueio de Mixed Content (navegador bloqueia HTTP dentro de HTTPS) e conectar ao servidor real.
 * 3. Se estiver em ambiente local (localhost / 127.0.0.1), permite VITE_BACKEND_URL ou fallback para 'http://localhost:3006'.
 */
export const OFFICIAL_CLOUDFLARE_TUNNEL = 'https://char-spreading-commercial-pensions.trycloudflare.com';

export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    // 1. Permite customização manual via localStorage
    const custom = localStorage.getItem('SP_CUSTOM_BACKEND_URL');
    if (custom && custom.trim().length > 0) {
      return custom.trim().replace(/\/+$/, '');
    }

    // 2. Se a página atual estiver em HTTPS ou em qualquer domínio remoto (ex: Vercel)
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';

    if (!isLocalhost || isHttps || hostname.endsWith('vercel.app')) {
      return OFFICIAL_CLOUDFLARE_TUNNEL;
    }
  }

  // 3. Desenvolvimento local
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0 && !envUrl.includes('localhost')) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return 'http://localhost:3006';
}

// =====================================================================
// ISOLAMENTO MULTITENANT DO BACKEND LEGADO
// ---------------------------------------------------------------------
// O backend Node atual é SINGLE-TENANT: possui uma única sessão de
// WhatsApp (baileys_auth) e um único arquivo marketing_config.json,
// ambos pertencentes à Smoking Pods. Qualquer outra empresa que fale
// com ele lê/sobrescreve dados da Smoking Pods e dispara pelo número dela.
// Por isso, apenas a conta oficial pode acessá-lo. Demais tenants ficam
// bloqueados (falha como "offline") até existir motor dedicado por loja.
// =====================================================================
export const OFFICIAL_BACKEND_COMPANY_ID = 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';

let activeBackendCompanyId: string | null = null;

/** Registra a empresa logada. Chamado pelo layout/módulos a cada render. */
export function setActiveBackendCompany(companyId: string | null | undefined): void {
  activeBackendCompanyId = companyId || null;
}

/** true somente se a empresa ativa for a dona do backend legado. Padrão seguro: false. */
export function isLegacyBackendAllowed(companyId?: string | null): boolean {
  const id = companyId !== undefined ? companyId : activeBackendCompanyId;
  return id === OFFICIAL_BACKEND_COMPANY_ID;
}

/**
 * fetch para o backend legado com trava multitenant.
 * Para tenants não autorizados, rejeita como falha de rede (os fluxos
 * existentes já tratam isso como offline), sem nenhuma requisição sair.
 */
export function legacyFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!isLegacyBackendAllowed()) {
    return Promise.reject(new Error('[Multitenant] Backend legado restrito à conta oficial.'));
  }
  return fetch(`${getBackendUrl()}${path}`, init);
}

/** Chave de localStorage isolada por empresa (evita vazamento entre contas no mesmo navegador). */
export function tenantCacheKey(baseKey: string): string {
  return `${baseKey}__${activeBackendCompanyId || 'anon'}`;
}

// Remove caches legados NÃO isolados por empresa (podiam conter dados de outra conta)
if (typeof window !== 'undefined') {
  try {
    ['smoking_broadcast_lists_v1', 'smoking_marketing_campaigns_v1', 'SP_MARKETING_CONTACTS', 'SP_MARKETING_GROUPS']
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}
