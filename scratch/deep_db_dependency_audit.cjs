const fs = require("fs");
const path = require("path");

const root = process.cwd();
const livePath = path.join(root, "scratch", "live_db_audit.json");
const outJson = path.join(root, "scratch", "deep_db_dependency_audit.json");
const outMd = path.join(root, "scratch", "deep_db_dependency_audit.md");

const ignoredDirs = new Set(["node_modules", ".git", "dist", ".codex-remote-attachments", ".agents", "scratch"]);
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"]);

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (exts.has(path.extname(entry.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function stripCommentsKeepLength(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n\r]*/g, (m, p1) => p1 + " ".repeat(Math.max(0, m.length - p1.length)));
}

function nearestFunction(text, index) {
  const before = text.slice(0, index);
  const patterns = [
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g,
    /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/g,
    /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*async\s+/g,
  ];
  let best = null;
  for (const re of patterns) {
    let m;
    while ((m = re.exec(before))) {
      if (!best || m.index > best.index) best = { name: m[1], index: m.index };
    }
  }
  return best?.name || "";
}

function parseSelectColumns(selectText) {
  if (!selectText || selectText.includes("*")) return [];
  const cleaned = selectText
    .replace(/`/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cols = new Set();
  let token = "";
  let depth = 0;
  for (const ch of cleaned) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      addToken(token, cols);
      token = "";
    } else {
      token += ch;
    }
  }
  addToken(token, cols);
  return [...cols];
}

function addToken(token, cols) {
  let t = token.trim();
  if (!t || t === "*") return;
  if (t.includes("(")) t = t.slice(0, t.indexOf("(")).trim();
  if (t.includes(":")) t = t.slice(0, t.indexOf(":")).trim();
  if (t.includes("!")) t = t.slice(0, t.indexOf("!")).trim();
  if (t.includes(".")) t = t.split(".").pop().trim();
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) cols.add(t);
}

function tableRows(rows, columns) {
  if (!rows.length) return "_Nenhum item encontrado._";
  const head = `| ${columns.join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((c) => String(row[c] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function suggestions(name, candidates) {
  return candidates
    .map((c) => ({ name: c, score: levenshtein(name, c) }))
    .filter((x) => x.score <= Math.max(4, Math.floor(name.length / 3)) || x.name.includes(name.replace(/s$/, "")) || name.includes(x.name.replace(/s$/, "")))
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((x) => x.name);
}

function importUsage(files, symbol) {
  const exact = new RegExp(`\\b${symbol}\\b`);
  const refs = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    if (exact.test(text)) refs.push(rel(file));
  }
  return refs;
}

const live = JSON.parse(fs.readFileSync(livePath, "utf8"));
const liveTables = new Set(live.queries.tables.rows.filter((r) => r.table_schema === "public").map((r) => r.table_name));
const liveColumnsByTable = {};
for (const row of live.queries.columns.rows.filter((r) => r.table_schema === "public")) {
  if (!liveColumnsByTable[row.table_name]) liveColumnsByTable[row.table_name] = new Set();
  liveColumnsByTable[row.table_name].add(row.column_name);
}
const liveFunctions = new Set(live.queries.functions.rows.filter((r) => r.schema === "public").map((r) => r.function_name));
const liveBuckets = new Set(live.queries.buckets.rows.map((r) => r.id || r.name));

const files = walk(root);
const tableRefs = [];
const bucketRefs = [];
const rpcRefs = [];

for (const abs of files) {
  const file = rel(abs);
  const original = fs.readFileSync(abs, "utf8");
  const text = stripCommentsKeepLength(original);
  let m;

  const dbRe = /\bsupabase\s*\.\s*from\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  while ((m = dbRe.exec(text))) {
    const table = m[1];
    const nextFrom = text.slice(m.index + 1).search(/\bsupabase\s*\.\s*from\(\s*["'`]/);
    const hardEnd = nextFrom >= 0 ? m.index + 1 + nextFrom : text.length;
    const softEndCandidates = [
      text.indexOf(";", m.index),
      text.indexOf("\n\n", m.index),
      text.indexOf("]);", m.index),
      text.indexOf(");", m.index),
      hardEnd,
    ].filter((x) => x > m.index);
    const end = Math.min(...softEndCandidates, m.index + 900);
    const chain = text.slice(m.index, end);
    const op = (chain.match(/\.(select|insert|update|upsert|delete)\s*\(/) || [null, "unknown"])[1];
    const selectMatch = chain.match(/\.select\(\s*([`"'])([\s\S]*?)\1\s*[\),]/);
    const filterColumns = [];
    const filterRe = /\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|order|rangeLt|rangeGt|rangeGte|rangeLte)\(\s*["'`]([^"'`]+)["'`]/g;
    let fm;
    while ((fm = filterRe.exec(chain))) filterColumns.push(fm[1]);
    tableRefs.push({
      table,
      file,
      line: lineOf(original, m.index),
      op,
      scope: nearestFunction(original, m.index),
      selectColumns: parseSelectColumns(selectMatch?.[2] || ""),
      filterColumns: [...new Set(filterColumns)],
    });
  }

  const storageRe = /\b(?:supabase\s*\.\s*)?storage\s*\.\s*from\(\s*["'`]([^"'`]+)["'`]\s*\)([\s\S]{0,700})/g;
  while ((m = storageRe.exec(text))) {
    const chain = m[2] || "";
    const op = (chain.match(/\.(upload|download|remove|createSignedUrl|createSignedUrls|getPublicUrl)\s*\(/) || [null, "unknown"])[1];
    bucketRefs.push({ bucket: m[1], file, line: lineOf(original, m.index), op, scope: nearestFunction(original, m.index) });
  }

  const rpcRe = /\bsupabase\s*\.\s*rpc\(\s*["'`]([^"'`]+)["'`]/g;
  while ((m = rpcRe.exec(text))) {
    rpcRefs.push({ rpc: m[1], file, line: lineOf(original, m.index), scope: nearestFunction(original, m.index) });
  }
}

const missingTables = [...new Set(tableRefs.map((r) => r.table).filter((t) => !liveTables.has(t)))].sort();
const missingBuckets = [...new Set(bucketRefs.map((r) => r.bucket).filter((b) => !liveBuckets.has(b)))].sort();
const missingRpcs = [...new Set(rpcRefs.map((r) => r.rpc).filter((f) => !liveFunctions.has(f)))].sort();

const missingColumns = [];
for (const ref of tableRefs) {
  if (!liveTables.has(ref.table)) continue;
  const cols = liveColumnsByTable[ref.table] || new Set();
  for (const col of [...ref.selectColumns, ...ref.filterColumns]) {
    if (!cols.has(col)) missingColumns.push({ table: ref.table, column: col, file: ref.file, line: ref.line, scope: ref.scope, op: ref.op });
  }
}

const missingTableDetails = missingTables.map((table) => {
  const refs = tableRefs.filter((r) => r.table === table);
  const scopes = [...new Set(refs.map((r) => r.scope).filter(Boolean))].join(", ");
  const refFiles = [...new Set(refs.map((r) => r.file))].join(", ");
  return {
    table,
    refs: refs.length,
    files: refFiles,
    scopes,
    suggestions: suggestions(table, [...liveTables]).join(", "),
    activeSignals: refs.some((r) => r.file.includes("lib/") || r.file.includes("components/")) ? "sim" : "incerto",
  };
});

const missingBucketDetails = missingBuckets.map((bucket) => {
  const refs = bucketRefs.filter((r) => r.bucket === bucket);
  return {
    bucket,
    refs: refs.length,
    ops: [...new Set(refs.map((r) => r.op))].join(", "),
    files: [...new Set(refs.map((r) => r.file))].join(", "),
    suggestions: suggestions(bucket, [...liveBuckets]).join(", "),
  };
});

const missingRpcDetails = missingRpcs.map((rpc) => {
  const refs = rpcRefs.filter((r) => r.rpc === rpc);
  return {
    rpc,
    refs: refs.length,
    files: [...new Set(refs.map((r) => r.file))].join(", "),
    suggestions: suggestions(rpc, [...liveFunctions]).join(", "),
  };
});

const audit = {
  generatedAt: new Date().toISOString(),
  filesScanned: files.length,
  tableRefs,
  bucketRefs,
  rpcRefs,
  liveCounts: {
    publicTables: liveTables.size,
    publicFunctions: liveFunctions.size,
    buckets: liveBuckets.size,
  },
  missingTables: missingTableDetails,
  missingBuckets: missingBucketDetails,
  missingRpcs: missingRpcDetails,
  missingColumns,
};

fs.writeFileSync(outJson, JSON.stringify(audit, null, 2), "utf8");

const md = [];
md.push("# Auditoria Profunda de Dependencias do Banco");
md.push("");
md.push(`Gerado em: ${audit.generatedAt}`);
md.push(`Arquivos analisados: ${audit.filesScanned}`);
md.push("");
md.push("## Totais");
md.push(`- Referencias a tabelas no codigo: ${tableRefs.length}`);
md.push(`- Tabelas publicas no banco vivo: ${liveTables.size}`);
md.push(`- Tabelas ausentes: ${missingTableDetails.length}`);
md.push(`- Referencias a buckets: ${bucketRefs.length}`);
md.push(`- Buckets no storage vivo: ${liveBuckets.size}`);
md.push(`- Buckets ausentes: ${missingBucketDetails.length}`);
md.push(`- Referencias a RPCs: ${rpcRefs.length}`);
md.push(`- Functions publicas no banco vivo: ${liveFunctions.size}`);
md.push(`- RPCs ausentes: ${missingRpcDetails.length}`);
md.push(`- Colunas usadas mas nao encontradas: ${missingColumns.length}`);
md.push("");
md.push("## Tabelas ausentes");
md.push(tableRows(missingTableDetails, ["table", "refs", "activeSignals", "suggestions", "files", "scopes"]));
md.push("");
md.push("## Buckets ausentes");
md.push(tableRows(missingBucketDetails, ["bucket", "refs", "ops", "suggestions", "files"]));
md.push("");
md.push("## RPCs ausentes");
md.push(tableRows(missingRpcDetails, ["rpc", "refs", "suggestions", "files"]));
md.push("");
md.push("## Colunas ausentes ou possiveis falsos positivos de parser");
md.push(tableRows(missingColumns.slice(0, 300), ["table", "column", "file", "line", "scope", "op"]));
md.push("");
md.push("## Observacao");
md.push("A validacao de colunas e estatica e conservadora. Selects relacionais do Supabase e aliases podem gerar falso positivo; itens desta secao exigem revisao antes de migration.");

fs.writeFileSync(outMd, md.join("\n"), "utf8");

console.log(`Deep DB dependency audit written: ${rel(outJson)}`);
console.log(`Report written: ${rel(outMd)}`);
console.log(JSON.stringify({
  filesScanned: audit.filesScanned,
  tableRefs: tableRefs.length,
  missingTables: missingTableDetails.length,
  bucketRefs: bucketRefs.length,
  missingBuckets: missingBucketDetails.length,
  rpcRefs: rpcRefs.length,
  missingRpcs: missingRpcDetails.length,
  missingColumns: missingColumns.length,
}, null, 2));
