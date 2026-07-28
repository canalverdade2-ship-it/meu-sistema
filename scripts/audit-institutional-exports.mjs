import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'artifacts');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'institutional-export-inventory.json');

const SEARCH_ROOTS = ['src', 'scripts', 'supabase/functions'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', 'artifacts']);
const SELF_PATH = 'scripts/audit-institutional-exports.mjs';

const PATTERNS = [
  { category: 'pdf-library', expression: /(?:from\s+['\"]jspdf['\"]|require\(['\"]jspdf['\"]\)|\bjsPDF\b|jspdf-autotable|autoTable\s*\()/i },
  { category: 'pdf-mime', expression: /application\/pdf/i },
  { category: 'print-as-pdf', expression: /window\.print\s*\(/i },
  { category: 'csv', expression: /(?:text\/csv|\.csv\b|exportarCSV\b|Papa\.unparse|unparse\s*\()/i },
  { category: 'exceljs', expression: /(?:from\s+['\"]exceljs['\"]|require\(['\"]exceljs['\"]\)|\bExcelJS\b|new\s+Workbook\s*\(|xlsx\.writeBuffer\s*\()/i },
  { category: 'sheetjs', expression: /(?:from\s+['\"]xlsx['\"]|require\(['\"]xlsx['\"]\)|\bXLSX\.)/i },
  { category: 'spreadsheet-mime', expression: /application\/(?:vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel)/i },
  { category: 'blob-download', expression: /(?:new\s+Blob\s*\(|URL\.createObjectURL\s*\(|\.download\s*=|setAttribute\s*\(\s*['\"]download['\"])/i },
  { category: 'file-export-action', expression: /(?:exportar|export|download|baixar|gerar\s+(?:arquivo|relat[oó]rio|pdf|excel))/i },
];

function normalizePath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const stack = [directory];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
        files.push(absolute);
      }
    }
  }

  return files.sort();
}

const sourceFiles = SEARCH_ROOTS.flatMap((root) => listFiles(path.join(ROOT, root)));
const findings = [];
const filesWithFindings = new Set();
const categories = {};

for (const absolutePath of sourceFiles) {
  const relativePath = normalizePath(absolutePath);
  if (relativePath === SELF_PATH) continue;

  const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of PATTERNS) {
      if (!pattern.expression.test(line)) continue;
      pattern.expression.lastIndex = 0;
      const finding = {
        category: pattern.category,
        file: relativePath,
        line: index + 1,
        snippet: line.trim().slice(0, 300),
      };
      findings.push(finding);
      filesWithFindings.add(relativePath);
      categories[pattern.category] = (categories[pattern.category] || 0) + 1;
    }
  });
}

const priorityFiles = [...filesWithFindings].filter((file) => {
  const fileFindings = findings.filter((finding) => finding.file === file);
  const categoriesInFile = new Set(fileFindings.map((finding) => finding.category));
  return categoriesInFile.has('pdf-library')
    || categoriesInFile.has('print-as-pdf')
    || categoriesInFile.has('csv')
    || categoriesInFile.has('exceljs')
    || categoriesInFile.has('sheetjs')
    || categoriesInFile.has('spreadsheet-mime');
});

const inventory = {
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY || null,
  ref: process.env.GITHUB_REF_NAME || null,
  scannedFiles: sourceFiles.length,
  filesWithFindings: filesWithFindings.size,
  priorityFiles: priorityFiles.sort(),
  categories: Object.fromEntries(Object.entries(categories).sort(([left], [right]) => left.localeCompare(right))),
  findings: findings.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.category.localeCompare(right.category)),
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');

console.log(`Arquivos analisados: ${inventory.scannedFiles}`);
console.log(`Arquivos com indícios de exportação: ${inventory.filesWithFindings}`);
console.log(`Arquivos prioritários: ${inventory.priorityFiles.length}`);
console.log('Categorias:');
for (const [category, count] of Object.entries(inventory.categories)) {
  console.log(`- ${category}: ${count}`);
}
console.log('Arquivos prioritários encontrados:');
for (const file of inventory.priorityFiles) {
  console.log(`- ${file}`);
}
console.log(`Inventário salvo em ${normalizePath(OUTPUT_FILE)}.`);
