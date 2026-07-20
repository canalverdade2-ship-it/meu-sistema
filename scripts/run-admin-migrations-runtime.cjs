const { readFileSync, writeFileSync, unlinkSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const sourcePath = resolve(process.cwd(), 'scripts/check-admin-migrations-runtime.cjs');
const generatedPath = resolve(process.cwd(), 'scripts/.check-admin-migrations-runtime.generated.cjs');
const source = readFileSync(sourcePath, 'utf8');

const marker = "const migrations = [\n";
const hardeningEntry = "  'supabase/migrations/20260720234500_admin_identity_permissions_hardening.sql',\n";
const extensionsEntry = "  'supabase/migrations/20260720235450_enable_admin_extensions.sql',\n";
const hashEntry = "  'supabase/migrations/20260721003000_hash_collaborator_credentials.sql',\n";

for (const required of [marker, hardeningEntry, extensionsEntry, hashEntry]) {
  if (!source.includes(required)) {
    throw new Error(`Não foi possível localizar a âncora da sequência de migrations: ${required.trim()}`);
  }
}

let generated = source.replace(
  marker,
  `${marker}  'supabase/migrations/20260720234400_admin_security_baseline_compat.sql',\n`,
);

generated = generated.replace(
  hardeningEntry,
  `${hardeningEntry}  'supabase/migrations/20260720235300_admin_security_state_restore.sql',\n`,
);

generated = generated.replace(
  extensionsEntry,
  `  'supabase/migrations/20260720235425_admin_protection_schema_compat.sql',\n${extensionsEntry}`,
);

generated = generated.replace(
  hashEntry,
  `${hashEntry}  'supabase/migrations/20260721003500_ticket_status_compat.sql',\n  'supabase/migrations/20260721003600_minimize_admin_dashboard_payload.sql',\n  'supabase/migrations/20260721003700_sensitive_admin_audit_triggers.sql',\n  'supabase/migrations/20260721003800_admin_session_token_validation_compat.sql',\n`,
);

writeFileSync(generatedPath, generated);
try {
  const result = spawnSync(process.execPath, [generatedPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
} finally {
  try { unlinkSync(generatedPath); } catch { /* arquivo temporário já removido */ }
}
