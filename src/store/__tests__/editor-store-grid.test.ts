import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../editor-store';
import { getCellText } from '../../types/tabml';

function loadGrid() {
  const store = useEditorStore.getState();
  store.loadFromText('A\tB\tC\nD\tE\tF\nG\tH\tI');
  store.setFocus({ row: 0, col: 0, editing: false });
  store.clearSelection();
}

function textAt(row: number, col: number): string {
  return getCellText(useEditorStore.getState().document.rows[row].cells[col]);
}

function columnCount(): number {
  return useEditorStore.getState().columnWidths.length;
}

describe('editor store grid operations', () => {
  beforeEach(() => {
    loadGrid();
  });

  it('keeps a multi-cell selection when focus moves before clearing content', () => {
    const store = useEditorStore.getState();

    store.setSelectionRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
    store.setFocus({ row: 1, col: 0, editing: false });
    useEditorStore.getState().clearSelectionContent();

    expect(textAt(0, 0)).toBe('');
    expect(textAt(0, 1)).toBe('');
    expect(textAt(1, 0)).toBe('D');
  });

  it('pastes a copied cell range by pushing existing cells right and rows down', () => {
    const store = useEditorStore.getState();

    store.setSelectionRange({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    store.copySelection();
    store.pasteClipboard(1, 1);

    expect(textAt(1, 0)).toBe('D');
    expect(textAt(1, 1)).toBe('A');
    expect(textAt(1, 2)).toBe('B');
    expect(textAt(1, 3)).toBe('E');
    expect(textAt(2, 1)).toBe('D');
    expect(textAt(2, 2)).toBe('E');
    expect(textAt(3, 0)).toBe('G');
  });

  it('copies and pastes selected rows as inserted rows', () => {
    const store = useEditorStore.getState();

    store.selectRow(0);
    store.copySelection();
    store.pasteClipboard(2, 0);

    expect(textAt(2, 0)).toBe('A');
    expect(textAt(2, 1)).toBe('B');
    expect(textAt(3, 0)).toBe('G');
  });

  it('copies, pastes, and deletes selected columns structurally', () => {
    const store = useEditorStore.getState();
    const initialColumns = columnCount();

    store.selectColumn(1);
    store.copySelection();
    store.pasteClipboard(0, 0);

    expect(columnCount()).toBe(initialColumns + 1);
    expect(textAt(0, 0)).toBe('B');
    expect(textAt(0, 1)).toBe('A');
    expect(textAt(1, 0)).toBe('E');
    expect(textAt(1, 1)).toBe('D');

    store.selectColumn(0);
    store.deleteSelection();

    expect(columnCount()).toBe(initialColumns);
    expect(textAt(0, 0)).toBe('A');
    expect(textAt(1, 0)).toBe('D');
  });

  it('inserts the requested number of rows and columns', () => {
    const store = useEditorStore.getState();
    const initialRows = store.document.rows.length;
    const initialColumns = columnCount();

    store.insertRowsAt(1, 3);

    expect(useEditorStore.getState().document.rows).toHaveLength(initialRows + 3);
    expect(textAt(1, 0)).toBe('');
    expect(textAt(4, 0)).toBe('D');

    store.insertColumnsAt(1, 2);

    expect(columnCount()).toBe(initialColumns + 2);
    expect(textAt(0, 0)).toBe('A');
    expect(textAt(0, 1)).toBe('');
    expect(textAt(0, 2)).toBe('');
    expect(textAt(0, 3)).toBe('B');
  });
});
