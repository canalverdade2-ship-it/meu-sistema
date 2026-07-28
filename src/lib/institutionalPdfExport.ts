import {
  DEFAULT_INSTITUTIONAL_CONFIDENTIALITY,
  assertInstitutionalRows,
  defaultInstitutionalAlignment,
  downloadInstitutionalBlob,
  formatInstitutionalDisplayValue,
  humanizeInstitutionalKey,
  inferInstitutionalColumnType,
  normalizeInstitutionalFileName,
  resolveInstitutionalColumns,
  type InstitutionalReportOptions,
} from './institutionalReportCore';

export async function exportInstitutionalPdf(options: InstitutionalReportOptions): Promise<void> {
  assertInstitutionalRows(options.rows);
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default;
  const columns = resolveInstitutionalColumns(options.rows, options.columns);
  if (columns.length === 0) throw new Error('Nenhuma coluna disponível para gerar o PDF.');
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
    document.text(options.confidentiality || DEFAULT_INSTITUTIONAL_CONFIDENTIALITY, margin, pageHeight - 6);
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
      .map(([key, value]) => `${humanizeInstitutionalKey(key)}: ${String(value)}`),
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
      document.text(
        formatInstitutionalDisplayValue(item.value, item.type || inferInstitutionalColumnType(item.label, item.value)),
        x + 2,
        startY + 12,
      );
    });
    startY += 19;
  }

  autoTable(document, {
    startY,
    head: [columns.map((column) => column.label)],
    body: options.rows.map((row) => columns.map((column) => (
      formatInstitutionalDisplayValue(row[column.key], column.type || inferInstitutionalColumnType(column.key, row[column.key]))
    ))),
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
    columnStyles: Object.fromEntries(columns.map((column, index) => [
      index,
      { halign: column.align || defaultInstitutionalAlignment(column.type) },
    ])),
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

  downloadInstitutionalBlob(document.output('blob'), normalizeInstitutionalFileName(options.fileName, 'pdf'));
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
