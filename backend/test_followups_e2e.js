const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smk-followups-test-'));
process.env.SMK_DATA_DIR = tempDataDir;

const {
  app,
  loadMarketingConfig,
  getTenantSession,
  runFollowUpsSchedulerForCompany,
  mergeFollowUpsList,
} = require('./server.js');

async function runBackendE2E() {
  const testCompanyId = 'test_company_e2e_followups';
  const session = getTenantSession(testCompanyId);

  const sentMessages = [];
  const whatsappChecks = [];

  session.isWhatsAppReady = true;
  session.whatsAppSessionState = 'CONNECTED';
  session.sock = {
    onWhatsApp: async (...jids) => {
      whatsappChecks.push(jids);
      return [{ exists: true, jid: jids[0] }];
    },
    sendMessage: async (jid, content) => {
      sentMessages.push({ jid, text: content?.text || '' });
      return { key: { id: 'msg_' + sentMessages.length } };
    },
  };

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    // Usar data fixa no fuso America/Sao_Paulo dentro e fora da janela segura
    const morningNow = new Date('2026-11-26T09:00:00-03:00');
    const afternoonNow = new Date('2026-11-26T15:00:00-03:00');
    const afternoonNextMin = new Date('2026-11-26T15:05:00-03:00');

    const dueItem = {
      id: 'fu-due-1',
      company_id: testCompanyId,
      client_phone: '5511951741181',
      client_name: 'Eduardo pizza',
      reason_category: 'recompra_futura',
      target_product: 'Ignite V150 Grape Ice',
      scheduled_date: '2026-11-25', // vencido
      status: 'pendente',
      send_count: 0,
      custom_message: 'Salve Eduardo! Texto customizado de teste.',
      created_at: '2026-11-20T12:00:00Z',
      updated_at: '2026-11-26T10:00:00Z',
    };

    const futureItem = {
      id: 'fu-future-2',
      company_id: testCompanyId,
      client_phone: '5511964282930',
      client_name: 'vinicius',
      reason_category: 'recompra_futura',
      target_product: 'V80 Grape',
      scheduled_date: '2026-12-14',
      status: 'pendente',
      send_count: 0,
      created_at: '2026-11-24T12:00:00Z',
      updated_at: '2026-11-26T10:00:00Z',
    };

    // 1. POST /api/marketing/followups/sync
    const syncRes = await fetch(`${baseUrl}/api/marketing/followups/sync?companyId=${testCompanyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: testCompanyId,
        followUps: [dueItem, futureItem],
        deletedIds: [],
        dismissedClients: [],
      }),
    });
    assert.equal(syncRes.status, 200);
    const syncData = await syncRes.json();
    assert.equal(syncData.success, true);
    assert.equal(syncData.serverAutoDispatchActive, true);
    assert.equal(syncData.followUps.length, 2);

    // 2. Fora da janela (09:00 BRT) -> não dispara
    const resEarly = await runFollowUpsSchedulerForCompany(testCompanyId, { nowDate: morningNow, delayMs: 0 });
    assert.equal(resEarly.skippedReason, 'outside_window');
    assert.equal(sentMessages.length, 0);

    // 3. Dentro da janela (15:00 BRT) -> dispara somente para o item vencido (fu-due-1)
    const resAfternoon = await runFollowUpsSchedulerForCompany(testCompanyId, { nowDate: afternoonNow, delayMs: 0 });
    assert.equal(resAfternoon.sentCount, 1);
    assert.equal(sentMessages.length, 1);
    assert.equal(whatsappChecks.length >= 1, true, 'Deve resolver JID via onWhatsApp');
    assert.equal(sentMessages[0].jid, '5511951741181@s.whatsapp.net');
    assert.equal(sentMessages[0].text, 'Salve Eduardo! Texto customizado de teste.');

    // Confirma persistência do reset de +21 dias e limpeza de custom_message
    const cfgAfter = loadMarketingConfig(testCompanyId);
    const updatedDue = cfgAfter.followUps.find(f => f.id === 'fu-due-1');
    assert.ok(updatedDue);
    assert.equal(updatedDue.scheduled_date, '2026-12-17'); // 2026-11-26 + 21d
    assert.equal(updatedDue.send_count, 1);
    assert.equal(updatedDue.custom_message, null, 'custom_message deve resetar após envio automático para rotacionar copies no próximo ciclo');
    assert.ok(updatedDue.last_sent_at);

    // 4. Segunda execução 5 min depois NÃO pode reenviar (idempotency + 12h + scheduled_date)
    const resRepeat = await runFollowUpsSchedulerForCompany(testCompanyId, { nowDate: afternoonNextMin, delayMs: 0 });
    assert.equal(resRepeat.sentCount, 0);
    assert.equal(sentMessages.length, 1);

    // 5. Excluir cliente via DELETE e tentar ressuscitar via sync com lista velha -> bloqueado!
    const delRes = await fetch(`${baseUrl}/api/marketing/followups/fu-future-2?companyId=${testCompanyId}&phone=5511964282930`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);

    const staleSyncRes = await fetch(`${baseUrl}/api/marketing/followups/sync?companyId=${testCompanyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: testCompanyId,
        followUps: [dueItem, futureItem], // aba desatualizada reenvia fu-future-2 e fu-due-1 antigo
        deletedIds: [],
        dismissedClients: [],
      }),
    });
    const staleSyncData = await staleSyncRes.json();
    assert.equal(staleSyncData.followUps.some(f => f.id === 'fu-future-2'), false, 'Excluído não pode ressuscitar no sync do servidor');
    const syncedDue = staleSyncData.followUps.find(f => f.id === 'fu-due-1');
    assert.equal(syncedDue.scheduled_date, '2026-12-17', 'Dados mais novos do servidor devem vencer payload antigo do cliente');
    assert.equal(syncedDue.send_count, 1);

    // 6. GET /api/marketing/followups + POST /api/marketing/followups/mark-sent
    const markRes = await fetch(`${baseUrl}/api/marketing/followups/mark-sent?companyId=${testCompanyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: testCompanyId,
        id: 'fu-due-1',
        send_count: 2,
        scheduled_date: '2027-01-07',
      }),
    });
    assert.equal(markRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/marketing/followups?companyId=${testCompanyId}`);
    const getData = await getRes.json();
    assert.equal(getData.followUps.find(f => f.id === 'fu-due-1').send_count, 2);
    assert.equal(getData.dismissedClients.some(d => d.phone === '5511964282930'), true);

    // 7. Valida mergeFollowUpsList contra payload com deleted_at
    const mergedClean = mergeFollowUpsList(
      [],
      [{ ...dueItem, deleted_at: '2026-11-26T18:00:00Z' }],
      [],
      []
    );
    assert.equal(mergedClean.length, 0);

    console.log('✅ Cenário 7 (Backend HTTP + Scheduler 24/7 E2E) passou 100%!');
  } finally {
    await new Promise(resolve => server.close(resolve));
    try {
      fs.rmSync(tempDataDir, { recursive: true, force: true });
    } catch {}
  }
}

runBackendE2E().catch((err) => {
  console.error('❌ Falha no E2E do backend:', err);
  process.exit(1);
});
