const fs = require("fs");
const path = require("path");

const root = process.cwd();
const live = JSON.parse(fs.readFileSync(path.join(root, "scratch", "live_db_audit.json"), "utf8"));
const writes = JSON.parse(fs.readFileSync(path.join(root, "scratch", "direct_write_audit.json"), "utf8"));
const inv = JSON.parse(fs.readFileSync(path.join(root, "scratch", "production_audit_inventory.json"), "utf8"));

const outJson = path.join(root, "scratch", "rls_deep_audit.json");
const outMd = path.join(root, "scratch", "rls_deep_audit.md");

function isTrueExpr(value) {
  const v = String(value || "").trim().toLowerCase();
  return v === "true" || v === "(true)";
}

function isPublicRole(roles) {
  const r = Array.isArray(roles) ? roles.join(",") : String(roles || "");
  return /public|anon/i.test(r);
}

function sensitivity(table) {
  if (/^(faturas|pagamentos|cobrancas|carteira|extrato|saques|transferencias|emprestimos|pontos|points_|loja_credito)/.test(table)) return "financeiro";
  if (/clientes|prestadores|colaboradores|funcoes|modulos|sessoes|logs|notificacoes|solicitacoes_exclusao/.test(table)) return "identidade_acesso";
  if (/documentos|fiscal|ordens_fiscais|notas/.test(table)) return "documentos_fiscal";
  if (/orcamentos|ordens_|loja_solicitacoes|loja_reembolsos|promocoes_quantidade_uso/.test(table)) return "operacional";
  if (/tickets|suporte|mensagens|comentarios|historico|timeline/.test(table)) return "comunicacao_historico";
  if (/produtos|servicos|assinaturas|categorias|cupons|vouchers|promocoes|client_levels|empresa|formas_pagamento/.test(table)) return "catalogo_config";
  return "outro";
}

function severity(table, policies) {
  const sens = sensitivity(table);
  const cmds = new Set(policies.map((p) => p.cmd));
  const hasWrite = policies.some((p) => p.cmd === "ALL" || ["INSERT", "UPDATE", "DELETE"].includes(p.cmd));
  if (hasWrite && ["financeiro", "identidade_acesso", "documentos_fiscal"].includes(sens)) return "critica";
  if (hasWrite && ["operacional", "comunicacao_historico"].includes(sens)) return "alta";
  if (hasWrite) return "media";
  if (cmds.has("SELECT") && ["financeiro", "identidade_acesso", "documentos_fiscal"].includes(sens)) return "alta";
  return "baixa";
}

function recommendation(table, sens, hasWrites) {
  if (sens === "catalogo_config" && !hasWrites) return "Manter SELECT publico apenas para catalogo realmente publico; bloquear escrita direta.";
  if (sens === "catalogo_config") return "Separar leitura publica de catalogo e mover escrita para admin/RPC.";
  if (sens === "financeiro") return "Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator.";
  if (sens === "identidade_acesso") return "Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true.";
  if (sens === "documentos_fiscal") return "Aplicar policies por dono/admin e paths de Storage por ator; upload via RPC/edge quando houver aprovacao.";
  if (sens === "operacional") return "Migrar mudancas de status/aprovacao/cancelamento para RPCs; SELECT limitado por cliente/prestador/admin.";
  if (sens === "comunicacao_historico") return "Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only.";
  return "Revisar uso real e substituir policy aberta por policy especifica.";
}

const rlsByTable = Object.fromEntries(live.queries.rls.rows.map((r) => [r.table_name, r]));
const directByTarget = Object.fromEntries((writes.summary || []).map((r) => [r.target, r]));
const tableRefs = inv.supabase.usedTables || {};

const openPolicies = live.queries.policies.rows.filter((p) => isPublicRole(p.roles) && (isTrueExpr(p.qual) || isTrueExpr(p.with_check)));
const grouped = new Map();
for (const policy of openPolicies) {
  const key = `${policy.schemaname}.${policy.tablename}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(policy);
}

const rows = [...grouped.entries()].map(([key, policies]) => {
  const table = key.split(".")[1];
  const sens = sensitivity(table);
  const hasWrites = policies.some((p) => p.cmd === "ALL" || ["INSERT", "UPDATE", "DELETE"].includes(p.cmd));
  const direct = directByTarget[table];
  return {
    table,
    sensitivity: sens,
    severity: severity(table, policies),
    rls_enabled: !!rlsByTable[table]?.rls_enabled,
    rls_forced: !!rlsByTable[table]?.rls_forced,
    open_policy_count: policies.length,
    commands: [...new Set(policies.map((p) => p.cmd))].join(","),
    direct_write_count: direct?.count || 0,
    sensitive_direct_write: !!direct?.sensitive,
    code_refs: (tableRefs[table] || []).length,
    policies: policies.map((p) => p.policyname),
    recommendation: recommendation(table, sens, hasWrites),
  };
}).sort((a, b) => {
  const rank = { critica: 0, alta: 1, media: 2, baixa: 3 };
  return rank[a.severity] - rank[b.severity] || b.direct_write_count - a.direct_write_count || a.table.localeCompare(b.table);
});

const counts = rows.reduce((acc, row) => {
  acc.bySeverity[row.severity] = (acc.bySeverity[row.severity] || 0) + 1;
  acc.bySensitivity[row.sensitivity] = (acc.bySensitivity[row.sensitivity] || 0) + 1;
  if (row.rls_enabled) acc.rlsEnabledTables += 1;
  if (row.direct_write_count) acc.tablesWithDirectWrites += 1;
  return acc;
}, { policies: openPolicies.length, tables: rows.length, rlsEnabledTables: 0, tablesWithDirectWrites: 0, bySeverity: {}, bySensitivity: {} });

const report = {
  generatedAt: new Date().toISOString(),
  counts,
  conclusion: "As policies abertas procedem. Fechar tudo em uma migration unica quebraria o sistema porque a aplicacao usa anon key, sessao propria em localStorage/sistema_sessoes e muitas escritas diretas em tabelas protegidas.",
  rows,
};

function mdTable(items, cols) {
  if (!items.length) return "_Nenhum item._";
  return [
    `| ${cols.join(" | ")} |`,
    `| ${cols.map(() => "---").join(" | ")} |`,
    ...items.map((item) => `| ${cols.map((c) => String(item[c] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

const md = [];
md.push("# Auditoria Profunda de RLS - Sistema GSA");
md.push("");
md.push(`Gerado em: ${report.generatedAt}`);
md.push("");
md.push("## Conclusao");
md.push("");
md.push(report.conclusion);
md.push("");
md.push("## Numeros");
md.push("");
md.push(`- Policies abertas confirmadas: ${counts.policies}`);
md.push(`- Tabelas afetadas: ${counts.tables}`);
md.push(`- Tabelas afetadas com RLS ligado: ${counts.rlsEnabledTables}`);
md.push(`- Tabelas afetadas com escrita direta detectada no codigo: ${counts.tablesWithDirectWrites}`);
md.push(`- Por gravidade: ${JSON.stringify(counts.bySeverity)}`);
md.push(`- Por area: ${JSON.stringify(counts.bySensitivity)}`);
md.push("");
md.push("## Tabelas Criticas e Altas");
md.push("");
md.push(mdTable(rows.filter((r) => ["critica", "alta"].includes(r.severity)), [
  "severity",
  "table",
  "sensitivity",
  "commands",
  "open_policy_count",
  "direct_write_count",
  "code_refs",
  "rls_enabled",
  "recommendation",
]));
md.push("");
md.push("## Todas as Tabelas Afetadas");
md.push("");
md.push(mdTable(rows, [
  "severity",
  "table",
  "sensitivity",
  "commands",
  "open_policy_count",
  "direct_write_count",
  "code_refs",
  "rls_enabled",
]));
md.push("");
md.push("## Estrategia Segura");
md.push("");
md.push("1. Nao remover todas as policies abertas de uma vez.");
md.push("2. Primeiro criar camada de compatibilidade: helpers de sessao/role, RPCs transacionais e views publicas somente leitura para catalogo.");
md.push("3. Migrar modulos financeiros e operacionais para RPCs antes de fechar INSERT/UPDATE/DELETE.");
md.push("4. Fechar RLS por grupo de tabelas, sempre com smoke test de cliente/admin/prestador.");
md.push("5. So depois remover policies `Acesso total`/`Public Full Access` remanescentes.");

fs.writeFileSync(outJson, JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(outMd, md.join("\n"), "utf8");
console.log(JSON.stringify(counts, null, 2));
