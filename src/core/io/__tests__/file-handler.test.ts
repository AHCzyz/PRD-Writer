import { describe, expect, it } from 'vitest';
import { isExcelImportPath } from '../file-handler';

describe('file handler import filters', () => {
  it('recognizes spreadsheet files for folder Excel import without making them workspace documents', () => {
    expect(isExcelImportPath('F:\\repo\\table.xlsx')).toBe(true);
    expect(isExcelImportPath('F:\\repo\\table.xls')).toBe(true);
    expect(isExcelImportPath('F:\\repo\\table.xlsm')).toBe(true);
    expect(isExcelImportPath('F:\\repo\\table.xlsb')).toBe(true);
    expect(isExcelImportPath('F:\\repo\\data.csv')).toBe(true);

    expect(isExcelImportPath('F:\\repo\\note.md')).toBe(false);
    expect(isExcelImportPath('F:\\repo\\plan.prd')).toBe(false);
    expect(isExcelImportPath('F:\\repo\\note.txt')).toBe(false);
  });
});
