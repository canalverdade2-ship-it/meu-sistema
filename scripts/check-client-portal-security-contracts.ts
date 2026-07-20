import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', 'playwright-report', 'test-results']);
const textExtensions = new Set([
  '.cjs', '.js', '.mjs', '.ts', '.tsx', '.json', '.sql', '.md', '.yml', '.yaml', '.env', '.example', '.txt',
]);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertContains(relativePath: string, expected: string[]): void {
  const content = read(relativePath);
  for (const value of expected) {
    if (!content.includes(value)) {
      throw new Error(`${relativePath}: contrato ausente: ${value}`);
    }
  }
}

function walk(directory: string, output: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, output);
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (textExtensions.has(extension) || entry.name.startsWith('.env')) output.push(absolutePath);
  }
  return output;
}

const leakedConnectionFiles: string[] = [];
const publicSqlExecutorFiles: string[] = [];

for (const absolutePath of walk(root)) {
  const relativePath = path.relative(root, absolutePath);
  const content = fs.readFileSync(absolutePath, 'utf8');

  if (/postgresql:\/\/postgres:[^\s"']+@/i.test(content)) {
    leakedConnectionFiles.push(relativePath);
  }

  if (/\.rpc\(\s*['"]execute_sql['"]/i.test(content)) {
    publicSqlExecutorFiles.push(relativePath);
  }
}

if (leakedConnectionFiles.length > 0) {
  throw new Error(`Conexão PostgreSQL com senha embutida encontrada em: ${leakedConnectionFiles.join(', ')}`);
}

if (publicSqlExecutorFiles.length > 0) {
  throw new Error(`Uso frontend de execute_sql encontrado em: ${publicSqlExecutorFiles.join(', ')}`);
}

assertContains('apply_pg_migration.cjs', [
  'process.env.SUPABASE_DB_URL',
  'SUPABASE_DB_URL não configurada',
]);

assertContains('src/lib/logService.ts', [
  "import { sessionService } from './sessionService'",
  'sessionService.getCurrentSession()',
]);

assertContains('src/hooks/useAutoLogout.ts', [
  'Promise.resolve(onLogout())',
  'evitando duas chamadas concorrentes',
]);

assertContains('src/lib/clientOperationalWrite.ts', [
  "sessionData.atorTipo !== 'cliente'",
  'void clienteId',
]);

assertContains('src/lib/supabase.ts', [
  "const PRIVATE_CLIENT_BUCKET = 'documentos_cliente'",
  'MAX_CLIENT_FILE_SIZE',
  'storage://',
]);

assertContains('src/lib/privateStorage.ts', [
  "export const CLIENT_DOCUMENT_BUCKET = 'documentos_cliente'",
  'CLIENT_DOCUMENT_PREFIX',
  'createSignedUrl',
  '/storage/v1/object/public/',
]);

assertContains('src/contexts/FileViewerContext.tsx', [
  'resolvePrivateFileReference',
  'Não foi possível autorizar o acesso ao arquivo',
]);

assertContains('supabase/migrations/20260720200600_secure_client_portal_critical_flows.sql', [
  "p.proname = 'execute_sql'",
  'gsa_client_process_scheduled_credit_release',
]);

assertContains('supabase/migrations/20260720201000_schedule_and_guard_store_credit_release.sql', [
  'gsa_process_due_store_credit_releases',
  'gsa_guard_client_credit_limits',
  'cron.schedule',
]);

assertContains('supabase/migrations/20260720201100_compat_secure_legacy_credit_release.sql', [
  'gsa_guard_client_credit_limits',
  'gsa_guard_duplicate_client_credit_movement',
  'gsa_guard_duplicate_client_credit_notification',
]);

assertContains('supabase/migrations/20260720202000_revoke_client_sessions_on_access_change.sql', [
  'gsa_revoke_client_sessions_on_access_change',
  "SET status = 'encerrado'",
  "to_jsonb(NEW) ->> 'bloqueado'",
]);

assertContains('supabase/migrations/20260720203000_private_client_documents_storage.sql', [
  "SET public = false",
  'GSA acessa documentos privados do cliente',
  "string_to_array(name, '/')",
]);

assertContains('supabase/migrations/20260720204000_harden_client_operational_permissions.sql', [
  "p.proname = 'cliente_operational_write'",
  'gsa_guard_client_notification_insert',
  'GRANT EXECUTE ON FUNCTION',
]);

assertContains('supabase/migrations/20260720205000_optional_client_block_state_compat.sql', [
  'gsa_client_record_is_blocked',
  'gsa_release_due_store_credit_for_client',
  'to_jsonb(v_cliente)',
  'to_jsonb(OLD)',
]);

console.log('Contratos críticos de segurança do painel do cliente validados.');
