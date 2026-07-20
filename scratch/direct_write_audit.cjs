const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outJson = path.join(root, "scratch", "direct_write_audit.json");
const outMd = path.join(root, "scratch", "direct_write_audit.md");

const ignoreDirs = new Set(["node_modules", ".git", "dist", ".codex-remote-attachments", ".agents", "scratch"]);
const sourceExts = new Set([".ts", ".tsx", ".js", ".jsx"]);

const sensitiveTables = new Set([
  "clientes",
  "faturas",
  "pagamentos",
  "extrato_financeiro",
  "carteira_lancamentos",
  "loja_credito_movimentacoes",
  "loja_credito_solicitacoes",
  "loja_credito_documentos",
  "transferencias",
  "saques",
  "prestador_saques",
  "prestador_transacoes",
  "orcamentos",
  "ordens_compra",
  "ordens_servico",
  "ordens_assinatura",
  "cobrancas",
  "cobranca_historico",
  "emprestimos",
  "emprestimo_parcelas",
  "vouchers",
  "points_transactions",
  "pontos_movimentacoes",
  "promocoes",
  "cliente_promocoes",
  "cupons_ativados",
  "cupons_loja",
  "sistema_logs",
  "sistema_sessoes",
  "system_settings",
]);

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function walk(dir, acc = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, acc);
    else if (sourceExts.has(path.extname(item.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function excerpt(text, index) {
  return text.slice(Math.max(0, index - 100), Math.min(text.length, index + 220)).replace(/\s+/g, " ").trim();
}

function areaFromPath(file) {
  if (file.startsWith("src/components/client/") || file.startsWith("src/hooks/")) return "cliente";
  if (file.startsWith("src/components/admin/") || file.startsWith("src/pages/AdminPanel")) return "admin";
  if (file.startsWith("src/components/prestador/") || file.startsWith("src/pages/Prestador/")) return "prestador";
  if (file.startsWith("src/pages/Home") || file.startsWith("src/components/public/")) return "publico";
  if (file.startsWith("src/validation/")) return "validacao";
  if (file.startsWith("src/utils/") || file.startsWith("src/lib/")) return "servico_util";
  return "outro";
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

const records = [];
const files = walk(root);

for (const fileAbs of files) {
  const file = rel(fileAbs);
  const text = fs.readFileSync(fileAbs, "utf8");
  const area = areaFromPath(file);

  const chainRe = /(?:supabase\.)?from\(\s*["'`]([^"'`]+)["'`]\s*\)([\s\S]{0,700}?)(?:\.|\n\s*\.)(insert|update|upsert|delete)\s*\(/g;
  let match;
  while ((match = chainRe.exec(text))) {
    const table = match[1];
    const op = match[3];
    records.push({
      type: "table_write",
      area,
      file,
      line: lineOf(text, match.index),
      table,
      op,
      sensitive: sensitiveTables.has(table),
      evidence: excerpt(text, match.index),
    });
  }

  const dynamicRe = /(?:supabase\.)?from\(\s*([A-Za-z0-9_.$[\]]+)\s*\)([\s\S]{0,700}?)(?:\.|\n\s*\.)(insert|update|upsert|delete)\s*\(/g;
  while ((match = dynamicRe.exec(text))) {
    const tableExpr = match[1];
    if (/^["'`]/.test(tableExpr)) continue;
    records.push({
      type: "dynamic_table_write",
      area,
      file,
      line: lineOf(text, match.index),
      table: tableExpr,
      op: match[3],
      sensitive: true,
      evidence: excerpt(text, match.index),
    });
  }

  const storageRe = /storage\s*\.\s*from\(\s*["'`]([^"'`]+)["'`]\s*\)([\s\S]{0,700}?)(?:\.|\n\s*\.)(upload|remove|download|createSignedUrl|createSignedUrls)\s*\(/g;
  while ((match = storageRe.exec(text))) {
    records.push({
      type: "storage_operation",
      area,
      file,
      line: lineOf(text, match.index),
      table: match[1],
      op: match[3],
      sensitive: match[3] !== "download",
      evidence: excerpt(text, match.index),
    });
  }
}

const byTable = {};
for (const r of records) {
  const key = `${r.type}:${r.table}:${r.op}`;
  if (!byTable[key]) byTable[key] = { type: r.type, target: r.table, op: r.op, count: 0, sensitive: false, files: new Set(), areas: new Set() };
  byTable[key].count += 1;
  byTable[key].sensitive = byTable[key].sensitive || r.sensitive;
  byTable[key].files.add(r.file);
  byTable[key].areas.add(r.area);
}

const summary = Object.values(byTable)
  .map((row) => ({ ...row, files: [...row.files].sort().join(", "), areas: [...row.areas].sort().join(", ") }))
  .sort((a, b) => Number(b.sensitive) - Number(a.sensitive) || b.count - a.count || a.target.localeCompare(b.target));

const audit = {
  generatedAt: new Date().toISOString(),
  filesScanned: files.length,
  directOperations: records.length,
  sensitiveOperations: records.filter((r) => r.sensitive).length,
  summary,
  records,
};

fs.writeFileSync(outJson, JSON.stringify(audit, null, 2), "utf8");

const md = [];
md.push("# Direct Write Audit");
md.push("");
md.push(`Generated at: ${audit.generatedAt}`);
md.push(`Files scanned: ${audit.filesScanned}`);
md.push(`Direct operations found: ${audit.directOperations}`);
md.push(`Sensitive operations found: ${audit.sensitiveOperations}`);
md.push("");
md.push("## Summary by target and operation");
md.push(tableRows(summary, ["type", "target", "op", "count", "sensitive", "areas", "files"]));
md.push("");
md.push("## Sensitive operation records");
md.push(tableRows(records.filter((r) => r.sensitive).map((r) => ({
  type: r.type,
  area: r.area,
  file: r.file,
  line: r.line,
  target: r.table,
  op: r.op,
})), ["type", "area", "file", "line", "target", "op"]));

fs.writeFileSync(outMd, md.join("\n"), "utf8");

console.log(`Direct write audit written: ${rel(outJson)}`);
console.log(`Direct write report written: ${rel(outMd)}`);
console.log(JSON.stringify({
  filesScanned: audit.filesScanned,
  directOperations: audit.directOperations,
  sensitiveOperations: audit.sensitiveOperations,
  distinctTargets: summary.length,
}, null, 2));
