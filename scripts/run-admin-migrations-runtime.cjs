const { readFileSync, writeFileSync, unlinkSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const sourcePath = resolve(process.cwd(), 'scripts/check-admin-migrations-runtime.cjs');
const generatedPath = resolve(process.cwd(), 'scripts/.check-admin-migrations-runtime.generated.cjs');
const source = readFileSync(sourcePath, 'utf8');
const marker = "const migrations = [\n";

if (!source.includes(marker)) {
  throw new Error('Não foi possível localizar a lista de migrations administrativas.');
}

const generated = source.replace(
  marker,
  `${marker}  'supabase/migrations/20260720234400_admin_security_baseline_compat.sql',\n`,
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
