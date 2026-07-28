import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');
const executable = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

const institutionalCore = read('src/lib/institutionalReportCore.ts');
const institutionalExcel = read('src/lib/institutionalExcelExport.ts');
const institutionalPdf = read('src/lib/institutionalPdfExport.ts');
const institutional = [institutionalCore, institutionalExcel, institutionalPdf].join('\n');
const legacyPath = 'src/components/admin/relatorios/utils/relatorioExport.ts';
const reportsDirectory = 'src/components/admin/relatorios';
const legacy = read(legacyPath);
const legacyExecutable = executable(legacy);
const demandas = executable(read('src/components/admin/demandas/DemandasTabela.tsx'));
const fiscalAdmin = executable(read('src/components/admin/FiscalModule.tsx'));
const fiscalClient = executable(read('src/components/client/financeiro/NotasFiscaisList.tsx'));
const fiscalReceipt = read('src/lib/fiscalReceiptPdf.ts');
const operationalPdf = read('src/lib/pdf.ts');
const calculatorsPdf = read('src/lib/freeToolsPdfReport.ts');
const reportFiles = fs.readdirSync(reportsDirectory)
  .filter((file) => /^Relatorio.*\.tsx$/.test(file))
  .map((file) => ({ file, source: read(path.join(reportsDirectory, file)) }));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(institutionalExcel.includes("import('exceljs')"), 'O gerador deve usar ExcelJS para criar planilhas reais.');
assert(institutionalPdf.includes("import('jspdf')"), 'O gerador deve usar jsPDF para criar PDFs reais.');
assert(institutionalPdf.includes("import('jspdf-autotable')"), 'O PDF deve usar tabelas paginadas e estruturadas.');
assert(institutionalExcel.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'A planilha deve usar o MIME oficial do formato XLSX.');
assert(institutionalExcel.includes('worksheet.autoFilter'), 'A planilha deve habilitar filtros no cabeçalho.');
assert(institutionalExcel.includes("state: 'frozen'"), 'A planilha deve congelar o cabeçalho.');
assert(institutionalExcel.includes('printTitlesRow'), 'A planilha deve repetir o cabeçalho durante a impressão.');
assert(institutionalExcel.includes('headerFooter'), 'A planilha deve possuir cabeçalho e rodapé institucionais.');
assert(institutionalExcel.includes('worksheet.mergeCells(summaryStart'), 'Os indicadores do resumo devem ocupar cartões mesclados sem sobreposição.');
assert(institutionalCore.includes('\"R$\" #,##0.00'), 'O formato monetário do Excel deve usar o literal BRL compatível.');
assert(institutionalCore.includes("cell.numFmt = '#,##0.##'"), 'Números inteiros não devem receber casas decimais artificiais.');
assert(institutionalPdf.includes('document.setProperties'), 'O PDF deve possuir metadados institucionais.');
assert(institutionalPdf.includes('didDrawPage'), 'O PDF deve repetir cabeçalho e rodapé nas páginas.');
assert(institutionalCore.includes('sanitizeExcelText'), 'A planilha deve neutralizar fórmulas injetadas por conteúdo textual.');
assert(institutionalCore.includes('URL.revokeObjectURL'), 'URLs temporárias de download devem ser revogadas.');
assert(institutionalCore.includes("currency: 'BRL'"), 'Moedas devem usar o padrão brasileiro BRL.');

assert(!legacyExecutable.includes('window.print()'), 'O legado não pode continuar usando window.print() como geração de PDF.');
assert(!legacyExecutable.includes("type: 'text/csv"), 'O legado não pode continuar produzindo CSV como relatório principal.');
assert(legacy.includes('return exportarExcel'), 'A assinatura legada exportarCSV deve redirecionar para Excel institucional.');
assert(legacy.includes('exportVisibleReportAsPdf'), 'O PDF legado deve ser convertido para um documento estruturado.');

for (const report of reportFiles) {
  assert(!report.source.includes('exportarCSV'), `${report.file} ainda utiliza exportação CSV.`);
  if (report.source.includes('exportarExcel')) {
    assert(!/>CSV(?:\s|<)/.test(report.source), `${report.file} ainda apresenta CSV como saída principal.`);
  }
}

assert(demandas.includes('exportInstitutionalExcel'), 'Demandas deve gerar Excel institucional.');
assert(!demandas.includes("type: 'text/csv"), 'Demandas não pode gerar CSV diretamente.');
assert(demandas.includes('filters:'), 'A planilha de demandas deve registrar os filtros aplicados.');
assert(demandas.includes('summary:'), 'A planilha de demandas deve registrar um resumo da exportação.');

assert(fiscalAdmin.includes('downloadFiscalReceiptPdf'), 'O painel fiscal deve usar o recibo PDF institucional.');
assert(fiscalClient.includes('downloadFiscalReceiptPdf'), 'O Portal do Cliente deve usar o recibo PDF institucional.');
assert(!fiscalAdmin.includes('window.print()'), 'O painel fiscal não pode imprimir a tela como PDF.');
assert(!fiscalClient.includes('printWindow.print()'), 'O Portal do Cliente não pode imprimir uma janela como PDF.');
assert(fiscalReceipt.includes('exportInstitutionalPdf'), 'O recibo fiscal deve reutilizar o gerador PDF institucional.');
assert(fiscalReceipt.includes("confidentiality: 'Documento fiscal"), 'O recibo fiscal deve declarar sua classificação de uso.');

assert(operationalPdf.includes('configureDocumentMetadata'), 'Orçamentos, OS e faturas devem possuir metadados.');
assert(operationalPdf.includes('compress: true'), 'Orçamentos, OS e faturas devem habilitar compressão.');
assert(operationalPdf.includes('putOnlyUsedFonts: true'), 'Orçamentos, OS e faturas devem incorporar somente fontes utilizadas.');
assert(operationalPdf.includes('gsa-orcamento-'), 'O nome do orçamento deve seguir o padrão institucional.');
assert(operationalPdf.includes('gsa-os-'), 'O nome da ordem de serviço deve seguir o padrão institucional.');
assert(operationalPdf.includes('gsa-fatura-'), 'O nome da fatura deve seguir o padrão institucional.');
assert(operationalPdf.includes('[11,  31,  58]'), 'Os PDFs operacionais devem usar o azul-marinho institucional.');
assert(operationalPdf.includes('[198, 161, 91]'), 'Os PDFs operacionais devem usar o dourado institucional.');

assert(calculatorsPdf.includes('compress: true'), 'Os PDFs das calculadoras devem habilitar compressão.');
assert(calculatorsPdf.includes('putOnlyUsedFonts: true'), 'Os PDFs das calculadoras devem incorporar somente fontes utilizadas.');
assert(calculatorsPdf.includes('keywords:'), 'Os PDFs das calculadoras devem possuir palavras-chave nos metadados.');
assert(calculatorsPdf.includes('Página ${page} de ${pageCount}'), 'Os PDFs das calculadoras devem usar paginação revisada.');
assert(calculatorsPdf.includes('GSA HUB — Ferramentas públicas'), 'Os PDFs das calculadoras devem identificar a origem institucional.');

console.log(`Contratos de arquivos institucionais aprovados em ${reportFiles.length} relatórios administrativos.`);
