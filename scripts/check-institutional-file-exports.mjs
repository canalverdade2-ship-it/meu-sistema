import fs from 'node:fs';

const institutionalPath = 'src/lib/institutionalFileExport.ts';
const legacyPath = 'src/components/admin/relatorios/utils/relatorioExport.ts';
const institutional = fs.readFileSync(institutionalPath, 'utf8');
const legacy = fs.readFileSync(legacyPath, 'utf8');
const legacyExecutable = legacy
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(institutional.includes("import('exceljs')"), 'O gerador deve usar ExcelJS para criar planilhas reais.');
assert(institutional.includes("import('jspdf')"), 'O gerador deve usar jsPDF para criar PDFs reais.');
assert(institutional.includes("import('jspdf-autotable')"), 'O PDF deve usar tabelas paginadas e estruturadas.');
assert(institutional.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), 'A planilha deve usar o MIME oficial do formato XLSX.');
assert(institutional.includes('worksheet.autoFilter'), 'A planilha deve habilitar filtros no cabeçalho.');
assert(institutional.includes("state: 'frozen'"), 'A planilha deve congelar o cabeçalho.');
assert(institutional.includes('printTitlesRow'), 'A planilha deve repetir o cabeçalho durante a impressão.');
assert(institutional.includes('headerFooter'), 'A planilha deve possuir cabeçalho e rodapé institucionais.');
assert(institutional.includes('document.setProperties'), 'O PDF deve possuir metadados institucionais.');
assert(institutional.includes('didDrawPage'), 'O PDF deve repetir cabeçalho e rodapé nas páginas.');
assert(institutional.includes('sanitizeExcelText'), 'A planilha deve neutralizar fórmulas injetadas por conteúdo textual.');
assert(institutional.includes('URL.revokeObjectURL'), 'URLs temporárias de download devem ser revogadas.');
assert(!legacyExecutable.includes('window.print()'), 'O legado não pode continuar usando window.print() como geração de PDF.');
assert(!legacyExecutable.includes("type: 'text/csv"), 'O legado não pode continuar produzindo CSV como relatório principal.');
assert(legacy.includes('return exportarExcel'), 'A assinatura legada exportarCSV deve redirecionar para Excel institucional.');
assert(legacy.includes('exportVisibleReportAsPdf'), 'O PDF legado deve ser convertido para um documento estruturado.');

console.log('Contratos de arquivos institucionais aprovados.');
