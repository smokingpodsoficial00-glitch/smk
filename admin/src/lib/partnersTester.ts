import { supabase } from './supabase';
import {
  fetchPartners,
  fetchPartnerTransactions,
  createPartner,
  updatePartner,
  deletePartner,
  createPartnerTransaction,
  deletePartnerTransaction,
  calculatePartnersFinancials,
  type Partner,
  type PartnerTransaction
} from './partners';

export interface PartnersTestResultItem {
  id: number;
  description: string;
  passed: boolean;
  details: string;
  error?: string;
}

export interface PartnersTestSuiteReport {
  timestamp: string;
  authenticatedUser: string | null;
  companyId: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  capTable: {
    totalCapital: number;
    eduardoCapital: number;
    eduardoEquityPct: string;
    gabrielCapital: number;
    gabrielEquityPct: string;
    isBalanced: boolean;
  };
  results: PartnersTestResultItem[];
}

const DEFAULT_COMPANY_ID = 'd7e1c479-32b4-40b8-b2d7-42fe4db1f8b5';

export async function runPartnersValidationSuite(): Promise<PartnersTestSuiteReport> {
  console.log('🚀 [PartnersTester] Iniciando Bateria de Testes Controlados — Bloco 8...');

  const { data: { session } } = await supabase.auth.getSession();
  const userEmail = session?.user?.email || null;
  console.log(`👤 [PartnersTester] Sessão atual: ${userEmail || 'Não autenticado via Supabase Auth'}`);

  const results: PartnersTestResultItem[] = [];

  let testPartnerId = '';
  let testTxId = '';

  // 1. Buscar Eduardo
  try {
    const { data, error } = await supabase
      .from('smoking_partners')
      .select('*')
      .eq('company_id', DEFAULT_COMPANY_ID)
      .eq('id', 'p1-eduardo')
      .maybeSingle();

    if (error) throw error;
    const ok = !!data && data.name === 'Eduardo';
    results.push({
      id: 1,
      description: 'Buscar Eduardo (p1-eduardo)',
      passed: ok,
      details: ok ? `Encontrado: ${data.name} (id: ${data.id}, ativo: ${data.is_active})` : 'Eduardo não encontrado'
    });
  } catch (e: any) {
    results.push({
      id: 1,
      description: 'Buscar Eduardo (p1-eduardo)',
      passed: false,
      details: 'Falha na busca remota',
      error: e.message
    });
  }

  // 2. Buscar Gabriel
  try {
    const { data, error } = await supabase
      .from('smoking_partners')
      .select('*')
      .eq('company_id', DEFAULT_COMPANY_ID)
      .eq('id', 'p2-gabriel')
      .maybeSingle();

    if (error) throw error;
    const ok = !!data && data.name === 'Gabriel';
    results.push({
      id: 2,
      description: 'Buscar Gabriel (p2-gabriel)',
      passed: ok,
      details: ok ? `Encontrado: ${data.name} (id: ${data.id}, ativo: ${data.is_active})` : 'Gabriel não encontrado'
    });
  } catch (e: any) {
    results.push({
      id: 2,
      description: 'Buscar Gabriel (p2-gabriel)',
      passed: false,
      details: 'Falha na busca remota',
      error: e.message
    });
  }

  // 3. Confirmar 2 parceiros
  try {
    const partners = await fetchPartners(DEFAULT_COMPANY_ID);
    const active = partners.filter(p => p.is_active !== false);
    const ok = active.length === 2 && active.some(p => p.id === 'p1-eduardo') && active.some(p => p.id === 'p2-gabriel');
    results.push({
      id: 3,
      description: 'Confirmar exatamente 2 parceiros ativos',
      passed: ok,
      details: `Total de parceiros ativos: ${active.length} (${active.map(p => p.name).join(', ')})`
    });
  } catch (e: any) {
    results.push({
      id: 3,
      description: 'Confirmar exatamente 2 parceiros ativos',
      passed: false,
      details: 'Erro ao listar parceiros',
      error: e.message
    });
  }

  // 4. Buscar tx-init-1
  try {
    const { data, error } = await supabase
      .from('smoking_partner_transactions')
      .select('*')
      .eq('company_id', DEFAULT_COMPANY_ID)
      .eq('id', 'tx-init-1')
      .maybeSingle();

    if (error) throw error;
    const ok = !!data && Number(data.amount) === 500 && data.partner_id === 'p1-eduardo' && data.type === 'APORTE';
    results.push({
      id: 4,
      description: 'Buscar tx-init-1 (Aporte Eduardo R$ 500,00)',
      passed: ok,
      details: ok ? `Encontrado: ${data.description}, Valor: R$ ${data.amount}, Sócio: ${data.partner_id}` : 'Transação tx-init-1 inválida ou ausente'
    });
  } catch (e: any) {
    results.push({
      id: 4,
      description: 'Buscar tx-init-1 (Aporte Eduardo R$ 500,00)',
      passed: false,
      details: 'Falha na consulta remota',
      error: e.message
    });
  }

  // 5. Buscar tx-init-2
  try {
    const { data, error } = await supabase
      .from('smoking_partner_transactions')
      .select('*')
      .eq('company_id', DEFAULT_COMPANY_ID)
      .eq('id', 'tx-init-2')
      .maybeSingle();

    if (error) throw error;
    const ok = !!data && Number(data.amount) === 605 && data.partner_id === 'p2-gabriel' && data.type === 'APORTE';
    results.push({
      id: 5,
      description: 'Buscar tx-init-2 (Aporte Gabriel R$ 605,00)',
      passed: ok,
      details: ok ? `Encontrado: ${data.description}, Valor: R$ ${data.amount}, Sócio: ${data.partner_id}` : 'Transação tx-init-2 inválida ou ausente'
    });
  } catch (e: any) {
    results.push({
      id: 5,
      description: 'Buscar tx-init-2 (Aporte Gabriel R$ 605,00)',
      passed: false,
      details: 'Falha na consulta remota',
      error: e.message
    });
  }

  // 6. Confirmar 2 transações
  let currentTx: PartnerTransaction[] = [];
  try {
    currentTx = await fetchPartnerTransactions(DEFAULT_COMPANY_ID);
    const ok = currentTx.length === 2 && currentTx.some(t => t.id === 'tx-init-1') && currentTx.some(t => t.id === 'tx-init-2');
    results.push({
      id: 6,
      description: 'Confirmar exatamente 2 transações societárias',
      passed: ok,
      details: `Total de transações: ${currentTx.length} (${currentTx.map(t => t.id).join(', ')})`
    });
  } catch (e: any) {
    results.push({
      id: 6,
      description: 'Confirmar exatamente 2 transações societárias',
      passed: false,
      details: 'Erro ao listar transações',
      error: e.message
    });
  }

  // Cálculos do Cap Table
  const partnersList = await fetchPartners(DEFAULT_COMPANY_ID);
  const finOverview = calculatePartnersFinancials({
    partners: partnersList,
    transactions: currentTx,
    orders: [],
    products: [],
    persistedCosts: {},
    operationalExpenses: 0
  });

  const eduardoMetric = finOverview.partnerMetrics.find(m => m.partner.id === 'p1-eduardo');
  const gabrielMetric = finOverview.partnerMetrics.find(m => m.partner.id === 'p2-gabriel');

  const totalCapital = finOverview.totalNetCapitalInvested;
  const eduardoCapital = eduardoMetric?.netCapitalInvested ?? 0;
  const gabrielCapital = gabrielMetric?.netCapitalInvested ?? 0;
  const eduardoEquity = eduardoMetric?.equityPercentage ?? 0;
  const gabrielEquity = gabrielMetric?.equityPercentage ?? 0;

  // 7. Confirmar R$ 1.105,00 total
  const okTotal = Math.abs(totalCapital - 1105.00) < 0.01;
  results.push({
    id: 7,
    description: 'Confirmar Capital Total = R$ 1.105,00',
    passed: okTotal,
    details: `Capital total apurado: R$ ${totalCapital.toFixed(2)} (Esperado: R$ 1.105,00)`
  });

  // 8. Confirmar Eduardo = R$ 500,00
  const okEduardoCap = Math.abs(eduardoCapital - 500.00) < 0.01;
  results.push({
    id: 8,
    description: 'Confirmar Capital Eduardo = R$ 500,00',
    passed: okEduardoCap,
    details: `Capital líquido apurado: R$ ${eduardoCapital.toFixed(2)} (Esperado: R$ 500,00)`
  });

  // 9. Confirmar Gabriel = R$ 605,00
  const okGabrielCap = Math.abs(gabrielCapital - 605.00) < 0.01;
  results.push({
    id: 9,
    description: 'Confirmar Capital Gabriel = R$ 605,00',
    passed: okGabrielCap,
    details: `Capital líquido apurado: R$ ${gabrielCapital.toFixed(2)} (Esperado: R$ 605,00)`
  });

  // 10. Confirmar equity = 45,25% / 54,75%
  const okEquity = Math.abs(eduardoEquity - 45.2488) < 0.01 && Math.abs(gabrielEquity - 54.7511) < 0.01;
  results.push({
    id: 10,
    description: 'Confirmar Equity = 45,25% / 54,75%',
    passed: okEquity,
    details: `Eduardo: ${eduardoEquity.toFixed(2)}% (esperado: 45,25%), Gabriel: ${gabrielEquity.toFixed(2)}% (esperado: 54,75%), Soma: ${(eduardoEquity + gabrielEquity).toFixed(2)}%`
  });

  // 11. Criar parceiro TESTE no Supabase
  try {
    const created = await createPartner({
      companyId: DEFAULT_COMPANY_ID,
      name: '__TESTE_SOCIO_TEMPORARIO__',
      role: 'Sócio Teste',
      avatarColor: '#f59e0b',
      notes: 'Registro efêmero de validação do Bloco 8'
    });
    testPartnerId = created.id;
    const ok = !!testPartnerId && created.name === '__TESTE_SOCIO_TEMPORARIO__';
    results.push({
      id: 11,
      description: 'Criar parceiro TESTE no Supabase',
      passed: ok,
      details: ok ? `Criado com sucesso (id: ${testPartnerId})` : 'Falha na criação'
    });
  } catch (e: any) {
    results.push({
      id: 11,
      description: 'Criar parceiro TESTE no Supabase',
      passed: false,
      details: 'Exceção na criação do sócio teste',
      error: e.message
    });
  }

  // 12. Atualizar parceiro TESTE
  try {
    if (!testPartnerId) throw new Error('Parceiro de teste não disponível');
    const updated = await updatePartner(testPartnerId, {
      role: 'Sócio Teste Atualizado',
      notes: 'Atualizado com sucesso na bateria'
    });
    results.push({
      id: 12,
      description: 'Atualizar parceiro TESTE',
      passed: updated,
      details: updated ? `Sócio ${testPartnerId} atualizado com sucesso` : 'Falha no update'
    });
  } catch (e: any) {
    results.push({
      id: 12,
      description: 'Atualizar parceiro TESTE',
      passed: false,
      details: 'Exceção ao atualizar sócio teste',
      error: e.message
    });
  }

  // 13. Criar transação TESTE
  try {
    if (!testPartnerId) throw new Error('Parceiro de teste não disponível');
    const createdTx = await createPartnerTransaction({
      companyId: DEFAULT_COMPANY_ID,
      partnerId: testPartnerId,
      partnerName: '__TESTE_SOCIO_TEMPORARIO__',
      type: 'APORTE',
      amount: 150.00,
      description: '__TESTE_APORTE_TEMPORARIO__',
      destinationCategory: 'ESTOQUE'
    });
    testTxId = createdTx.id;
    const ok = !!testTxId && Number(createdTx.amount) === 150;
    results.push({
      id: 13,
      description: 'Criar transação TESTE',
      passed: ok,
      details: ok ? `Transação criada com sucesso (id: ${testTxId}, valor: R$ 150,00)` : 'Falha ao criar transação teste'
    });
  } catch (e: any) {
    results.push({
      id: 13,
      description: 'Criar transação TESTE',
      passed: false,
      details: 'Exceção ao criar transação teste',
      error: e.message
    });
  }

  // 14. Ler transação TESTE
  try {
    if (!testTxId) throw new Error('Transação de teste não disponível');
    const { data, error } = await supabase
      .from('smoking_partner_transactions')
      .select('*')
      .eq('id', testTxId)
      .maybeSingle();

    if (error) throw error;
    const ok = !!data && Number(data.amount) === 150 && data.description === '__TESTE_APORTE_TEMPORARIO__';
    results.push({
      id: 14,
      description: 'Ler transação TESTE no Supabase',
      passed: ok,
      details: ok ? `Lida com sucesso no banco: ${data.description} (R$ ${data.amount})` : 'Transação não encontrada ou divergente'
    });
  } catch (e: any) {
    results.push({
      id: 14,
      description: 'Ler transação TESTE no Supabase',
      passed: false,
      details: 'Exceção ao ler transação teste',
      error: e.message
    });
  }

  // 15. Excluir transação TESTE
  try {
    if (!testTxId) throw new Error('Transação de teste não disponível');
    await deletePartnerTransaction(testTxId);
    const { data: checkDeleted } = await supabase
      .from('smoking_partner_transactions')
      .select('id')
      .eq('id', testTxId)
      .maybeSingle();

    const ok = !checkDeleted;
    results.push({
      id: 15,
      description: 'Excluir transação TESTE',
      passed: ok,
      details: ok ? `Transação ${testTxId} removida com sucesso (0 resíduos)` : 'Transação ainda existe após delete'
    });
  } catch (e: any) {
    results.push({
      id: 15,
      description: 'Excluir transação TESTE',
      passed: false,
      details: 'Exceção ao excluir transação teste',
      error: e.message
    });
  }

  // 16. Excluir parceiro TESTE
  try {
    if (!testPartnerId) throw new Error('Parceiro de teste não disponível');
    await deletePartner(testPartnerId);
    const { data: checkDeleted } = await supabase
      .from('smoking_partners')
      .select('id')
      .eq('id', testPartnerId)
      .maybeSingle();

    const ok = !checkDeleted;
    results.push({
      id: 16,
      description: 'Excluir parceiro TESTE',
      passed: ok,
      details: ok ? `Sócio ${testPartnerId} removido com sucesso (0 resíduos)` : 'Sócio ainda existe após delete'
    });
  } catch (e: any) {
    results.push({
      id: 16,
      description: 'Excluir parceiro TESTE',
      passed: false,
      details: 'Exceção ao excluir sócio teste',
      error: e.message
    });
  }

  // 17. Confirmar que não restou nenhum registro TESTE
  try {
    const { data: residualPartners } = await supabase
      .from('smoking_partners')
      .select('id, name')
      .ilike('name', '%__TESTE%');

    const { data: residualTx } = await supabase
      .from('smoking_partner_transactions')
      .select('id, description')
      .ilike('description', '%__TESTE%');

    const resPartCount = residualPartners?.length ?? 0;
    const resTxCount = residualTx?.length ?? 0;
    const ok = resPartCount === 0 && resTxCount === 0;

    results.push({
      id: 17,
      description: 'Confirmar zero resíduos de registros TESTE',
      passed: ok,
      details: ok ? 'Limpeza confirmada: 0 parceiros residuais, 0 transações residuais' : `Resíduos encontrados: ${resPartCount} sócios, ${resTxCount} txs`
    });
  } catch (e: any) {
    results.push({
      id: 17,
      description: 'Confirmar zero resíduos de registros TESTE',
      passed: false,
      details: 'Erro ao verificar resíduos',
      error: e.message
    });
  }

  // 18. Confirmar que Eduardo/Gabriel continuam intactos
  try {
    const finalPartners = await fetchPartners(DEFAULT_COMPANY_ID);
    const finalTx = await fetchPartnerTransactions(DEFAULT_COMPANY_ID);

    const activeFinal = finalPartners.filter(p => p.is_active !== false);
    const hasEdu = activeFinal.some(p => p.id === 'p1-eduardo' && p.name === 'Eduardo');
    const hasGab = activeFinal.some(p => p.id === 'p2-gabriel' && p.name === 'Gabriel');

    const hasTx1 = finalTx.some(t => t.id === 'tx-init-1' && Number(t.amount) === 500);
    const hasTx2 = finalTx.some(t => t.id === 'tx-init-2' && Number(t.amount) === 605);

    const ok = activeFinal.length === 2 && finalTx.length === 2 && hasEdu && hasGab && hasTx1 && hasTx2;

    results.push({
      id: 18,
      description: 'Confirmar que Eduardo e Gabriel continuam intactos',
      passed: ok,
      details: ok
        ? 'Confirmado: 2 parceiros (Eduardo R$ 500,00, Gabriel R$ 605,00) e 2 transações preservadas'
        : 'Inconsistência nos registros originais de Eduardo/Gabriel'
    });
  } catch (e: any) {
    results.push({
      id: 18,
      description: 'Confirmar que Eduardo e Gabriel continuam intactos',
      passed: false,
      details: 'Erro na verificação de integridade final',
      error: e.message
    });
  }

  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;
  const allPassed = failedTests === 0;

  const report: PartnersTestSuiteReport = {
    timestamp: new Date().toISOString(),
    authenticatedUser: userEmail,
    companyId: DEFAULT_COMPANY_ID,
    totalTests: results.length,
    passedTests,
    failedTests,
    allPassed,
    capTable: {
      totalCapital,
      eduardoCapital,
      eduardoEquityPct: `${eduardoEquity.toFixed(2)}%`,
      gabrielCapital,
      gabrielEquityPct: `${gabrielEquity.toFixed(2)}%`,
      isBalanced: finOverview.isCapTableBalanced
    },
    results
  };

  console.log('\n========================================================');
  console.log(`🏁 [PartnersTester] RESULTADO: ${allPassed ? '✅ 18/18 TESTES PASSARAM!' : `⚠️ ${passedTests}/${results.length} TESTES PASSARAM`}`);
  console.log(JSON.stringify(report, null, 2));
  console.log('========================================================\n');

  try {
    localStorage.setItem('__bloco8_test_report__', JSON.stringify(report));
    await fetch('/__report__', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
  } catch (e) {}

  return report;
}

if (typeof window !== 'undefined') {
  (window as any).__runPartnersTest = runPartnersValidationSuite;
}
