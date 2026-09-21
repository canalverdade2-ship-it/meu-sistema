const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../src');

const rpcCalls = [];
const tableCalls = [];
const edgeFuncCalls = [];
const realtimeSubs = [];
const fetchCalls = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(path.resolve(__dirname, '../../'), filePath).replace(/\\/g, '/');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 1. RPC calls: supabase.rpc('name', ...), callAdminRpc('name', ...), callClientRpc('name', ...)
    const rpcMatch = line.match(/(?:supabase\.rpc|callAdminRpc|callClientRpc)\s*<[^>]*>?\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (rpcMatch) {
      rpcCalls.push({ file: relPath, line: lineNum, rpc: rpcMatch[1], code: line.trim() });
    }

    // 2. Table mutations or queries: supabase.from('table').insert/update/delete/select/upsert
    const tableMatch = line.match(/supabase\s*\.\s*from\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.\s*(select|insert|update|delete|upsert)/);
    if (tableMatch) {
      tableCalls.push({ file: relPath, line: lineNum, table: tableMatch[1], method: tableMatch[2], code: line.trim() });
    }

    // 3. Edge functions: supabase.functions.invoke('name')
    const edgeMatch = line.match(/functions\.invoke\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (edgeMatch) {
      edgeFuncCalls.push({ file: relPath, line: lineNum, func: edgeMatch[1], code: line.trim() });
    }

    // 4. Realtime: useRealtimeSubscription
    const rtMatch = line.match(/table:\s*['"`]([^'"`]+)['"`]/);
    if (line.includes('useRealtimeSubscription') || line.includes('useRealtimeTable') || (rtMatch && line.includes('event:'))) {
      if (rtMatch) {
        realtimeSubs.push({ file: relPath, line: lineNum, table: rtMatch[1], code: line.trim() });
      }
    }

    // 5. Fetch calls to VPS/webhook/n8n/Evolution/InfinitePay
    const fetchMatch = line.match(/fetch\s*\(\s*([^,)]+)/);
    if (fetchMatch && (line.includes('http') || line.includes('webhook') || line.includes('api') || line.includes('VPS') || line.includes('evolution') || line.includes('infinitepay'))) {
      fetchCalls.push({ file: relPath, line: lineNum, target: fetchMatch[1].trim(), code: line.trim() });
    }
  });
}

scanDir(srcDir);

// Also scan supabase/functions
const functionsDir = path.resolve(__dirname, '../../supabase/functions');
if (fs.existsSync(functionsDir)) {
  scanDir(functionsDir);
}

const summary = {
  totalRpcCalls: rpcCalls.length,
  uniqueRpcs: [...new Set(rpcCalls.map(r => r.rpc))].sort(),
  totalTableCalls: tableCalls.length,
  uniqueTables: [...new Set(tableCalls.map(t => t.table))].sort(),
  totalEdgeFuncCalls: edgeFuncCalls.length,
  uniqueEdgeFuncs: [...new Set(edgeFuncCalls.map(e => e.func))].sort(),
  totalRealtimeSubs: realtimeSubs.length,
  uniqueRealtimeTables: [...new Set(realtimeSubs.map(r => r.table))].sort(),
  totalFetchCalls: fetchCalls.length
};

fs.writeFileSync(path.join(__dirname, 'scan_results.json'), JSON.stringify({ summary, rpcCalls, tableCalls, edgeFuncCalls, realtimeSubs, fetchCalls }, null, 2), 'utf8');
console.log('Scan completed successfully!');
console.log('Summary:', JSON.stringify(summary, null, 2));
