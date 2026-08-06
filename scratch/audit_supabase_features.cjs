// Auditoria completa de todas as funções RPC e chamadas Supabase no projeto
const fs = require('fs');
const path = require('path');

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (file === 'node_modules' || file === 'dist' || file === '.git' || file === 'scratch') continue;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDir(filePath, fileList);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.cjs')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = scanDir(process.cwd());
const rpcs = new Set();
const authMethods = new Set();
const realtimeChannels = new Set();
const storageBuckets = new Set();
const tables = new Set();

files.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');

  // RPCs
  const rpcMatches = [...code.matchAll(/rpc\s*<[^>]*>\s*\(\s*['"]([^'"]+)['"]/g), ...code.matchAll(/callAdminRpc\s*<[^>]*>\s*\(\s*['"]([^'"]+)['"]/g)];
  rpcMatches.forEach(m => rpcs.add(m[1]));

  // Tables
  const tableMatches = [...code.matchAll(/from\s*\(\s*['"]([^'"]+)['"]/g)];
  tableMatches.forEach(m => tables.add(m[1]));

  // Auth
  const authMatches = [...code.matchAll(/supabase\.auth\.([a-zA-Z0-9_]+)/g)];
  authMatches.forEach(m => authMethods.add(m[1]));

  // Realtime
  const channelMatches = [...code.matchAll(/supabase\.channel\s*\(\s*['"]([^'"]+)['"]/g)];
  channelMatches.forEach(m => realtimeChannels.add(m[1]));

  // Storage
  const storageMatches = [...code.matchAll(/storage\.from\s*\(\s*['"]([^'"]+)['"]/g)];
  storageMatches.forEach(m => storageBuckets.add(m[1]));
});

console.log('=== AUDITORIA COMPLETA RECURSOS SUPABASE ===');
console.log('Total de arquivos analisados:', files.length);
console.log('\n--- TABELAS ACESSADAS (Total: ' + tables.size + ') ---');
console.log(Array.from(tables).sort().slice(0, 20).join(', ') + '...');

console.log('\n--- FUNÇÕES RPC IDENTIFICADAS (Total: ' + rpcs.size + ') ---');
console.log(Array.from(rpcs).sort().join('\n'));

console.log('\n--- MÉTODOS DE AUTH UTILIZADOS ---');
console.log(Array.from(authMethods).sort().join(', '));

console.log('\n--- CANAIS REALTIME UTILIZADOS ---');
console.log(Array.from(realtimeChannels).sort().join(', '));

console.log('\n--- BUCKETS STORAGE UTILIZADOS ---');
console.log(Array.from(storageBuckets).sort().join(', '));
