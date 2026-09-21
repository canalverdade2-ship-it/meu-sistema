import fs from 'node:fs';
const text = fs.readFileSync('.env', 'utf8');
for (const line of text.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (match && /(PG|DB|DATABASE|SUPABASE)/i.test(match[1])) {
    console.log(match[1]);
  }
}
