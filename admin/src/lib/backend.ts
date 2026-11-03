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
