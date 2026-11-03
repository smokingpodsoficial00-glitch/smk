/**
 * Resolução centralizada e Multitenant da URL do backend Node.js (API & Motor WhatsApp Baileys).
 *
 * Arquitetura SaaS Multi-Contas Simultâneas:
 * - Cada loja autenticada possui seu próprio `companyId`.
 * - A conta oficial Smoking Pods (`OFFICIAL_BACKEND_COMPANY_ID`) conecta prioritariamente ao túnel
 *   onde sua sessão de WhatsApp já está ativa (`OFFICIAL_CLOUDFLARE_TUNNEL`), com fallback automático
 *   para o cluster Multitenant (`MULTITENANT_CLOUDFLARE_TUNNEL`).
 * - Todas as demais contas do SaaS (2, 10, 50+ lojas simultâneas, como King dos Pod) conectam ao
 *   motor Multitenant (`MULTITENANT_CLOUDFLARE_TUNNEL`), onde cada `companyId` mantém simultaneamente
 *   seu próprio socket Baileys (`baileys_auth_<companyId>`) e seu próprio banco de campanhas/listas
 *   (`marketing_config_<companyId>.json`).
 * - Importante para CORS: O `companyId` é enviado exclusivamente via query string (`?companyId=...`),
 *   sem adicionar headers customizados (`x-company-id`) que bloqueariam o preflight CORS nos túneis.
 */
export const OFFICIAL_BACKEND_COMPANY_ID = 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
export const OFFICIAL_CLOUDFLARE_TUNNEL = 'https://char-spreading-commercial-pensions.trycloudflare.com';
export const MULTITENANT_CLOUDFLARE_TUNNEL = 'https://suspected-issues-berry-usb.trycloudflare.com';

let activeBackendCompanyId: string | null = null;

/** Registra a empresa logada. Chamado pelo layout/módulos a cada render. */
export function setActiveBackendCompany(companyId: string | null | undefined): void {
  if (companyId) {
    activeBackendCompanyId = companyId;
  } else if (companyId === null) {
    activeBackendCompanyId = null;
  }
}

/** Resolve o companyId ativo (memória ou sessão persistida do AuthContext). */
export function getActiveBackendCompany(): string | null {
  if (activeBackendCompanyId) return activeBackendCompanyId;

  if (typeof window !== 'undefined') {
    try {
      const fromKey = localStorage.getItem('smk_auth_company_id');
      if (fromKey && fromKey.trim().length > 0) {
        return fromKey.trim();
      }
      const rawSession = localStorage.getItem('saas_auth_session_v2');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed?.company?.id) {
          return String(parsed.company.id);
        }
      }
    } catch {}
  }

  return null;
}

/** Chave de localStorage isolada por empresa (evita vazamento entre contas no mesmo navegador). */
export function tenantCacheKey(baseKey: string): string {
  const cid = getActiveBackendCompany() || 'anon';
  return `${baseKey}__${cid}`;
}

export function getBackendUrl(companyId?: string | null): string {
  const targetCompanyId = companyId !== undefined && companyId !== null
    ? companyId
    : getActiveBackendCompany();

  if (typeof window !== 'undefined') {
    // 1. Permite customização manual isolada por tenant via localStorage
    const customTenant = localStorage.getItem(tenantCacheKey('SP_CUSTOM_BACKEND_URL'));
    if (customTenant && customTenant.trim().length > 0) {
      return customTenant.trim().replace(/\/+$/, '');
    }

    // 2. Conta oficial Smoking Pods preserva conexão com o túnel onde sua sessão Baileys está ativa
    if (targetCompanyId === OFFICIAL_BACKEND_COMPANY_ID) {
      return OFFICIAL_CLOUDFLARE_TUNNEL;
    }

    // 3. Demais lojas do SaaS (ex: King dos Pod e N contas simultâneas): usa o túnel Multitenant
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';

    if (!isLocalhost || isHttps || hostname.endsWith('vercel.app')) {
      return MULTITENANT_CLOUDFLARE_TUNNEL;
    }
  }

  // 4. Desenvolvimento local para tenants no próprio PC
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0 && !envUrl.includes('localhost')) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return 'http://localhost:3006';
}

/**
 * Em modo SaaS Multitenant, toda loja autenticada com `companyId` válido
 * pode conectar seu próprio WhatsApp e gerenciar suas próprias listas e campanhas simultaneamente.
 */
export function isLegacyBackendAllowed(companyId?: string | null): boolean {
  const id = companyId !== undefined && companyId !== null ? companyId : getActiveBackendCompany();
  return Boolean(id && id.trim().length > 0);
}

/**
 * Wrapper `fetch` Multitenant para o backend Node.js.
 * Injeta automaticamente `?companyId=...` na URL (sem headers customizados que quebram CORS)
 * para garantir que o servidor isole a sessão do WhatsApp (`baileys_auth_<companyId>`)
 * e os dados de marketing (`marketing_config_<companyId>.json`) de cada loja simultaneamente.
 */
export async function legacyFetch(path: string, init?: RequestInit): Promise<Response> {
  const cid = getActiveBackendCompany();
  if (!cid) {
    return Promise.reject(new Error('[Multitenant] Nenhuma empresa autenticada ativa para acessar o backend.'));
  }

  const separator = path.includes('?') ? '&' : '?';
  const hasCompanyParam = /[?&]companyId=/.test(path);
  const scopedPath = hasCompanyParam
    ? path
    : `${path}${separator}companyId=${encodeURIComponent(cid)}`;

  const primaryUrl = getBackendUrl(cid);

  try {
    return await fetch(`${primaryUrl}${scopedPath}`, init);
  } catch (err) {
    // Fallback automático para o cluster Multitenant caso o túnel primário da conta oficial oscile
    if (primaryUrl !== MULTITENANT_CLOUDFLARE_TUNNEL) {
      return await fetch(`${MULTITENANT_CLOUDFLARE_TUNNEL}${scopedPath}`, init);
    }
    throw err;
  }
}

// Remove caches legados NÃO isolados por empresa (podiam conter dados de outra conta)
if (typeof window !== 'undefined') {
  try {
    ['smoking_broadcast_lists_v1', 'smoking_marketing_campaigns_v1', 'SP_MARKETING_CONTACTS', 'SP_MARKETING_GROUPS', 'SP_CUSTOM_BACKEND_URL']
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}
