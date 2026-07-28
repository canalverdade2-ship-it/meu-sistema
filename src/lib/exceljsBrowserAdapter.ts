import * as XLSXModule from '@redoper1/xlsx-js-style';

const XLSX = ((XLSXModule as unknown as { default?: unknown }).default ?? XLSXModule) as any;

type ExcelCellValue = string | number | boolean | Date | null | undefined;
type CellStyle = Record<string, any>;

function normalizeColor(color?: { argb?: string; rgb?: string } | null): { rgb: string } | undefined {
  const raw = color?.argb || color?.rgb;
  if (!raw) return undefined;
  const normalized = raw.replace(/^#/, '').toUpperCase();
  return { rgb: normalized.length === 8 ? normalized.slice(2) : normalized };
}

function normalizeBorderSide(side?: { style?: string; color?: { argb?: string; rgb?: string } } | null) {
  if (!side?.style) return undefined;
  return {
    style: side.style,
    color: normalizeColor(side.color),
  };
}

function encodeColumn(column: number): string {
  let current = Math.max(1, Math.trunc(column));
  let output = '';
  while (current > 0) {
    current -= 1;
    output = String.fromCharCode(65 + (current % 26)) + output;
    current = Math.floor(current / 26);
  }
  return output;
}

function encodeCell(row: number, column: number): string {
  return `${encodeColumn(column)}${Math.max(1, Math.trunc(row))}`;
}

function decodeCell(address: string): { row: number; column: number } {
  const match = /^([A-Z]+)(\d+)$/i.exec(address.trim());
  if (!match) throw new Error(`Endereço de célula inválido: ${address}`);
  let column = 0;
  for (const char of match[1].toUpperCase()) column = column * 26 + char.charCodeAt(0) - 64;
  return { row: Number(match[2]), column };
}

function inferCellType(value: ExcelCellValue): string {
  if (value instanceof Date) return 'd';
  if (typeof value === 'number') return 'n';
  if (typeof value === 'boolean') return 'b';
  if (value === null || value === undefined) return 'z';
  return 's';
}

class BrowserCell {
  constructor(
    private readonly worksheet: BrowserWorksheet,
    private readonly address: string,
  ) {}

  private data(): any {
    return this.worksheet.ensureCell(this.address);
  }

  get value(): ExcelCellValue {
    return this.data().v;
  }

  set value(value: ExcelCellValue) {
    const cell = this.data();
    cell.v = value ?? '';
    cell.t = inferCellType(value);
    if (value instanceof Date) cell.z ||= 'dd/mm/yyyy';
  }

  get numFmt(): string | undefined {
    return this.data().z;
  }

  set numFmt(value: string | undefined) {
    if (!value) return;
    const cell = this.data();
    cell.z = value;
    cell.s = { ...(cell.s || {}), numFmt: value };
  }

  get font(): CellStyle | undefined {
    return this.data().s?.font;
  }

  set font(value: any) {
    if (!value) return;
    const cell = this.data();
    cell.s = {
      ...(cell.s || {}),
      font: {
        name: value.name,
        sz: value.size,
        bold: Boolean(value.bold),
        italic: Boolean(value.italic),
        underline: value.underline,
        strike: Boolean(value.strike),
        color: normalizeColor(value.color),
      },
    };
  }

  get fill(): CellStyle | undefined {
    return this.data().s?.fill;
  }

  set fill(value: any) {
    if (!value) return;
    const cell = this.data();
    cell.s = {
      ...(cell.s || {}),
      fill: {
        patternType: value.pattern === 'solid' || value.type === 'pattern' ? 'solid' : value.pattern,
        fgColor: normalizeColor(value.fgColor),
        bgColor: normalizeColor(value.bgColor),
      },
    };
  }

  get alignment(): CellStyle | undefined {
    return this.data().s?.alignment;
  }

  set alignment(value: any) {
    if (!value) return;
    const cell = this.data();
    cell.s = {
      ...(cell.s || {}),
      alignment: {
        vertical: value.vertical === 'middle' ? 'center' : value.vertical,
        horizontal: value.horizontal,
        wrapText: Boolean(value.wrapText),
        textRotation: value.textRotation,
      },
    };
  }

  get border(): CellStyle | undefined {
    return this.data().s?.border;
  }

  set border(value: any) {
    if (!value) return;
    const cell = this.data();
    cell.s = {
      ...(cell.s || {}),
      border: {
        top: normalizeBorderSide(value.top),
        bottom: normalizeBorderSide(value.bottom),
        left: normalizeBorderSide(value.left),
        right: normalizeBorderSide(value.right),
      },
    };
  }
}

class BrowserRow {
  constructor(
    private readonly worksheet: BrowserWorksheet,
    private readonly index: number,
  ) {}

  get height(): number | undefined {
    return this.worksheet.sheet['!rows']?.[this.index - 1]?.hpt;
  }

  set height(value: number | undefined) {
    if (!value) return;
    const rows = (this.worksheet.sheet['!rows'] ||= []);
    rows[this.index - 1] = { ...(rows[this.index - 1] || {}), hpt: value };
  }

  getCell(column: number): BrowserCell {
    return this.worksheet.getCell(this.index, column);
  }

  set values(values: unknown[]) {
    values.forEach((value, index) => {
      if (index === 0 && values.length > 1 && values[0] === undefined) return;
      const column = values[0] === undefined ? index : index + 1;
      if (column < 1) return;
      this.getCell(column).value = value as ExcelCellValue;
    });
  }
}

class BrowserColumn {
  constructor(
    private readonly worksheet: BrowserWorksheet,
    private readonly index: number,
  ) {}

  get width(): number | undefined {
    return this.worksheet.sheet['!cols']?.[this.index - 1]?.wch;
  }

  set width(value: number | undefined) {
    if (!value) return;
    const columns = (this.worksheet.sheet['!cols'] ||= []);
    columns[this.index - 1] = { ...(columns[this.index - 1] || {}), wch: value };
  }
}

class BrowserWorksheet {
  readonly sheet: Record<string, any> = {
    '!merges': [],
    '!cols': [],
    '!rows': [],
  };
  readonly pageSetup: Record<string, any>;
  readonly headerFooter: Record<string, any> = {};
  private maxRow = 1;
  private maxColumn = 1;

  constructor(
    readonly name: string,
    options?: Record<string, any>,
  ) {
    this.pageSetup = { ...(options?.pageSetup || {}) };
    if (options?.properties?.defaultRowHeight) {
      this.sheet['!rows'][0] = { hpt: options.properties.defaultRowHeight };
    }
  }

  ensureCell(address: string): any {
    const normalized = address.toUpperCase();
    const decoded = decodeCell(normalized);
    this.maxRow = Math.max(this.maxRow, decoded.row);
    this.maxColumn = Math.max(this.maxColumn, decoded.column);
    this.sheet['!ref'] = `A1:${encodeCell(this.maxRow, this.maxColumn)}`;
    return (this.sheet[normalized] ||= { v: '', t: 's', s: {} });
  }

  getCell(address: string): BrowserCell;
  getCell(row: number, column: number): BrowserCell;
  getCell(addressOrRow: string | number, column?: number): BrowserCell {
    const address = typeof addressOrRow === 'string'
      ? addressOrRow
      : encodeCell(addressOrRow, column || 1);
    this.ensureCell(address);
    return new BrowserCell(this, address.toUpperCase());
  }

  getRow(index: number): BrowserRow {
    this.maxRow = Math.max(this.maxRow, index);
    return new BrowserRow(this, index);
  }

  getColumn(index: number): BrowserColumn {
    this.maxColumn = Math.max(this.maxColumn, index);
    return new BrowserColumn(this, index);
  }

  mergeCells(range: string): void;
  mergeCells(startRow: number, startColumn: number, endRow: number, endColumn: number): void;
  mergeCells(rangeOrStartRow: string | number, startColumn?: number, endRow?: number, endColumn?: number): void {
    const range = typeof rangeOrStartRow === 'string'
      ? rangeOrStartRow
      : `${encodeCell(rangeOrStartRow, startColumn || 1)}:${encodeCell(endRow || rangeOrStartRow, endColumn || startColumn || 1)}`;
    const [startAddress, endAddress] = range.split(':');
    const start = decodeCell(startAddress);
    const end = decodeCell(endAddress || startAddress);
    this.maxRow = Math.max(this.maxRow, start.row, end.row);
    this.maxColumn = Math.max(this.maxColumn, start.column, end.column);
    this.sheet['!ref'] = `A1:${encodeCell(this.maxRow, this.maxColumn)}`;
    this.sheet['!merges'].push({
      s: { r: start.row - 1, c: start.column - 1 },
      e: { r: end.row - 1, c: end.column - 1 },
    });
  }

  set autoFilter(value: any) {
    if (!value) return;
    if (typeof value === 'string') {
      this.sheet['!autofilter'] = { ref: value };
      return;
    }
    const from = typeof value.from === 'string'
      ? value.from
      : encodeCell(value.from?.row || 1, value.from?.column || 1);
    const to = typeof value.to === 'string'
      ? value.to
      : encodeCell(value.to?.row || 1, value.to?.column || 1);
    this.sheet['!autofilter'] = { ref: `${from}:${to}` };
  }

  set views(value: unknown) {
    this.sheet['!views'] = value;
  }

  toSheet(): Record<string, any> {
    this.sheet['!ref'] ||= `A1:${encodeCell(this.maxRow, this.maxColumn)}`;
    if (this.pageSetup?.margins) this.sheet['!margins'] = { ...this.pageSetup.margins };
    return this.sheet;
  }
}

export class Workbook {
  creator?: string;
  lastModifiedBy?: string;
  created?: Date;
  modified?: Date;
  title?: string;
  subject?: string;
  company?: string;
  category?: string;
  description?: string;
  keywords?: string;
  private readonly worksheets: BrowserWorksheet[] = [];

  readonly xlsx = {
    writeBuffer: async (): Promise<ArrayBuffer> => {
      const workbook = XLSX.utils.book_new();
      workbook.Props = {
        Author: this.creator,
        LastAuthor: this.lastModifiedBy,
        CreatedDate: this.created,
        ModifiedDate: this.modified,
        Title: this.title,
        Subject: this.subject,
        Company: this.company,
        Category: this.category,
        Comments: this.description,
        Keywords: this.keywords,
      };
      for (const worksheet of this.worksheets) {
        XLSX.utils.book_append_sheet(workbook, worksheet.toSheet(), worksheet.name);
      }
      return XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
        compression: true,
        cellStyles: true,
      }) as ArrayBuffer;
    },
  };

  addWorksheet(name: string, options?: Record<string, any>): BrowserWorksheet {
    const worksheet = new BrowserWorksheet(name, options);
    this.worksheets.push(worksheet);
    return worksheet;
  }
}

const ExcelJS = { Workbook };
export default ExcelJS;
