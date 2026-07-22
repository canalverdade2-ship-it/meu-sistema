import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(ROOT, relativePath), 'utf8');
}

async function includes(relativePath: string, snippets: string[]) {
  const content = await source(relativePath);
  for (const snippet of snippets) {
    assert.ok(content.includes(snippet), `${relativePath}: contrato ausente: ${snippet}`);
  }
}

async function excludes(relativePath: string, snippets: string[]) {
  const content = await source(relativePath);
  for (const snippet of snippets) {
    assert.ok(!content.includes(snippet), `${relativePath}: padrão proibido encontrado: ${snippet}`);
  }
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(relative));
    else output.push(relative);
  }
  return output;
}

async function assertProviderUiHasNoDirectDatabaseMutation() {
  const files = (await listFiles('src/pages/Prestador'))
    .concat(await listFiles('src/components/prestador'))
    .filter((file) => /\.(ts|tsx)$/.test(file));

  for (const file of files) {
    const content = await source(file);
    const forbidden = [
      /supabase\s*\.\s*from\s*\(/,
      /\.\s*(insert|update|delete|upsert)\s*\(/,
      /supabase\s*\.\s*rpc\s*\(/,
      /supabase\s*\.\s*storage\s*\./,
      /createSignedUrl\s*\(/,
      /createSignedUploadUrl\s*\(/,
    ];
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(content), `${file}: mutação/acesso direto ao Supabase encontrado (${pattern})`);
    }
  }
}

async function main() {
  await includes('src/lib/providerOperations.ts', [
    "callProviderRpc('gsa_provider_dashboard_snapshot'",
    "callProviderRpc('gsa_provider_profile_update'",
    "callProviderRpc('gsa_provider_associate_search'",
    "callProviderRpc('gsa_provider_eligibility_check'",
    "callProviderRpc('gsa_provider_service_record'",
    "callProviderRpc('gsa_provider_service_cancel'",
    "callProviderRpc('gsa_provider_authorization_create'",
    "callProviderRpc('gsa_provider_authorization_check'",
    "callProviderRpc('gsa_provider_claim_create'",
    "callProviderRpc('gsa_provider_claim_cancel'",
    "callProviderRpc('gsa_provider_document_list'",
    "callProviderRpc('gsa_provider_document_metadata_create'",
    "callProviderRpc('gsa_provider_document_delete'",
    "callProviderRpc('gsa_provider_support_create'",
    "callProviderRpc('gsa_provider_support_reply'",
    "callProviderRpc('gsa_provider_support_close'",
    "callProviderRpc('gsa_provider_pendency_snapshot'",
  ]);

  await excludes('src/lib/providerOperations.ts', [
    ".from('",
    '.insert(',
    '.update(',
    '.delete(',
    '.upsert(',
    '.storage.',
  ]);

  await includes('src/lib/providerRpc.ts', [
    'sessionService.restoreSession()',
    "session.atorTipo !== 'prestador'",
    'p_sessao_id: session.sessaoId',
    'p_session_token: session.sessionToken',
  ]);

  await assertProviderUiHasNoDirectDatabaseMutation();

  await includes('src/lib/providerStorage.ts', [
    'PRIVATE_BUCKETS.has(bucket)',
    'normalizeProviderStoragePath',
    "normalized.includes('..')",
    "normalized.includes('//')",
    'UUID_PATTERN.test(providerId)',
    'Math.min(Math.max(expiresInSeconds, 30), 900)',
    "if (!file.type || !allowed.includes(file.type) || !allowedExtensions.has(extension))",
    'file.size <= 0',
  ]);

  await includes('src/hooks/useProviderNotifications.tsx', [
    'const HEARTBEAT_INTERVAL_MS = 60_000;',
    'providerOperations.pendencySnapshot',
    'destinatario_tipo=in.(broadcast_prestadores,broadcast_todos)',
    'provider-scoped-${prestadorId}',
  ]);

  await includes('src/lib/sessionService.ts', [
    "const SESSION_STORAGE_KEY = '_gsa_session';",
    'appMetadata.gsa_session_id !== sessaoId',
    'appMetadata.gsa_actor_type !== atorTipo',
    'appMetadata.gsa_actor_id !== atorId',
    "async loginWithPin(documento: string, pin: string, tipo: 'cliente' | 'prestador' | 'fornecedor')",
    "rpc('gsa_validate_session'",
    "await supabase.auth.signOut({ scope: 'local' })",
  ]);

  await includes('src/lib/supabase.ts', [
    'storage: sessionStorageAdapter',
    'persistSession: true',
    "flowType: 'pkce'",
    'clearLegacySupabaseLocalStorage',
  ]);

  await includes('src/App.tsx', [
    "const PrestadorDashboard = lazy(() => import('./pages/Prestador/PrestadorDashboard')",
    "restored.atorTipo === 'prestador'",
    "readSafeReturnTo(window.location.search, ['/prestador'])",
    '<ProviderNotificationProvider prestadorId={session.prestadorId}>',
  ]);

  await includes('src/routing/routeSecurity.ts', [
    "path.startsWith('/prestador')",
  ]);

  console.log('Contratos críticos de segurança do portal do prestador validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
