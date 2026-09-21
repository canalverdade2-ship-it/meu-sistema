import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// Let's search all migrations and SQL files for column definitions of specific tables
const targetTables = [
  'clientes',
  'cobrancas',
  'cobranca_historico',
  'cobranca_acordo_parcelas',
  'carteira_lancamentos',
  'cliente_premios',
  'prestador_premios',
  'gsa_afiliados',
  'sistema_logs',
  'system_settings',
  'faturas',
  'ordens_servico',
  'ordens_compra',
  'ordens_assinatura',
  'orcamentos',
  'prestadores',
  'prestador_demandas',
  'prestador_saques',
  'saques',
  'transferencias',
  'tickets',
  'ticket_mensagens',
  'empresa',
  'loja_reembolsos',
  'loja_solicitacoes',
  'saude_contratos',
  'seguros_apolices',
  'fornecedores',
  'cupons_loja',
  'indicacoes',
  'ordens_fiscais',
  'emprestimos',
  'loja_credito_solicitacoes',
  'colaboradores'
];

const results = {};

function scanSql(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(root, filePath).replaceAll('\\', '/');

  for (const table of targetTables) {
    if (!results[table]) results[table] = { definitions: [], alters: [] };

    // CREATE TABLE regex
    const regex = new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\);`, 'gi');
    let m;
    while ((m = regex.exec(content)) !== null) {
      results[table].definitions.push({ file: rel, body: m[1] });
    }

    // ALTER TABLE regex
    const alterRegex = new RegExp(`ALTER\\s+TABLE(?:\\s+ONLY)?\\s+(?:public\\.)?${table}\\s+ADD\\s+COLUMN[\\s\\S]*?;`, 'gi');
    let am;
    while ((am = alterRegex.exec(content)) !== null) {
      results[table].alters.push({ file: rel, statement: am[0] });
    }
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(f.name)) continue;
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walk(full);
    else if (f.name.endsWith('.sql')) scanSql(full);
  }
}

walk(path.join(root, 'supabase', 'migrations'));
if (fs.existsSync(path.join(root, 'master_supabase_schema.sql'))) scanSql(path.join(root, 'master_supabase_schema.sql'));
if (fs.existsSync(path.join(root, 'evolution_db.sql'))) scanSql(path.join(root, 'evolution_db.sql'));

fs.writeFileSync(
  path.join(root, '.agents', 'explorer_diag_db_1', 'target_tables_schema.json'),
  JSON.stringify(results, null, 2)
);

console.log('Target tables schema compiled successfully.');
