const fs = require("fs");
const path = require("path");

const root = process.cwd();
const out = path.join(root, "scratch", "gsa_production_readiness_audit.md");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function list(items) {
  return items && items.length ? items.map((x) => `- ${x}`).join("\n") : "- Nenhum item.";
}

function table(rows, cols) {
  if (!rows.length) return "_Nenhum item._";
  const head = `| ${cols.join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((r) => `| ${cols.map((c) => String(r[c] ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ")).join(" | ")} |`)
    .join("\n");
  return `${head}\n${sep}\n${body}`;
}

const inv = readJson("scratch/production_audit_inventory.json");
const live = readJson("scratch/live_db_audit.json");
const writes = readJson("scratch/direct_write_audit.json");
const charReport = fs.readFileSync(path.join(root, "scratch", "character_audit_report.md"), "utf8");
const charFindings = Number((charReport.match(/- Findings: (\d+)/) || [0, "0"])[1]);

const openPolicies = live.queries.policies.rows.filter((p) => {
  const q = String(p.qual || "").trim().toLowerCase();
  const c = String(p.with_check || "").trim().toLowerCase();
  const roles = Array.isArray(p.roles) ? p.roles.join(",") : String(p.roles || "");
  return /public|anon/i.test(roles) && (["true", "(true)"].includes(q) || ["true", "(true)"].includes(c));
});

const openPolicyTables = [...new Set(openPolicies.map((p) => p.tablename))].sort();
const realtimeTables = live.queries.publications.rows
  .filter((r) => r.pubname === "supabase_realtime")
  .map((r) => `${r.schemaname}.${r.tablename}`)
  .sort();
const publicTables = live.queries.tables.rows.filter((r) => r.table_schema === "public").map((r) => r.table_name).sort();
const publicFunctions = live.queries.functions.rows.filter((r) => r.schema === "public").map((r) => r.function_name).sort();
const missingTables = live.comparisons.usedTablesMissingInLiveDb || [];
const missingRpcs = live.comparisons.usedRpcsMissingInLiveDb || [];
const missingBuckets = live.comparisons.usedBucketsMissingInLiveDb || [];
const realtimeTableCount = realtimeTables.length;

const sensitiveTop = writes.summary
  .filter((r) => r.sensitive)
  .slice(0, 40)
  .map((r) => ({
    alvo: r.target,
    operacao: r.op,
    quantidade: r.count,
    areas: r.areas,
    arquivos: r.files,
  }));

const routes = inv.frontend.routes.map((r) => `${r.route} (${r.source}:${r.line})`);
const clientModules = inv.frontend.clientPortalReferences
  .filter((r) => r.key === "label")
  .map((r) => `${r.value} (${r.line})`);
const adminModules = inv.frontend.adminPanelReferences
  .filter((r) => r.key === "label")
  .map((r) => `${r.value} (${r.line})`);

const md = [];
md.push("# Relatorio de Auditoria Integral GSA - Production Readiness");
md.push("");
md.push(`Gerado em: ${new Date().toISOString()}`);
md.push(`Projeto: ${root}`);
md.push("");
md.push("## Decisao Executiva");
md.push("");
md.push("**STATUS: NAO APROVADO PARA PRODUCAO.**");
md.push("");
md.push("A aplicacao compila e a auditoria principal de caracteres nao encontrou mojibake em codigo fonte. Mesmo assim, o sistema nao pode ser liberado para producao porque ainda ha falhas criticas comprovadas no banco real e na arquitetura operacional:");
md.push("");
md.push(`- ${openPolicies.length} policies RLS abertas para \`public\`/\`anon\` com \`true\` em \`USING\` ou \`WITH CHECK\` no banco real.`);
md.push(`- ${missingTables.length} tabelas referenciadas pelo codigo nao existem no schema publico vivo.`);
md.push(`- ${missingRpcs.length} RPCs chamadas pelo codigo/tooling nao existem no banco vivo.`);
md.push(`- ${missingBuckets.length} buckets usados pelo codigo nao existem no storage vivo.`);
md.push(`- ${writes.sensitiveOperations} operacoes diretas sensiveis no frontend/servicos locais ainda escrevem em tabelas criticas.`);
md.push("- Strings de conexao do banco aparecem hardcoded em scripts locais (`get_schema.cjs`, `apply_pg_migration.cjs`).");
md.push("- Nao ha script formal de teste no `package.json`; existe apenas `src/tests/finance.test.ts` sem runner configurado.");
md.push("- A auditoria navegada foi bloqueada pela politica do navegador para o host local, logo nenhum botao pode ser certificado como aprovado por execucao visual nesta rodada.");
md.push("");
md.push("## Evidencias Executadas");
md.push("");
md.push("- Inventario estatico: `node scratch/production_audit_inventory.cjs`.");
md.push("- Auditoria de caracteres: `node scratch/character_audit.cjs`.");
md.push("- Auditoria viva do banco: `node scratch/live_db_audit.cjs --allow-local-fallback`.");
md.push("- Auditoria de escritas diretas: `node scratch/direct_write_audit.cjs`.");
md.push("- Build: `npm run build` aprovado.");
md.push("");
md.push("## Inventario do Projeto");
md.push("");
md.push(`- Arquivos proprios analisados: ${inv.totals.files}.`);
md.push(`- Arquivos em src/: ${inv.totals.sourceFiles}.`);
md.push(`- Arquivos SQL: ${inv.totals.sqlFiles}.`);
md.push(`- Migrations: ${inv.totals.migrations}.`);
md.push(`- Paginas detectadas: ${inv.frontend.pages.length}.`);
md.push(`- Componentes detectados: ${inv.frontend.components.length}.`);
md.push(`- Hooks detectados: ${inv.frontend.hooks.length}.`);
md.push(`- Contextos detectados: ${inv.frontend.contexts.length}.`);
md.push(`- Rotas detectadas: ${inv.frontend.routes.length}.`);
md.push(`- Tabelas usadas via Supabase no codigo: ${Object.keys(inv.supabase.usedTables).length}.`);
md.push(`- RPCs usadas no codigo: ${Object.keys(inv.supabase.usedRpcs).length}.`);
md.push(`- Canais realtime no codigo: ${Object.keys(inv.supabase.usedChannels).length}.`);
md.push("");
md.push("### Rotas encontradas");
md.push(list(routes));
md.push("");
md.push("### Paginas");
md.push(list(inv.frontend.pages));
md.push("");
md.push("### Modulos do Portal Cliente");
md.push(list(clientModules));
md.push("");
md.push("### Modulos do Admin");
md.push(list(adminModules));
md.push("");
md.push("## Banco Real");
md.push("");
md.push(`- Tabelas totais consultadas: ${live.queries.tables.rows.length}.`);
md.push(`- Tabelas publicas: ${publicTables.length}.`);
md.push(`- Colunas: ${live.queries.columns.rows.length}.`);
md.push(`- Constraints: ${live.queries.constraints.rows.length}.`);
md.push(`- Indices: ${live.queries.indexes.rows.length}.`);
md.push(`- Policies: ${live.queries.policies.rows.length}.`);
md.push(`- Tabelas com estado RLS consultado: ${live.queries.rls.rows.length}.`);
md.push(`- Functions totais: ${live.queries.functions.rows.length}.`);
md.push(`- Functions publicas: ${publicFunctions.length}.`);
md.push(`- Triggers: ${live.queries.triggers.rows.length}.`);
md.push(`- Views: ${live.queries.views.rows.length}.`);
md.push(`- Buckets: ${live.queries.buckets.rows.length}.`);
md.push(`- Publicacoes realtime: ${live.queries.publications.rows.length}.`);
md.push("");
md.push("### Tabelas publicas encontradas");
md.push(list(publicTables));
md.push("");
md.push("### Buckets encontrados");
md.push(list(live.queries.buckets.rows.map((b) => `${b.id} (public=${b.public}, limite=${b.file_size_limit ?? "sem limite"})`)));
md.push("");
md.push("## Divergencias Codigo x Banco Real");
md.push("");
md.push("### Tabelas referenciadas no codigo e ausentes no banco vivo");
md.push(list(missingTables));
md.push("");
md.push("### RPCs chamadas no codigo e ausentes no banco vivo");
md.push(list(missingRpcs));
md.push("");
md.push("### Buckets usados no codigo e ausentes no banco vivo");
md.push(list(missingBuckets));
md.push("");
md.push("## RLS e Seguranca");
md.push("");
md.push(`Policies abertas encontradas no banco real: ${openPolicies.length}.`);
md.push("");
md.push("### Tabelas afetadas por policies abertas");
md.push(list(openPolicyTables));
md.push("");
md.push("Impacto: qualquer policy `public`/`anon` com condicao `true` enfraquece ou anula isolamento de dados. Em tabelas financeiras, clientes, pagamentos, notificacoes, documentos, logs, sessoes e suporte isso e bloqueador de producao.");
md.push("");
md.push("## Realtime");
md.push("");
md.push(`Tabelas publicadas em supabase_realtime: ${realtimeTableCount}.`);
md.push("");
md.push(list(realtimeTables));
md.push("");
md.push("Risco: realtime amplo com RLS aberta pode expor eventos indevidos e dificulta provar que nenhum evento duplica ou vaza entre usuarios.");
md.push("");
md.push("## Escritas Diretas Sensíveis");
md.push("");
md.push(`Operacoes diretas encontradas: ${writes.directOperations}.`);
md.push(`Operacoes diretas sensiveis: ${writes.sensitiveOperations}.`);
md.push("");
md.push("### Maiores grupos sensiveis");
md.push(table(sensitiveTop, ["alvo", "operacao", "quantidade", "areas", "arquivos"]));
md.push("");
md.push("Impacto: fluxos financeiros/operacionais ainda dependem de multiplas escritas no frontend ou em utilitarios locais. Isso permite inconsistencias em clique duplo, falha no meio do fluxo, manipulacao de payload, IDOR e divergencia entre tela e banco. A correcao definitiva e migrar esses grupos para RPCs transacionais com validacao e RLS fechada.");
md.push("");
md.push("## Caracteres e Encoding");
md.push("");
md.push(`Resultado da auditoria principal de caracteres: ${charFindings} achado(s).`);
md.push("");
md.push("Observacao: uma checagem agressiva gerou falsos positivos em letras validas do portugues, como `Ã` maiusculo em palavras acentuadas. Por isso a decisao de encoding foi baseada no scanner principal, que detecta sequencias reais de mojibake, C1 invisivel e caractere de substituicao.");
md.push("");
md.push("## Build, TypeScript e Performance");
md.push("");
md.push("- `npm run build`: aprovado.");
md.push("- Aviso de performance: bundle principal `index-Cg_Z1wal.js` com aproximadamente 4,134.61 kB minificado e 1,002.03 kB gzip.");
md.push("- Aviso de chunking: `src/utils/referralHelpers.ts` e importado estaticamente e dinamicamente, impedindo isolamento em chunk separado.");
md.push("");
md.push("## Testes");
md.push("");
md.push("- `package.json` nao possui script `test`.");
md.push("- Existe `src/tests/finance.test.ts`, mas sem runner configurado no projeto.");
md.push("- Existem scripts de validacao em `src/validation`, porem eles executam escritas reais em Supabase e nao sao uma suite segura/repetivel de CI.");
md.push("- Nenhum fluxo de botao, modal, upload, pagamento, saque, transferencia, notificacao ou realtime foi aprovado por E2E nesta rodada.");
md.push("");
md.push("## Auditoria Navegada");
md.push("");
md.push("A tentativa de navegar para o host local foi bloqueada pela politica do Browser desta sessao. Resultado: nao ha evidencia navegada suficiente para aprovar botoes, formularios, modais e estados visuais. Isso permanece pendente.");
md.push("");
md.push("## Achados Criticos");
md.push("");
md.push(table([
  { severidade: "Critica", achado: "RLS aberta no banco real", impacto: "Vazamento/alteracao indevida de dados entre usuarios e roles.", evidencia: `${openPolicies.length} policies public/anon true em live_db_audit.json` },
  { severidade: missingTables.length || missingBuckets.length ? "Critica" : "Baixa", achado: "Codigo/tooling chama estruturas ausentes", impacto: "Fluxos quebram em runtime quando a chamada faz parte da aplicacao.", evidencia: `${missingTables.length} tabelas, ${missingRpcs.length} RPCs e ${missingBuckets.length} buckets ausentes no banco vivo` },
  { severidade: "Critica", achado: "Escritas sensiveis diretas", impacto: "Inconsistencia financeira e operacional, clique duplo, falha parcial e manipulacao de payload.", evidencia: `${writes.sensitiveOperations} operacoes sensiveis em direct_write_audit.json` },
  { severidade: "Critica", achado: "Credencial de banco hardcoded em scripts", impacto: "Vazamento de acesso privilegiado ao banco.", evidencia: "get_schema.cjs e apply_pg_migration.cjs contem connection string hardcoded" },
  { severidade: "Alta", achado: "Realtime amplo", impacto: "Superficie grande de vazamento/duplicacao de eventos.", evidencia: `${realtimeTableCount} tabelas em supabase_realtime` },
  { severidade: "Alta", achado: "Ausencia de suite formal de testes", impacto: "Nao ha regressao automatizada para liberar producao.", evidencia: "package.json sem script test" },
  { severidade: "Media", achado: "Bundle principal grande", impacto: "Carregamento lento em mobile e redes ruins.", evidencia: "build Vite reportou chunk > 500 kB; principal ~1 MB gzip" },
], ["severidade", "achado", "impacto", "evidencia"]));
md.push("");
md.push("## Correcoes Recomendadas Antes de Producao");
md.push("");
md.push("1. Rotacionar imediatamente a credencial de banco exposta nos scripts locais.");
md.push("2. Remover connection strings hardcoded e exigir `SUPABASE_DB_URL` apenas via ambiente seguro.");
md.push("3. Fechar RLS por tabela com policies especificas por role/usuario, com testes de anon/auth/admin/cliente/prestador.");
md.push("4. Criar migrations para estruturas ausentes ou remover referencias mortas do codigo.");
md.push("5. Migrar escritas sensiveis diretas para RPCs transacionais com `SECURITY DEFINER`, validacao interna, idempotencia e logs.");
md.push("6. Reduzir realtime para tabelas/eventos realmente necessarios e validar permissao por usuario.");
md.push("7. Configurar runner de testes (unit, integracao e E2E) e CI.");
md.push("8. Criar testes E2E autenticados para cliente, admin e prestador.");
md.push("9. Quebrar bundle por modulo com lazy loading real e revisar import dinamico/estatico misto.");
md.push("10. Manter auditoria de caracteres como gate antes de build.");
md.push("");
md.push("## Checklist de Producao");
md.push("");
md.push("- [x] Inventario estatico inicial gerado.");
md.push("- [x] Banco real consultado.");
md.push("- [x] Build aprovado.");
md.push("- [x] TypeScript aprovado.");
md.push("- [x] Auditoria principal de caracteres aprovada.");
md.push("- [ ] RLS segura.");
md.push("- [ ] Credenciais fora do codigo.");
md.push("- [ ] Tabelas/RPCs/buckets consistentes entre codigo e banco.");
md.push("- [ ] Escritas sensiveis centralizadas no backend/RPC.");
md.push("- [ ] Realtime minimizado e testado.");
md.push("- [ ] Notificacoes testadas por permissao/destinatario/deduplicacao.");
md.push("- [ ] Suite de testes configurada.");
md.push("- [ ] E2E navegada de todos os botoes e fluxos criticos.");
md.push("- [ ] Performance mobile validada.");
md.push("- [ ] Backup/restore/rollback/monitoramento documentados e testados.");
md.push("");
md.push("## Conclusao");
md.push("");
md.push("Com base nas evidencias coletadas, o Sistema GSA ainda nao esta pronto para producao real. A prioridade nao e visual neste momento; os bloqueadores estao em seguranca do banco, consistencia entre codigo e schema, centralizacao de regras sensiveis e ausencia de testes formais.");

fs.writeFileSync(out, md.join("\n"), "utf8");
console.log(`Final production audit report written: ${path.relative(root, out).replace(/\\/g, "/")}`);
