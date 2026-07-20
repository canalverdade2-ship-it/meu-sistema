import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

async function file(path: string) {
  return readFile(resolve(root, path), 'utf8');
}

async function includes(path: string, patterns: string[]) {
  const content = await file(path);
  for (const pattern of patterns) {
    assert.ok(content.includes(pattern), `${path}: contrato ausente: ${pattern}`);
  }
}

async function excludes(path: string, patterns: string[]) {
  const content = await file(path);
  for (const pattern of patterns) {
    assert.ok(!content.includes(pattern), `${path}: padrão inseguro ainda presente: ${pattern}`);
  }
}

async function main() {
  await includes('supabase/migrations/20260720233000_provider_portal_audit_hardening.sql', [
    'gsa_provider_context',
    "p_require_active AND COALESCE(v_provider.status, '') <> 'ativo'",
    'gsa_guard_provider_direct_write',
    'gsa_provider_create_ticket',
    'gsa_provider_send_ticket_message',
    'gsa_provider_request_demand_support',
    'pg_advisory_xact_lock',
    "NEW.link_resultado !~* '^https?://'",
    "v_promotion.data_inicio > current_date",
    "public.gsa_admin_has_module('operacoes')",
    "public.gsa_admin_has_module('atendimento')",
    'gsa_provider_audit_events',
  ]);

  await includes('supabase/migrations/20260720233100_provider_portal_secure_snapshots.sql', [
    'gsa_provider_pendency_snapshot',
    'moduleDemandasAbertas',
  ]);

  await includes('src/lib/providerOperations.ts', [
    'gsa_provider_dashboard_snapshot',
    'gsa_provider_pendency_snapshot',
    'gsa_provider_create_ticket',
    'gsa_provider_send_ticket_message',
    'gsa_provider_request_profile_change',
    'gsa_provider_request_demand_support',
  ]);

  await excludes('src/pages/Prestador/PrestadorDashboard.tsx', [
    ".from('tickets').insert",
    "createNotification(null",
  ]);
  await excludes('src/components/prestador/PrestadorSuporte.tsx', [
    ".from('ticket_mensagens').insert",
    ".from('tickets').insert",
    'notificationService.notifyAdmin',
  ]);
  await excludes('src/components/prestador/PrestadorDemandas.tsx', [
    ".from('prestador_suporte_demandas').insert",
    ".from('os_notas').insert",
    'notificationService.notifyAdmin',
  ]);

  await includes('src/lib/providerStorage.ts', [
    "if (!file.type || !allowed.includes(file.type) || !allowedExtensions.has(extension))",
    'file.size <= 0',
  ]);
  await includes('src/hooks/useProviderNotifications.tsx', [
    'const HEARTBEAT_INTERVAL_MS = 60_000;',
    'providerOperations.pendencySnapshot',
    'destinatario_tipo=in.(broadcast_prestadores,broadcast_todos)',
  ]);

  console.log('Painel do Prestador: contratos de autorização, transação, privacidade e desempenho aprovados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
