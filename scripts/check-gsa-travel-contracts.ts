import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { matchRoute } from '../src/routing/routeMatcher';

const root = process.cwd();

function assertRoute(
  path: string,
  expected: { module: string; submodule?: string; itemId?: string },
) {
  const route = matchRoute(path, '', '');
  assert.equal(route.module, expected.module, `${path}: módulo inesperado`);
  assert.equal(route.submodule, expected.submodule, `${path}: submódulo inesperado`);
  assert.equal(route.itemId, expected.itemId, `${path}: item inesperado`);
}

async function assertFileContains(path: string, patterns: string[]) {
  const content = await readFile(resolve(root, path), 'utf8');
  for (const pattern of patterns) {
    assert.ok(content.includes(pattern), `${path}: contrato ausente: ${pattern}`);
  }
}

async function main() {
  assertRoute('/marketplace/menu/pacotes-viagem', {
    module: 'pacotes-viagem',
    submodule: 'home',
  });
  assertRoute('/marketplace/menu/pacotes-viagem/ofertas/nacionais', {
    module: 'pacotes-viagem',
    submodule: 'ofertas-nacionais',
  });
  assertRoute('/marketplace/menu/pacotes-viagem/ofertas/pacote-teste', {
    module: 'pacotes-viagem',
    submodule: 'pacote-detalhe',
    itemId: 'pacote-teste',
  });
  assertRoute('/marketplace/menu/pacotes-viagem/orcamento', {
    module: 'pacotes-viagem',
    submodule: 'orcamento',
  });
  assertRoute('/marketplace/menu/pacotes-viagem/minhas-viagens/transacao-1', {
    module: 'pacotes-viagem',
    submodule: 'minhas-viagens',
    itemId: 'transacao-1',
  });
  assertRoute('/marketplace/menu/pacotes-viagem/documentos', {
    module: 'pacotes-viagem',
    submodule: 'documentos',
  });
  assertRoute('/marketplace/menu/pacotes-viagem/cancelamentos', {
    module: 'pacotes-viagem',
    submodule: 'cancelamentos',
  });
  assertRoute('/marketplace/menu/pacotes-viagem/suporte', {
    module: 'pacotes-viagem',
    submodule: 'suporte',
  });

  await assertFileContains(
    'supabase/migrations/20260720110000_gsa_viagens_custom_session_security.sql',
    [
      'gsa_jwt_session_is_valid',
      'gsa_jwt_actor_id',
      'gsa_jwt_actor_type',
      'Cliente ou visitante insere orcamentos',
      'Operacao GSA gerencia',
    ],
  );

  await assertFileContains(
    'supabase/migrations/20260720120000_fix_gsa_viagens_core_flow.sql',
    [
      'gsa_accept_travel_proposal',
      'gsa_client_checkout_travel',
      'gsa_client_session_actor',
      'p_sessao_id UUID',
      'p_session_token TEXT',
      'ADD COLUMN IF NOT EXISTS pacote_id',
      'ADD COLUMN IF NOT EXISTS forma_pagamento',
    ],
  );

  await assertFileContains(
    'supabase/migrations/20260720123000_gsa_viagens_storage_and_quotes.sql',
    [
      "'viagens-documentos'",
      "'viagens-vouchers'",
      'Cliente ou visitante insere orcamentos',
      'gsa_jwt_session_is_valid',
      'gsa_jwt_actor_id',
      'Cliente baixa vouchers de viagem',
      'Operacao GSA gerencia arquivos de viagem',
    ],
  );

  await assertFileContains(
    'supabase/migrations/20260720130000_gsa_viagens_cancelamento_rpc.sql',
    [
      'gsa_request_travel_cancellation',
      'gsa_client_session_actor',
      'p_sessao_id UUID',
      'p_session_token TEXT',
      "'reembolso_em_analise'",
    ],
  );

  await assertFileContains(
    'src/components/client/marketplace/MarketplaceGSAStore.tsx',
    [
      'TravelCancellationsPage',
      'TravelSupportPage',
      "currentSubmodule === 'documentos'",
      "currentSubmodule === 'cancelamentos'",
      "currentSubmodule === 'suporte'",
    ],
  );

  await assertFileContains(
    'src/components/client/marketplace/travel/TravelReservationPage.tsx',
    ['viagens-documentos', 'viagens-vouchers', 'createSignedUrl'],
  );

  await assertFileContains(
    'src/components/client/marketplace/travel/TravelProposalsPage.tsx',
    ['callClientRpc', 'gsa_accept_travel_proposal'],
  );

  await assertFileContains(
    'src/components/client/marketplace/travel/TravelCancellationsPage.tsx',
    ['callClientRpc', 'gsa_request_travel_cancellation'],
  );

  console.log('GSA Viagens: rotas e contratos críticos validados com sucesso.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
