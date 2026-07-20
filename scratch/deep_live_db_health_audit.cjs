const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ quiet: true });

const root = process.cwd();
const outJson = path.join(root, 'scratch', 'deep_live_db_health_audit.json');
const outMd = path.join(root, 'scratch', 'deep_live_db_health_audit.md');

function connectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const source = fs.readFileSync(path.join(root, 'apply_pg_migration.cjs'), 'utf8');
  const match = source.match(/postgresql:\/\/postgres:[^'"\s]+/);
  if (!match) throw new Error('SUPABASE_DB_URL is not set.');
  const url = new URL(match[0]);
  url.hostname = 'aws-0-us-west-2.pooler.supabase.com';
  url.port = '5432';
  url.username = 'postgres.ocgajvagxagutfvgxwsy';
  return url.toString();
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function parseVector(value) {
  if (Array.isArray(value)) return value.map(Number);
  return String(value || '').replace(/[{}]/g, '').trim().split(/[ ,]+/).filter(Boolean).map(Number);
}

function parseTextArray(value) {
  if (Array.isArray(value)) return value.map(String);
  const text = String(value || '').trim();
  if (!text) return [];
  return text.replace(/^\{|\}$/g, '').split(',').map((item) => item.replace(/^"|"$/g, '').replaceAll('\\"', '"'));
}

function mdTable(rows, columns) {
  if (!rows.length) return '_Nenhum item._';
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((column) => String(row[column] ?? '').replaceAll('|', '\\|').replace(/\r?\n/g, ' ')).join(' | ')} |`),
  ].join('\n');
}

async function query(client, sql, params = []) {
  try {
    const result = await client.query(sql, params);
    return { ok: true, rows: result.rows };
  } catch (error) {
    return { ok: false, error: error.message, rows: [] };
  }
}

async function main() {
  const client = new Client({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
    statement_timeout: 30000,
  });
  await client.connect();

  const audit = { generatedAt: new Date().toISOString(), status: 'ok', checks: {}, findings: [] };

  try {
    audit.checks.server = await query(client, `
      SELECT current_database() AS database_name, current_user AS database_user,
             current_setting('server_version') AS server_version,
             pg_database_size(current_database()) AS database_bytes;
    `);
    audit.checks.migrations = await query(client, `
      SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
    `);
    audit.checks.publicTables = await query(client, `
      SELECT n.nspname AS schema_name, c.relname AS table_name, c.relrowsecurity AS rls_enabled,
             c.relforcerowsecurity AS rls_forced, c.reltuples::bigint AS estimated_rows,
             pg_total_relation_size(c.oid) AS total_bytes,
             EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conrelid = c.oid AND pc.contype = 'p') AS has_primary_key
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p') ORDER BY c.relname;
    `);
    audit.checks.openPolicies = await query(client, `
      SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE (roles && ARRAY['public','anon']::name[])
        AND (lower(trim(COALESCE(qual, ''))) IN ('true','(true)') OR lower(trim(COALESCE(with_check, ''))) IN ('true','(true)'))
      ORDER BY tablename, policyname;
    `);
    audit.checks.tableGrants = await query(client, `
      SELECT grantee, table_schema, table_name, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema IN ('public','storage') AND grantee IN ('anon','authenticated','PUBLIC')
      ORDER BY grantee, table_schema, table_name, privilege_type;
    `);
    audit.checks.securityDefinerFunctions = await query(client, `
      SELECT n.nspname AS schema_name, p.proname AS function_name,
             pg_get_function_identity_arguments(p.oid) AS arguments,
             pg_get_userbyid(p.proowner) AS owner,
             array_to_string(p.proconfig, ',') AS function_config,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
      ORDER BY p.proname, arguments;
    `);
    audit.checks.invalidIndexes = await query(client, `
      SELECT n.nspname AS schema_name, t.relname AS table_name, i.relname AS index_name,
             x.indisvalid, x.indisready, x.indislive
      FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND (NOT x.indisvalid OR NOT x.indisready OR NOT x.indislive)
      ORDER BY t.relname, i.relname;
    `);
    audit.checks.unvalidatedConstraints = await query(client, `
      SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name,
             con.contype AS constraint_type
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT con.convalidated ORDER BY c.relname, con.conname;
    `);
    audit.checks.foreignKeys = await query(client, `
      SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name,
             pn.nspname AS parent_schema, pc.relname AS parent_table, con.conkey, con.confkey,
             ARRAY(SELECT a.attname FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum ORDER BY k.ord) AS columns,
             ARRAY(SELECT a.attname FROM unnest(con.confkey) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum ORDER BY k.ord) AS parent_columns
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_class pc ON pc.oid = con.confrelid JOIN pg_namespace pn ON pn.oid = pc.relnamespace
      WHERE con.contype = 'f' AND n.nspname = 'public' ORDER BY c.relname, con.conname;
    `);
    audit.checks.indexKeys = await query(client, `
      SELECT t.relname AS table_name, x.indkey::text AS indkey, x.indisvalid, x.indpred IS NULL AS not_partial
      FROM pg_index x JOIN pg_class t ON t.oid = x.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public';
    `);
    audit.checks.storageBuckets = await query(client, `
      SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;
    `);
    audit.checks.storagePolicies = await query(client, `
      SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies
      WHERE schemaname = 'storage' ORDER BY tablename, policyname;
    `);
    audit.checks.realtime = await query(client, `
      SELECT pt.pubname, pt.schemaname, pt.tablename, c.relrowsecurity AS rls_enabled,
             c.relreplident AS replica_identity
      FROM pg_publication_tables pt
      JOIN pg_namespace n ON n.nspname = pt.schemaname
      JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = pt.tablename
      WHERE pt.pubname = 'supabase_realtime' ORDER BY pt.schemaname, pt.tablename;
    `);
    audit.checks.cronJobs = await query(client, `
      SELECT jobid, schedule, command, active FROM cron.job ORDER BY jobid;
    `);
    if (audit.checks.cronJobs.ok) {
      audit.checks.cronJobs.rows = audit.checks.cronJobs.rows.map((row) => ({
        ...row,
        command: String(row.command || '').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]'),
      }));
    }
    audit.checks.disabledTriggers = await query(client, `
      SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgenabled = 'D' ORDER BY c.relname, t.tgname;
    `);

    const localMigrationFiles = fs.readdirSync(path.join(root, 'supabase', 'migrations')).filter((name) => name.endsWith('.sql')).sort();
    const localVersions = localMigrationFiles.map((name) => ({ name, version: (name.match(/^(\d+)/) || [])[1] || '' }));
    const appliedVersions = new Set(audit.checks.migrations.rows.map((row) => String(row.version)));
    audit.checks.migrationDrift = {
      localCount: localMigrationFiles.length,
      appliedCount: appliedVersions.size,
      localNotApplied: localVersions.filter((item) => item.version && !appliedVersions.has(item.version)),
      appliedNotLocal: audit.checks.migrations.rows.filter((item) => !localVersions.some((local) => local.version === String(item.version))),
      duplicateLocalVersions: Object.entries(localVersions.reduce((acc, item) => {
        acc[item.version] = (acc[item.version] || 0) + 1;
        return acc;
      }, {})).filter(([version, count]) => version && count > 1).map(([version, count]) => ({ version, count })),
      emptyMigrations: localMigrationFiles.filter((name) => fs.statSync(path.join(root, 'supabase', 'migrations', name)).size === 0),
    };

    const indexesByTable = new Map();
    for (const index of audit.checks.indexKeys.rows) {
      if (!index.indisvalid || !index.not_partial) continue;
      const keys = parseVector(index.indkey);
      if (!indexesByTable.has(index.table_name)) indexesByTable.set(index.table_name, []);
      indexesByTable.get(index.table_name).push(keys);
    }
    audit.checks.unindexedForeignKeys = audit.checks.foreignKeys.rows.filter((fk) => {
      const keys = parseVector(fk.conkey);
      return !(indexesByTable.get(fk.table_name) || []).some((indexKeys) => keys.every((key, position) => indexKeys[position] === key));
    }).map((fk) => ({ table_name: fk.table_name, constraint_name: fk.constraint_name, columns: parseTextArray(fk.columns).join(',') }));

    audit.checks.orphans = [];
    for (const fk of audit.checks.foreignKeys.rows) {
      const columns = parseTextArray(fk.columns);
      const parentColumns = parseTextArray(fk.parent_columns);
      const notNull = columns.map((column) => `child.${quoteIdent(column)} IS NOT NULL`).join(' AND ');
      const join = columns.map((column, index) => `parent.${quoteIdent(parentColumns[index])} = child.${quoteIdent(column)}`).join(' AND ');
      const result = await query(client, `SELECT count(*)::bigint AS orphan_count FROM ${quoteIdent(fk.schema_name)}.${quoteIdent(fk.table_name)} child WHERE ${notNull} AND NOT EXISTS (SELECT 1 FROM ${quoteIdent(fk.parent_schema)}.${quoteIdent(fk.parent_table)} parent WHERE ${join})`);
      if (result.ok && Number(result.rows[0].orphan_count) > 0) {
        audit.checks.orphans.push({ table_name: fk.table_name, constraint_name: fk.constraint_name, orphan_count: Number(result.rows[0].orphan_count) });
      }
    }

    const integritySql = {
      duplicate_client_cpf: `SELECT count(*)::int AS count FROM (SELECT regexp_replace(cpf, '\\D', '', 'g') value FROM public.clientes WHERE NULLIF(regexp_replace(cpf, '\\D', '', 'g'), '') IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d`,
      duplicate_client_cnpj: `SELECT count(*)::int AS count FROM (SELECT regexp_replace(cnpj, '\\D', '', 'g') value FROM public.clientes WHERE NULLIF(regexp_replace(cnpj, '\\D', '', 'g'), '') IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d`,
      duplicate_provider_document: `SELECT count(*)::int AS count FROM (SELECT regexp_replace(documento, '\\D', '', 'g') value FROM public.prestadores WHERE NULLIF(regexp_replace(documento, '\\D', '', 'g'), '') IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d`,
      negative_client_wallet: `SELECT count(*)::int AS count FROM public.clientes WHERE COALESCE(saldo_carteira,0) < 0 OR COALESCE(saldo_pontos,0) < 0 OR COALESCE(limite_credito_disponivel,0) < 0`,
      invalid_invoices: `SELECT count(*)::int AS count FROM public.faturas WHERE COALESCE(valor_total,0) < 0 OR COALESCE(valor_pago,0) < 0 OR COALESCE(valor_pago,0) > COALESCE(valor_total,0) + COALESCE(acrescimo_manual,0)`,
      invalid_payments: `SELECT count(*)::int AS count FROM public.pagamentos WHERE COALESCE(valor,0) <= 0`,
      invalid_withdrawals: `SELECT count(*)::int AS count FROM public.saques WHERE COALESCE(valor,0) <= 0 OR COALESCE(valor_liquido,0) < 0 OR COALESCE(taxa_aplicada,0) < 0`,
      invalid_transfers: `SELECT count(*)::int AS count FROM public.transferencias WHERE COALESCE(valor,0) <= 0 OR COALESCE(valor_liquido,0) < 0 OR cliente_origem_id = cliente_destino_id`,
      duplicate_withdrawal_request: `SELECT count(*)::int AS count FROM (SELECT cliente_id, request_id FROM public.saques WHERE request_id IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) d`,
      duplicate_transfer_request: `SELECT count(*)::int AS count FROM (SELECT cliente_origem_id, request_id FROM public.transferencias WHERE request_id IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) d`,
      duplicate_checkout_request: `SELECT count(*)::int AS count FROM (SELECT cliente_id, checkout_request_id FROM public.orcamentos WHERE checkout_request_id IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) d`,
      stale_active_sessions: `SELECT count(*)::int AS count FROM public.sistema_sessoes WHERE status = 'ativa' AND ultimo_acesso < now() - interval '24 hours'`,
    };
    audit.checks.integrity = {};
    for (const [name, sql] of Object.entries(integritySql)) audit.checks.integrity[name] = await query(client, sql);

    const sensitiveTables = ['clientes','faturas','pagamentos','saques','transferencias','emprestimos','carteira_lancamentos','extrato_financeiro','pontos_movimentacoes','points_transactions','sistema_sessoes','notificacoes','cliente_documentos'];
    audit.checks.anonExposure = [];
    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL ROLE anon');
      for (const table of sensitiveTables) {
        const result = await query(client, `SELECT count(*)::bigint AS visible_rows FROM public.${quoteIdent(table)}`);
        audit.checks.anonExposure.push({ table_name: table, selectable: result.ok, visible_rows: result.ok ? Number(result.rows[0].visible_rows) : null, error: result.error || '' });
      }
    } finally {
      await client.query('ROLLBACK');
    }

    const push = (severity, code, count, message) => {
      if (count > 0) audit.findings.push({ severity, code, count, message });
    };
    push('critical', 'OPEN_RLS_POLICIES', audit.checks.openPolicies.rows.length, 'Policies public/anon com expressao true.');
    push('critical', 'SENSITIVE_ANON_DATA_VISIBLE', audit.checks.anonExposure.filter((row) => row.selectable && row.visible_rows > 0).length, 'Tabelas sensiveis com linhas visiveis ao papel anon.');
    push('critical', 'LOCAL_MIGRATIONS_NOT_APPLIED', audit.checks.migrationDrift.localNotApplied.length, 'Migrations locais sem versao registrada no banco vivo.');
    push('high', 'UNINDEXED_FOREIGN_KEYS', audit.checks.unindexedForeignKeys.length, 'Foreign keys sem indice de prefixo correspondente.');
    push('high', 'ORPHAN_ROWS', audit.checks.orphans.length, 'Relacionamentos com registros orfaos.');
    push('high', 'UNSAFE_SECURITY_DEFINER', audit.checks.securityDefinerFunctions.rows.filter((row) => (row.anon_execute || row.authenticated_execute) && !String(row.function_config || '').includes('search_path=')).length, 'Functions SECURITY DEFINER executaveis pelo navegador sem search_path fixo.');
    push('high', 'INVALID_FINANCIAL_DATA', Object.values(audit.checks.integrity).reduce((sum, result) => sum + (result.ok ? Number(result.rows[0].count) : 0), 0), 'Registros inconsistentes nos checks de integridade.');
    push('medium', 'TABLES_WITHOUT_PRIMARY_KEY', audit.checks.publicTables.rows.filter((row) => !row.has_primary_key).length, 'Tabelas publicas sem primary key.');
    push('medium', 'INVALID_INDEXES', audit.checks.invalidIndexes.rows.length, 'Indices invalidos/incompletos.');
    push('medium', 'UNVALIDATED_CONSTRAINTS', audit.checks.unvalidatedConstraints.rows.length, 'Constraints nao validadas.');
    push('medium', 'DUPLICATE_MIGRATION_VERSIONS', audit.checks.migrationDrift.duplicateLocalVersions.length, 'Versoes de migration repetidas no repositorio.');
    push('medium', 'EMPTY_MIGRATIONS', audit.checks.migrationDrift.emptyMigrations.length, 'Migrations vazias no repositorio.');
  } catch (error) {
    audit.status = 'failed';
    audit.error = error.message;
  } finally {
    await client.end();
  }

  fs.writeFileSync(outJson, JSON.stringify(audit, null, 2), 'utf8');
  const md = [
    '# Auditoria Profunda do Banco Vivo', '',
    `Gerado em: ${audit.generatedAt}`, `Status: ${audit.status}`, '',
    '## Achados', '', mdTable(audit.findings, ['severity','code','count','message']), '',
  ];
  if (audit.status === 'ok') {
    md.push('## Drift de migrations', '',
      `- Locais: ${audit.checks.migrationDrift.localCount}`,
      `- Registradas no banco: ${audit.checks.migrationDrift.appliedCount}`,
      `- Locais sem registro: ${audit.checks.migrationDrift.localNotApplied.length}`,
      `- Versoes locais duplicadas: ${audit.checks.migrationDrift.duplicateLocalVersions.length}`,
      `- Migrations vazias: ${audit.checks.migrationDrift.emptyMigrations.length}`, '',
      mdTable(audit.checks.migrationDrift.localNotApplied, ['version','name']), '',
      '## Exposicao anonima comprovada', '', mdTable(audit.checks.anonExposure, ['table_name','selectable','visible_rows','error']), '',
      '## Foreign keys sem indice', '', mdTable(audit.checks.unindexedForeignKeys, ['table_name','constraint_name','columns']), '',
      '## Orfaos', '', mdTable(audit.checks.orphans, ['table_name','constraint_name','orphan_count']), '',
      '## Integridade de dados', '');
    md.push(mdTable(Object.entries(audit.checks.integrity).map(([check, result]) => ({ check, ok: result.ok, count: result.ok ? result.rows[0].count : '', error: result.error || '' })), ['check','ok','count','error']), '');
    const unsafe = audit.checks.securityDefinerFunctions.rows.filter((row) => (row.anon_execute || row.authenticated_execute) && !String(row.function_config || '').includes('search_path='));
    md.push('## SECURITY DEFINER sem search_path fixo', '', mdTable(unsafe, ['schema_name','function_name','arguments','anon_execute','authenticated_execute','function_config']), '',
      '## Buckets', '', mdTable(audit.checks.storageBuckets.rows, ['id','public','file_size_limit','allowed_mime_types']), '',
      '## Cron jobs', '', audit.checks.cronJobs.ok ? mdTable(audit.checks.cronJobs.rows, ['jobid','schedule','command','active']) : `Erro: ${audit.checks.cronJobs.error}`);
  } else md.push(`Erro: ${audit.error}`);
  fs.writeFileSync(outMd, md.join('\n'), 'utf8');
  console.log(JSON.stringify({ status: audit.status, findings: audit.findings, report: path.relative(root, outMd) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
