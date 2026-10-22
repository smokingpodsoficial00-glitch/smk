/**
 * Trava de Proteção de Ambiente: Impede que a aplicação inicie em modo Staging
 * ou Desenvolvimento conectando acidentalmente no banco de PRODUÇÃO (zhlcuhvigfxedafqkwac).
 * 
 * Projeto Oficial de Staging Homologado: epigvnzhafaqcxczncor
 * Projeto Oficial de Produção Protegido: zhlcuhvigfxedafqkwac
 */
export function validateEnvironmentSafety(supabaseUrl: string | undefined): void {
  const PRODUCTION_REF = 'zhlcuhvigfxedafqkwac';
  const EXPECTED_STAGING_REF = 'epigvnzhafaqcxczncor';
  const isStagingEnv = import.meta.env?.VITE_IS_STAGING === 'true';

  // 1. Barreira de Inicialização: URL ausente
  if (!supabaseUrl || typeof supabaseUrl !== 'string' || supabaseUrl.trim() === '') {
    const errorMsg = '🛑 [FATAL SAFETY BLOCK] VITE_SUPABASE_URL não configurada ou vazia. A aplicação foi interrompida para evitar conexão com endpoint padrão.';
    console.error(errorMsg);
    if (typeof alert !== 'undefined') alert(errorMsg);
    throw new Error(errorMsg);
  }

  // 2. Barreira Crítica de Contenção: Modo STAGING conectado à PRODUÇÃO
  if (isStagingEnv && supabaseUrl.includes(PRODUCTION_REF)) {
    const errorMsg = '🛑 [FATAL SAFETY BLOCK] Violação de Isolamento: A aplicação está configurada para STAGING (VITE_IS_STAGING=true) mas apontando para o Supabase de PRODUÇÃO (zhlcuhvigfxedafqkwac). A execução foi abortada imediatamente para proteger a integridade dos dados de produção.';
    console.error(errorMsg);
    if (typeof alert !== 'undefined') alert(errorMsg);
    throw new Error(errorMsg);
  }

  // 3. Validação Positiva de Staging: Se estiver em modo STAGING, deve conter a ref oficial de Staging
  if (isStagingEnv && !supabaseUrl.includes(EXPECTED_STAGING_REF)) {
    const errorMsg = `🛑 [FATAL SAFETY BLOCK] Ambiente em STAGING mas a URL fornecida não contém o ref oficial homologado (${EXPECTED_STAGING_REF}). A execução foi abortada para impedir conexão com bancos de teste não-autorizados.`;
    console.error(errorMsg);
    if (typeof alert !== 'undefined') alert(errorMsg);
    throw new Error(errorMsg);
  }
}
