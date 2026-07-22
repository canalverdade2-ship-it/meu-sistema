import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;
const root = process.cwd();
const auditDirectory = path.join(root, 'audit');
const migrationBaselinePath = path.join(auditDirectory, 'database-migration-baseline.json');

function assertVersionArray(name, values) {
  if (!Array.isArray(values)) throw new Error(`${name} deve ser uma lista.`);
  const normalized = [...values].map(String);
  if (normalized.some((value) => !/^\d{14}$/.test(value))) {
    throw new Error(`${name} contém versão inválida.`);
  }
  const sortedUnique = [...new Set(normalized)].sort();
  if (sortedUnique.length !== normalized.length || sortedUnique.some((value, index) => value !== normalized[index])) {
    throw new Error(`${name} deve estar ordenada e sem duplicidades.`);
  }
  return normalized;
}

function readMigrationBaseline() {
  const baseline = JSON.parse(fs.readFileSync(migrationBaselinePath, 'utf8'));
  if (baseline.schemaVersion !== 1) throw new Error('Versão de schema do baseline de migrations não suportada.');
  if (!baseline.source || typeof baseline.source !== 'object') throw new Error('Fonte do baseline de migrations ausente.');

  const duplicateCounts = baseline.legacyDuplicateLocalVersionCounts;
  if (!duplicateCounts || typeof duplicateCounts !== 'object' || Array.isArray(duplicateCounts)) {
    throw new Error('legacyDuplicateLocalVersionCounts deve ser um objeto.');
  }

  const normalizedDuplicateCounts = {};
  for (const version of Object.keys(duplicateCounts).sort()) {
    const count = Number(duplicateCounts[version]);
    if (!/^\d{14}$/.test(version) || !Number.isInteger(count) || count < 2) {
      throw new Error(`Baseline de duplicidade inválido para ${version}.`);
    }
    normalizedDuplicateCounts[version] = count;
  }

  return {
    ...baseline,
    legacyDuplicateLocalVersionCounts: normalizedDuplicateCounts,
    legacyLocalOnlyVersions: assertVersionArray('legacyLocalOnlyVersions', baseline.legacyLocalOnlyVersions),
    legacyRemoteOnlyVersions: assertVersionArray('legacyRemoteOnlyVersions', baseline.legacyRemoteOnlyVersions),
  };
}

function walk(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'coverage', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolutePath, output);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) output.push(absolutePath);
  }
  return output;
}

function localMigrationInventory() {
  const directory = path.join(root, 'supabase', 'migrations');
  const counts = new Map();
  for (const name of fs.readdirSync(directory)) {
    const version = name.match(/^(\d{14})_/i)?.[1];
    if (!version) continue;
    counts.set(version, (counts.get(version) || 0) + 1);
  }
  return {
    versions: [...counts.keys()].sort(),
    counts,
  };
}

function sourceInventory() {
  const tables = new Set();
  const rpcs = new Set();
  const buckets = new Set();
  const sourceFiles = [
    ...walk(path.join(root, 'src')),
    ...walk(path.join(root, 'supabase', 'functions')),
  ];

  for (const absolutePath of sourceFiles) {
    const content = fs.readFileSync(absolutePath, 'utf8');

    for (const match of content.matchAll(/\.storage\s*\.from\(\s*['"]([^'"]+)['"]/g)) {
      buckets.add(match[1]);
    }

    for (const match of content.matchAll(/\.from\(\s*['"]([^'"]+)['"]/g)) {
      const prefix = content.slice(Math.max(0, match.index - 80), match.index);
      if (/\.storage\s*$/.test(prefix) || /\.schema\(\s*['"]storage['"]\s*\)\s*$/.test(prefix)) continue;
      tables.add(match[1]);
    }

    const rpcPatterns = [
      /\.rpc(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g,
      /call(?:Admin|Client)Rpc(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g,
    ];
    for (const pattern of rpcPatterns) {
      for (const match of content.matchAll(pattern)) rpcs.add(match[1]);
    }
  }

  return {
    tables: [...tables].sort(),
    rpcs: [...rpcs].sort(),
    buckets: [...buckets].sort(),
  };
}

function difference(expected, actual) {
  const actualSet = new Set(actual);
  return expected.filter((value) => !actualSet.has(value));
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function duplicateCountFindings(localMigration, baseline) {
  const versions = new Set([
    ...localMigration.counts.keys(),
    ...Object.keys(baseline.legacyDuplicateLocalVersionCounts),
  ]);
  const findings = [];
  for (const version of [...versions].sort()) {
    const actualCount = localMigration.counts.get(version) || 0;
    const expectedCount = baseline.legacyDuplicateLocalVersionCounts[version] || 1;
    if (actualCount > 1 && actualCount !== expectedCount) {
      findings.push({
        version,
        actualCount,
        expectedLegacyCount: baseline.legacyDuplicateLocalVersionCounts[version] || null,
      });
    }
  }
  return findings;
}

const migrationBaseline = readMigrationBaseline();
const localMigration = localMigrationInventory();
const unexpectedDuplicateMigrationVersions = duplicateCountFindings(localMigration, migrationBaseline);

if (process.argv.includes('--validate-baseline-only')) {
  if (unexpectedDuplicateMigrationVersions.length > 0) {
    throw new Error(`Duplicidades de migration fora do baseline: ${JSON.stringify(unexpectedDuplicateMigrationVersions)}`);
  }
  console.log('DATABASE_MIGRATION_BASELINE_OK');
  process.exit(0);
}

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('SUPABASE_DB_URL ou DATABASE_URL deve ser configurada para validar o inventário do banco.');
}

const client = new Client({
  connectionString,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  const localMigrations = localMigration.versions;
  const source = sourceInventory();

  const [migrationResult, tableResult, functionResult, bucketResult, disabledTriggerResult, exposedTableResult, criticalFunctionResult] = await Promise.all([
    client.query('SELECT version::text FROM supabase_migrations.schema_migrations ORDER BY version'),
    client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"),
    client.query("SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'"),
    client.query("SELECT id::text FROM storage.buckets ORDER BY id"),
    client.query(`
      SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal
        AND t.tgenabled = 'D'
        AND n.nspname IN ('public', 'storage')
      ORDER BY n.nspname, c.relname, t.tgname
    `),
    client.query(`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND NOT c.relrowsecurity
        AND (
          has_table_privilege('anon', c.oid, 'SELECT')
          OR has_table_privilege('anon', c.oid, 'INSERT')
          OR has_table_privilege('anon', c.oid, 'UPDATE')
          OR has_table_privilege('anon', c.oid, 'DELETE')
          OR has_table_privilege('authenticated', c.oid, 'SELECT')
          OR has_table_privilege('authenticated', c.oid, 'INSERT')
          OR has_table_privilege('authenticated', c.oid, 'UPDATE')
          OR has_table_privilege('authenticated', c.oid, 'DELETE')
        )
      ORDER BY c.relname
    `),
    client.query(`
      SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'execute_sql',
          'gsa_ads_serve',
          'gsa_ads_record_event',
          'gsa_ads_list_orphan_creative_paths',
          'gsa_ads_refresh_campaign_states',
          'gsa_admin_write_audit',
          'gsa_provider_write_audit'
        )
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
      ORDER BY p.proname
    `),
  ]);

  const remoteMigrations = [...new Set(
    migrationResult.rows
      .map((row) => String(row.version))
      .filter((version) => /^\d{14}$/.test(version)),
  )].sort();
  const databaseTables = tableResult.rows.map((row) => String(row.table_name)).sort();
  const databaseFunctions = functionResult.rows.map((row) => String(row.proname)).sort();
  const databaseBuckets = bucketResult.rows.map((row) => String(row.id)).sort();

  const allLocalOnlyVersions = difference(localMigrations, remoteMigrations);
  const allRemoteOnlyVersions = difference(remoteMigrations, localMigrations);
  const legacyDuplicateLocalVersions = Object.entries(migrationBaseline.legacyDuplicateLocalVersionCounts)
    .filter(([version, expectedCount]) => localMigration.counts.get(version) === expectedCount)
    .map(([version]) => version);
  const resolvedLegacyDuplicateLocalVersions = Object.keys(migrationBaseline.legacyDuplicateLocalVersionCounts)
    .filter((version) => (localMigration.counts.get(version) || 0) <= 1);

  const legacy = {
    duplicateLocalVersions: legacyDuplicateLocalVersions,
    localOnlyVersions: intersection(allLocalOnlyVersions, migrationBaseline.legacyLocalOnlyVersions),
    remoteOnlyVersions: intersection(allRemoteOnlyVersions, migrationBaseline.legacyRemoteOnlyVersions),
    resolvedDuplicateLocalVersions: resolvedLegacyDuplicateLocalVersions,
    resolvedLocalOnlyVersions: difference(migrationBaseline.legacyLocalOnlyVersions, allLocalOnlyVersions),
    resolvedRemoteOnlyVersions: difference(migrationBaseline.legacyRemoteOnlyVersions, allRemoteOnlyVersions),
  };

  const findings = {
    unexpectedDuplicateMigrationVersions,
    missingMigrationsInDatabase: difference(allLocalOnlyVersions, migrationBaseline.legacyLocalOnlyVersions),
    migrationsMissingFromRepository: difference(allRemoteOnlyVersions, migrationBaseline.legacyRemoteOnlyVersions),
    missingReferencedTables: difference(source.tables, databaseTables),
    missingReferencedRpcs: difference(source.rpcs, databaseFunctions),
    missingReferencedBuckets: difference(source.buckets, databaseBuckets),
    disabledTriggers: disabledTriggerResult.rows,
    exposedTablesWithoutRls: exposedTableResult.rows.map((row) => row.table_name),
    exposedCriticalFunctions: criticalFunctionResult.rows.map((row) => row.proname),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    source,
    database: {
      migrationCount: remoteMigrations.length,
      tableCount: databaseTables.length,
      functionCount: databaseFunctions.length,
      bucketCount: databaseBuckets.length,
    },
    migrationBaseline: {
      capturedAt: migrationBaseline.capturedAt,
      source: migrationBaseline.source,
      observedLegacy: legacy,
    },
    findings,
  };

  fs.mkdirSync(auditDirectory, { recursive: true });
  fs.writeFileSync(path.join(auditDirectory, 'database-inventory.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(auditDirectory, 'database-inventory.md'), [
    '# Inventário do banco de dados',
    '',
    `Gerado em: ${report.generatedAt}`,
    '',
    `- Migrations remotas: ${report.database.migrationCount}`,
    `- Tabelas públicas: ${report.database.tableCount}`,
    `- Funções públicas: ${report.database.functionCount}`,
    `- Buckets: ${report.database.bucketCount}`,
    '',
    '## Baseline legado reconhecido',
    '',
    `- Duplicidades locais legadas presentes: ${legacy.duplicateLocalVersions.length}`,
    `- Versões locais legadas sem registro remoto: ${legacy.localOnlyVersions.length}`,
    `- Versões remotas legadas sem arquivo local: ${legacy.remoteOnlyVersions.length}`,
    `- Duplicidades legadas já resolvidas: ${legacy.resolvedDuplicateLocalVersions.length}`,
    `- Divergências locais legadas já resolvidas: ${legacy.resolvedLocalOnlyVersions.length}`,
    `- Divergências remotas legadas já resolvidas: ${legacy.resolvedRemoteOnlyVersions.length}`,
    '',
    '## Achados bloqueadores',
    '',
    ...Object.entries(findings).map(([key, values]) => `- ${key}: ${values.length}`),
    '',
  ].join('\n'));

  const blockingFindings = Object.values(findings).flat();
  if (blockingFindings.length > 0) {
    console.error(JSON.stringify(findings, null, 2));
    throw new Error(`Inventário do banco encontrou ${blockingFindings.length} divergência(s) bloqueadora(s).`);
  }

  console.log('DATABASE_INVENTORY_OK');
} finally {
  await client.end();
}
