const fs = require('fs');
const path = require('path');

const rootDir = 'c:\\Users\\Adriano Farias\\Downloads\\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)';

const invFile = path.join(rootDir, 'INVENTARIO_COMPLETO.md');
const grafoFile = path.join(rootDir, 'GRAFO_CONEXOES.md');
const rastrFile = path.join(rootDir, 'MATRIZ_RASTREABILIDADE.md');
const testesFile = path.join(rootDir, 'MATRIZ_TESTES_CONEXOES.md');
const baseFile = path.join(rootDir, 'BASELINE_INICIAL.md');

const inv = fs.readFileSync(invFile, 'utf8');
const grafo = fs.readFileSync(grafoFile, 'utf8');
const rastr = fs.readFileSync(rastrFile, 'utf8');
const testes = fs.readFileSync(testesFile, 'utf8');
const base = fs.readFileSync(baseFile, 'utf8');

console.log('========================================================================');
console.log('MILESTONE 1 DELIVERABLES — INDEPENDENT RECONCILIATION AUDIT');
console.log('========================================================================\n');

// 1. Audit INVENTARIO_COMPLETO.md
console.log('--- 1. AUDITING INVENTARIO_COMPLETO.md ---');

function checkSequence(content, prefix, expectedCount, padLen) {
  // Matches `PREFIX-001` or | `PREFIX-001` |
  const regex = new RegExp('`' + prefix + '-(\\d+)`', 'g');
  const found = new Set();
  let m;
  while ((m = regex.exec(content)) !== null) {
    found.add(m[1]);
  }

  const missing = [];
  for (let i = 1; i <= expectedCount; i++) {
    const s = String(i).padStart(padLen, '0');
    if (!found.has(s)) {
      missing.push(prefix + '-' + s);
    }
  }

  const extra = [];
  for (const item of found) {
    const n = parseInt(item, 10);
    if (n < 1 || n > expectedCount) {
      extra.push(prefix + '-' + item);
    }
  }

  const isOk = found.size === expectedCount && missing.length === 0 && extra.length === 0;
  console.log(`[${isOk ? 'PASS' : 'FAIL'}] ${prefix.padEnd(10)}: Found ${found.size} / Expected ${expectedCount} | Missing: ${missing.length} | Extra: ${extra.length}`);
  if (missing.length > 0) console.log(`       Missing (first 5): ${missing.slice(0, 5).join(', ')}`);
  if (extra.length > 0) console.log(`       Extra (first 5): ${extra.slice(0, 5).join(', ')}`);
  return { prefix, foundCount: found.size, expectedCount, missing, extra, isOk };
}

const rMod = checkSequence(inv, 'UI-MOD', 15, 2);
const rPage = checkSequence(inv, 'UI-PAGE', 72, 3);
const rForm = checkSequence(inv, 'UI-FORM', 54, 3);
const rBtn = checkSequence(inv, 'UI-BTN', 118, 3);
const rTbl = checkSequence(inv, 'UI-TBL', 42, 3);
const rMdl = checkSequence(inv, 'UI-MDL', 48, 3);
const rDbTbl = checkSequence(inv, 'DB-TBL', 294, 3);
const rRpc = checkSequence(inv, 'DB-RPC', 692, 3);
const rEdge = checkSequence(inv, 'API-EDGE', 17, 3);
const rWh = checkSequence(inv, 'API-WH', 15, 3);
const rEnd = checkSequence(inv, 'API-END', 10, 3);

const totalInventory = rMod.foundCount + rPage.foundCount + rForm.foundCount + rBtn.foundCount +
  rTbl.foundCount + rMdl.foundCount + rDbTbl.foundCount + rRpc.foundCount +
  rEdge.foundCount + rWh.foundCount + rEnd.foundCount;

console.log(`Total cataloged elements in INVENTARIO_COMPLETO: ${totalInventory} (Expected 1377: ${totalInventory === 1377 ? 'PASS' : 'FAIL'})\n`);

// Check for forbidden VALIDADO claims in INVENTARIO_COMPLETO
const invValidado = (inv.match(/\|\s*VALIDADO\s*\|/gi) || []).length;
console.log(`Forbidden VALIDADO status in INVENTARIO_COMPLETO table rows: ${invValidado} (Expected 0: ${invValidado === 0 ? 'PASS' : 'FAIL'})\n`);

// 2. Audit GRAFO_CONEXOES.md
console.log('--- 2. AUDITING GRAFO_CONEXOES.md ---');
const rGrafoEdges = checkSequence(grafo, 'EDGE', 80, 3);

// Verify edge 5-level tuples in GRAFO_CONEXOES.md
const edgeBlocks = grafo.split(/###\s*Aresta:\s*`EDGE-/).slice(1);
console.log(`Parsed ${edgeBlocks.length} detailed edge blocks in GRAFO_CONEXOES.md`);

let tuplePassCount = 0;
const tupleFailures = [];

for (const block of edgeBlocks) {
  const edgeIdMatch = block.match(/^(\d{3})`/);
  const edgeId = edgeIdMatch ? 'EDGE-' + edgeIdMatch[1] : 'UNKNOWN';
  
  const hasUI = block.includes('1. **Origem (UI)**');
  const hasHandler = block.includes('2. **Handler Local**');
  const hasService = block.includes('3. **Método de Serviço / Hook**');
  const hasAPI = block.includes('4. **Backend Endpoint / RPC**');
  const hasDB = block.includes('5. **Tabelas do Banco de Dados**');
  const hasPropagation = block.includes('**Alvo de Propagação Cross-Módulo**');
  const hasStatus = block.includes('**Status Canônico**') && block.includes('ANALISADO ESTATICAMENTE');
  
  if (hasUI && hasHandler && hasService && hasAPI && hasDB && hasPropagation && hasStatus) {
    tuplePassCount++;
  } else {
    tupleFailures.push({ edgeId, hasUI, hasHandler, hasService, hasAPI, hasDB, hasPropagation, hasStatus });
  }
}
console.log(`[${tupleFailures.length === 0 && tuplePassCount === 80 ? 'PASS' : 'FAIL'}] 5-level Tuples + Propagation + Status in GRAFO_CONEXOES: ${tuplePassCount}/80 complete`);
if (tupleFailures.length > 0) {
  console.log('Tuple failures:', JSON.stringify(tupleFailures.slice(0, 3)));
}

// Check for false VALIDADO in GRAFO_CONEXOES
const grafoValidado = (grafo.match(/\|\s*VALIDADO\s*\|/gi) || []).length;
console.log(`Forbidden VALIDADO status in GRAFO_CONEXOES: ${grafoValidado} (Expected 0: ${grafoValidado === 0 ? 'PASS' : 'FAIL'})\n`);

// 3. Audit MATRIZ_RASTREABILIDADE.md
console.log('--- 3. AUDITING MATRIZ_RASTREABILIDADE.md ---');
const rRastrTrc = checkSequence(rastr, 'TRC', 80, 3);
const rRastrEdge = checkSequence(rastr, 'EDGE', 80, 3);

const rastrValidado = (rastr.match(/\|\s*VALIDADO\s*\|/gi) || []).length;
console.log(`Forbidden VALIDADO status in MATRIZ_RASTREABILIDADE: ${rastrValidado} (Expected 0: ${rastrValidado === 0 ? 'PASS' : 'FAIL'})\n`);

// 4. Audit MATRIZ_TESTES_CONEXOES.md
console.log('--- 4. AUDITING MATRIZ_TESTES_CONEXOES.md ---');
const rTestesEdge = checkSequence(testes, 'EDGE', 80, 3);

// Verify required test sections in MATRIZ_TESTES_CONEXOES.md
const testBlocks = testes.split(/###\s*Especificação de Teste:\s*`EDGE-/).slice(1);
console.log(`Parsed ${testBlocks.length} test specification blocks in MATRIZ_TESTES_CONEXOES.md`);

let testSpecPassCount = 0;
const testSpecFailures = [];

for (const block of testBlocks) {
  const edgeIdMatch = block.match(/^(\d{3})`/);
  const edgeId = edgeIdMatch ? 'EDGE-' + edgeIdMatch[1] : 'UNKNOWN';
  
  const hasHappy = block.includes('**Cenário Positivo**');
  const hasNegative = block.includes('**Cenário Negativo & Resiliência**');
  const hasPersistence = block.includes('**Método de Verificação de Persistência no Banco**');
  const hasPropagation = block.includes('**Método de Validação da Propagação Cross-Módulo**');
  const hasStatus = block.includes('**Status de Auditoria**') && block.includes('ANALISADO ESTATICAMENTE');
  
  if (hasHappy && hasNegative && hasPersistence && hasPropagation && hasStatus) {
    testSpecPassCount++;
  } else {
    testSpecFailures.push({ edgeId, hasHappy, hasNegative, hasPersistence, hasPropagation, hasStatus });
  }
}
console.log(`[${testSpecFailures.length === 0 && testSpecPassCount === 80 ? 'PASS' : 'FAIL'}] Complete Test Specs (Happy+Negative+Persistence+Propagation) in MATRIZ_TESTES_CONEXOES: ${testSpecPassCount}/80 complete`);
if (testSpecFailures.length > 0) {
  console.log('Test spec failures:', JSON.stringify(testSpecFailures.slice(0, 3)));
}

const testesValidado = (testes.match(/\|\s*VALIDADO\s*\|/gi) || []).length;
console.log(`Forbidden VALIDADO status in MATRIZ_TESTES_CONEXOES: ${testesValidado} (Expected 0: ${testesValidado === 0 ? 'PASS' : 'FAIL'})\n`);

// 5. Check 1:1 Edge Mappings Across Deliverables
console.log('--- 5. CHECKING 1:1 EDGE MAPPINGS ACROSS ALL DELIVERABLES ---');

function getEdgeSet(text) {
  const set = new Set();
  const m = text.matchAll(/`EDGE-(\d{3})`/g);
  for (const match of m) {
    set.add('EDGE-' + match[1]);
  }
  return set;
}

const sGrafo = getEdgeSet(grafo);
const sRastr = getEdgeSet(rastr);
const sTestes = getEdgeSet(testes);

let mappingOk = true;
for (let i = 1; i <= 80; i++) {
  const edgeId = 'EDGE-' + String(i).padStart(3, '0');
  const inGrafo = sGrafo.has(edgeId);
  const inRastr = sRastr.has(edgeId);
  const inTestes = sTestes.has(edgeId);
  if (!inGrafo || !inRastr || !inTestes) {
    console.log(`Mapping failure for ${edgeId}: Grafo=${inGrafo}, Rastr=${inRastr}, Testes=${inTestes}`);
    mappingOk = false;
  }
}
console.log(`1:1 Edge Reconciliation across GRAFO_CONEXOES, MATRIZ_RASTREABILIDADE and MATRIZ_TESTES_CONEXOES: [${mappingOk ? 'PASS' : 'FAIL'}]\n`);

// 6. Check Baseline Document
console.log('--- 6. AUDITING BASELINE_INICIAL.md ---');
const baseTsc = base.includes('ScrapingAdminModule.tsx') && base.includes('TS2322');
const baseVitest = base.includes('1.908') && base.includes('1.895') && base.includes('13');
const baseMig = base.includes('20260831143000') && base.includes('20260831203000');
const baseBuild = base.includes('npm run build') && base.includes('4.555') && base.includes('dist/');
const baseRealtime = base.includes('REALTIME_RESILIENCE_CONTRACTS_OK');
const baseSchema = base.includes('validate-db-schema.cjs');

console.log(`TSC TS2322 Documented: ${baseTsc ? 'PASS' : 'FAIL'}`);
console.log(`Vitest 13 failures Documented: ${baseVitest ? 'PASS' : 'FAIL'}`);
console.log(`Migration duplicate versions Documented: ${baseMig ? 'PASS' : 'FAIL'}`);
console.log(`Vite build results Documented: ${baseBuild ? 'PASS' : 'FAIL'}`);
console.log(`Realtime contracts Documented: ${baseRealtime ? 'PASS' : 'FAIL'}`);
console.log(`Schema snapshot Documented: ${baseSchema ? 'PASS' : 'FAIL'}`);

console.log('\n========================================================================');
console.log('FINAL RECONCILIATION RESULT');
console.log('========================================================================');
const overallPass = rMod.isOk && rPage.isOk && rForm.isOk && rBtn.isOk && rTbl.isOk && rMdl.isOk &&
  rDbTbl.isOk && rRpc.isOk && rEdge.isOk && rWh.isOk && rEnd.isOk && (totalInventory === 1377) &&
  rGrafoEdges.isOk && rRastrTrc.isOk && rRastrEdge.isOk && rTestesEdge.isOk &&
  mappingOk && tupleFailures.length === 0 && testSpecFailures.length === 0 &&
  invValidado === 0 && grafoValidado === 0 && rastrValidado === 0 && testesValidado === 0 &&
  baseTsc && baseVitest && baseMig && baseBuild && baseRealtime && baseSchema;

console.log(`OVERALL RECONCILIATION STATUS: ${overallPass ? 'ALL CHECKS PASSED (100% MATHEMATICAL & STRUCTURAL INTEGRITY)' : 'FAILED'}`);
