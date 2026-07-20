const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config();

const root = process.cwd();
const inventoryPath = path.join(root, "scratch", "production_audit_inventory.json");
const outJson = path.join(root, "scratch", "live_db_audit.json");
const outMd = path.join(root, "scratch", "live_db_audit.md");

const allowLocalFallback = process.argv.includes("--allow-local-fallback");

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), "utf8");
  } catch {
    return "";
  }
}

function findLocalConnectionString() {
  for (const file of ["apply_pg_migration.cjs", "get_schema.cjs"]) {
    const text = read(file);
    const match = text.match(/postgresql:\/\/postgres:[^'"\s]+/);
    if (match) return { value: match[0], source: file };
  }
  return { value: "", source: "" };
}

function uniq(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

async function safeQuery(client, name, sql) {
  try {
    const res = await client.query(sql);
    return { ok: true, rows: res.rows };
  } catch (error) {
    return { ok: false, error: error.message, rows: [] };
  }
}

function tableRows(rows, columns) {
  if (!rows.length) return "_Nenhum item encontrado._";
  const head = `| ${columns.join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${columns.map((c) => String(row[c] ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ")).join(" | ")} |`)
    .join("\n");
  return `${head}\n${sep}\n${body}`;
}

function policyLooksOpen(policy) {
  const qual = String(policy.qual || "").trim().toLowerCase();
  const check = String(policy.with_check || "").trim().toLowerCase();
  const roles = Array.isArray(policy.roles) ? policy.roles.join(",") : String(policy.roles || "");
  const publicRole = /public|anon/i.test(roles);
  const openExpr = qual === "true" || check === "true" || qual === "(true)" || check === "(true)";
  return publicRole && openExpr;
}

async function main() {
  let source = "SUPABASE_DB_URL";
  let connectionString = process.env.SUPABASE_DB_URL || "";

  if (!connectionString && allowLocalFallback) {
    const local = findLocalConnectionString();
    connectionString = local.value;
    source = local.source ? `local-script:${local.source}` : "local-script:not-found";
  }

  if (!connectionString) {
    const blocked = {
      generatedAt: new Date().toISOString(),
      status: "blocked",
      reason: "SUPABASE_DB_URL is not set. Use --allow-local-fallback only if approved to reuse the local project connection string.",
    };
    fs.writeFileSync(outJson, JSON.stringify(blocked, null, 2), "utf8");
    fs.writeFileSync(outMd, "# Live DB Audit\n\nStatus: blocked\n\nSUPABASE_DB_URL is not set.\n", "utf8");
    console.log(JSON.stringify(blocked, null, 2));
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const inventory = fs.existsSync(inventoryPath) ? JSON.parse(fs.readFileSync(inventoryPath, "utf8")) : null;

  const audit = {
    generatedAt: new Date().toISOString(),
    status: "ok",
    connectionSource: source,
    queries: {},
    comparisons: {},
    findings: [],
  };

  try {
    await client.connect();
    audit.queries.tables = await safeQuery(client, "tables", `
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    audit.queries.columns = await safeQuery(client, "columns", `
      SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name, ordinal_position;
    `);
    audit.queries.constraints = await safeQuery(client, "constraints", `
      SELECT tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type,
             kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY tc.table_schema, tc.table_name, tc.constraint_name;
    `);
    audit.queries.indexes = await safeQuery(client, "indexes", `
      SELECT schemaname, tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename, indexname;
    `);
    audit.queries.policies = await safeQuery(client, "policies", `
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      ORDER BY schemaname, tablename, policyname;
    `);
    audit.queries.rls = await safeQuery(client, "rls", `
      SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY n.nspname, c.relname;
    `);
    audit.queries.functions = await safeQuery(client, "functions", `
      SELECT n.nspname AS schema, p.proname AS function_name,
             pg_get_function_identity_arguments(p.oid) AS arguments,
             l.lanname AS language,
             p.prosecdef AS security_definer
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY n.nspname, p.proname, arguments;
    `);
    audit.queries.triggers = await safeQuery(client, "triggers", `
      SELECT event_object_schema, event_object_table, trigger_name, event_manipulation, action_timing, action_statement
      FROM information_schema.triggers
      WHERE trigger_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY event_object_schema, event_object_table, trigger_name;
    `);
    audit.queries.views = await safeQuery(client, "views", `
      SELECT table_schema, table_name
      FROM information_schema.views
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    audit.queries.buckets = await safeQuery(client, "buckets", `
      SELECT id, name, public, file_size_limit, allowed_mime_types
      FROM storage.buckets
      ORDER BY id;
    `);
    audit.queries.publications = await safeQuery(client, "publications", `
      SELECT pubname, schemaname, tablename
      FROM pg_publication_tables
      ORDER BY pubname, schemaname, tablename;
    `);
    audit.queries.extensions = await safeQuery(client, "extensions", `
      SELECT extname, extversion
      FROM pg_extension
      ORDER BY extname;
    `);

    const livePublicTables = uniq((audit.queries.tables.rows || [])
      .filter((r) => r.table_schema === "public")
      .map((r) => r.table_name));
    const liveFunctions = uniq((audit.queries.functions.rows || [])
      .filter((r) => r.schema === "public")
      .map((r) => r.function_name));
    const liveBuckets = uniq((audit.queries.buckets.rows || []).map((r) => r.id || r.name));
    const usedTables = inventory ? uniq(Object.keys(inventory.supabase.usedTables).filter((x) => x !== "...")) : [];
    const usedRpcs = inventory ? uniq(Object.keys(inventory.supabase.usedRpcs)) : [];
    const usedBuckets = inventory ? uniq(Object.keys(inventory.supabase.usedStorageBuckets)) : [];

    audit.comparisons.usedTablesMissingInLiveDb = usedTables.filter((t) => !livePublicTables.includes(t));
    audit.comparisons.livePublicTablesNotUsedBySupabaseFrom = livePublicTables.filter((t) => !usedTables.includes(t));
    audit.comparisons.usedRpcsMissingInLiveDb = usedRpcs.filter((f) => !liveFunctions.includes(f));
    audit.comparisons.usedBucketsMissingInLiveDb = usedBuckets.filter((b) => !liveBuckets.includes(b));

    const openPolicies = (audit.queries.policies.rows || []).filter(policyLooksOpen);
    if (openPolicies.length) {
      audit.findings.push({
        severity: "critical",
        code: "OPEN_RLS_POLICIES",
        count: openPolicies.length,
        message: "Policies with public/anon role and true expressions were found in the live database.",
      });
    }
    if (audit.comparisons.usedTablesMissingInLiveDb.length) {
      audit.findings.push({
        severity: "critical",
        code: "CODE_REFERENCES_MISSING_TABLES",
        count: audit.comparisons.usedTablesMissingInLiveDb.length,
        message: "Frontend/backend code references tables that are not present in the live public schema.",
      });
    }
    if (audit.comparisons.usedRpcsMissingInLiveDb.length) {
      audit.findings.push({
        severity: "critical",
        code: "CODE_REFERENCES_MISSING_RPCS",
        count: audit.comparisons.usedRpcsMissingInLiveDb.length,
        message: "Frontend/backend code calls RPC functions that are not present in the live public schema.",
      });
    }
  } catch (error) {
    audit.status = "failed";
    audit.error = error.message;
  } finally {
    try {
      await client.end();
    } catch {}
  }

  fs.writeFileSync(outJson, JSON.stringify(audit, null, 2), "utf8");

  const md = [];
  md.push("# Live DB Audit");
  md.push("");
  md.push(`Generated at: ${audit.generatedAt}`);
  md.push(`Status: ${audit.status}`);
  md.push(`Connection source: ${audit.connectionSource}`);
  if (audit.error) md.push(`Error: ${audit.error}`);
  md.push("");
  if (audit.status === "ok") {
    md.push("## Counts");
    for (const [name, result] of Object.entries(audit.queries)) {
      md.push(`- ${name}: ${result.ok ? result.rows.length : `ERROR: ${result.error}`}`);
    }
    md.push("");
    md.push("## Findings");
    md.push(audit.findings.length ? tableRows(audit.findings, ["severity", "code", "count", "message"]) : "_No automated live DB findings._");
    md.push("");
    md.push("## Code references missing in live DB");
    md.push("### Tables");
    md.push(audit.comparisons.usedTablesMissingInLiveDb.map((x) => `- ${x}`).join("\n") || "_None._");
    md.push("### RPCs");
    md.push(audit.comparisons.usedRpcsMissingInLiveDb.map((x) => `- ${x}`).join("\n") || "_None._");
    md.push("### Buckets");
    md.push(audit.comparisons.usedBucketsMissingInLiveDb.map((x) => `- ${x}`).join("\n") || "_None._");
    md.push("");
    md.push("## Open policy evidence");
    const openPolicies = (audit.queries.policies.rows || []).filter(policyLooksOpen);
    md.push(tableRows(openPolicies, ["schemaname", "tablename", "policyname", "roles", "cmd", "qual", "with_check"]));
  }
  fs.writeFileSync(outMd, md.join("\n"), "utf8");

  console.log(`Live DB audit written: ${rel(outJson)}`);
  console.log(`Live DB report written: ${rel(outMd)}`);
  console.log(JSON.stringify({
    status: audit.status,
    findings: audit.findings.length,
    missingTables: audit.comparisons.usedTablesMissingInLiveDb ? audit.comparisons.usedTablesMissingInLiveDb.length : null,
    missingRpcs: audit.comparisons.usedRpcsMissingInLiveDb ? audit.comparisons.usedRpcsMissingInLiveDb.length : null,
    missingBuckets: audit.comparisons.usedBucketsMissingInLiveDb ? audit.comparisons.usedBucketsMissingInLiveDb.length : null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
