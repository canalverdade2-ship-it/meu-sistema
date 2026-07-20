import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

async function read(path: string) {
  return readFile(resolve(root, path), 'utf8');
}

async function assertContains(path: string, patterns: string[]) {
  const content = await read(path);
  for (const pattern of patterns) {
    assert.ok(content.includes(pattern), `${path}: contrato ausente: ${pattern}`);
  }
  return content;
}

async function assertExcludes(path: string, patterns: string[]) {
  const content = await read(path);
  for (const pattern of patterns) {
    assert.ok(!content.includes(pattern), `${path}: padrão proibido presente: ${pattern}`);
  }
}

async function main() {
  const hardening = await assertContains(
    'supabase/migrations/20260720235900_provider_portal_audit_hardening.sql',
    [
      'gsa_assert_current_provider_any_status',
      "COALESCE(v_status, '') <> 'ativo'",
      'gsa_provider_create_ticket',
      'gsa_provider_send_ticket_message',
      'gsa_provider_request_profile_change',
      'gsa_provider_request_demand_support',
      'gsa_provider_dashboard_snapshot',
      'gsa_provider_pendency_snapshot',
      'pg_advisory_xact_lock',
      'AND data_inicio <= now()',
      'data_inicio IS NULL OR data_inicio <= current_date',
      "v_link !~* '^https?://",
      'gsa_provider_audit_events',
      "gsa_admin_has_module('cadastro')",
      "gsa_admin_has_module('atendimento')",
      "gsa_admin_has_module('operacoes')",
    ],
  );
  assert.ok(
    hardening.indexOf('gsa_assert_current_provider_any_status') < hardening.indexOf('gsa_assert_current_provider()'),
    'A validação de qualquer status deve existir antes da validação de prestador ativo.',
  );

  await assertContains(
    'supabase/migrations/20260720235910_provider_portal_runtime_guards.sql',
    [
      'gsa_guard_provider_direct_insert',
      'gsa_provider_legacy_insert_event',
      'gsa_provider_suppress_duplicate_os_note',
      "TG_TABLE_NAME = 'notificacoes'",
      'RETURN NULL',
      "(storage.foldername(name))[2] = 'documentos'",
    ],
  );

  await assertContains(
    'supabase/migrations/20260720235920_provider_portal_event_contracts.sql',
    [
      "v_notification_action := 'prestador_saque_solicitado'",
      "v_notification_action := 'voucher_resgate_solicitado'",
      "v_notification_action := 'premio_resgate_solicitado'",
      "v_notification_action := 'prestador_promocao_ativada'",
      "v_notification_action := 'demanda_entregue'",
      "v_notification_action := 'demanda_recusada'",
      "v_notification_action := 'demanda_transferida'",
    ],
  );

  await assertContains('src/lib/providerOperations.ts', [
    'gsa_provider_dashboard_snapshot',
    'gsa_provider_pendency_snapshot',
    'gsa_provider_create_ticket',
    'gsa_provider_send_ticket_message',
    'gsa_provider_request_profile_change',
    'gsa_provider_request_demand_support',
  ]);

  await assertContains('src/lib/providerStorage.ts', [
    'ALLOWED_EXTENSIONS',
    '!file.type',
    'file.size <= 0',
    'application/msword',
  ]);

  await assertContains('src/hooks/useProviderNotifications.tsx', [
    '120_000',
    'pendencySnapshot()',
    'destinatario_tipo=in.(broadcast_prestadores,broadcast_todos)',
  ]);

  await assertContains('src/pages/Prestador/PrestadorDashboard.tsx', [
    'dashboardSnapshot()',
    'requestProfileChange',
    'createTicket(',
  ]);
  await assertExcludes('src/pages/Prestador/PrestadorDashboard.tsx', [
    "from('tickets').insert",
    "from('prestador_demandas').select('status')",
    'createNotification(',
  ]);

  await assertContains('src/components/prestador/PrestadorSuporte.tsx', [
    'providerOperations.createTicket',
    'providerOperations.sendTicketMessage',
    'removeProviderPrivateFile',
    '.limit(100)',
    '.limit(200)',
  ]);
  await assertExcludes('src/components/prestador/PrestadorSuporte.tsx', [
    "from('tickets').insert",
    "from('ticket_mensagens').insert",
    'notificationService.notifyAdmin',
  ]);

  await assertContains('src/components/prestador/PrestadorDemandas.tsx', [
    'providerOperations.requestDemandSupport',
    "transitionDemand(selected.id, 'deliver'",
    "transitionDemand(selected.id, 'return'",
    '.limit(100)',
    '.limit(200)',
  ]);
  await assertExcludes('src/components/prestador/PrestadorDemandas.tsx', [
    "from('prestador_suporte_demandas').insert",
    "from('os_notas').insert",
    'notificationService.notifyAdmin',
  ]);

  await assertContains('src/components/prestador/PrestadorDocumentos.tsx', [
    'previousReferences',
    'removeProviderPrivateFile',
    '.limit(100)',
  ]);
  await assertContains('src/components/prestador/PrestadorPromocoes.tsx', [
    'notStarted',
    '.limit(100)',
  ]);

  console.log('Painel do Prestador: contratos de autorização, transação, Storage, suporte, demandas e desempenho validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
