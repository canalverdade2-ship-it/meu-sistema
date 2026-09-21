import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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

// 1. Fetch live DB columns map
const dbColumns = runRemotePsqlJson(`
  SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  ORDER BY table_name, ordinal_position;
`);
const dbTableCols = {};
for (const c of dbColumns) {
  if (!dbTableCols[c.table_name]) dbTableCols[c.table_name] = new Set();
  dbTableCols[c.table_name].add(c.column_name);
}

const disc = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/audit_discrepancies.json', 'utf-8'));

console.log('=== VERIFYING SUSPECTED DISCREPANCIES ===\n');

for (const entry of disc.columnDiscrepancies) {
  const [table, col] = entry.col.split('.');
  console.log(`Checking ${table}.${col}:`);
  for (const fileDesc of entry.files) {
    const filePath = fileDesc.split(' ')[0];
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(col) && (lines[i].includes('select') || lines[i].includes('order') || lines[i].includes('eq') || lines[i].includes('from'))) {
          console.log(`  ${filePath}:${i+1} -> ${lines[i].trim()}`);
        }
      }
    }
  }
}
