const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let res = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) res = res.concat(getFiles(p));
    else if (p.endsWith('.tsx')) res.push(p);
  }
  return res;
}

const files = getFiles(path.resolve('src/components/client'));
const suspiciousPatterns = [
  { name: 'Double closing bracket >>', regex: />\s*>/g },
  { name: 'Double opening bracket <<', regex: /<\s*</g },
  { name: 'Unfinished equals attribute', regex: /\b[a-zA-Z0-9_-]+=\s*>/g },
  { name: 'Double equals in tag attribute', regex: /<[a-zA-Z][^>]*={2,}[^>]*>/g },
  { name: 'Broken inputMode artifact', regex: /=\s*inputMode/g }
];

let totalHits = 0;
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  for (const p of suspiciousPatterns) {
    // Exclude legitimate >> or << operators in JS/TS if not part of JSX
    const matches = content.match(p.regex);
    if (matches) {
      console.log(`Match for "${p.name}" in ${path.relative(process.cwd(), f)}: Count ${matches.length}`);
      totalHits += matches.length;
    }
  }
}
console.log('Total suspicious pattern hits:', totalHits);
