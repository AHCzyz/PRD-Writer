import * as XLSX from 'xlsx';
import type { TabMLCell, TabMLDocument, TabMLRow } from '../../types/tabml';
import {
  DEFAULT_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
} from '../../constants/format';

export interface ImportedExcelSheet {
  name: string;
  document: TabMLDocument;
  columnWidths: number[];
}

export function importExcelWorkbook(data: ArrayBuffer): ImportedExcelSheet[] {
  const workbook = XLSX.read(data, {
    type: 'array',
    cellDates: true,
    cellFormula: true,
    cellNF: true,
    cellStyles: true,
    cellText: true,
  });

  return workbook.SheetNames.map((name, index) =>
    worksheetToDocument(workbook.Sheets[name], name || `Sheet${index + 1}`)
  );
}

function worksheetToDocument(sheet: XLSX.WorkSheet, name: string): ImportedExcelSheet {
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
  const rowInfo = sheet['!rows'] || [];
  const colInfo = sheet['!cols'] || [];
  const rowCount = Math.max(range ? range.e.r + 1 : 0, rowInfo.length, 1);
  const colCount = Math.max(range ? range.e.c + 1 : 0, colInfo.length, 1);
  const columnWidths = Array.from({ length: colCount }, (_, col) =>
    columnInfoToPixels(colInfo[col])
  );

  const rows: TabMLRow[] = Array.from({ length: rowCount }, (_, row) => ({
    indent: 0,
    isEmpty: false,
    cells: Array.from({ length: colCount }, (_, col) =>
      createTextCell(cellToText(sheet[XLSX.utils.encode_cell({ r: row, c: col })]))
    ),
  }));

  const document: TabMLDocument = {
    frontmatter: {
      columnWidths,
    },
    rows,
  };

  return { name, document, columnWidths };
}

function cellToText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.t === 'z') return '';
  if (typeof cell.f === 'string' && cell.f.length > 0) {
    return normalizeCellText(`=${cell.f}`);
  }
  if (typeof cell.w === 'string') {
    return normalizeCellText(cell.w);
  }
  if (cell.v == null) return '';
  if (cell.v instanceof Date) {
    return normalizeCellText(cell.v.toISOString());
  }
  return normalizeCellText(String(cell.v));
}

function normalizeCellText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '    ');
}

function createTextCell(text: string): TabMLCell {
  return {
    content: [{ type: 'text', text }],
  };
}

function columnInfoToPixels(col: XLSX.ColInfo | undefined): number {
  const rawWidth =
    typeof col?.wpx === 'number'
      ? col.wpx
      : typeof col?.wch === 'number'
        ? Math.round(col.wch * 7 + 5)
        : DEFAULT_COLUMN_WIDTH;

  return Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(rawWidth)));
}
