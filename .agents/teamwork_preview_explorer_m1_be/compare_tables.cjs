const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const docPath = path.join(root, 'DOCUMENTACAO_SISTEMA.md');
const catalogPath = path.join(__dirname, 'catalog_complete.json');

const docContent = fs.readFileSync(docPath, 'utf8');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const extractedTableNames = new Set(catalog.tables.map(t => t.name.toLowerCase()));

// Look at Section 2.2 in DOCUMENTACAO_SISTEMA.md
const lines = docContent.split('\n');
let inDomainSection = false;
const docTables = new Set();

lines.forEach(line => {
  if (line.includes('### 2.2 Catálogo Detalhado das 294 Tabelas')) inDomainSection = true;
  if (line.includes('### 2.3 Matriz de Políticas RLS')) inDomainSection = false;
  if (inDomainSection) {
    // Look for bold table names or bullet points with table names
    // e.g. - **sistema_sessoes**: or - **gsa_tv_channels**, **gsa_tv_media_items**
    const boldMatches = line.match(/\*\*([a-zA-Z0-9_]+)\*\*/g);
    if (boldMatches) {
      boldMatches.forEach(b => {
        const name = b.replace(/\*\*/g, '').toLowerCase();
        // filter out domain titles or keywords
        if (!['domínio', 'id', 'uuid', 'text', 'boolean', 'integer', 'decimal', 'timestamp', 'check', 'unique'].includes(name)) {
          docTables.add(name);
        }
      });
    }
    // Also inline code `table_name`
    const codeMatches = line.match(/`([a-zA-Z0-9_]+)`/g);
    if (codeMatches) {
      codeMatches.forEach(c => {
        const name = c.replace(/`/g, '').toLowerCase();
        if (name.includes('_') && !['created_at', 'updated_at', 'p_sessao_id', 'p_session_token', 'p_payload', 'auth_user_id', 'search_path', 'gsa_jwt_actor_type', 'gsa_jwt_actor_id'].includes(name)) {
          // check if looks like table
          // docTables.add(name);
        }
      });
    }
  }
});

console.log(`Tables explicitly mentioned in Documentacao Domain section: ${docTables.size}`);
console.log(`Tables extracted from SQL migrations: ${extractedTableNames.size}`);

const missingInMigrations = [];
docTables.forEach(t => {
  if (!extractedTableNames.has(t)) missingInMigrations.push(t);
});

console.log(`Tables in Doc but not in SQL parsed: ${missingInMigrations.length}`);
console.log(missingInMigrations);
