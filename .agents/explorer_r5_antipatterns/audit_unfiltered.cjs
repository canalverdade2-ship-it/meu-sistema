const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.agents' && file !== 'dist') {
        results = results.concat(walk(filePath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('src');

const suspiciousTables = [
  'faturas', 'transacoes', 'pedidos', 'clientes', 'logs', 'demandas', 'atendimentos',
  'notificacoes', 'crm_clientes', 'loja_pedidos', 'prestador_transacoes', 'prestador_demandas',
  'shopee_orders', 'faturas_recorrentes', 'mensagens', 'chat', 'saques', 'orcamentos',
  'ordens_servico', 'vouchers', 'pontos_extrato', 'cupons_resgatados', 'tickets',
  'prestador_promocoes', 'prestador_premios', 'prestador_vouchers', 'prestador_documentos',
  'extrato_financeiro', 'notas_fiscais', 'system_logs', 'security_audit_logs', 'audit_logs'
];

console.log('=== ANTI-PATTERN 1: SUBSCRIPTIONS ON SUSPICIOUS/LARGE TABLES WITHOUT FILTER ===');

const noFilterFindings = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (f.includes('useRealtime.ts') || f.includes('supabaseRealtime.ts') || f.includes('realtime-hook.test.ts')) return;

  const lines = content.split('\n');

  // Match useRealtimeSubscription([ ... ]) or useRealtime(...) or .channel().on('postgres_changes', ...)
  // Let's inspect each line or block
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check table: 'xyz'
    const tableMatch = line.match(/table:\s*['"`]([a-zA-Z0-9_-]+)['"`]/);
    if (tableMatch) {
      const table = tableMatch[1];
      // Check surrounding lines (up to 5 before and after) for 'filter:'
      const windowStart = Math.max(0, i - 4);
      const windowEnd = Math.min(lines.length, i + 6);
      const windowText = lines.slice(windowStart, windowEnd).join('\n');
      
      const hasFilter = windowText.includes('filter:');
      
      if (suspiciousTables.includes(table) || f.includes('client') || f.includes('prestador') || f.includes('Fornecedor')) {
        noFilterFindings.push({
          file: f,
          line: i + 1,
          table,
          hasFilter,
          isClientOrProvider: f.toLowerCase().includes('client') || f.toLowerCase().includes('prestador') || f.toLowerCase().includes('fornecedor') || f.toLowerCase().includes('afiliado'),
          snippet: windowText
        });
      }
    }

    // Check useRealtime('table_name', ...)
    const useRtShortMatch = line.match(/useRealtime\(\s*['"`]([a-zA-Z0-9_-]+)['"`]/);
    if (useRtShortMatch) {
      const table = useRtShortMatch[1];
      const windowText = lines.slice(i, Math.min(lines.length, i + 5)).join('\n');
      const hasFilter = windowText.includes('filter');
      noFilterFindings.push({
        file: f,
        line: i + 1,
        table,
        hasFilter,
        isClientOrProvider: f.toLowerCase().includes('client') || f.toLowerCase().includes('prestador') || f.toLowerCase().includes('fornecedor'),
        snippet: windowText
      });
    }

    // Check useRealtimeTable('table_name' or ['a', 'b'])
    const useRtTableMatch = line.match(/useRealtimeTable\(\s*(\[[^\]]+\]|['"`][a-zA-Z0-9_-]+['"`])/);
    if (useRtTableMatch) {
      noFilterFindings.push({
        file: f,
        line: i + 1,
        table: useRtTableMatch[1],
        hasFilter: false, // useRealtimeTable has NO filter support!
        isClientOrProvider: f.toLowerCase().includes('client') || f.toLowerCase().includes('prestador') || f.toLowerCase().includes('fornecedor'),
        snippet: line.trim()
      });
    }

    // Check direct .on('postgres_changes', { ... table: 'xyz' })
    if (line.includes("'postgres_changes'") || line.includes('"postgres_changes"')) {
      const windowText = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 6)).join('\n');
      const tMatch = windowText.match(/table:\s*['"`]([a-zA-Z0-9_-]+)['"`]/);
      const hasFilter = windowText.includes('filter:');
      if (tMatch) {
        noFilterFindings.push({
          file: f,
          line: i + 1,
          table: tMatch[1],
          hasFilter,
          isClientOrProvider: f.toLowerCase().includes('client') || f.toLowerCase().includes('prestador') || f.toLowerCase().includes('fornecedor'),
          snippet: windowText
        });
      }
    }
  }
});

console.log(`Total table subscription checks: ${noFilterFindings.length}`);
const unfilteredInClientProvider = noFilterFindings.filter(f => !f.hasFilter && f.isClientOrProvider);
console.log(`Unfiltered subscriptions in Client/Provider/Portal files: ${unfilteredInClientProvider.length}`);

unfilteredInClientProvider.forEach(item => {
  console.log(`\n[UNFILTERED] ${item.file}:${item.line} (Table: ${item.table})`);
  console.log(item.snippet);
});

fs.writeFileSync('.agents/explorer_r5_antipatterns/unfiltered_report.json', JSON.stringify(noFilterFindings, null, 2));
