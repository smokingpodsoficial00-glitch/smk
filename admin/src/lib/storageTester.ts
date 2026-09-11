import { supabase } from './supabase';

export interface StorageTestReport {
  timestamp: string;
  authenticatedUser: string | null;
  productsTest: {
    bucket: string;
    uploadAccepted: boolean;
    objectExists: boolean;
    publicUrl: string;
    publicReadStatus: number;
    publicReadOk: boolean;
    updateAccepted: boolean;
    removed: boolean;
    removalConfirmed: boolean;
    error?: string;
  };
  storeAssetsTest: {
    bucket: string;
    uploadAccepted: boolean;
    objectExists: boolean;
    publicUrl: string;
    publicReadStatus: number;
    publicReadOk: boolean;
    updateAccepted: boolean;
    removed: boolean;
    removalConfirmed: boolean;
    error?: string;
  };
  allPassed: boolean;
}

export async function runStorageValidationSuite(): Promise<StorageTestReport> {
  console.log('🚀 [StorageTester] Iniciando validação do Supabase Storage...');

  const { data: { session } } = await supabase.auth.getSession();
  const userEmail = session?.user?.email || null;
  console.log(`👤 [StorageTester] Sessão atual: ${userEmail || 'Não autenticado'}`);

  // 1. TESTE PRODUCTS
  const prodFileName = '__TESTE_MIGRACAO_STORAGE_PRODUCTS__.txt';
  const prodContent = `Validação Storage Products — Timestamp: ${new Date().toISOString()}`;
  const prodBlob = new Blob([prodContent], { type: 'text/plain' });

  const productsReport: StorageTestReport['productsTest'] = {
    bucket: 'products',
    uploadAccepted: false,
    objectExists: false,
    publicUrl: '',
    publicReadStatus: 0,
    publicReadOk: false,
    updateAccepted: false,
    removed: false,
    removalConfirmed: false,
  };

  try {
    // 1. Upload
    const { error: upErr } = await supabase.storage
      .from('products')
      .upload(prodFileName, prodBlob, { upsert: true });

    if (upErr) throw upErr;
    productsReport.uploadAccepted = true;
    console.log('✅ [StorageTester] Products: Upload aceito com sucesso.');

    // 2. Confirma existência
    const { data: listData } = await supabase.storage.from('products').list('', { search: prodFileName });
    const exists = !!listData?.some(f => f.name === prodFileName);
    productsReport.objectExists = exists;
    console.log(`✅ [StorageTester] Products: Objeto confirmado na listagem (${exists}).`);

    // 3. Obtém URL Pública
    const { data: urlData } = supabase.storage.from('products').getPublicUrl(prodFileName);
    productsReport.publicUrl = urlData?.publicUrl || '';
    console.log(`🔗 [StorageTester] Products: URL pública obtida: ${productsReport.publicUrl}`);

    // 4. Leitura pública via HTTP GET
    const getRes = await fetch(productsReport.publicUrl, { cache: 'no-store' });
    productsReport.publicReadStatus = getRes.status;
    const bodyText = await getRes.text();
    productsReport.publicReadOk = getRes.status === 200 && bodyText === prodContent;
    console.log(`✅ [StorageTester] Products: Leitura pública HTTP ${getRes.status} (Corpo confere: ${productsReport.publicReadOk}).`);

    // 5. Atualização (UPDATE)
    const updateBlob = new Blob([prodContent + ' [UPDATED]'], { type: 'text/plain' });
    const { error: updateErr } = await supabase.storage
      .from('products')
      .update(prodFileName, updateBlob);
    productsReport.updateAccepted = !updateErr;
    console.log(`✅ [StorageTester] Products: Atualização aceita (${!updateErr}).`);

    // 6. Remoção (DELETE)
    const { error: delErr } = await supabase.storage.from('products').remove([prodFileName]);
    productsReport.removed = !delErr;
    console.log(`✅ [StorageTester] Products: Remoção solicitada (${!delErr}).`);

    // 7. Confirmação de remoção
    const { data: listAfter } = await supabase.storage.from('products').list('', { search: prodFileName });
    const stillExists = !!listAfter?.some(f => f.name === prodFileName);
    productsReport.removalConfirmed = !stillExists;
    console.log(`✅ [StorageTester] Products: Confirmação de remoção concluída (Inexistente: ${!stillExists}).`);
  } catch (e: any) {
    console.error('❌ [StorageTester] Erro no teste do bucket products:', e);
    productsReport.error = e.message;
  }

  // 2. TESTE STORE-ASSETS
  const storeFileName = '__TESTE_MIGRACAO_STORAGE_STORE_ASSETS__.txt';
  const storeContent = `Validação Storage Store Assets — Timestamp: ${new Date().toISOString()}`;
  const storeBlob = new Blob([storeContent], { type: 'text/plain' });

  const storeReport: StorageTestReport['storeAssetsTest'] = {
    bucket: 'store-assets',
    uploadAccepted: false,
    objectExists: false,
    publicUrl: '',
    publicReadStatus: 0,
    publicReadOk: false,
    updateAccepted: false,
    removed: false,
    removalConfirmed: false,
  };

  try {
    // 1. Upload
    const { error: upErr } = await supabase.storage
      .from('store-assets')
      .upload(storeFileName, storeBlob, { upsert: true });

    if (upErr) throw upErr;
    storeReport.uploadAccepted = true;
    console.log('✅ [StorageTester] Store-Assets: Upload aceito com sucesso.');

    // 2. Confirma existência
    const { data: listData } = await supabase.storage.from('store-assets').list('', { search: storeFileName });
    const exists = !!listData?.some(f => f.name === storeFileName);
    storeReport.objectExists = exists;
    console.log(`✅ [StorageTester] Store-Assets: Objeto confirmado na listagem (${exists}).`);

    // 3. Obtém URL Pública
    const { data: urlData } = supabase.storage.from('store-assets').getPublicUrl(storeFileName);
    storeReport.publicUrl = urlData?.publicUrl || '';
    console.log(`🔗 [StorageTester] Store-Assets: URL pública obtida: ${storeReport.publicUrl}`);

    // 4. Leitura pública via HTTP GET
    const getRes = await fetch(storeReport.publicUrl, { cache: 'no-store' });
    storeReport.publicReadStatus = getRes.status;
    const bodyText = await getRes.text();
    storeReport.publicReadOk = getRes.status === 200 && bodyText === storeContent;
    console.log(`✅ [StorageTester] Store-Assets: Leitura pública HTTP ${getRes.status} (Corpo confere: ${storeReport.publicReadOk}).`);

    // 5. Atualização (UPDATE)
    const updateBlob = new Blob([storeContent + ' [UPDATED]'], { type: 'text/plain' });
    const { error: updateErr } = await supabase.storage
      .from('store-assets')
      .update(storeFileName, updateBlob);
    storeReport.updateAccepted = !updateErr;
    console.log(`✅ [StorageTester] Store-Assets: Atualização aceita (${!updateErr}).`);

    // 6. Remoção (DELETE)
    const { error: delErr } = await supabase.storage.from('store-assets').remove([storeFileName]);
    storeReport.removed = !delErr;
    console.log(`✅ [StorageTester] Store-Assets: Remoção solicitada (${!delErr}).`);

    // 7. Confirmação de remoção
    const { data: listAfter } = await supabase.storage.from('store-assets').list('', { search: storeFileName });
    const stillExists = !!listAfter?.some(f => f.name === storeFileName);
    storeReport.removalConfirmed = !stillExists;
    console.log(`✅ [StorageTester] Store-Assets: Confirmação de remoção concluída (Inexistente: ${!stillExists}).`);
  } catch (e: any) {
    console.error('❌ [StorageTester] Erro no teste do bucket store-assets:', e);
    storeReport.error = e.message;
  }

  const allPassed = 
    productsReport.uploadAccepted &&
    productsReport.objectExists &&
    productsReport.publicReadOk &&
    productsReport.updateAccepted &&
    productsReport.removalConfirmed &&
    storeReport.uploadAccepted &&
    storeReport.objectExists &&
    storeReport.publicReadOk &&
    storeReport.updateAccepted &&
    storeReport.removalConfirmed;

  const finalReport: StorageTestReport = {
    timestamp: new Date().toISOString(),
    authenticatedUser: userEmail,
    productsTest: productsReport,
    storeAssetsTest: storeReport,
    allPassed,
  };

  console.log('\n========================================================');
  console.log(`🏁 [StorageTester] RESULTADO FINAL: ${allPassed ? '✅ TODOS OS TESTES PASSARAM!' : '❌ FALHA EM ALGUNS TESTES'}`);
  console.log(JSON.stringify(finalReport, null, 2));
  console.log('========================================================\n');

  return finalReport;
}

if (typeof window !== 'undefined') {
  (window as any).__runStorageTest = runStorageValidationSuite;
}
