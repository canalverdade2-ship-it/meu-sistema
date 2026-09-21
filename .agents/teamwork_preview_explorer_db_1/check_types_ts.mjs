import fs from 'fs';
import path from 'path';

const typesContent = fs.readFileSync('src/integrations/supabase/types.ts', 'utf-8');

// Match table names in Tables: { ... }
const tablesSection = typesContent.match(/Tables:\s*\{([\s\S]*?)\n\s*\}\s*Views:/);
const tableNamesInTypes = [];
if (tablesSection) {
  const tMatches = tablesSection[1].matchAll(/^\s{6}([a-zA-Z0-9_]+):\s*\{/gm);
  for (const tm of tMatches) {
    tableNamesInTypes.push(tm[1]);
  }
}

// Match functions in Functions: { ... }
const funcsSection = typesContent.match(/Functions:\s*\{([\s\S]*?)\n\s*\}\s*Enums:/);
const funcNamesInTypes = [];
if (funcsSection) {
  const fMatches = funcsSection[1].matchAll(/^\s{6}([a-zA-Z0-9_]+):\s*\{/gm);
  for (const fm of fMatches) {
    funcNamesInTypes.push(fm[1]);
  }
}

console.log(`Tables in types.ts: ${tableNamesInTypes.length}`);
console.log(`Functions in types.ts: ${funcNamesInTypes.length}`);

fs.writeFileSync('.agents/teamwork_preview_explorer_db_1/types_inventory.json', JSON.stringify({
  tables: tableNamesInTypes,
  functions: funcNamesInTypes
}, null, 2));
