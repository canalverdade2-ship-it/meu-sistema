import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

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

async function run() {
  console.log('=== 1. Inspecting system_settings table ===');
  const sysCols = runRemotePsqlJson(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'system_settings';
  `);
  console.log('system_settings columns:', sysCols);

  const sysRows = runRemotePsqlJson(`SELECT * FROM public.system_settings;`);
  console.log(`system_settings row count: ${sysRows.length}`);
  console.log('Sample settings keys:', sysRows.map(r => r.key || r.chave || r.nome || Object.keys(r)));

  console.log('\n=== 2. Inspecting GsaTvModule.tsx and TV tables ===');
  const tvTables = runRemotePsqlJson(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%tv%';
  `);
  console.log('TV tables in DB:', tvTables);

  console.log('\n=== 3. Inspecting all system settings usages in src/ ===');
  const srcDir = path.resolve('src');
  const allSrcFiles = [];
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(fullPath);
      else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        allSrcFiles.push(fullPath);
      }
    }
  }
  walkDir(srcDir);

  const systemSettingKeysUsed = new Set();
  const settingKeyRegex = /['"`]([a-zA-Z0-9_\-\.:]+)['"`]/g;
  for (const file of allSrcFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('system_settings') || content.includes('useSystemSettings') || content.includes('getSetting')) {
      // Find keys queried
      const matches = content.matchAll(/(?:getSetting|system_settings|settings)\.([a-zA-Z0-9_]+)|(?:from\(['"]system_settings['"]\)\.select\([^)]*\)\.eq\(['"]key['"]\s*,\s*['"]([^'"]+)['"]\))/g);
      for (const m of matches) {
        if (m[1]) systemSettingKeysUsed.add(m[1]);
        if (m[2]) systemSettingKeysUsed.add(m[2]);
      }
    }
  }
  console.log('System settings keys referenced in code:', Array.from(systemSettingKeysUsed));

  fs.writeFileSync('.agents/teamwork_preview_explorer_db_1/system_settings_dump.json', JSON.stringify({
    columns: sysCols,
    rows: sysRows,
    keysInCode: Array.from(systemSettingKeysUsed)
  }, null, 2));

  console.log('Saved system settings dump.');
}

run().catch(console.error);
