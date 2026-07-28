import * as XLSXModule from '@redoper1/xlsx-js-style';
import ExcelJS from '../src/lib/exceljsBrowserAdapter';

const XLSX = ((XLSXModule as unknown as { default?: unknown }).default ?? XLSXModule) as any;

async function main(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GSA HUB';
  workbook.title = 'Validação do adaptador institucional';

  const worksheet = workbook.addWorksheet('Auditoria', {
    properties: { defaultRowHeight: 20 },
    pageSetup: { margins: { left: 0.35, right: 0.35, top: 0.55, bottom: 0.55 } },
  });

  worksheet.mergeCells('A1:C1');
  worksheet.getCell('A1').value = 'GSA HUB';
  worksheet.getCell('A1').font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2747' } };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 36;

  worksheet.getCell('A2').value = 'Valor';
  worksheet.getCell('B2').value = 1250.5;
  worksheet.getCell('B2').numFmt = 'R$ #,##0.00';
  worksheet.getCell('B2').border = { bottom: { style: 'thin', color: { argb: 'FFD6DEE8' } } };
  worksheet.getColumn(1).width = 24;
  worksheet.getColumn(2).width = 18;
  worksheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 2 } };

  const titleCell = worksheet.getCell('A1');
  const valueCell = worksheet.getCell('B2');
  if (!titleCell.font?.bold || titleCell.fill?.fgColor?.rgb !== '0F2747') {
    throw new Error('O adaptador não converteu corretamente fonte e preenchimento institucionais.');
  }
  if (valueCell.numFmt !== 'R$ #,##0.00' || !valueCell.border?.bottom) {
    throw new Error('O adaptador não converteu corretamente formato monetário e borda.');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 1_000) {
    throw new Error(`O adaptador não gerou um XLSX válido. Tamanho: ${buffer?.byteLength ?? 0} bytes.`);
  }

  const parsed = XLSX.read(buffer, { type: 'array', cellStyles: true });
  const sheet = parsed.Sheets.Auditoria;
  if (!sheet || sheet.A1?.v !== 'GSA HUB' || sheet.B2?.v !== 1250.5) {
    throw new Error('O conteúdo essencial da planilha não foi preservado.');
  }
  if (!Array.isArray(sheet['!merges']) || sheet['!merges'].length !== 1) {
    throw new Error('A mesclagem institucional de células não foi preservada.');
  }
  if (sheet.B2?.z !== 'R$ #,##0.00') {
    throw new Error('A formatação monetária não foi preservada no arquivo gerado.');
  }

  console.log(`Adaptador XLSX institucional validado: ${buffer.byteLength} bytes, conteúdo, estilos, mesclagem e formato preservados.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
