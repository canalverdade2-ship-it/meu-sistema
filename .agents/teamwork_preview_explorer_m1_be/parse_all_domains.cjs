const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const docPath = path.join(root, 'DOCUMENTACAO_SISTEMA.md');
const content = fs.readFileSync(docPath, 'utf8');

// Section 2.2 begins at "### 2.2 Catálogo Detalhado das 294 Tabelas" and ends before "### 2.3"
const startIdx = content.indexOf('### 2.2 Catálogo Detalhado das 294 Tabelas');
const endIdx = content.indexOf('### 2.3 Matriz de Políticas RLS');
const sec22 = content.substring(startIdx, endIdx);

const domainBlocks = sec22.split(/#### Domínio\s+/i).slice(1);

const domains = [];
let allDiscoveredTables = [];

domainBlocks.forEach(block => {
  const firstLine = block.split('\n')[0];
  // Example: "1: Autenticação, Sessões & Governança de Segurança (55 tabelas)"
  // Example: "2: CRM & Clientes (Identidade, VIP, Indicações, Bloqueios) (9 tabelas)"
  const headerMatch = firstLine.match(/^(\d+):\s*(.*?)\s*\((\d+)\s+tabelas?\)/);
  if (!headerMatch) {
    console.warn('Failed to parse header:', firstLine);
    return;
  }
  const domainNum = parseInt(headerMatch[1], 10);
  const domainName = headerMatch[2].trim();
  const expectedCount = parseInt(headerMatch[3], 10);

  const blockBody = block.substring(firstLine.length);

  // Extract table names
  const domainTables = [];

  // Match bold entries: - **table_name**: or - **tbl1**, **tbl2**, ...
  const lines = blockBody.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- **') || trimmed.startsWith('- *Demais tabelas') || trimmed.startsWith('- *Tabelas complementares')) {
      const boldItems = trimmed.match(/\*\*([a-zA-Z0-9_]+)\*\*/g) || [];
      boldItems.forEach(b => {
        const t = b.replace(/\*\*/g, '').trim().toLowerCase();
        if (!['id', 'uuid', 'pk', 'fk', 'unique', 'boolean', 'integer', 'decimal', 'text', 'jsonb', 'timestamptz', 'date', 'check', 'default'].includes(t)) {
          if (!domainTables.includes(t)) domainTables.push(t);
        }
      });
      const codeItems = trimmed.match(/`([a-zA-Z0-9_]+)`/g) || [];
      codeItems.forEach(c => {
        const t = c.replace(/`/g, '').trim().toLowerCase();
        if (t.includes('_') && !['created_at', 'updated_at', 'p_sessao_id', 'p_session_token', 'p_payload', 'auth_user_id', 'search_path', 'set_config', 'for_update'].includes(t)) {
          if (!domainTables.includes(t)) domainTables.push(t);
        }
      });
    }
  });

  domains.push({
    num: domainNum,
    name: domainName,
    expectedCount,
    extractedCount: domainTables.length,
    tables: domainTables
  });

  allDiscoveredTables.push(...domainTables);
});

console.log('=== PARSED ALL 17 DOMAINS ===');
let sumExpected = 0;
let sumExtracted = 0;
domains.forEach(d => {
  sumExpected += d.expectedCount;
  sumExtracted += d.extractedCount;
  console.log(`Domain ${d.num.toString().padStart(2, ' ')}: [Exp: ${d.expectedCount.toString().padStart(2, ' ')} | Ext: ${d.extractedCount.toString().padStart(2, ' ')}] ${d.name}`);
});
console.log(`TOTAL EXPECTED: ${sumExpected} | TOTAL EXTRACTED: ${sumExtracted}`);

fs.writeFileSync(path.join(__dirname, 'all_17_domains_tables.json'), JSON.stringify(domains, null, 2), 'utf8');
