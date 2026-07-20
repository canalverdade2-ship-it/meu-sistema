const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outJson = path.join(root, "scratch", "production_audit_inventory.json");
const outMd = path.join(root, "scratch", "production_audit_report.md");

const ignoredDirs = new Set([
  "node_modules",
  ".git",
  "dist",
  ".codex-remote-attachments",
  ".agents",
  "scratch",
]);

const textExts = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".cjs",
  ".mjs",
  ".json",
  ".sql",
  ".md",
  ".css",
  ".html",
  ".env",
  ".example",
]);

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function walk(dir, acc = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      walk(full, acc);
      continue;
    }
    acc.push(full);
  }
  return acc;
}

function isTextFile(file) {
  const base = path.basename(file);
  const ext = path.extname(file).toLowerCase();
  return textExts.has(ext) || base === ".env" || base === ".env.example";
}

function readFile(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function matchAll(text, regex) {
  const out = [];
  let match;
  while ((match = regex.exec(text))) out.push(match);
  return out;
}

function uniq(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function count(text, regex) {
  return matchAll(text, regex).length;
}

function pushMap(map, key, value) {
  if (!key) return;
  if (!map[key]) map[key] = [];
  map[key].push(value);
}

function normalizeSqlName(name) {
  if (!name) return "";
  return name.replace(/"/g, "").replace(/^public\./i, "").trim();
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function excerpt(text, index, width = 180) {
  const start = Math.max(0, index - width / 2);
  const end = Math.min(text.length, index + width / 2);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

const files = walk(root).filter(isTextFile);
const inventory = {
  generatedAt: new Date().toISOString(),
  root,
  totals: {
    files: files.length,
    sourceFiles: 0,
    sqlFiles: 0,
    migrations: 0,
  },
  files: [],
  frontend: {
    pages: [],
    components: [],
    hooks: [],
    contexts: [],
    routes: [],
    clientPortalReferences: [],
    adminPanelReferences: [],
    jsxMetricsByFile: [],
  },
  code: {
    exportedFunctions: {},
    functions: {},
    imports: {},
    todos: [],
    possibleMocks: [],
    consoleStatements: [],
  },
  supabase: {
    usedTables: {},
    usedRpcs: {},
    usedChannels: {},
    usedRealtimeTables: {},
    realtimeEvents: {},
    usedStorageBuckets: {},
    uploads: [],
    downloads: [],
    authCalls: [],
    notificationReferences: [],
    logReferences: [],
    historyReferences: [],
  },
  database: {
    migrationFiles: [],
    rootSqlFiles: [],
    tablesCreated: {},
    tablesAltered: {},
    functionsCreated: {},
    triggersCreated: {},
    policiesCreated: {},
    indexesCreated: {},
    viewsCreated: {},
    rlsEnabled: {},
    grants: [],
    storageBucketsReferenced: {},
  },
  comparisons: {},
};

for (const file of files) {
  const r = rel(file);
  const ext = path.extname(file).toLowerCase();
  const text = readFile(file);
  const lines = text ? text.split(/\r?\n/).length : 0;
  const kind =
    r.startsWith("src/pages/")
      ? "page"
      : r.startsWith("src/components/")
        ? "component"
        : r.startsWith("src/hooks/")
          ? "hook"
          : r.startsWith("src/contexts/")
            ? "context"
            : r.startsWith("supabase/migrations/")
              ? "migration"
              : ext === ".sql"
                ? "sql"
                : "other";

  inventory.files.push({ path: r, kind, ext, lines });

  if (r.startsWith("src/")) inventory.totals.sourceFiles += 1;
  if (ext === ".sql") inventory.totals.sqlFiles += 1;
  if (kind === "migration") inventory.totals.migrations += 1;

  if (kind === "page") inventory.frontend.pages.push(r);
  if (kind === "component") inventory.frontend.components.push(r);
  if (kind === "hook") inventory.frontend.hooks.push(r);
  if (kind === "context") inventory.frontend.contexts.push(r);
  if (kind === "migration") inventory.database.migrationFiles.push(r);
  if (ext === ".sql" && kind !== "migration") inventory.database.rootSqlFiles.push(r);

  for (const m of matchAll(text, /\bexport\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) {
    pushMap(inventory.code.exportedFunctions, m[1], { file: r, line: lineOf(text, m.index) });
  }
  for (const m of matchAll(text, /\bfunction\s+([A-Za-z0-9_]+)\s*\(/g)) {
    pushMap(inventory.code.functions, m[1], { file: r, line: lineOf(text, m.index) });
  }
  for (const m of matchAll(text, /\bimport\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g)) {
    pushMap(inventory.code.imports, m[1], { file: r, line: lineOf(text, m.index) });
  }

  for (const m of matchAll(text, /\b(TODO|FIXME|HACK|XXX)\b[^\n\r]*/gi)) {
    inventory.code.todos.push({ file: r, line: lineOf(text, m.index), text: m[0].trim() });
  }
  for (const m of matchAll(text, /\b(mock|fake|stub|placeholder|demo|sample)\b/gi)) {
    inventory.code.possibleMocks.push({ file: r, line: lineOf(text, m.index), text: excerpt(text, m.index) });
  }
  for (const m of matchAll(text, /\bconsole\.(log|warn|error|info|debug)\s*\(/g)) {
    inventory.code.consoleStatements.push({ file: r, line: lineOf(text, m.index), call: m[0] });
  }

  if (/\.(tsx|jsx)$/.test(ext)) {
    const buttons = count(text, /<button\b/gi);
    const forms = count(text, /<form\b/gi);
    const inputs = count(text, /<input\b/gi);
    const selects = count(text, /<select\b/gi);
    const textareas = count(text, /<textarea\b/gi);
    const modals = count(text, /\bModal\b|Dialog|Sheet|Drawer/gi);
    const toasts = count(text, /\btoast\./g);
    if (buttons || forms || inputs || selects || textareas || modals || toasts) {
      inventory.frontend.jsxMetricsByFile.push({
        file: r,
        buttons,
        forms,
        inputs,
        selects,
        textareas,
        modals,
        toasts,
      });
    }
  }

  if (r === "src/App.tsx") {
    for (const m of matchAll(text, /normalizedPath\s*={2,3}\s*["']([^"']+)["']/g)) {
      inventory.frontend.routes.push({ route: m[1], source: r, line: lineOf(text, m.index), evidence: "normalizedPath equality" });
    }
    for (const m of matchAll(text, /normalizedPath\.startsWith\(["']([^"']+)["']\)/g)) {
      inventory.frontend.routes.push({ route: `${m[1]}*`, source: r, line: lineOf(text, m.index), evidence: "normalizedPath startsWith" });
    }
    for (const m of matchAll(text, /["'](\/[A-Za-z0-9_\/-]+)["']/g)) {
      if (!inventory.frontend.routes.some((x) => x.route === m[1])) {
        inventory.frontend.routes.push({ route: m[1], source: r, line: lineOf(text, m.index), evidence: "route-like literal" });
      }
    }
  }

  if (r === "src/pages/ClientPortal.tsx") {
    for (const m of matchAll(text, /\b(id|title|label|path|route):\s*["'`]([^"'`]+)["'`]/g)) {
      inventory.frontend.clientPortalReferences.push({ key: m[1], value: m[2], line: lineOf(text, m.index) });
    }
  }
  if (r === "src/pages/AdminPanel.tsx") {
    for (const m of matchAll(text, /\b(id|title|label|path|route):\s*["'`]([^"'`]+)["'`]/g)) {
      inventory.frontend.adminPanelReferences.push({ key: m[1], value: m[2], line: lineOf(text, m.index) });
    }
  }

  for (const m of matchAll(text, /\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (/storage\s*$/i.test(before)) continue;
    pushMap(inventory.supabase.usedTables, m[1], { file: r, line: lineOf(text, m.index) });
  }
  for (const m of matchAll(text, /\.rpc\(\s*["'`]([^"'`]+)["'`]/g)) {
    pushMap(inventory.supabase.usedRpcs, m[1], { file: r, line: lineOf(text, m.index) });
  }
  for (const m of matchAll(text, /\.channel\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    pushMap(inventory.supabase.usedChannels, m[1], { file: r, line: lineOf(text, m.index) });
  }
  for (const m of matchAll(text, /table:\s*["'`]([^"'`]+)["'`]/g)) {
    pushMap(inventory.supabase.usedRealtimeTables, m[1], { file: r, line: lineOf(text, m.index) });
  }
  for (const m of matchAll(text, /event:\s*["'`]([^"'`]+)["'`]/g)) {
    pushMap(inventory.supabase.realtimeEvents, m[1], { file: r, line: lineOf(text, m.index) });
  }
  for (const m of matchAll(text, /storage\s*\.\s*from\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    pushMap(inventory.supabase.usedStorageBuckets, m[1], { file: r, line: lineOf(text, m.index) });
  }
  for (const m of matchAll(text, /\.upload\s*\(/g)) {
    inventory.supabase.uploads.push({ file: r, line: lineOf(text, m.index), text: excerpt(text, m.index) });
  }
  for (const m of matchAll(text, /\.download\s*\(/g)) {
    inventory.supabase.downloads.push({ file: r, line: lineOf(text, m.index), text: excerpt(text, m.index) });
  }
  for (const m of matchAll(text, /supabase\.auth\.[A-Za-z0-9_]+|\.auth\.[A-Za-z0-9_]+/g)) {
    inventory.supabase.authCalls.push({ file: r, line: lineOf(text, m.index), call: m[0] });
  }
  for (const m of matchAll(text, /notification|notificacao|notificacoes|toast|notify/gi)) {
    inventory.supabase.notificationReferences.push({ file: r, line: lineOf(text, m.index), text: excerpt(text, m.index, 120) });
  }
  for (const m of matchAll(text, /\blog|logs|auditoria|audit/gi)) {
    inventory.supabase.logReferences.push({ file: r, line: lineOf(text, m.index), text: excerpt(text, m.index, 120) });
  }
  for (const m of matchAll(text, /historico|history|timeline/gi)) {
    inventory.supabase.historyReferences.push({ file: r, line: lineOf(text, m.index), text: excerpt(text, m.index, 120) });
  }

  if (ext === ".sql" || kind === "migration") {
    for (const m of matchAll(text, /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?[\w]+"?)/gi)) {
      pushMap(inventory.database.tablesCreated, normalizeSqlName(m[1]), { file: r, line: lineOf(text, m.index) });
    }
    for (const m of matchAll(text, /\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?("?[\w]+"?)/gi)) {
      pushMap(inventory.database.tablesAltered, normalizeSqlName(m[1]), { file: r, line: lineOf(text, m.index) });
    }
    for (const m of matchAll(text, /\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public\.)?("?[\w]+"?)\s*\(/gi)) {
      pushMap(inventory.database.functionsCreated, normalizeSqlName(m[1]), { file: r, line: lineOf(text, m.index) });
    }
    for (const m of matchAll(text, /\bcreate\s+(?:or\s+replace\s+)?view\s+(?:public\.)?("?[\w]+"?)/gi)) {
      pushMap(inventory.database.viewsCreated, normalizeSqlName(m[1]), { file: r, line: lineOf(text, m.index) });
    }
    for (const m of matchAll(text, /\bcreate\s+trigger\s+("?[\w]+"?)/gi)) {
      pushMap(inventory.database.triggersCreated, normalizeSqlName(m[1]), { file: r, line: lineOf(text, m.index) });
    }
    for (const m of matchAll(text, /\bcreate\s+policy\s+("?[^"\n]+"?|\w+)\s+on\s+(?:public\.)?("?[\w]+"?)/gi)) {
      pushMap(inventory.database.policiesCreated, normalizeSqlName(m[2]), {
        policy: normalizeSqlName(m[1]),
        file: r,
        line: lineOf(text, m.index),
      });
    }
    for (const m of matchAll(text, /\bcreate\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?("?[\w]+"?)/gi)) {
      pushMap(inventory.database.indexesCreated, normalizeSqlName(m[1]), { file: r, line: lineOf(text, m.index) });
    }
    for (const m of matchAll(text, /\balter\s+table\s+(?:public\.)?("?[\w]+"?)\s+enable\s+row\s+level\s+security/gi)) {
      pushMap(inventory.database.rlsEnabled, normalizeSqlName(m[1]), { file: r, line: lineOf(text, m.index) });
    }
    for (const m of matchAll(text, /\bgrant\s+[\s\S]{0,160}?\s+to\s+[\w,\s]+/gi)) {
      inventory.database.grants.push({ file: r, line: lineOf(text, m.index), text: m[0].replace(/\s+/g, " ").trim() });
    }
    for (const m of matchAll(text, /storage\.buckets[\s\S]{0,260}?["']([A-Za-z0-9_-]+)["']/gi)) {
      pushMap(inventory.database.storageBucketsReferenced, m[1], { file: r, line: lineOf(text, m.index) });
    }
  }
}

const createdOrAlteredTables = uniq([
  ...Object.keys(inventory.database.tablesCreated),
  ...Object.keys(inventory.database.tablesAltered),
]);
const usedTables = uniq(Object.keys(inventory.supabase.usedTables));
const createdFunctions = uniq(Object.keys(inventory.database.functionsCreated));
const usedRpcs = uniq(Object.keys(inventory.supabase.usedRpcs));

inventory.comparisons = {
  usedTablesNotFoundInSqlEvidence: usedTables.filter((name) => !createdOrAlteredTables.includes(name)),
  sqlTablesNotReferencedBySupabaseFrom: createdOrAlteredTables.filter((name) => !usedTables.includes(name)),
  usedRpcsNotFoundInSqlEvidence: usedRpcs.filter((name) => !createdFunctions.includes(name)),
  sqlFunctionsNotCalledByRpc: createdFunctions.filter((name) => !usedRpcs.includes(name)),
  usedStorageBucketsNotFoundInSqlEvidence: uniq(Object.keys(inventory.supabase.usedStorageBuckets)).filter(
    (name) => !Object.keys(inventory.database.storageBucketsReferenced).includes(name)
  ),
};

function summarizeMap(map) {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, refs]) => `- ${name}: ${refs.length} referencia(s)`);
}

function tableRows(rows, columns) {
  if (!rows.length) return "_Nenhum item encontrado._";
  const head = `| ${columns.join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${columns.map((c) => String(row[c] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`)
    .join("\n");
  return `${head}\n${sep}\n${body}`;
}

const md = [];
md.push("# Auditoria Integral GSA - Inventario Inicial");
md.push("");
md.push(`Gerado em: ${inventory.generatedAt}`);
md.push(`Raiz: ${inventory.root}`);
md.push("");
md.push("## Escopo desta etapa");
md.push("Este arquivo e um inventario estatico automatizado. Ele prova existencia por codigo/migrations, mas ainda nao substitui testes navegados, auditoria do banco real e validacao manual de fluxos.");
md.push("");
md.push("## Totais");
md.push(`- Arquivos analisados: ${inventory.totals.files}`);
md.push(`- Arquivos em src/: ${inventory.totals.sourceFiles}`);
md.push(`- Arquivos SQL: ${inventory.totals.sqlFiles}`);
md.push(`- Migrations: ${inventory.totals.migrations}`);
md.push("");
md.push("## Rotas encontradas em src/App.tsx");
md.push(tableRows(inventory.frontend.routes, ["route", "source", "line", "evidence"]));
md.push("");
md.push("## Paginas");
md.push(inventory.frontend.pages.map((x) => `- ${x}`).join("\n") || "_Nenhuma pagina encontrada._");
md.push("");
md.push("## Componentes");
md.push(inventory.frontend.components.map((x) => `- ${x}`).join("\n") || "_Nenhum componente encontrado._");
md.push("");
md.push("## Hooks e Contextos");
md.push("### Hooks");
md.push(inventory.frontend.hooks.map((x) => `- ${x}`).join("\n") || "_Nenhum hook encontrado._");
md.push("### Contextos");
md.push(inventory.frontend.contexts.map((x) => `- ${x}`).join("\n") || "_Nenhum contexto encontrado._");
md.push("");
md.push("## Metricas JSX por arquivo");
md.push(tableRows(inventory.frontend.jsxMetricsByFile, ["file", "buttons", "forms", "inputs", "selects", "textareas", "modals", "toasts"]));
md.push("");
md.push("## Supabase - tabelas usadas no codigo");
md.push(summarizeMap(inventory.supabase.usedTables).join("\n") || "_Nenhuma tabela usada via .from()._");
md.push("");
md.push("## Supabase - RPCs usadas no codigo");
md.push(summarizeMap(inventory.supabase.usedRpcs).join("\n") || "_Nenhuma RPC usada via .rpc()._");
md.push("");
md.push("## Supabase - realtime");
md.push("### Canais");
md.push(summarizeMap(inventory.supabase.usedChannels).join("\n") || "_Nenhum canal encontrado._");
md.push("### Tabelas em listeners");
md.push(summarizeMap(inventory.supabase.usedRealtimeTables).join("\n") || "_Nenhuma tabela de listener encontrada._");
md.push("### Eventos");
md.push(summarizeMap(inventory.supabase.realtimeEvents).join("\n") || "_Nenhum evento encontrado._");
md.push("");
md.push("## Supabase - storage");
md.push(summarizeMap(inventory.supabase.usedStorageBuckets).join("\n") || "_Nenhum bucket usado via storage.from()._");
md.push("");
md.push("## Banco - tabelas criadas/alteradas em SQL");
md.push(summarizeMap(Object.fromEntries(createdOrAlteredTables.map((name) => [name, [{ file: "" }]]))).join("\n") || "_Nenhuma tabela encontrada._");
md.push("");
md.push("## Banco - functions/RPCs criadas em SQL");
md.push(summarizeMap(inventory.database.functionsCreated).join("\n") || "_Nenhuma function encontrada._");
md.push("");
md.push("## Banco - policies por tabela");
md.push(summarizeMap(inventory.database.policiesCreated).join("\n") || "_Nenhuma policy encontrada._");
md.push("");
md.push("## Banco - triggers");
md.push(summarizeMap(inventory.database.triggersCreated).join("\n") || "_Nenhum trigger encontrado._");
md.push("");
md.push("## Banco - RLS habilitado");
md.push(summarizeMap(inventory.database.rlsEnabled).join("\n") || "_Nenhum ALTER TABLE ENABLE RLS encontrado._");
md.push("");
md.push("## Comparacao codigo x SQL local");
md.push("### Tabelas usadas no codigo sem evidencia SQL local");
md.push(inventory.comparisons.usedTablesNotFoundInSqlEvidence.map((x) => `- ${x}`).join("\n") || "_Nenhuma divergencia encontrada nesta checagem._");
md.push("### RPCs chamadas no codigo sem evidencia SQL local");
md.push(inventory.comparisons.usedRpcsNotFoundInSqlEvidence.map((x) => `- ${x}`).join("\n") || "_Nenhuma divergencia encontrada nesta checagem._");
md.push("### Buckets usados no codigo sem evidencia SQL local");
md.push(inventory.comparisons.usedStorageBucketsNotFoundInSqlEvidence.map((x) => `- ${x}`).join("\n") || "_Nenhuma divergencia encontrada nesta checagem._");
md.push("");
md.push("## Sinais de qualidade");
md.push(`- TODO/FIXME/HACK/XXX: ${inventory.code.todos.length}`);
md.push(`- Possiveis mocks/placeholders/demo/sample: ${inventory.code.possibleMocks.length}`);
md.push(`- Console statements: ${inventory.code.consoleStatements.length}`);
md.push("");
md.push("## Arquivos analisados");
md.push(tableRows(inventory.files, ["path", "kind", "ext", "lines"]));

fs.writeFileSync(outJson, JSON.stringify(inventory, null, 2), "utf8");
fs.writeFileSync(outMd, md.join("\n"), "utf8");

console.log(`Inventory written: ${rel(outJson)}`);
console.log(`Report written: ${rel(outMd)}`);
console.log(JSON.stringify({
  files: inventory.totals.files,
  sourceFiles: inventory.totals.sourceFiles,
  sqlFiles: inventory.totals.sqlFiles,
  migrations: inventory.totals.migrations,
  routes: inventory.frontend.routes.length,
  pages: inventory.frontend.pages.length,
  components: inventory.frontend.components.length,
  usedTables: usedTables.length,
  usedRpcs: usedRpcs.length,
  sqlTables: createdOrAlteredTables.length,
  sqlFunctions: createdFunctions.length,
  tableMismatches: inventory.comparisons.usedTablesNotFoundInSqlEvidence.length,
  rpcMismatches: inventory.comparisons.usedRpcsNotFoundInSqlEvidence.length,
}, null, 2));
