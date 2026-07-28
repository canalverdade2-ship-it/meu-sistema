import {
  DEFAULT_INSTITUTIONAL_CONFIDENTIALITY,
  INSTITUTIONAL_BRAND,
  applyExcelNumberFormat,
  assertInstitutionalRows,
  calculateInstitutionalColumnWidth,
  defaultInstitutionalAlignment,
  downloadInstitutionalBlob,
  getExcelColumnLetter,
  humanizeInstitutionalKey,
  inferInstitutionalColumnType,
  normalizeInstitutionalFileName,
  normalizeInstitutionalSheetName,
  normalizeInstitutionalValue,
  resolveInstitutionalColumns,
  type InstitutionalReportOptions,
} from './institutionalReportCore';

export async function exportInstitutionalExcel(options: InstitutionalReportOptions): Promise<void> {
  assertInstitutionalRows(options.rows);
  const ExcelJSImport = await import('exceljs');
  const ExcelJS = ExcelJSImport.default;
  const workbook = new ExcelJS.Workbook();
  const generatedAt = new Date();
  const columns = resolveInstitutionalColumns(options.rows, options.columns);
  if (columns.length === 0) throw new Error('Nenhuma coluna disponível para gerar a planilha.');
  const lastColumnLetter = getExcelColumnLetter(columns.length);

  workbook.creator = 'GSA HUB';
  workbook.lastModifiedBy = 'GSA HUB';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  Object.assign(workbook, {
    title: options.title,
    subject: options.subtitle || 'Relatório institucional GSA HUB',
    company: 'GSA HUB',
    category: 'Relatórios institucionais',
    description: options.confidentiality || DEFAULT_INSTITUTIONAL_CONFIDENTIALITY,
    keywords: 'GSA HUB, relatório, institucional',
  });

  const worksheet = workbook.addWorksheet(normalizeInstitutionalSheetName(options.sheetName || options.title), {
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      paperSize: 9,
      orientation: columns.length > 7 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.35, right: 0.35, top: 0.55, bottom: 0.55, header: 0.2, footer: 0.2 },
    },
  });

  worksheet.mergeCells(`A1:${lastColumnLetter}1`);
  worksheet.getCell('A1').value = 'GSA HUB';
  worksheet.getCell('A1').font = { name: 'Aptos Display', size: 19, bold: true, color: { argb: INSTITUTIONAL_BRAND.white } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTITUTIONAL_BRAND.navy } };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 38;

  worksheet.mergeCells(`A2:${lastColumnLetter}2`);
  worksheet.getCell('A2').value = options.title;
  worksheet.getCell('A2').font = { name: 'Aptos Display', size: 15, bold: true, color: { argb: INSTITUTIONAL_BRAND.ink } };
  worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTITUTIONAL_BRAND.ivory } };
  worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).height = 30;

  let currentRow = 3;
  if (options.subtitle) {
    worksheet.mergeCells(`A${currentRow}:${lastColumnLetter}${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = options.subtitle;
    worksheet.getCell(`A${currentRow}`).font = { name: 'Aptos', size: 10, italic: true, color: { argb: INSTITUTIONAL_BRAND.muted } };
    worksheet.getCell(`A${currentRow}`).alignment = { wrapText: true, vertical: 'middle' };
    worksheet.getRow(currentRow).height = 26;
    currentRow += 1;
  }

  const metadata = [
    ['Emitido em', new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(generatedAt)],
    ...(options.period ? [['Período', options.period]] : []),
    ...(options.source ? [['Origem', options.source]] : []),
    ...Object.entries(options.filters || {})
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => [humanizeInstitutionalKey(key), String(value)]),
  ];

  for (const [label, value] of metadata) {
    const labelCell = worksheet.getCell(currentRow, 1);
    labelCell.value = label;
    labelCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: INSTITUTIONAL_BRAND.navySecondary } };
    if (columns.length > 1) {
      worksheet.mergeCells(currentRow, 2, currentRow, columns.length);
      const valueCell = worksheet.getCell(currentRow, 2);
      valueCell.value = value;
      valueCell.font = { name: 'Aptos', size: 9, color: { argb: INSTITUTIONAL_BRAND.ink } };
    } else {
      labelCell.value = `${label}: ${value}`;
    }
    currentRow += 1;
  }

  if (options.summary?.length) {
    currentRow += 1;
    const summaryStart = currentRow;
    const summaryItems = options.summary.slice(0, columns.length);
    let startColumn = 1;

    summaryItems.forEach((item, index) => {
      const remainingColumns = columns.length - startColumn + 1;
      const remainingItems = summaryItems.length - index;
      const columnSpan = Math.max(1, Math.ceil(remainingColumns / remainingItems));
      const endColumn = index === summaryItems.length - 1
        ? columns.length
        : Math.min(columns.length, startColumn + columnSpan - 1);
      const itemType = item.type || inferInstitutionalColumnType(item.label, item.value);

      for (let column = startColumn; column <= endColumn; column += 1) {
        for (const row of [summaryStart, summaryStart + 1]) {
          const cardCell = worksheet.getCell(row, column);
          cardCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTITUTIONAL_BRAND.stripe } };
          cardCell.border = {
            top: { style: 'thin', color: { argb: INSTITUTIONAL_BRAND.border } },
            bottom: { style: 'thin', color: { argb: INSTITUTIONAL_BRAND.border } },
            left: { style: 'thin', color: { argb: INSTITUTIONAL_BRAND.border } },
            right: { style: 'thin', color: { argb: INSTITUTIONAL_BRAND.border } },
          };
        }
      }

      if (endColumn > startColumn) {
        worksheet.mergeCells(summaryStart, startColumn, summaryStart, endColumn);
        worksheet.mergeCells(summaryStart + 1, startColumn, summaryStart + 1, endColumn);
      }

      const labelCell = worksheet.getCell(summaryStart, startColumn);
      labelCell.value = item.label;
      labelCell.font = { name: 'Aptos', size: 8, bold: true, color: { argb: INSTITUTIONAL_BRAND.muted } };
      labelCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      const valueCell = worksheet.getCell(summaryStart + 1, startColumn);
      valueCell.value = normalizeInstitutionalValue(item.value, itemType);
      valueCell.font = { name: 'Aptos Display', size: 12, bold: true, color: { argb: INSTITUTIONAL_BRAND.navy } };
      valueCell.alignment = { vertical: 'middle', horizontal: defaultInstitutionalAlignment(itemType), wrapText: true };
      applyExcelNumberFormat(valueCell, itemType);
      startColumn = endColumn + 1;
    });

    worksheet.getRow(summaryStart).height = 22;
    worksheet.getRow(summaryStart + 1).height = 28;
    currentRow += 3;
  } else {
    currentRow += 1;
  }

  const headerRowNumber = currentRow;
  const headerRow = worksheet.getRow(headerRowNumber);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: INSTITUTIONAL_BRAND.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTITUTIONAL_BRAND.navySecondary } };
    cell.alignment = { vertical: 'middle', horizontal: column.align || defaultInstitutionalAlignment(column.type), wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: INSTITUTIONAL_BRAND.gold } } };
    worksheet.getColumn(index + 1).width = calculateInstitutionalColumnWidth(column, options.rows);
  });
  headerRow.height = 30;

  options.rows.forEach((sourceRow, rowIndex) => {
    const excelRow = worksheet.getRow(headerRowNumber + rowIndex + 1);
    columns.forEach((column, columnIndex) => {
      const type = column.type || inferInstitutionalColumnType(column.key, sourceRow[column.key]);
      const cell = excelRow.getCell(columnIndex + 1);
      cell.value = normalizeInstitutionalValue(sourceRow[column.key], type);
      cell.font = { name: 'Aptos', size: 9, color: { argb: INSTITUTIONAL_BRAND.ink } };
      cell.alignment = { vertical: 'top', horizontal: column.align || defaultInstitutionalAlignment(type), wrapText: true };
      cell.border = {
        bottom: { style: 'hair', color: { argb: INSTITUTIONAL_BRAND.border } },
        left: { style: 'hair', color: { argb: INSTITUTIONAL_BRAND.border } },
        right: { style: 'hair', color: { argb: INSTITUTIONAL_BRAND.border } },
      };
      if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INSTITUTIONAL_BRAND.stripe } };
      applyExcelNumberFormat(cell, type);
    });
    excelRow.height = 22;
  });

  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: columns.length },
  };
  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRowNumber, topLeftCell: `A${headerRowNumber + 1}`, activeCell: `A${headerRowNumber + 1}` }];
  worksheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
  worksheet.headerFooter.oddHeader = `&L&"Aptos,Bold"GSA HUB&C${options.title}&R&D`;
  worksheet.headerFooter.oddFooter = `&L${options.confidentiality || DEFAULT_INSTITUTIONAL_CONFIDENTIALITY}&C&P de &N&R&T`;
  worksheet.headerFooter.evenHeader = worksheet.headerFooter.oddHeader;
  worksheet.headerFooter.evenFooter = worksheet.headerFooter.oddFooter;

  const buffer = await workbook.xlsx.writeBuffer();
  downloadInstitutionalBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    normalizeInstitutionalFileName(options.fileName, 'xlsx'),
  );
}
