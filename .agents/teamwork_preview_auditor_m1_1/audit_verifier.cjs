const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

console.log('--- FORENSIC INDEPENDENT AUDIT VERIFIER ---');
console.log('Project root:', root);

// 1. Gather all files in project (excluding node_modules and .git)
const allFiles = [];
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else {
      allFiles.push(full.replace(/\\/g, '/'));
    }
  }
}
walk(root);

console.log('Indexed project files (non-vendor):', allFiles.length);

// 2. Read Deliverables
const grafoContent = fs.readFileSync(path.join(root, 'GRAFO_CONEXOES.md'), 'utf8');
const matrizTestesContent = fs.readFileSync(path.join(root, 'MATRIZ_TESTES_CONEXOES.md'), 'utf8');
const rastreabilidadeContent = fs.readFileSync(path.join(root, 'MATRIZ_RASTREABILIDADE.md'), 'utf8');
const inventarioContent = fs.readFileSync(path.join(root, 'INVENTARIO_COMPLETO.md'), 'utf8');
const baselineContent = fs.readFileSync(path.join(root, 'BASELINE_INICIAL.md'), 'utf8');

// 3. Extract edges from GRAFO_CONEXOES.md
const lines = grafoContent.split(/\r?\n/);
const edges = [];
for (const line of lines) {
  const match = line.match(/^\|\s*`(EDGE-\d{3})`\s*\|\s*`([^`]+)`/);
  if (match) {
    const edgeId = match[1];
    const rawComp = match[2];
    const compClean = rawComp.split('<br>')[0].replace(/[`\s]/g, '').trim();
    edges.push({ edgeId, rawComp, compClean });
  }
}

console.log('Total edge rows parsed in GRAFO_CONEXOES:', edges.length);

const missingFiles = [];
for (const edge of edges) {
  const fileExists = allFiles.some(f => f.endsWith('/' + edge.compClean) || f.endsWith(edge.compClean));
  if (!fileExists) {
    missingFiles.push(edge);
  }
}

console.log('Component files found in project:', (edges.length - missingFiles.length), 'of', edges.length);
if (missingFiles.length > 0) {
  console.log('Missing component files:', JSON.stringify(missingFiles, null, 2));
}

// 4. Verify DB tables from INVENTARIO_COMPLETO.md against schema
const dbInventory = JSON.parse(fs.readFileSync(path.join(root, 'audit/database-inventory.json'), 'utf8'));
const knownTables = new Set(dbInventory.source.tables);
console.log('Known authentic PostgreSQL tables in audit catalog:', knownTables.size);

const invLines = inventarioContent.split(/\r?\n/);
const inventoriedTables = [];
for (const line of invLines) {
  const m = line.match(/^\|\s*`(DB-TBL-\d{3})`\s*\|\s*`([^`]+)`/);
  if (m) {
    inventoriedTables.push({ id: m[1], table: m[2] });
  }
}
console.log('Inventoried DB tables in INVENTARIO_COMPLETO:', inventoriedTables.length);

const matchedTables = inventoriedTables.filter(t => knownTables.has(t.table));
const unmatchedTables = inventoriedTables.filter(t => !knownTables.has(t.table));
console.log('Tables matching known catalog:', matchedTables.length, 'of', inventoriedTables.length);
if (unmatchedTables.length > 0) {
  console.log('Unmatched tables:', JSON.stringify(unmatchedTables, null, 2));
}

// 5. Verify Edge Functions from INVENTARIO_COMPLETO.md
const edgeFunctions = [];
for (const line of invLines) {
  const m = line.match(/^\|\s*`(API-EDGE-\d{3})`\s*\|\s*`([^`]+)`/);
  if (m) {
    edgeFunctions.push({ id: m[1], name: m[2] });
  }
}
console.log('Inventoried Edge Functions:', edgeFunctions.length);
const missingEdgeFuncs = edgeFunctions.filter(e => !fs.existsSync(path.join(root, 'supabase/functions', e.name)));
console.log('Edge functions found on disk:', (edgeFunctions.length - missingEdgeFuncs.length), 'of', edgeFunctions.length);
if (missingEdgeFuncs.length > 0) {
  console.log('Missing Edge Functions:', missingEdgeFuncs);
}

// 6. Verify status claims
function countStatus(content) {
  const validadoCount = (content.match(/\|\s*(\*\*VALIDADO\*\*|VALIDADO)\s*\|/g) || []).length;
  const analisadoCount = (content.match(/\|\s*(\*\*ANALISADO ESTATICAMENTE\*\*|ANALISADO ESTATICAMENTE)\s*\|/g) || []).length;
  return { validadoCount, analisadoCount };
}

console.log('Status in MATRIZ_RASTREABILIDADE:', countStatus(rastreabilidadeContent));
console.log('Status in MATRIZ_TESTES_CONEXOES:', countStatus(matrizTestesContent));
console.log('Status in GRAFO_CONEXOES:', countStatus(grafoContent));
