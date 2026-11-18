import FinanceDashboard from "./FinanceDashboard";

/**
 * PartnersDashboard (Wrapper Unificado SMK)
 * Redireciona e renderiza a área unificada de Sócios & Pró-Labore do Financeiro,
 * garantindo fonte única da verdade para cálculos de equity, salários e reinvestimentos.
 */
export default function PartnersDashboard() {
  return <FinanceDashboard initialTab="socios" />;
}
