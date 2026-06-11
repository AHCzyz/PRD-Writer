import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { importExcelWorkbook } from '../importer';
import { getCellText } from '../../../types/tabml';
import { DEFAULT_COLUMN_WIDTH } from '../../../constants/format';

describe('Excel importer', () => {
  it('preserves sheet range, raw text, formulas, and column widths', () => {
    const sheet: XLSX.WorkSheet = {
      A1: { t: 's', v: '原文\t带制表符' },
      B2: { t: 'n', f: 'A1+1', v: 2, w: '2' },
      C3: { t: 's', v: '末尾' },
      '!ref': 'A1:C3',
      '!cols': [{ wpx: 88 }, { wpx: 120 }, {}],
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '需求');

    const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const [imported] = importExcelWorkbook(data);

    expect(imported.name).toBe('需求');
    expect(imported.document.rows).toHaveLength(3);
    expect(imported.document.rows[0].cells).toHaveLength(3);
    expect(getCellText(imported.document.rows[0].cells[0])).toBe('原文    带制表符');
    expect(getCellText(imported.document.rows[1].cells[1])).toBe('=A1+1');
    expect(getCellText(imported.document.rows[2].cells[2])).toBe('末尾');
    expect(imported.columnWidths[0]).toBeGreaterThan(DEFAULT_COLUMN_WIDTH);
    expect(imported.columnWidths[1]).toBeGreaterThan(imported.columnWidths[0]);
  });
});
