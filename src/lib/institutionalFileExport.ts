export type InstitutionalColumnType = 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'percentage' | 'boolean';

export interface InstitutionalReportColumn {
  key: string;
  label: string;
  type?: InstitutionalColumnType;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface InstitutionalReportSummaryItem {
  label: string;
  value: string | number;
  type?: InstitutionalColumnType;
}

export interface InstitutionalReportOptions {
  title: string;
  subtitle?: string;
  fileName: string;
  sheetName?: string;
  rows: Record<string, unknown>[];
  columns?: InstitutionalReportColumn[];
  period?: string;
  filters?: Record<string, string | number | boolean | null | undefined>;
  summary?: InstitutionalReportSummaryItem[];
  confidentiality?: string;
  source?: string;
}

const BRAND = {
  navy: '0B1F3A',
  navySecondary: '16345C',
  gold: 'C6A15B',
  ivory: 'F7F3EA',
  white: 'FFFFFF',
  ink: '162033',
  muted: '667085',
  border: 'D5DCE5',
  stripe: 'F5F7FA',
  danger: 'B42318',
};

const DEFAULT_CONFIDENTIALITY = 'Documento institucional — uso conforme as permissões do sistema GSA HUB.';

function normalizeFileName(value: string, extension: 'xlsx' | 'pdf'): string {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'relatorio-gsa-hub';
  const date = new Date().toISOString().slice(0, 10);
  return `${base}-${date}.${extension}`;
}

function normalizeSheetName(value: string): string {
  return (value || 'Relatório')
    .replace(/[\\/*?:[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31) || 'Relatório';
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function inferColumnType(key: string, value: unknown): InstitutionalColumnType {
  const normalized = key.toLowerCase();
  if (/(percent|porcent|pct|margem)/.test(normalized)) return 'percentage';
  if (/(data|date|created_at|updated_at|emissao|pagamento|vencimento|abertura|fechamento)/.test(normalized)) {
    return /(_at|hora|datetime)/.test(normalized) ? 'datetime' : 'date';
  }
  if (/(valor|preco|preço|custo|receita|lucro|saldo|desconto|acrescimo|acréscimo|taxa|bonus|bônus|capital|total_financiado)/.test(normalized)) {
    return 'currency';
  }
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'text';
}

function resolveColumns(rows: Record<string, unknown>[], columns?: InstitutionalReportColumn[]): InstitutionalReportColumn[] {
  if (columns?.length) return columns;
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return keys.map((key) => {
    const sample = rows.find((row) => row[key] !== null && row[key] !== undefined)?.[key];
    return {
      key,
      label: humanizeKey(key),
      type: inferColumnType(key, sample),
    };
  });
}

function isValidDate(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  return !Number.isNaN(new Date(value).getTime());
}

function normalizePercentage(value: unknown): number | string {
  if (typeof value === 'number') return Math.abs(value) > 1 ? value / 100 : value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace('%', '').replace(',', '.').trim());
    if (Number.isFinite(parsed)) return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
  }
  return value === null || value === undefined ? '' : String(value);
}

function sanitizeExcelText(value: string): string {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function normalizeValue(value: unknown, type: InstitutionalColumnType): string | number | boolean | Date {
  if (value === null || value === undefined) return '';
  if (type === 'boolean') return typeof value === 'boolean' ? value : ['true', 'sim', '1'].includes(String(value).toLowerCase());
  if (type === 'currency' || type === 'number') {
    const numberValue = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9,.-]/g, '').replace(',', '.'));
    return Number.isFinite(numberValue) ? numberValue : sanitizeExcelText(String(value));
  }
  if (type === 'percentage') return normalizePercentage(value);
  if ((type === 'date' || type === 'datetime') && isValidDate(value)) return value instanceof Date ? value : new Date(value as string | number);
  return sanitizeExcelText(String(value));
}

function formatDisplayValue(value: unknown, type: InstitutionalColumnType): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'currency') {
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9,.-]/g, '').replace(',', '.'));
    return Number.isFinite(numeric) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric) : String(value);
  }
  if (type === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('pt-BR').format(numeric) : String(value);
  }
  if (type === 'percentage') {
    const numeric = normalizePercentage(value);
    return typeof numeric === 'number' ? new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(numeric) : String(numeric);
  }
  if ((type === 'date' || type === 'datetime') && isValidDate(value)) {
    const options: Intl.DateTimeFormatOptions = type === 'datetime'
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'short' };
    return new Intl.DateTimeFormat('pt-BR', options).format(new Date(value as string | number | Date));
  }
  if (type === 'boolean') return Boolean(value) ? 'Sim' : 'Não';
  return String(value);
}

function calculateColumnWidth(column: InstitutionalReportColumn, rows: Record<string, unknown>[]): number {
  if (column.width) return Math.min(Math.max(column.width, 10), 45);
  const longest = rows.slice(0, 250).reduce((maximum, row) => {
    const length = formatDisplayValue(row[column.key], column.type || 'text').length;
    return Math.max(maximum, length);
  }, column.label.length);
  return Math.min(Math.max(longest + 3, 12), 36);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function assertRows(rows: Record<string, unknown>[]): void {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Nenhum dado disponível para gerar o arquivo.');
}

export async function exportInstitutionalExcel(options: InstitutionalReportOptions): Promise<void> {
  assertRows(options.rows);
  const ExcelJSImport = await import('exceljs');
  const ExcelJS = ExcelJSImport.default;
  const workbook = new ExcelJS.Workbook();
  const generatedAt = new Date();
  const columns = resolveColumns(options.rows, options.columns);
  const lastColumnLetter = getExcelColumnLetter(Math.max(columns.length, 1));

  workbook.creator = 'GSA HUB';
  workbook.lastModifiedBy = 'GSA HUB';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  Object.assign(workbook, {
    title: options.title,
    subject: options.subtitle || 'Relatório institucional GSA HUB',
    company: 'GSA HUB',
    category: 'Relatórios institucionais',
    description: options.confidentiality || DEFAULT_CONFIDENTIALITY,
    keywords: 'GSA HUB, relatório, institucional',
  });

  const worksheet = workbook.addWorksheet(normalizeSheetName(options.sheetName || options.title), {
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
  worksheet.getCell('A1').font = { name: 'Aptos Display', size: 19, bold: true, color: { argb: BRAND.white } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.navy } };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 38;

  worksheet.mergeCells(`A2:${lastColumnLetter}2`);
  worksheet.getCell('A2').value = options.title;
  worksheet.getCell('A2').font = { name: 'Aptos Display', size: 15, bold: true, color: { argb: BRAND.ink } };
  worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.ivory } };
  worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).height = 30;

  let currentRow = 3;
  if (options.subtitle) {
    worksheet.mergeCells(`A${currentRow}:${lastColumnLetter}${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = options.subtitle;
    worksheet.getCell(`A${currentRow}`).font = { name: 'Aptos', size: 10, italic: true, color: { argb: BRAND.muted } };
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
      .map(([key, value]) => [humanizeKey(key), String(value)]),
  ];

  for (const [label, value] of metadata) {
    worksheet.getCell(currentRow, 1).value = label;
    worksheet.getCell(currentRow, 1).font = { name: 'Aptos', size: 9, bold: true, color: { argb: BRAND.navySecondary } };
    if (columns.length > 1) {
      worksheet.mergeCells(currentRow, 2, currentRow, columns.length);
      worksheet.getCell(currentRow, 2).value = value;
      worksheet.getCell(currentRow, 2).font = { name: 'Aptos', size: 9, color: { argb: BRAND.ink } };
    } else {
      worksheet.getCell(currentRow, 1).value = `${label}: ${value}`;
    }
    currentRow += 1;
  }

  if (options.summary?.length) {
    currentRow += 1;
    const summaryStart = currentRow;
    options.summary.forEach((item, index) => {
      const column = index + 1;
      if (column > columns.length) return;
      const cell = worksheet.getCell(summaryStart, column);
      cell.value = item.label;
      cell.font = { name: 'Aptos', size: 8, bold: true, color: { argb: BRAND.muted } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.stripe } };
      const valueCell = worksheet.getCell(summaryStart + 1, column);
      valueCell.value = normalizeValue(item.value, item.type || inferColumnType(item.label, item.value));
      valueCell.font = { name: 'Aptos Display', size: 12, bold: true, color: { argb: BRAND.navy } };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.stripe } };
      valueCell.alignment = { vertical: 'middle' };
      applyExcelNumberFormat(valueCell, item.type || inferColumnType(item.label, item.value));
    });
    currentRow += 3;
  } else {
    currentRow += 1;
  }

  const headerRowNumber = currentRow;
  const headerRow = worksheet.getRow(headerRowNumber);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: BRAND.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.navySecondary } };
    cell.alignment = { vertical: 'middle', horizontal: column.align || defaultAlignment(column.type), wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: BRAND.gold } } };
    worksheet.getColumn(index + 1).width = calculateColumnWidth(column, options.rows);
  });
  headerRow.height = 30;

  options.rows.forEach((sourceRow, rowIndex) => {
    const excelRow = worksheet.getRow(headerRowNumber + rowIndex + 1);
    columns.forEach((column, columnIndex) => {
      const type = column.type || inferColumnType(column.key, sourceRow[column.key]);
      const cell = excelRow.getCell(columnIndex + 1);
      cell.value = normalizeValue(sourceRow[column.key], type);
      cell.font = { name: 'Aptos', size: 9, color: { argb: BRAND.ink } };
      cell.alignment = { vertical: 'top', horizontal: column.align || defaultAlignment(type), wrapText: true };
      cell.border = {
        bottom: { style: 'hair', color: { argb: BRAND.border } },
        left: { style: 'hair', color: { argb: BRAND.border } },
        right: { style: 'hair', color: { argb: BRAND.border } },
      };
      if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.stripe } };
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
  worksheet.headerFooter.oddFooter = `&L${options.confidentiality || DEFAULT_CONFIDENTIALITY}&C&P de &N&R&T`;
  worksheet.headerFooter.evenHeader = worksheet.headerFooter.oddHeader;
  worksheet.headerFooter.evenFooter = worksheet.headerFooter.oddFooter;

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    normalizeFileName(options.fileName, 'xlsx'),
  );
}

export async function exportInstitutionalPdf(options: InstitutionalReportOptions): Promise<void> {
  assertRows(options.rows);
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default;
  const columns = resolveColumns(options.rows, options.columns);
  const orientation = columns.length > 6 ? 'landscape' : 'portrait';
  const document = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const generatedAt = new Date();
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 12;

  document.setProperties({
    title: options.title,
    subject: options.subtitle || 'Relatório institucional GSA HUB',
    author: 'GSA HUB',
    creator: 'GSA HUB',
    keywords: 'GSA HUB, relatório, institucional',
  });

  const drawHeader = () => {
    document.setFillColor(11, 31, 58);
    document.rect(0, 0, pageWidth, 24, 'F');
    document.setTextColor(255, 255, 255);
    document.setFont('helvetica', 'bold');
    document.setFontSize(15);
    document.text('GSA HUB', margin, 10);
    document.setFontSize(8.5);
    document.setFont('helvetica', 'normal');
    document.text(options.title, margin, 16);
    document.setDrawColor(198, 161, 91);
    document.setLineWidth(0.8);
    document.line(margin, 21, pageWidth - margin, 21);
  };

  const drawFooter = (pageNumber: number) => {
    document.setDrawColor(213, 220, 229);
    document.setLineWidth(0.25);
    document.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    document.setTextColor(102, 112, 133);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7);
    document.text(options.confidentiality || DEFAULT_CONFIDENTIALITY, margin, pageHeight - 6);
    document.text(`Página ${pageNumber}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  };

  drawHeader();
  let startY = 30;
  document.setTextColor(22, 32, 51);
  document.setFont('helvetica', 'bold');
  document.setFontSize(14);
  document.text(options.title, margin, startY);
  startY += 5;

  if (options.subtitle) {
    document.setTextColor(102, 112, 133);
    document.setFont('helvetica', 'normal');
    document.setFontSize(8.5);
    const subtitleLines = document.splitTextToSize(options.subtitle, pageWidth - margin * 2);
    document.text(subtitleLines, margin, startY);
    startY += subtitleLines.length * 4 + 2;
  }

  document.setTextColor(102, 112, 133);
  document.setFontSize(7.5);
  const metadataParts = [
    `Emitido em: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(generatedAt)}`,
    ...(options.period ? [`Período: ${options.period}`] : []),
    ...(options.source ? [`Origem: ${options.source}`] : []),
    ...Object.entries(options.filters || {})
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${humanizeKey(key)}: ${String(value)}`),
  ];
  const metadataLines = document.splitTextToSize(metadataParts.join('  •  '), pageWidth - margin * 2);
  document.text(metadataLines, margin, startY);
  startY += metadataLines.length * 3.5 + 3;

  if (options.summary?.length) {
    const availableWidth = pageWidth - margin * 2;
    const gap = 2;
    const cardWidth = (availableWidth - gap * (options.summary.length - 1)) / options.summary.length;
    options.summary.forEach((item, index) => {
      const x = margin + index * (cardWidth + gap);
      document.setFillColor(247, 243, 234);
      document.setDrawColor(213, 220, 229);
      document.roundedRect(x, startY, cardWidth, 15, 1.2, 1.2, 'FD');
      document.setTextColor(102, 112, 133);
      document.setFontSize(6.5);
      document.setFont('helvetica', 'bold');
      document.text(document.splitTextToSize(item.label, cardWidth - 4), x + 2, startY + 4);
      document.setTextColor(11, 31, 58);
      document.setFontSize(9.5);
      document.text(formatDisplayValue(item.value, item.type || inferColumnType(item.label, item.value)), x + 2, startY + 12);
    });
    startY += 19;
  }

  autoTable(document, {
    startY,
    head: [columns.map((column) => column.label)],
    body: options.rows.map((row) => columns.map((column) => formatDisplayValue(row[column.key], column.type || inferColumnType(column.key, row[column.key])))),
    margin: { top: 28, right: margin, bottom: 16, left: margin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: columns.length > 8 ? 6.2 : 7.2,
      cellPadding: 2,
      lineWidth: 0.15,
      lineColor: [213, 220, 229],
      textColor: [22, 32, 51],
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [22, 52, 92],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      lineColor: [198, 161, 91],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: Object.fromEntries(columns.map((column, index) => [index, { halign: column.align || defaultAlignment(column.type) }])),
    didDrawPage: () => {
      drawHeader();
      drawFooter(document.getNumberOfPages());
    },
  });

  const totalPages = document.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    document.setPage(pageNumber);
    drawFooter(pageNumber);
  }

  downloadBlob(document.output('blob'), normalizeFileName(options.fileName, 'pdf'));
}

export async function exportVisibleReportAsPdf(): Promise<void> {
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const root = activeElement?.closest('.space-y-6') || document.querySelector('main .space-y-6');
  if (!(root instanceof HTMLElement)) throw new Error('Não foi possível identificar o relatório visível.');

  const title = root.querySelector('h2')?.textContent?.trim() || 'Relatório GSA HUB';
  const table = root.querySelector('table');
  if (!(table instanceof HTMLTableElement)) throw new Error('Este relatório ainda não possui uma tabela estruturada para exportação em PDF.');

  const labels = Array.from(table.querySelectorAll('thead th')).map((cell) => cell.textContent?.trim() || 'Coluna');
  const bodyRows = Array.from(table.querySelectorAll('tbody tr'))
    .map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || ''))
    .filter((row) => row.length > 0);

  if (!labels.length || !bodyRows.length) throw new Error('Nenhum dado disponível para gerar o PDF.');
  const columns = labels.map((label, index) => ({ key: `column_${index}`, label, type: 'text' as const }));
  const rows = bodyRows.map((values) => Object.fromEntries(values.map((value, index) => [`column_${index}`, value])));

  await exportInstitutionalPdf({
    title,
    subtitle: 'Documento gerado a partir da visualização autorizada no Centro de Relatórios.',
    fileName: title,
    rows,
    columns,
    source: 'Centro de Relatórios GSA HUB',
  });
}

function defaultAlignment(type?: InstitutionalColumnType): 'left' | 'center' | 'right' {
  if (type === 'currency' || type === 'number' || type === 'percentage') return 'right';
  if (type === 'boolean' || type === 'date' || type === 'datetime') return 'center';
  return 'left';
}

function applyExcelNumberFormat(cell: { numFmt?: string }, type: InstitutionalColumnType): void {
  if (type === 'currency') cell.numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00';
  if (type === 'number') cell.numFmt = '#,##0.00';
  if (type === 'percentage') cell.numFmt = '0.00%';
  if (type === 'date') cell.numFmt = 'dd/mm/yyyy';
  if (type === 'datetime') cell.numFmt = 'dd/mm/yyyy hh:mm';
}

function getExcelColumnLetter(columnNumber: number): string {
  let value = Math.max(columnNumber, 1);
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}
