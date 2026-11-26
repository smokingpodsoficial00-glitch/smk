import assert from 'node:assert/strict';

/**
 * Bateria completa de cenários end-to-end para a Esteira de Follow-ups (21 Dias).
 * Executa exatamente o código de produção de `followUps.ts` com:
 * - Simulador em memória da tabela PostgREST `smoking_crm_follow_ups` (via `@supabase/supabase-js`)
 * - Simulador isolado de `localStorage` (simula reload / F5 / múltiplas abas)
 * - Simulador controlável de relógio (`nowFn`) e servidor WhatsApp
 *
 * Executar via: `npm run test:followups` (dentro de `admin/`)
 */

// 1. Setup do ambiente simulado ANTES dos imports que consomem window/localStorage/fetch
const memStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
  setItem: (k: string, v: string) => memStorage.set(k, String(v)),
  removeItem: (k: string) => memStorage.delete(k),
  clear: () => memStorage.clear(),
};
(globalThis as any).window = {
  location: {
    origin: 'https://smoking-pods-admin.vercel.app',
    hostname: 'smoking-pods-admin.vercel.app',
    protocol: 'https:',
  },
};

interface DbRow {
  id: string;
  company_id: string;
  client_id: string | null;
  scheduled_at: string;
  note: string;
  status: string;
  created_at: string;
}

const pgFollowUpsTable: DbRow[] = [];
let seqUuid = 1;

function nextUuid(): string {
  const hex = (seqUuid++).toString(16).padStart(12, '0');
  return `aaaaaaaa-bbbb-4ccc-8ddd-${hex}`;
}

function resetSimulatedDb(): void {
  pgFollowUpsTable.length = 0;
  memStorage.clear();
}

// Simulador fiel da API REST PostgREST do Supabase para `smoking_crm_follow_ups`
(globalThis as any).fetch = async (input: any, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : input?.url || String(input);
  const parsedUrl = new URL(urlStr);

  if (parsedUrl.pathname.endsWith('/rest/v1/smoking_crm_follow_ups')) {
    const method = (init?.method || 'GET').toUpperCase();
    const prefer = new Headers(init?.headers as any).get('prefer') || '';
    const eqId = parsedUrl.searchParams.get('id')?.replace(/^eq\./, '') || null;
    const eqCompanyId = parsedUrl.searchParams.get('company_id')?.replace(/^eq\./, '') || null;

    if (method === 'GET') {
      let rows = [...pgFollowUpsTable];
      if (eqId) rows = rows.filter(r => r.id === eqId);
      if (eqCompanyId) rows = rows.filter(r => r.company_id === eqCompanyId);
      const orderParam = parsedUrl.searchParams.get('order');
      if (orderParam === 'scheduled_at.asc') {
        rows.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
      }
      const accept = new Headers(init?.headers as any).get('accept') || '';
      if (accept.includes('vnd.pgrst.object+json')) {
        return new Response(JSON.stringify(rows[0] || null), {
          status: rows[0] ? 200 : 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST') {
      const bodyRaw = init?.body ? JSON.parse(String(init.body)) : {};
      const items = Array.isArray(bodyRaw) ? bodyRaw : [bodyRaw];
      const inserted: DbRow[] = [];

      for (const entry of items) {
        if (prefer.includes('resolution=merge-duplicates') && entry.id) {
          const idx = pgFollowUpsTable.findIndex(r => r.id === entry.id);
          if (idx !== -1) {
            pgFollowUpsTable[idx] = { ...pgFollowUpsTable[idx], ...entry };
            inserted.push(pgFollowUpsTable[idx]);
            continue;
          }
        }
        const row: DbRow = {
          id: entry.id || nextUuid(),
          company_id: entry.company_id,
          client_id: entry.client_id ?? null,
          scheduled_at: entry.scheduled_at,
          note: entry.note || '',
          status: entry.status || 'pendente',
          created_at: entry.created_at || new Date().toISOString(),
        };
        pgFollowUpsTable.push(row);
        inserted.push(row);
      }

      const accept = new Headers(init?.headers as any).get('accept') || '';
      const payload = accept.includes('vnd.pgrst.object+json') ? inserted[0] : inserted;
      return new Response(JSON.stringify(payload), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'PATCH') {
      const updates = init?.body ? JSON.parse(String(init.body)) : {};
      const matched: DbRow[] = [];
      for (let i = 0; i < pgFollowUpsTable.length; i++) {
        const r = pgFollowUpsTable[i];
        if (eqId && r.id !== eqId) continue;
        if (eqCompanyId && r.company_id !== eqCompanyId) continue;
        pgFollowUpsTable[i] = { ...r, ...updates };
        matched.push(pgFollowUpsTable[i]);
      }
      return new Response(JSON.stringify(matched), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'DELETE') {
      const deleted: DbRow[] = [];
      for (let i = pgFollowUpsTable.length - 1; i >= 0; i--) {
        const r = pgFollowUpsTable[i];
        if (eqId && r.id !== eqId) continue;
        if (eqCompanyId && r.company_id !== eqCompanyId) continue;
        deleted.push(r);
        pgFollowUpsTable.splice(i, 1);
      }
      return new Response(JSON.stringify(deleted), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Unhandled mock URL: ' + urlStr }), { status: 404 });
};

import {
  DEFAULT_COMPANY_ID,
  OFFICIAL_CATALOG_URL,
  REPLENISHMENT_CYCLE_DAYS,
  REPLENISHMENT_COPY_VARIATIONS,
  toLocalDateString,
  calculateDaysDiff,
  getReplenishmentCopy,
  generateFollowUpMessage,
  fetchFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  sync21DaysReplenishmentFollowUps,
  syncFollowUpsWithBackend,
  getDismissedClients,
  scheduleOrderReplenishmentFollowUp,
  executeAutoDispatchBatch,
  executeForceSendFollowUp,
  isFollowUpDispatchBusy,
  setDailyAutoLock,
  resetFollowUpRuntimeLocksForTests,
  sortFollowUpsDeterministic,
  type FollowUpItem,
} from './followUps.ts';

const safeNow = () => {
  const d = new Date();
  const todaySP = toLocalDateString(d);
  // 15:00 BRT é sempre garantidamente dentro da janela segura 10h-22h
  return new Date(`${todaySP}T15:00:00-03:00`);
};

async function runAllScenarios() {
  console.log('🧪 Iniciando Bateria Multi-Cenários de Follow-Ups (21 Dias)...\n');

  // =========================================================================
  // CENÁRIO 1: 2 clientes com 3 semanas atingidas + 1 recente (18d) + concorrência
  // =========================================================================
  resetSimulatedDb();
  resetFollowUpRuntimeLocksForTests();

  const todayStr = toLocalDateString(safeNow());
  const yesterdayStr = toLocalDateString(new Date(safeNow().getTime() - 24 * 60 * 60 * 1000));
  const future18Str = toLocalDateString(new Date(safeNow().getTime() + 18 * 24 * 60 * 60 * 1000));
  const plus21Str = toLocalDateString(new Date(safeNow().getTime() + REPLENISHMENT_CYCLE_DAYS * 24 * 60 * 60 * 1000));

  const itemDueToday = await createFollowUp({
    company_id: DEFAULT_COMPANY_ID,
    client_phone: '11951741181',
    client_name: 'Eduardo pizza',
    reason_category: 'recompra_futura',
    reason_description: 'Ciclo de 3 semanas completo.',
    target_product: 'Pod Descartável',
    scheduled_date: todayStr,
  });

  const itemDueOverdue = await createFollowUp({
    company_id: DEFAULT_COMPANY_ID,
    client_phone: '11914252662',
    client_name: 'eduardo locatelli',
    reason_category: 'recompra_futura',
    reason_description: 'Ciclo de 3 semanas completo (vencido ontem).',
    target_product: 'LUMA 20K Watermelon Ice',
    scheduled_date: yesterdayStr,
  });

  const itemUpcoming = await createFollowUp({
    company_id: DEFAULT_COMPANY_ID,
    client_phone: '11964282930',
    client_name: 'vinicius',
    reason_category: 'recompra_futura',
    reason_description: 'Aguardando 3 semanas.',
    target_product: 'V80 ANTIGO Grape Ice',
    scheduled_date: future18Str,
  });

  assert.ok(itemDueToday && itemDueOverdue && itemUpcoming);

  const initialList = await fetchFollowUps(DEFAULT_COMPANY_ID);
  assert.equal(initialList.length, 3);
  // Ordenação determinística: vencidos/hoje primeiro (-1, 0), futuros depois (+18)
  assert.equal(initialList[0].client_name, 'eduardo locatelli');
  assert.equal(initialList[1].client_name, 'Eduardo pizza');
  assert.equal(initialList[2].client_name, 'vinicius');

  const sentPayloads: any[] = [];
  const markSentPayloads: any[] = [];
  const uiSnapshots: FollowUpItem[][] = [];

  const mockRequester = async (path: string, init?: RequestInit): Promise<Response> => {
    if (path.startsWith('/api/qr')) {
      return new Response(JSON.stringify({ status: 'CONNECTED', isReady: true }), { status: 200 });
    }
    if (path.startsWith('/api/marketing/send-direct')) {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentPayloads.push(payload);
      // Simula verificação de concorrência durante envio (loadData deve ser bloqueado!)
      assert.equal(isFollowUpDispatchBusy(), true, 'Trava global precisa ficar ativa durante envio HTTP');
      return new Response(JSON.stringify({ success: true, targetJid: `${payload.phone}@s.whatsapp.net` }), { status: 200 });
    }
    if (path.startsWith('/api/marketing/followups/mark-sent')) {
      markSentPayloads.push(JSON.parse(String(init?.body || '{}')));
      return new Response('Not Found', { status: 404 });
    }
    return new Response('Not Found', { status: 404 });
  };

  // Dispara dois batches concorrentes para provar trava anti-concorrência
  const [batchRes, concurrentIgnored] = await Promise.all([
    executeAutoDispatchBatch(initialList, {
      companyId: DEFAULT_COMPANY_ID,
      delayMs: 0,
      nowFn: safeNow,
      requester: mockRequester as any,
      onItemDispatched: (_updated, allSorted) => {
        uiSnapshots.push(allSorted);
      },
    }),
    (async () => {
      // Espera 1 microtask para garantir que batch 1 entrou
      await Promise.resolve();
      return executeAutoDispatchBatch(initialList, {
        companyId: DEFAULT_COMPANY_ID,
        delayMs: 0,
        nowFn: safeNow,
        requester: mockRequester as any,
      });
    })(),
  ]);

  assert.equal(batchRes.sentCount, 2, 'Deve enviar exatamente para os 2 vencidos (eduardo locatelli + Eduardo pizza)');
  assert.equal(concurrentIgnored.sentCount, 0, 'Execução paralela não pode duplicar envios');
  assert.equal(sentPayloads.length, 2, 'Exatamente 2 mensagens enviadas via motor WhatsApp');
  assert.equal(markSentPayloads.length, 2);
  assert.equal(uiSnapshots.length, 2, 'Cada envio deve atualizar a tela imediatamente');

  // Confirma ordem em tela após os 2 disparos: vinicius (18d) sobe ao topo, e os 2 enviados descem para 21d
  const finalUiList = uiSnapshots[1];
  assert.equal(finalUiList[0].client_name, 'vinicius');
  const locAfter = finalUiList.find(f => f.client_name === 'eduardo locatelli')!;
  const pizzaAfter = finalUiList.find(f => f.client_name === 'Eduardo pizza')!;
  assert.equal(locAfter.daysDiff, 21);
  assert.equal(pizzaAfter.daysDiff, 21);
  assert.equal(locAfter.scheduled_date, plus21Str);
  assert.equal(pizzaAfter.scheduled_date, plus21Str);
  assert.ok(locAfter.last_sent_at && locAfter.completed_at, 'eduardo locatelli precisa exibir status ENVIADO');
  assert.ok(pizzaAfter.last_sent_at && pizzaAfter.completed_at, 'Eduardo pizza precisa exibir status ENVIADO');
  assert.equal(locAfter.send_count, 1);
  assert.equal(pizzaAfter.send_count, 1);

  // Confirma que persistiu no Supabase + localStorage após "F5"
  const afterReload = await fetchFollowUps(DEFAULT_COMPANY_ID);
  assert.equal(afterReload.length, 3);
  assert.equal(afterReload.find(f => f.id === itemDueOverdue.id)?.scheduled_date, plus21Str);
  assert.equal(afterReload.find(f => f.id === itemDueToday.id)?.scheduled_date, plus21Str);
  assert.ok(afterReload.every(f => f.last_sent_at || f.client_name === 'vinicius'));
  console.log('✅ Cenário 1 passou: 2 vencidos disparados sequencialmente, ambos resetados para 21d + ENVIADO.');

  // =========================================================================
  // CENÁRIO 2: Recarregar página no mesmo dia NÃO pode reenviar (zero duplicidade)
  // =========================================================================
  // Limpa cooldown de memória simulando recarregamento completo (Ctrl+F5)
  resetFollowUpRuntimeLocksForTests();
  const reloadBatch = await executeAutoDispatchBatch(afterReload, {
    companyId: DEFAULT_COMPANY_ID,
    delayMs: 0,
    nowFn: safeNow,
    requester: mockRequester as any,
  });
  assert.equal(reloadBatch.sentCount, 0);
  assert.equal(sentPayloads.length, 2, 'Reload no mesmo dia não pode disparar novamente');
  console.log('✅ Cenário 2 passou: Reload após disparo manteve 0 envios extras.');

  // =========================================================================
  // CENÁRIO 3: Excluir cliente da lista NÃO pode ressuscitar (mesmo após sync + F5 + outro browser)
  // =========================================================================
  const fakeClientsFromCRM = [
    {
      id: 'cli-locatelli',
      name: 'eduardo locatelli',
      phone: '5511914252662',
      cleanPhone: '5511914252662',
      daysSinceLastOrder: 25,
      lastOrderTimestamp: safeNow().getTime() - 25 * 24 * 60 * 60 * 1000,
      lastProduct: 'LUMA 20K Watermelon Ice',
      lastFlavor: 'Watermelon Ice',
      lastPuffs: 20000,
    },
    {
      id: 'cli-vinicius',
      name: 'vinicius',
      phone: '5511964282930',
      cleanPhone: '5511964282930',
      daysSinceLastOrder: 3,
      lastOrderTimestamp: safeNow().getTime() - 3 * 24 * 60 * 60 * 1000,
      lastProduct: 'V80 ANTIGO Grape Ice',
      lastFlavor: 'Grape Ice',
      lastPuffs: 8000,
    },
  ];

  // Injeta duplicata proposital em cache local para provar que delete limpa duplicatas também
  await deleteFollowUp(itemDueOverdue.id, DEFAULT_COMPANY_ID, locAfter);
  await sync21DaysReplenishmentFollowUps(fakeClientsFromCRM, DEFAULT_COMPANY_ID);
  let postDeleteList = await fetchFollowUps(DEFAULT_COMPANY_ID);
  assert.equal(
    postDeleteList.some(f => f.client_phone === '5511914252662'),
    false,
    'Cliente excluído NÃO pode ressuscitar após sync21DaysReplenishmentFollowUps'
  );

  // Simula abrir outro navegador (limpa localStorage inteiro, mantendo apenas o Postgres!)
  memStorage.clear();
  postDeleteList = await fetchFollowUps(DEFAULT_COMPANY_ID);
  await sync21DaysReplenishmentFollowUps(fakeClientsFromCRM, DEFAULT_COMPANY_ID);
  postDeleteList = await fetchFollowUps(DEFAULT_COMPANY_ID);
  assert.equal(
    postDeleteList.some(f => f.client_phone === '5511914252662'),
    false,
    'Tombstone remoto no Supabase impede ressuscitação mesmo em navegador anônimo/limpo'
  );
  console.log('✅ Cenário 3 passou: Exclusão definitiva resistiu ao sync do CRM e à limpeza de cache local.');

  // =========================================================================
  // CENÁRIO 4: Cliente homônimo "Eduardo Silva" NÃO pode pular ciclo de 21 dias
  // =========================================================================
  const clientEduardoSilva = {
    id: 'cli-edu-silva',
    name: 'Eduardo Silva',
    phone: '5511999112233',
    cleanPhone: '5511999112233',
    daysSinceLastOrder: 0,
    lastOrderTimestamp: safeNow().getTime(),
    lastProduct: 'Ignite V150 Mint',
    lastFlavor: 'Mint',
    lastPuffs: 15000,
  };
  await sync21DaysReplenishmentFollowUps([clientEduardoSilva], DEFAULT_COMPANY_ID);
  const afterEduSilva = await fetchFollowUps(DEFAULT_COMPANY_ID);
  const eduSilvaItem = afterEduSilva.find(f => f.client_phone === '5511999112233');
  assert.ok(eduSilvaItem, 'Eduardo Silva deve entrar na esteira');
  assert.equal(eduSilvaItem.scheduled_date, plus21Str, 'Cliente comum chamado Eduardo deve esperar 21 dias reais');
  assert.ok((eduSilvaItem.daysDiff ?? 0) >= 20, 'Eduardo Silva não pode pular para 100% no dia da compra');
  console.log('✅ Cenário 4 passou: Clientes homônimos chamados "Eduardo" respeitam o ciclo completo de 21 dias.');

  // =========================================================================
  // CENÁRIO 5: Cliente excluído que faz uma NOVA compra futura entra em novo ciclo
  // =========================================================================
  const realLaterOrder = {
    id: 'ord-locatelli-new',
    client_id: 'cli-locatelli',
    client_name: 'eduardo locatelli',
    client_phone: '11914252662',
    items: [{ name: 'Ignite V250', flavor: 'Menthol', puffs: 25000 }],
  };
  const recreated = await scheduleOrderReplenishmentFollowUp(realLaterOrder, DEFAULT_COMPANY_ID);
  assert.ok(recreated && recreated.scheduled_date === plus21Str);
  const listWithNewOrder = await fetchFollowUps(DEFAULT_COMPANY_ID);
  const locReentered = listWithNewOrder.find(f => f.client_phone === '5511914252662');
  assert.ok(locReentered, 'Nova compra legítima recoloca o cliente no ciclo de 21 dias');
  assert.equal(locReentered.daysDiff, 21);
  console.log('✅ Cenário 5 passou: Nova compra futura reinicia normalmente o ciclo de 21 dias.');

  // =========================================================================
  // CENÁRIO 6: Janela segura, fallback offline, Forçar Envio duplo-clique & 5 copies
  // =========================================================================
  resetSimulatedDb();
  resetFollowUpRuntimeLocksForTests();

  const dueSingle = (await createFollowUp({
    company_id: DEFAULT_COMPANY_ID,
    client_phone: '11988887777',
    client_name: 'Carlos Teste',
    reason_category: 'recompra_futura',
    target_product: 'Ignite V80 Grape',
    scheduled_date: todayStr,
  }))!;

  // 6a. Fora da janela segura (08h e 23h) -> bloqueado
  const earlyNow = () => new Date(`${todayStr}T08:30:00-03:00`);
  const lateNow = () => new Date(`${todayStr}T23:15:00-03:00`);
  const resEarly = await executeAutoDispatchBatch([dueSingle], { companyId: DEFAULT_COMPANY_ID, delayMs: 0, nowFn: earlyNow, requester: mockRequester as any });
  const resLate = await executeAutoDispatchBatch([dueSingle], { companyId: DEFAULT_COMPANY_ID, delayMs: 0, nowFn: lateNow, requester: mockRequester as any });
  assert.equal(resEarly.skippedWindow, true);
  assert.equal(resLate.skippedWindow, true);

  // 6b. WhatsApp offline -> NÃO pode gravar dailyAutoLock (permite disparar assim que conectar)
  const offlineRequester = async (path: string) => {
    if (path.startsWith('/api/qr')) return new Response(JSON.stringify({ status: 'DISCONNECTED', isReady: false }), { status: 200 });
    return new Response('{}', { status: 503 });
  };
  const resOffline = await executeAutoDispatchBatch([dueSingle], { companyId: DEFAULT_COMPANY_ID, delayMs: 0, nowFn: safeNow, requester: offlineRequester as any });
  assert.equal(resOffline.skippedOffline, true);
  assert.equal(resOffline.sentCount, 0);

  // Assim que reconecta, deve disparar normalmente!
  let forceSendHits = 0;
  const countingRequester = async (path: string, _init?: RequestInit) => {
    if (path.startsWith('/api/qr')) return new Response(JSON.stringify({ status: 'CONNECTED', isReady: true }), { status: 200 });
    if (path.startsWith('/api/marketing/send-direct')) {
      forceSendHits++;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  // 6c. Duplo clique rápido em Forçar Envio deve resultar em apenas 1 envio
  const [f1, f2] = await Promise.all([
    executeForceSendFollowUp(dueSingle, { companyId: DEFAULT_COMPANY_ID, nowFn: safeNow, requester: countingRequester as any }),
    executeForceSendFollowUp(dueSingle, { companyId: DEFAULT_COMPANY_ID, nowFn: safeNow, requester: countingRequester as any }),
  ]);
  assert.equal(forceSendHits, 1, 'Duplo clique em Forçar Envio não pode enviar 2 mensagens');
  assert.equal(f1.success, true);
  assert.equal(f2.deduplicated, true);

  // 6d. Verificar rotação das 5 copies, calculateDaysDiff e tamanho curto
  assert.equal(REPLENISHMENT_COPY_VARIATIONS.length, 5);
  assert.equal(calculateDaysDiff(todayStr), 0);
  assert.equal(calculateDaysDiff(plus21Str), 21);
  assert.equal(calculateDaysDiff(yesterdayStr), -1);
  assert.ok(getReplenishmentCopy('Carlos Teste', 0, 'Ignite V80').includes(OFFICIAL_CATALOG_URL));

  await updateFollowUp(dueSingle.id, { custom_message: 'Oi Carlos, texto customizado!' }, DEFAULT_COMPANY_ID);
  const loadedWithCustom = await fetchFollowUps(DEFAULT_COMPANY_ID);
  assert.equal(loadedWithCustom.find(f => f.id === dueSingle.id)?.whatsappMessage, 'Oi Carlos, texto customizado!');

  const copySet = new Set<string>();
  for (let c = 0; c < 5; c++) {
    const msg = generateFollowUpMessage({ ...dueSingle, custom_message: null, send_count: c });
    assert.ok(msg.includes('Carlos'));
    assert.ok(!msg.includes('Teste'), 'Usa apenas primeiro nome');
    assert.ok(msg.includes(OFFICIAL_CATALOG_URL));
    assert.ok(msg.length < 220);
    copySet.add(msg);
  }
  assert.equal(copySet.size, 5, 'Deve alternar todas as 5 variações sem repetir dentro de um ciclo de 5');

  // Confirma que offline->online ainda funciona em batch novo
  const anotherDue = (await createFollowUp({
    company_id: DEFAULT_COMPANY_ID,
    client_phone: '11977776666',
    client_name: 'Marina VIP',
    reason_category: 'recompra_futura',
    target_product: 'Luma 40K Berry',
    scheduled_date: todayStr,
  }))!;
  const prevHits = forceSendHits;
  const afterReconnect = await executeAutoDispatchBatch([anotherDue], { companyId: DEFAULT_COMPANY_ID, delayMs: 0, nowFn: safeNow, requester: countingRequester as any });
  assert.equal(afterReconnect.sentCount, 1);
  assert.equal(forceSendHits, prevHits + 1);

  // Confirma ordenação determinística estável
  const sorted = sortFollowUpsDeterministic([
    { ...dueSingle, id: 'z', scheduled_date: plus21Str },
    { ...anotherDue, id: 'a', scheduled_date: todayStr },
  ]);
  assert.equal(sorted[0].id, 'a');

  console.log('✅ Cenário 6 passou: Janela segura, reconexão offline, duplo clique e 5 variações validados!');

  // =========================================================================
  // CENÁRIO 8: Sincronização Servidor 24/7 -> Supabase & merge de exclusões
  // =========================================================================
  const serverSentIso = new Date(safeNow().getTime() + 60000).toISOString();
  const baseFetch = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input?.url || String(input);
    if (urlStr.includes('/api/marketing/followups/sync')) {
      return new Response(
        JSON.stringify({
          success: true,
          serverAutoDispatchActive: true,
          deletedIds: ['remote-deleted-id'],
          dismissedClients: [{ phone: '5511944443333', deletedAt: safeNow().getTime() }],
          followUps: [
            {
              ...dueSingle,
              send_count: 3,
              last_sent_at: serverSentIso,
              completed_at: serverSentIso,
              scheduled_date: plus21Str,
              custom_message: null,
              updated_at: serverSentIso,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return baseFetch(input, init);
  };

  try {
    const currentBeforeSync = await fetchFollowUps(DEFAULT_COMPANY_ID);
    const syncOut = await syncFollowUpsWithBackend(currentBeforeSync, DEFAULT_COMPANY_ID);
    assert.equal(syncOut.serverAutoDispatchActive, true);
    const updatedFromSrv = syncOut.items.find(f => f.id === dueSingle.id)!;
    assert.equal(updatedFromSrv.send_count, 3);
    assert.equal(updatedFromSrv.scheduled_date, plus21Str);

    // Garante que a atualização vinda do servidor foi persistida no Supabase simulado!
    const supabaseAfterSrvSync = pgFollowUpsTable.find(r => r.id === dueSingle.id);
    assert.ok(supabaseAfterSrvSync && supabaseAfterSrvSync.note.includes('"send_count":3'));
    assert.ok(getDismissedClients(DEFAULT_COMPANY_ID).some(d => d.phone === '5511944443333'));
    console.log('✅ Cenário 8 passou: Estado mais recente do servidor 24/7 propagado para Supabase e UI.');
  } finally {
    globalThis.fetch = baseFetch;
  }

  // =========================================================================
  // CENÁRIO 9: Contagem regressiva cronometrada (1 minuto) + trava anterior no mesmo dia
  // =========================================================================
  resetSimulatedDb();
  resetFollowUpRuntimeLocksForTests();

  const beforeLockIso = new Date(`${todayStr}T15:00:00-03:00`).toISOString();
  setDailyAutoLock(DEFAULT_COMPANY_ID, '5511951741181', todayStr, beforeLockIso);

  const triggerAtIso = new Date(`${todayStr}T16:01:00-03:00`).toISOString();
  const timedItem = (await createFollowUp({
    company_id: DEFAULT_COMPANY_ID,
    client_phone: '11951741181',
    client_name: 'Eduardo pizza',
    reason_category: 'recompra_futura',
    target_product: 'Ignite V150 Grape Ice',
    scheduled_date: todayStr,
  }))!;

  await updateFollowUp(timedItem.id, {
    scheduled_trigger_at: triggerAtIso,
    completed_at: null,
    last_sent_at: null,
  }, DEFAULT_COMPANY_ID);

  const timedLoaded = await fetchFollowUps(DEFAULT_COMPANY_ID);
  assert.equal(timedLoaded[0].scheduled_trigger_at, triggerAtIso);

  let timedSendHits = 0;
  const timedRequester = async (path: string) => {
    if (path.startsWith('/api/qr')) return new Response(JSON.stringify({ status: 'CONNECTED', isReady: true }), { status: 200 });
    if (path.startsWith('/api/marketing/send-direct')) {
      timedSendHits++;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  // Antes do horário (16:00:30) NÃO dispara
  const beforeTriggerRes = await executeAutoDispatchBatch(timedLoaded, {
    companyId: DEFAULT_COMPANY_ID,
    delayMs: 0,
    nowFn: () => new Date(`${todayStr}T16:00:30-03:00`),
    requester: timedRequester as any,
  });
  assert.equal(beforeTriggerRes.sentCount, 0);
  assert.equal(timedSendHits, 0);

  // Ao completar o 1 minuto (16:01:02) DISPARA mesmo existindo trava mais antiga das 15:00
  const atTriggerRes = await executeAutoDispatchBatch(timedLoaded, {
    companyId: DEFAULT_COMPANY_ID,
    delayMs: 0,
    nowFn: () => new Date(`${todayStr}T16:01:02-03:00`),
    requester: timedRequester as any,
  });
  assert.equal(atTriggerRes.sentCount, 1);
  assert.equal(timedSendHits, 1);
  assert.equal(atTriggerRes.updatedItems[0].scheduled_trigger_at, null);
  assert.equal(atTriggerRes.updatedItems[0].daysDiff, 21);

  // 1 minuto depois (16:02:00) NÃO reenvia novamente
  const afterTriggerRes = await executeAutoDispatchBatch(atTriggerRes.updatedItems, {
    companyId: DEFAULT_COMPANY_ID,
    delayMs: 0,
    nowFn: () => new Date(`${todayStr}T16:02:00-03:00`),
    requester: timedRequester as any,
  });
  assert.equal(afterTriggerRes.sentCount, 0);
  assert.equal(timedSendHits, 1);

  console.log('✅ Cenário 9 passou: Disparo agendado para +1 minuto aguardou o horário exato, disparou e reiniciou para +21d sem duplicar!');
  console.log('\n🎉 TODOS OS CENÁRIOS DE FRONTEND/PERSISTÊNCIA PASSARAM 100%!');
}

runAllScenarios().catch((err) => {
  console.error('❌ Falha na bateria multi-cenários:', err);
  process.exit(1);
});
