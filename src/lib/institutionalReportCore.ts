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

export const INSTITUTIONAL_BRAND = {
  navy: '0B1F3A',
  navySecondary: '16345C',
  gold: 'C6A15B',
  ivory: 'F7F3EA',
  white: 'FFFFFF',
  ink: '162033',
  muted: '667085',
  border: 'D5DCE5',
  stripe: 'F5F7FA',
} as const;

export const DEFAULT_INSTITUTIONAL_CONFIDENTIALITY = 'Documento institucional — uso conforme as permissões do sistema GSA HUB.';

export function normalizeInstitutionalFileName(value: string, extension: 'xlsx' | 'pdf'): string {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'relatorio-gsa-hub';
  return `${base}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function normalizeInstitutionalSheetName(value: string): string {
  return (value || 'Relatório')
    .replace(/[\\/*?:[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31) || 'Relatório';
}

export function humanizeInstitutionalKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function inferInstitutionalColumnType(key: string, value: unknown): InstitutionalColumnType {
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

export function resolveInstitutionalColumns(rows: Record<string, unknown>[], columns?: InstitutionalReportColumn[]): InstitutionalReportColumn[] {
  if (columns?.length) return columns;
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return keys.map((key) => {
    const sample = rows.find((row) => row[key] !== null && row[key] !== undefined)?.[key];
    return { key, label: humanizeInstitutionalKey(key), type: inferInstitutionalColumnType(key, sample) };
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

export function sanitizeExcelText(value: string): string {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

export function normalizeInstitutionalValue(value: unknown, type: InstitutionalColumnType): string | number | boolean | Date {
  if (value === null || value === undefined) return '';
  if (type === 'boolean') return typeof value === 'boolean' ? value : ['true', 'sim', '1'].includes(String(value).toLowerCase());
  if (type === 'currency' || type === 'number') {
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9,.-]/g, '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : sanitizeExcelText(String(value));
  }
  if (type === 'percentage') return normalizePercentage(value);
  if ((type === 'date' || type === 'datetime') && isValidDate(value)) return value instanceof Date ? value : new Date(value as string | number);
  return sanitizeExcelText(String(value));
}

export function formatInstitutionalDisplayValue(value: unknown, type: InstitutionalColumnType): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'currency') {
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9,.-]/g, '').replace(',', '.'));
    return Number.isFinite(numeric) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric) : String(value);
  }
  if (type === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(numeric) : String(value);
  }
  if (type === 'percentage') {
    const numeric = normalizePercentage(value);
    return typeof numeric === 'number'
      ? new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(numeric)
      : String(numeric);
  }
  if ((type === 'date' || type === 'datetime') && isValidDate(value)) {
    const options: Intl.DateTimeFormatOptions = type === 'datetime' ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' };
    return new Intl.DateTimeFormat('pt-BR', options).format(new Date(value as string | number | Date));
  }
  if (type === 'boolean') return Boolean(value) ? 'Sim' : 'Não';
  return String(value);
}

export function calculateInstitutionalColumnWidth(column: InstitutionalReportColumn, rows: Record<string, unknown>[]): number {
  if (column.width) return Math.min(Math.max(column.width, 10), 45);
  const longest = rows.slice(0, 250).reduce((maximum, row) => {
    const length = formatInstitutionalDisplayValue(row[column.key], column.type || 'text').length;
    return Math.max(maximum, length);
  }, column.label.length);
  return Math.min(Math.max(longest + 3, 12), 36);
}

export function defaultInstitutionalAlignment(type?: InstitutionalColumnType): 'left' | 'center' | 'right' {
  if (type === 'currency' || type === 'number' || type === 'percentage') return 'right';
  if (type === 'boolean' || type === 'date' || type === 'datetime') return 'center';
  return 'left';
}

export function applyExcelNumberFormat(cell: { numFmt?: string }, type: InstitutionalColumnType): void {
  if (type === 'currency') cell.numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
  if (type === 'number') cell.numFmt = '#,##0.##';
  if (type === 'percentage') cell.numFmt = '0.00%';
  if (type === 'date') cell.numFmt = 'dd/mm/yyyy';
  if (type === 'datetime') cell.numFmt = 'dd/mm/yyyy hh:mm';
}

export function getExcelColumnLetter(columnNumber: number): string {
  let value = Math.max(columnNumber, 1);
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

export function assertInstitutionalRows(rows: Record<string, unknown>[]): void {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Nenhum dado disponível para gerar o arquivo.');
}

export function downloadInstitutionalBlob(blob: Blob, fileName: string): void {
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
