import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const projectRoot = 'c:\\Users\\Adriano Farias\\Downloads\\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)';
const creds = fs.readFileSync(path.join(projectRoot, 'CREDENCIAIS_SISTEMA_GSA.md'), 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();

const pw64 = Buffer.from(password, 'utf8').toString('base64');
const targetTables = [
  'tickets',
  'ticket_mensagens',
  'saques',
  'prestador_saques',
  'faturas',
  'pontos_movimentacoes',
  'extrato_financeiro',
  'carteira_lancamentos',
  'vouchers',
  'cupons_loja',
  'cupons_ativados',
  'orcamentos',
  'ordens_assinatura',
  'ordens_compra',
  'gsa_voucher_resgates',
  'prestador_faturas',
  'gsa_afiliado_saques',
  'loja_credito_saques',
  'parceiros_resgates',
  'parceiros_resgates_recursos',
  'parceiros_resgates_eventos',
  'produto_variantes',
  'produtos',
  'cobrancas'
];

const tblList = targetTables.map(t => `'${t}'`).join(',');

const query = `
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orcamentos' ORDER BY ordinal_position;
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'orcamentos' ORDER BY indexname;
`;

const q64 = Buffer.from(query, 'utf8').toString('base64');

const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${q64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|'
`;

const ssh = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', [
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'ConnectTimeout=15',
  '-i', key,
  'opc@147.15.43.141',
  'bash', '-s'
], { input: remote, encoding: 'utf8', timeout: 30000 });

console.log('STATUS:', ssh.status);
if (ssh.stderr) console.error('STDERR:', ssh.stderr);
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(path.join(__dirname, 'live_schema_output.txt'), ssh.stdout);
console.log('OUTPUT LENGTH:', ssh.stdout.length);

