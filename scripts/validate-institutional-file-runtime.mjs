import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.INSTITUTIONAL_EXPORT_TEST_URL || 'http://127.0.0.1:4173/runtime-export-test.html';
const OUTPUT_DIR = path.resolve('artifacts/institutional-runtime');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function openWithRetry(page) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 5_000 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw lastError;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await openWithRetry(page);

  const generated = await page.evaluate(async () => {
    const captured = { blob: null, fileName: '' };
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    const originalClick = HTMLAnchorElement.prototype.click;

    URL.createObjectURL = (blob) => {
      captured.blob = blob;
      return 'blob:institutional-runtime-validation';
    };
    URL.revokeObjectURL = () => undefined;
    HTMLAnchorElement.prototype.click = function click() {
      captured.fileName = this.download;
    };

    const toBase64 = (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    try {
      const exporter = await import('/src/lib/institutionalFileExport.ts');
      const rows = Array.from({ length: 64 }, (_, index) => ({
        cliente: index === 0 ? '=2+2' : `Cliente ${String(index + 1).padStart(2, '0')}`,
        valor: 1234.56 + index * 17.35,
        percentual: 0.12 + index / 10_000,
        emissao: new Date(Date.UTC(2026, 6, 1 + (index % 27), 12, index % 60)).toISOString(),
        status: index % 2 === 0 ? 'Concluído' : 'Em análise',
      }));
      const columns = [
        { key: 'cliente', label: 'Cliente', type: 'text', width: 30 },
        { key: 'valor', label: 'Valor', type: 'currency', width: 18 },
        { key: 'percentual', label: 'Índice', type: 'percentage', width: 14 },
        { key: 'emissao', label: 'Emissão', type: 'datetime', width: 20 },
        { key: 'status', label: 'Status', type: 'text', width: 18 },
      ];
      const options = {
        title: 'Relatório de Validação Institucional',
        subtitle: 'Amostra automatizada para validar estrutura, paginação, metadados e qualidade dos arquivos do GSA HUB.',
        fileName: 'validacao-institucional',
        sheetName: 'Validação',
        rows,
        columns,
        period: 'Julho de 2026',
        filters: { status: 'Todos', unidade: 'GSA HUB' },
        summary: [
          { label: 'Registros', value: rows.length, type: 'number' },
          { label: 'Valor total', value: rows.reduce((total, row) => total + row.valor, 0), type: 'currency' },
          { label: 'Situação', value: 'Validação automatizada', type: 'text' },
        ],
        source: 'Teste automatizado da PR',
      };

      await exporter.exportInstitutionalExcel(options);
      const excel = {
        name: captured.fileName,
        type: captured.blob?.type || '',
        size: captured.blob?.size || 0,
        base64: await toBase64(captured.blob),
      };

      captured.blob = null;
      captured.fileName = '';
      await exporter.exportInstitutionalPdf(options);
      const pdf = {
        name: captured.fileName,
        type: captured.blob?.type || '',
        size: captured.blob?.size || 0,
        base64: await toBase64(captured.blob),
      };

      return { excel, pdf };
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  assert.match(generated.excel.name, /^validacao-institucional-\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.equal(generated.excel.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.ok(generated.excel.size > 5_000, 'A planilha gerada está anormalmente pequena.');

  const excelBuffer = Buffer.from(generated.excel.base64, 'base64');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);
  const worksheet = workbook.getWorksheet('Validação');
  assert.ok(worksheet, 'A planilha Validação não foi encontrada.');
  assert.equal(workbook.creator, 'GSA HUB');
  assert.equal(workbook.title, 'Relatório de Validação Institucional');
  assert.equal(worksheet.getCell('A1').value, 'GSA HUB');
  assert.ok(worksheet.autoFilter, 'O filtro automático não foi preservado.');
  assert.equal(worksheet.views[0]?.state, 'frozen');
  assert.ok(worksheet.headerFooter.oddHeader?.includes('GSA HUB'));
  assert.ok(worksheet.headerFooter.oddFooter?.includes('&P de &N'));
  assert.equal(worksheet.pageSetup.fitToPage, true);

  const allCells = [];
  worksheet.eachRow((row) => row.eachCell((cell) => allCells.push(cell)));
  assert.ok(allCells.some((cell) => cell.value === "'=2+2"), 'A neutralização de fórmula não foi aplicada.');
  assert.ok(allCells.some((cell) => String(cell.numFmt || '').includes('R$')), 'O formato monetário BRL não foi aplicado.');
  assert.ok(allCells.some((cell) => cell.numFmt === '0.00%'), 'O formato percentual não foi aplicado.');
  fs.writeFileSync(path.join(OUTPUT_DIR, generated.excel.name), excelBuffer);

  assert.match(generated.pdf.name, /^validacao-institucional-\d{4}-\d{2}-\d{2}\.pdf$/);
  assert.equal(generated.pdf.type, 'application/pdf');
  assert.ok(generated.pdf.size > 8_000, 'O PDF gerado está anormalmente pequeno.');
  const pdfBuffer = Buffer.from(generated.pdf.base64, 'base64');
  assert.equal(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
  const pdfSource = pdfBuffer.toString('latin1');
  assert.ok(pdfSource.includes('/Author (GSA HUB)'), 'O autor institucional não foi gravado no PDF.');
  assert.ok((pdfSource.match(/\/Type \/Page\b/g) || []).length >= 2, 'O teste deveria gerar um PDF com múltiplas páginas.');
  fs.writeFileSync(path.join(OUTPUT_DIR, generated.pdf.name), pdfBuffer);

  const evidence = {
    excel: {
      fileName: generated.excel.name,
      bytes: generated.excel.size,
      worksheet: worksheet.name,
      rows: worksheet.rowCount,
      columns: worksheet.columnCount,
      frozen: worksheet.views[0]?.state === 'frozen',
      autoFilter: Boolean(worksheet.autoFilter),
    },
    pdf: {
      fileName: generated.pdf.name,
      bytes: generated.pdf.size,
      pages: (pdfSource.match(/\/Type \/Page\b/g) || []).length,
      author: 'GSA HUB',
    },
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'runtime-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
