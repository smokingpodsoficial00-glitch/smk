/**
 * Resolução centralizada da URL do backend Node.js (API).
 * 
 * Regras:
 * - Prioriza VITE_BACKEND_URL caso configurado.
 * - Permite customização via localStorage ('SP_CUSTOM_BACKEND_URL').
 * - Fornece fallback seguro para 'http://localhost:3006' sem derrubar a aplicação.
 */
export function getBackendUrl(): string {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('SP_CUSTOM_BACKEND_URL');
    if (custom && custom.trim().length > 0) {
      return custom.trim().replace(/\/+$/, '');
    }
  }

  return 'http://localhost:3006';
}
