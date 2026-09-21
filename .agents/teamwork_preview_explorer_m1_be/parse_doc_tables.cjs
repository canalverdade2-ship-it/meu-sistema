const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const docPath = path.join(root, 'DOCUMENTACAO_SISTEMA.md');
const content = fs.readFileSync(docPath, 'utf8');

// Match domains:
// #### Domínio X: Title (N tabelas)
const domainRegex = /#### Domínio\s+(\d+):\s+([^(]+)\((\d+)\s+tabelas?\)([\s\S]*?)(?=#### Domínio|\n---\n|### 2\.3)/gi;

const domains = [];
let match;
while ((match = domainRegex.exec(content)) !== null) {
  const domainNum = parseInt(match[1], 10);
  const domainTitle = match[2].trim();
  const expectedTableCount = parseInt(match[3], 10);
  const domainBody = match[4];

  // Extract table names
  // Usually bullet points like: - **table_name**: ... or - **table_a**, **table_b**, ...
  const tables = [];
  const boldMatches = domainBody.match(/\*\*([a-zA-Z0-9_]+)\*\*/g) || [];
  boldMatches.forEach(b => {
    const tName = b.replace(/\*\*/g, '').trim().toLowerCase();
    if (!['id', 'uuid', 'pk', 'fk', 'unique', 'boolean', 'integer', 'decimal', 'text', 'jsonb', 'timestamptz', 'date', 'check', 'default'].includes(tName)) {
      if (!tables.includes(tName)) tables.push(tName);
    }
  });

  // Also check inline lists like `table_a`, `table_b`
  const codeMatches = domainBody.match(/`([a-zA-Z0-9_]+)`/g) || [];
  codeMatches.forEach(c => {
    const tName = c.replace(/`/g, '').trim().toLowerCase();
    if (tName.includes('_') && !['created_at', 'updated_at', 'p_sessao_id', 'p_session_token', 'p_payload', 'auth_user_id', 'search_path', 'set_config', 'for_update'].includes(tName)) {
      // if it looks like table and not in tables, we can check
    }
  });

  domains.push({
    num: domainNum,
    title: domainTitle,
    expectedCount: expectedTableCount,
    foundCount: tables.length,
    tables,
    body: domainBody.trim()
  });
}

console.log('=== 17 DOMAINS PARSED FROM DOCUMENTACAO_SISTEMA.md ===');
let totalExpected = 0;
let totalFound = 0;
domains.forEach(d => {
  totalExpected += d.expectedCount;
  totalFound += d.foundCount;
  console.log(`Domain ${d.num} [${d.expectedCount} expected, ${d.foundCount} found]: ${d.title}`);
});
console.log(`TOTAL EXPECTED: ${totalExpected} | TOTAL FOUND DIRECTLY: ${totalFound}`);

fs.writeFileSync(path.join(__dirname, 'doc_domains.json'), JSON.stringify(domains, null, 2), 'utf8');
