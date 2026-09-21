import fs from 'fs';
import path from 'path';

const clientDir = path.resolve('src/components/client');
const projectRoot = path.resolve('.');

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const clientFiles = getAllFiles(clientDir);
console.log(`Total client files inspected: ${clientFiles.length}`);

// 1. Unicode replacement character check (\uFFFD)
console.log('\n--- 1. UNICODE REPLACEMENT CHARACTER (\\uFFFD) ---');
let ufffdCount = 0;
for (const file of clientFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('\uFFFD')) {
    const rel = path.relative(projectRoot, file);
    const matches = content.split('\n').map((l, i) => ({ line: i + 1, text: l })).filter(x => x.text.includes('\uFFFD'));
    console.log(`FOUND \\uFFFD in ${rel}: ${matches.length} occurrences`);
    matches.forEach(m => console.log(`  L${m.line}: ${m.text.trim()}`));
    ufffdCount += matches.length;
  }
}
console.log(`Total \\uFFFD in client components: ${ufffdCount}`);

// 2. Mojibake inspection
console.log('\n--- 2. MOJIBAKE PATTERNS ---');
const mojibakeRegex = /(Ã¡|Ã©|Ã­|Ã³|Ãº|Ã£|Ãµ|Ã¢|Ãª|Ã´|Ã§|Ã€|Ã|Ã‰|Ã|Ã“|Ãš|Ãƒ|Ã•|Ã‚|ÃŠ|Ã”|Ã‡|â‚¬|â€™|â€œ|â€|Âº|Âª)/g;
let mojibakeTotal = 0;
for (const file of clientFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const found = [];
  lines.forEach((line, idx) => {
    // Check if line contains mojibake
    const m = line.match(mojibakeRegex);
    if (m) {
      found.push({ line: idx + 1, matched: m, text: line.trim() });
    }
  });
  if (found.length > 0) {
    const rel = path.relative(projectRoot, file);
    console.log(`Mojibake found in ${rel}: ${found.length} matches`);
    found.forEach(f => console.log(`  L${f.line}: ${f.matched.join(', ')} -> ${f.text.substring(0, 100)}`));
    mojibakeTotal += found.length;
  }
}
console.log(`Total mojibake occurrences: ${mojibakeTotal}`);

// 3. Inspect what the previous script called "Dangling JSX assignment"
console.log('\n--- 3. DETAILED JSX / ARTIFACT ANALYSIS ---');
const artifactRegex = /=\s*inputMode\s*=\s*"[^"]*">/g;
let artifactCount = 0;
for (const file of clientFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (artifactRegex.test(content)) {
    const rel = path.relative(projectRoot, file);
    console.log(`FOUND inputMode artifact in ${rel}`);
    artifactCount++;
  }
}
console.log(`Total inputMode artifacts in client: ${artifactCount}`);

// 4. Broken fragments
console.log('\n--- 4. FRAGMENTS CHECK ---');
let fragErrors = 0;
for (const file of clientFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const openFrags = (content.match(/<>|<React\.Fragment>/g) || []).length;
  const closeFrags = (content.match(/<\/>|<\/React\.Fragment>/g) || []).length;
  if (openFrags !== closeFrags) {
    const rel = path.relative(projectRoot, file);
    console.log(`Unbalanced fragments in ${rel}: <>=${openFrags}, </>=${closeFrags}`);
    fragErrors++;
  }
}
console.log(`Total fragment imbalances: ${fragErrors}`);

