import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const creds = fs.readFileSync(path.join(projectRoot, 'CREDENCIAIS_SISTEMA_GSA.md'), 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const pw64 = Buffer.from(password, 'utf8').toString('base64');

function testExplain(query) {
  const q64 = Buffer.from(query, 'utf8').toString('base64');
  const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${q64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X
`;

  const ssh = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', [
    '-o', 'BatchMode=yes',
    '-i', key,
    'opc@147.15.43.141',
    'bash', '-s'
  ], { input: remote, encoding: 'utf8', timeout: 20000 });

  return ssh.stdout;
}

const tests = [
  { name: 'idx_tickets_status', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.tickets WHERE status = 'aberto';" },
  { name: 'idx_tickets_modulo', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.tickets WHERE modulo = 'suporte';" },
  { name: 'idx_ticket_mensagens_autor_id', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.ticket_mensagens WHERE autor_id = 'admin-1';" },
  { name: 'idx_ticket_mensagens_nao_lidas', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.ticket_mensagens WHERE ticket_id = '00000000-0000-0000-0000-000000000001' AND lida = false;" },
  { name: 'idx_saques_status', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.saques WHERE status = 'recusado';" },
  { name: 'idx_saques_fila_pendente', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.saques WHERE status = 'pendente';" },
  { name: 'idx_prestador_saques_prestador_status', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.prestador_saques WHERE prestador_id = '00000000-0000-0000-0000-000000000001' AND status = 'pendente';" },
  { name: 'idx_faturas_tipo', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.faturas WHERE tipo = 'produto';" },
  { name: 'idx_faturas_data_vencimento', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.faturas WHERE data_vencimento = '2026-09-11';" },
  { name: 'idx_faturas_emprestimo_id', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.faturas WHERE emprestimo_id = '00000000-0000-0000-0000-000000000001';" },
  { name: 'idx_faturas_loja_credito_solicitacao_id', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.faturas WHERE loja_credito_solicitacao_id = '00000000-0000-0000-0000-000000000001';" },
  { name: 'idx_cobrancas_fatura_id', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.cobrancas WHERE fatura_id = '00000000-0000-0000-0000-000000000001';" },
  { name: 'idx_pontos_movimentacoes_cliente_data', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.pontos_movimentacoes WHERE cliente_id = '00000000-0000-0000-0000-000000000001' ORDER BY data_movimentacao DESC;" },
  { name: 'idx_pontos_movimentacoes_tipo', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.pontos_movimentacoes WHERE tipo = 'bonus';" },
  { name: 'idx_extrato_financeiro_tipo', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.extrato_financeiro WHERE tipo = 'credito';" },
  { name: 'idx_extrato_financeiro_referencia', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.extrato_financeiro WHERE referencia_id = '00000000-0000-0000-0000-000000000001';" },
  { name: 'idx_carteira_lancamentos_tipo', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.carteira_lancamentos WHERE tipo = 'debito';" },
  { name: 'idx_vouchers_categoria', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.vouchers WHERE categoria = 'desconto';" },
  { name: 'idx_vouchers_validade', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.vouchers WHERE validade = '2026-12-31';" },
  { name: 'idx_vouchers_cliente_status', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.vouchers WHERE cliente_id = '00000000-0000-0000-0000-000000000001' AND status = 'ativo';" },
  { name: 'idx_gsa_voucher_resgates_voucher_id', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.gsa_voucher_resgates WHERE voucher_id = '00000000-0000-0000-0000-000000000001';" },
  { name: 'idx_cupons_loja_categoria', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.cupons_loja WHERE categoria_cupom = 'desconto';" },
  { name: 'idx_cupons_loja_status_cat', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.cupons_loja WHERE status = 'ativo' AND categoria_cupom = 'desconto';" },
  { name: 'idx_cupons_loja_validade', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.cupons_loja WHERE data_validade = '2026-12-31';" },
  { name: 'idx_ordens_assinatura_status', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.ordens_assinatura WHERE status = 'cancelado';" },
  { name: 'idx_ordens_assinatura_renovacao_cron', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.ordens_assinatura WHERE data_vencimento = '2026-10-01' AND renovacao_automatica = true AND status = 'aprovado';" },
  { name: 'idx_ordens_compra_status', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.ordens_compra WHERE status = 'cancelado';" },
  { name: 'idx_prestador_faturas_prestador_status', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.prestador_faturas WHERE prestador_id = '00000000-0000-0000-0000-000000000001' AND status = 'pendente';" },
  { name: 'idx_prestador_faturas_data_vencimento', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.prestador_faturas WHERE data_vencimento = '2026-09-11';" },
  { name: 'idx_gsa_afiliado_saques_afiliado_data', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.gsa_afiliado_saques WHERE afiliado_id = '00000000-0000-0000-0000-000000000001' ORDER BY solicitado_em DESC;" },
  { name: 'idx_loja_credito_saques_fatura_id', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.loja_credito_saques WHERE fatura_id = '00000000-0000-0000-0000-000000000001';" },
  { name: 'idx_loja_credito_saques_movimentacao_id', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.loja_credito_saques WHERE movimentacao_id = '00000000-0000-0000-0000-000000000001';" },
  { name: 'idx_parceiros_resgates_codigo_gerado', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.parceiros_resgates WHERE codigo_gerado = 'COD123';" },
  { name: 'idx_parceiros_resgates_eventos_recurso_id', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.parceiros_resgates_eventos WHERE recurso_id = '00000000-0000-0000-0000-000000000001';" },
  { name: 'idx_produto_variantes_sku', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.produto_variantes WHERE sku = 'SKU-001';" },
  { name: 'idx_produto_variantes_codigo_barras', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.produto_variantes WHERE codigo_barras = '7891234567890';" },
  { name: 'idx_produtos_status_created', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.produtos WHERE status = 'ativo' ORDER BY created_at DESC;" },
  { name: 'idx_orcamentos_cupom_desconto_id', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.orcamentos WHERE cupom_desconto_id = '00000000-0000-0000-0000-000000000001';" },
  { name: 'idx_orcamentos_cupom_entrega_id', q: "SET enable_seqscan = off; EXPLAIN SELECT * FROM public.orcamentos WHERE cupom_entrega_id = '00000000-0000-0000-0000-000000000001';" }
];

let passed = 0;
for (const t of tests) {
  const out = testExplain(t.q);
  const regex = new RegExp(t.name, 'i');
  if (regex.test(out)) {
    console.log(`[PASS] ${t.name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${t.name}: did not find in plan:\n${out.trim()}`);
  }
}
console.log(`Total Passed: ${passed} / ${tests.length}`);
