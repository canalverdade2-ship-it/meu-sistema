const fs = require('fs');
const path = require('path');

const tables = ['tickets', 'ticket_mensagens', 'pontos_movimentacoes', 'saques', 'faturas', 'vouchers', 'gsa_voucher_resgates', 'ordens_assinatura', 'ordens_compra', 'carteira_lancamentos', 'parceiros_resgates', 'produto_variantes', 'prestador_faturas', 'prestador_saques', 'loja_credito_saques', 'gsa_afiliado_saques'];

function scanDir(dir, filterExt, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === '.agents') continue;
    const fullPath = path.join(dir, e.name);
    if (e.isDirectory()) {
      scanDir(fullPath, filterExt, cb);
    } else if (filterExt.some(ext => e.name.endsWith(ext))) {
      cb(fullPath);
    }
  }
}

const usages = {};
for (const t of tables) {
  usages[t] = [];
}

scanDir(path.join(process.cwd(), 'src'), ['.ts', '.tsx'], (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const t of tables) {
    const patterns = [
      new RegExp(`\\.from\\(['"]${t}['"]\\)([\\s\\S]{1,200})`, 'g'),
      new RegExp(`table:\\s*['"]${t}['"]([\\s\\S]{1,100})`, 'g')
    ];
    for (const pat of patterns) {
      let m;
      while ((m = pat.exec(content)) !== null) {
        usages[t].push({
          file: path.relative(process.cwd(), filePath),
          snippet: m[0].replace(/\s+/g, ' ').substring(0, 150)
        });
      }
    }
  }
});

// Also scan supabase/migrations for SQL queries
scanDir(path.join(process.cwd(), 'supabase', 'migrations'), ['.sql'], (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const t of tables) {
    const pat = new RegExp(`(?:FROM|JOIN|UPDATE|DELETE\\s+FROM)\\s+(?:public\\.)?${t}\\b([\\s\\S]{1,150})`, 'gi');
    let m;
    while ((m = pat.exec(content)) !== null) {
      const matchText = m[1].replace(/\s+/g, ' ').trim();
      if (matchText.includes('WHERE') || matchText.includes('ON') || matchText.includes('ORDER BY')) {
        usages[t].push({
          file: path.relative(process.cwd(), filePath),
          snippet: (m[0].substring(0, 30) + ' ' + matchText).substring(0, 150)
        });
      }
    }
  }
});

console.log('Query patterns summary:');
for (const t of tables) {
  console.log(`\nTable ${t}: ${usages[t].length} usages found.`);
  const samples = usages[t].slice(0, 5);
  for (const s of samples) {
    console.log(`  [${s.file}] ${s.snippet}`);
  }
}

fs.writeFileSync(path.join(process.cwd(), 'scratch', 'query_usage_patterns.json'), JSON.stringify(usages, null, 2));
