import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const sdDir = path.join(root, 'src', 'components', 'admin', 'super-domains');
const files = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walk(full);
    else if (f.name.endsWith('.tsx') || f.name.endsWith('.ts')) files.push(full);
  }
}
walk(sdDir);

const findings = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const rel = path.relative(root, file).replaceAll('\\', '/');

  // Search for supabase.from(...)
  const regex = /supabase\s*\.from(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const tableName = match[1];
    const charIndex = match.index;
    const lineNumber = content.slice(0, charIndex).split('\n').length;
    
    // Lookahead for chained methods up to next semicolon or ~600 chars
    const snippet = content.slice(charIndex, charIndex + 800);
    const endCall = snippet.search(/;\s*(?:\n|\/\/|\/\*|$)/);
    const fullCall = endCall !== -1 ? snippet.slice(0, endCall + 1) : snippet;

    findings.push({
      file: rel,
      line: lineNumber,
      table: tableName,
      callSnippet: fullCall.replace(/\s+/g, ' ').slice(0, 300),
    });
  }
}

fs.writeFileSync(
  path.join(root, '.agents', 'explorer_diag_db_1', 'sd_all_supabase_calls.json'),
  JSON.stringify(findings, null, 2)
);

console.log(`Found ${findings.length} Supabase calls in super-domains.`);
