import { execSync } from 'child_process';
import fs from 'fs';

const SSH_KEY = 'C:\\Users\\Adriano Farias\\Downloads\\CLOUD\\ssh-key-2026-07-30.key';
const SSH_HOST = 'opc@147.15.43.141';

function runRemotePsql(sql) {
  const fullCmd = `ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SSH_HOST} "PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -A"`;
  return execSync(fullCmd, { input: sql, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
}

function runRemotePsqlJson(sql) {
  const cleanSql = sql.trim().replace(/;+$/, '');
  const wrappedSql = `SELECT COALESCE(json_agg(t), '[]'::json) FROM (${cleanSql}) t;`;
  const raw = runRemotePsql(wrappedSql);
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '') return [];
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    console.error('Failed to parse JSON result. Raw was:', trimmed.slice(0, 500));
    throw e;
  }
}

const tablesToCheck = [
  'clientes',
  'notificacoes',
  'faturas',
  'classificados_anuncios',
  'classificados_transacoes',
  'classificados_propostas',
  'viagens_pacotes',
  'viagens_transacoes',
  'viagens_cancelamentos',
  'ordens_compra',
  'ordens_assinatura',
  'loja_reembolsos',
  'prestador_agendamentos',
  'prestadores',
  'parceiros',
  'parceiros_resgates',
  'gsa_tv_channels',
  'gsa_tv_audit_log'
];

for (const t of tablesToCheck) {
  const cols = runRemotePsqlJson(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = '${t}' 
    ORDER BY ordinal_position;
  `);
  console.log(`\n================= TABLE: ${t} (${cols.length} columns) =================`);
  console.log(cols.map(c => `${c.column_name} (${c.data_type})`).join(', '));
}
