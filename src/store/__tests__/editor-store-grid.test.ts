import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore, isCellFrozenByRowImage } from '../editor-store';
import { createTextCell, getCellText } from '../../types/tabml';

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

  it('freezes non-image cells in a row that contains a floating image', () => {
    const store = useEditorStore.getState();
    store.loadFromText('![](image.png =120x80)\tLocked\tC\nSource\tE\tF');

    expect(isCellFrozenByRowImage(useEditorStore.getState().document.rows[0], 0)).toBe(false);
    expect(isCellFrozenByRowImage(useEditorStore.getState().document.rows[0], 1)).toBe(true);

    store.updateCell(0, 1, createTextCell('Changed'));
    expect(textAt(0, 1)).toBe('Locked');

    store.setSelectionRange({ startRow: 0, startCol: 1, endRow: 0, endCol: 1 });
    store.clearSelectionContent();
    expect(textAt(0, 1)).toBe('Locked');

    store.setSelectionRange({ startRow: 1, startCol: 0, endRow: 1, endCol: 0 });
    store.copySelection();
    store.pasteClipboard(0, 1);
    expect(textAt(0, 1)).toBe('Locked');

    store.updateCell(0, 0, createTextCell('Image removed'));
    expect(textAt(0, 0)).toBe('Image removed');
  });

  it('does not structurally expand a row that contains a floating image when inserting columns', () => {
    const store = useEditorStore.getState();
    store.loadFromText('![](image.png =120x80)\tLocked\nA\tB');
    const initialImageRowCells = useEditorStore.getState().document.rows[0].cells.length;

    store.insertColumnsAt(1, 2);

    const state = useEditorStore.getState();
    expect(state.document.rows[0].cells).toHaveLength(initialImageRowCells);
    expect(state.document.rows[1].cells).toHaveLength(4);
    expect(textAt(1, 0)).toBe('A');
    expect(textAt(1, 3)).toBe('B');
  });

  it('does not structurally shrink a row that contains a floating image when deleting columns', () => {
    const store = useEditorStore.getState();
    store.loadFromText('![](image.png =120x80)\tLocked\tKeep\nA\tB\tC');
    const initialColumns = columnCount();
    const initialImageRowCells = useEditorStore.getState().document.rows[0].cells.length;

    store.selectColumn(1);
    store.deleteSelection();

    const state = useEditorStore.getState();
    expect(columnCount()).toBe(initialColumns - 1);
    expect(state.document.rows[0].cells).toHaveLength(initialImageRowCells);
    expect(textAt(0, 1)).toBe('Locked');
    expect(textAt(0, 2)).toBe('Keep');
    expect(textAt(1, 0)).toBe('A');
    expect(textAt(1, 1)).toBe('C');
  });

  it('replaces only the image cell when pasting copied cells onto a floating-image row', () => {
    const store = useEditorStore.getState();
    store.loadFromText('![](image.png =120x80)\tLocked\nA\tB');
    const initialRows = useEditorStore.getState().document.rows.length;
    const initialImageRowCells = useEditorStore.getState().document.rows[0].cells.length;

    store.setSelectionRange({ startRow: 1, startCol: 0, endRow: 1, endCol: 1 });
    store.copySelection();
    store.pasteClipboard(0, 0);

    const state = useEditorStore.getState();
    expect(state.document.rows).toHaveLength(initialRows);
    expect(state.document.rows[0].cells).toHaveLength(initialImageRowCells);
    expect(textAt(0, 0)).toBe('A');
    expect(textAt(0, 1)).toBe('Locked');
  });

  it('does not paste copied cells or insert rows when the target is frozen by a floating image', () => {
    const store = useEditorStore.getState();
    store.loadFromText('![](image.png =120x80)\tLocked\nA\tB\nC\tD');
    const initialRows = useEditorStore.getState().document.rows.length;
    const initialImageRowCells = useEditorStore.getState().document.rows[0].cells.length;

    store.setSelectionRange({ startRow: 1, startCol: 0, endRow: 2, endCol: 0 });
    store.copySelection();
    store.pasteClipboard(0, 1);

    const state = useEditorStore.getState();
    expect(state.document.rows).toHaveLength(initialRows);
    expect(state.document.rows[0].cells).toHaveLength(initialImageRowCells);
    expect(textAt(0, 1)).toBe('Locked');
    expect(textAt(1, 0)).toBe('A');
  });
});
