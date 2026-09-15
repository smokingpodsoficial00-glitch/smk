/**
 * Resolução centralizada da URL do backend Node.js (API).
 * 
 * Regras:
 * - Em produção (!import.meta.env.DEV), exige expressamente a configuração de VITE_BACKEND_URL.
 * - Em desenvolvimento local (import.meta.env.DEV), permite fallback seguro para 'http://localhost:3006'.
 * - Não assume localhost silenciosamente em produção.
 */
export function getBackendUrl(): string {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:3006';
  }

  const errorMsg = '[Backend Config] VITE_BACKEND_URL não configurada no ambiente de produção. Configure a URL da API da loja na Vercel.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}
