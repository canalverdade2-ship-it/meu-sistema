declare module '@redoper1/xlsx-js-style' {
  const XLSX: any;
  export default XLSX;
  export const utils: any;
  export const write: any;
  export const read: any;
}

declare module 'exceljs' {
  const ExcelJS: {
    Workbook: new () => any;
  };

  export default ExcelJS;
}
