/**
 * Resolução centralizada e Multitenant da URL do backend Node.js (API & Motor WhatsApp Baileys).
 *
 * Isolamento SaaS por Loja (companyId):
 * - A conta oficial Smoking Pods (`OFFICIAL_BACKEND_COMPANY_ID`) conecta ao seu túnel dedicado
 *   onde sua sessão WhatsApp já está pareada e ativa (`OFFICIAL_CLOUDFLARE_TUNNEL`).
 * - Todas as demais contas do SaaS (ex: King dos Pod e novas lojas) conectam ao motor
 *   Multitenant (`MULTITENANT_CLOUDFLARE_TUNNEL` em HTTPS/Vercel ou `http://localhost:3006` localmente),
 *   onde cada `companyId` possui sua própria pasta `baileys_auth_<companyId>` e seu próprio
 *   arquivo `marketing_config_<companyId>.json`, sem qualquer colisão de sessão, contatos, listas ou campanhas.
 */
export const OFFICIAL_BACKEND_COMPANY_ID = 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';
export const OFFICIAL_CLOUDFLARE_TUNNEL = 'https://char-spreading-commercial-pensions.trycloudflare.com';
export const MULTITENANT_CLOUDFLARE_TUNNEL = 'https://suspected-issues-berry-usb.trycloudflare.com';

let activeBackendCompanyId: string | null = null;

/** Registra a empresa logada. Chamado pelo layout/módulos a cada render. */
export function setActiveBackendCompany(companyId: string | null | undefined): void {
  activeBackendCompanyId = companyId || null;
}

/** Retorna o companyId ativo no momento. */
export function getActiveBackendCompany(): string | null {
  return activeBackendCompanyId;
}

/** Chave de localStorage isolada por empresa (evita vazamento entre contas no mesmo navegador). */
export function tenantCacheKey(baseKey: string): string {
  return `${baseKey}__${activeBackendCompanyId || 'anon'}`;
}

export function getBackendUrl(companyId?: string | null): string {
  const targetCompanyId = companyId !== undefined ? companyId : activeBackendCompanyId;

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

    // 3. Demais lojas do SaaS (ex: King dos Pod): em HTTPS/Vercel usa o túnel Multitenant
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
 * pode conectar seu próprio WhatsApp e gerenciar suas próprias listas e campanhas.
 */
export function isLegacyBackendAllowed(companyId?: string | null): boolean {
  const id = companyId !== undefined ? companyId : activeBackendCompanyId;
  return Boolean(id && id.trim().length > 0);
}

/**
 * Wrapper `fetch` Multitenant para o backend Node.js.
 * Injeta automaticamente `companyId` na query string e no header `x-company-id`
 * para garantir que o servidor isole a sessão do WhatsApp (`baileys_auth_<companyId>`)
 * e os dados de marketing (`marketing_config_<companyId>.json`) de cada loja.
 */
export function legacyFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!activeBackendCompanyId) {
    return Promise.reject(new Error('[Multitenant] Nenhuma empresa autenticada ativa para acessar o backend.'));
  }

  const baseUrl = getBackendUrl(activeBackendCompanyId);
  const separator = path.includes('?') ? '&' : '?';
  const hasCompanyParam = /[?&]companyId=/.test(path);
  const scopedPath = hasCompanyParam
    ? path
    : `${path}${separator}companyId=${encodeURIComponent(activeBackendCompanyId)}`;

  const headers = new Headers(init?.headers || {});
  if (!headers.has('x-company-id')) {
    headers.set('x-company-id', activeBackendCompanyId);
  }

  return fetch(`${baseUrl}${scopedPath}`, {
    ...init,
    headers,
  });
}

// Remove caches legados NÃO isolados por empresa (podiam conter dados de outra conta)
if (typeof window !== 'undefined') {
  try {
    ['smoking_broadcast_lists_v1', 'smoking_marketing_campaigns_v1', 'SP_MARKETING_CONTACTS', 'SP_MARKETING_GROUPS', 'SP_CUSTOM_BACKEND_URL']
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}
