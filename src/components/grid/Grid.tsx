/**
 * Grid 主网格组件
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore, type FormatType, type SelectionRange } from '../../store/editor-store';
import GridRow from './GridRow';
import { useKeyboardNavigation } from '../../hooks/use-keyboard-navigation';
import { isToolbarInteracting } from '../toolbar/FloatingToolbar';
import {
  applyActiveCellEditorFormat,
  commitActiveCellEditor,
  hasActiveCellEditorTextSelection,
} from '../cell/CellEditor';
import {
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
} from '../../constants/format';

interface ContextMenuState {
  top: number;
  left: number;
  row: number;
  col: number;
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  textSelection: boolean;
}

function colLabel(idx: number): string {
  let s = '';
  let n = idx;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

const ROW_HEADER_WIDTH = 36;

export default function Grid() {
  const document = useEditorStore((s) => s.document);
  const columnWidths = useEditorStore((s) => s.columnWidths);
  const showGridLines = useEditorStore((s) => s.showGridLines);
  const focus = useEditorStore((s) => s.focus);
  const setFocus = useEditorStore((s) => s.setFocus);
  const insertRow = useEditorStore((s) => s.insertRow);
  const fontSize = useEditorStore((s) => s.fontSize);
  const selectionRange = useEditorStore((s) => s.selectionRange);
  const selectAll = useEditorStore((s) => s.selectAll);
  const clipboard = useEditorStore((s) => s.clipboard);

  const gridRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const dragRef = useRef<{
    dragging: boolean;
    startRow: number;
    startCol: number;
  } | null>(null);

  const [resizeCol, setResizeCol] = useState<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  useKeyboardNavigation();

  const handleCellMouseDown = useCallback(
    (rowIdx: number, colIdx: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setContextMenu(null);

      const state = useEditorStore.getState();
      const currentFocus = state.focus;
      const switchingCell = currentFocus.row !== rowIdx || currentFocus.col !== colIdx;
      if (currentFocus.editing && !switchingCell) {
        return;
      }
      if (switchingCell) {
        commitActiveCellEditor({ keepEditing: true, force: true });
      }

      dragRef.current = { dragging: true, startRow: rowIdx, startCol: colIdx };
      state.setSelectionRange({
        startRow: rowIdx,
        startCol: colIdx,
        endRow: rowIdx,
        endCol: colIdx,
      });
      state.setFocus({ row: rowIdx, col: colIdx, editing: false });
    },
    []
  );

  const handleCellMouseEnter = useCallback((rowIdx: number, colIdx: number) => {
    if (!dragRef.current?.dragging) return;
    useEditorStore.getState().setSelectionRange({
      startRow: dragRef.current.startRow,
      startCol: dragRef.current.startCol,
      endRow: rowIdx,
      endCol: colIdx,
    });
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      if (dragRef.current?.dragging) {
        dragRef.current = null;
      }
    };
    window.document.addEventListener('mouseup', handleMouseUp);
    return () => window.document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleResizeStart = useCallback(
    (colIdx: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizeCol(colIdx);
      resizeStartX.current = e.clientX;
      resizeStartW.current = columnWidths[colIdx];

      const handleMove = (ev: MouseEvent) => {
        const delta = ev.clientX - resizeStartX.current;
        const newW = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, resizeStartW.current + delta));
        useEditorStore.getState().setColumnWidth(colIdx, newW);
      };
      const handleUp = () => {
        setResizeCol(null);
        window.document.removeEventListener('mousemove', handleMove);
        window.document.removeEventListener('mouseup', handleUp);
      };
      window.document.addEventListener('mousemove', handleMove);
      window.document.addEventListener('mouseup', handleUp);
    },
    [columnWidths]
  );

  const handleRowHeaderClick = useCallback((rowIdx: number) => {
    setContextMenu(null);
    useEditorStore.getState().selectRow(rowIdx);
  }, []);

  const handleColHeaderClick = useCallback((colIdx: number) => {
    setContextMenu(null);
    useEditorStore.getState().selectColumn(colIdx);
  }, []);

  const handleCornerClick = useCallback(() => {
    setContextMenu(null);
    useEditorStore.getState().selectAllCells();
  }, []);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const handleMouseDown = (e: MouseEvent) => {
      const { focus: f } = useEditorStore.getState();
      if (isToolbarInteracting()) return;

      const target = e.target as HTMLElement;
      const editingCell = el.querySelector(
        `[data-row="${f.row}"][data-col="${f.col}"] .cell-editor`
      );
      if (editingCell && editingCell.contains(target)) return;
      if (target.closest('.floating-toolbar')) return;
      if (target.closest('.context-menu')) return;

      commitActiveCellEditor({ keepEditing: true, force: true });
    };

    window.document.addEventListener('mousedown', handleMouseDown);
    return () => window.document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      setContextMenu(null);
      if (e.target === gridRef.current || e.target === tableRef.current) {
        const { focus: f } = useEditorStore.getState();
        commitActiveCellEditor({ force: true });
        setFocus({ row: f.row, col: f.col, editing: false });
      }
    },
    [setFocus]
  );

  const handleGridContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.floating-toolbar')) return;

    const state = useEditorStore.getState();
    let row = state.focus.row;
    let col = state.focus.col;
    let range: SelectionRange | null = null;
    const fromCellEditor = !!target.closest('.cell-editor');
    const textSelection = fromCellEditor && hasActiveCellEditorTextSelection();

    const colHeader = target.closest('[data-col-header]') as HTMLElement | null;
    const rowHeader = target.closest('[data-row-header]') as HTMLElement | null;
    const cellEl = target.closest('[data-row][data-col]') as HTMLElement | null;

    if (colHeader && gridRef.current?.contains(colHeader)) {
      col = Number(colHeader.dataset.colHeader);
      if (!Number.isInteger(col)) return;
      row = 0;
      range = {
        startRow: 0,
        startCol: col,
        endRow: state.document.rows.length - 1,
        endCol: col,
      };
      state.selectColumn(col);
    } else if (rowHeader && gridRef.current?.contains(rowHeader)) {
      row = Number(rowHeader.dataset.rowHeader);
      if (!Number.isInteger(row)) return;
      col = 0;
      const maxCol = getMaxCol(state.document, state.columnWidths);
      range = {
        startRow: row,
        startCol: 0,
        endRow: row,
        endCol: maxCol,
      };
      state.selectRow(row);
    } else if (cellEl && gridRef.current?.contains(cellEl)) {
      row = Number(cellEl.dataset.row);
      col = Number(cellEl.dataset.col);
      if (!Number.isInteger(row) || !Number.isInteger(col)) return;

      const selected = state.selectAll || isInSelection(state.selectionRange, row, col);
      range = selected
        ? state.selectionRange || fullRange(state.document, state.columnWidths)
        : { startRow: row, startCol: col, endRow: row, endCol: col };

      if (!selected) {
        state.setSelectionRange(range);
      }
    } else {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (!textSelection) {
      commitActiveCellEditor({ keepEditing: true, force: true });
      state.setFocus({ row, col, editing: false });
    }

    const normalized = normalizeRange(range, state.document, state.columnWidths);
    setContextMenu({
      top: Math.max(8, e.clientY),
      left: Math.max(8, e.clientX),
      row,
      col,
      textSelection,
      ...normalized,
    });
  }, []);

  const runContextAction = useCallback((action: () => void) => {
    action();
    setContextMenu(null);
  }, []);

  const applyContextFormat = useCallback((format: FormatType, textSelection: boolean) => {
    if (textSelection && applyActiveCellEditorFormat(format)) {
      commitActiveCellEditor({ keepEditing: true, force: true });
      return;
    }
    useEditorStore.getState().applyFormat(format);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    window.document.addEventListener('mousedown', handleMouseDown);
    window.document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.document.removeEventListener('mousedown', handleMouseDown);
      window.document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!gridRef.current) return;
    const cellEl = gridRef.current.querySelector(
      `[data-row="${focus.row}"][data-col="${focus.col}"]`
    ) as HTMLElement;
    if (cellEl) {
      const editable = cellEl.querySelector('.ProseMirror') as HTMLElement;
      if (editable) {
        editable.focus();
      } else {
        cellEl.focus();
      }
      cellEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [focus.row, focus.col, focus.editing]);

  const isInRange = (r: number, c: number): boolean => {
    if (selectAll) return true;
    if (!selectionRange) return false;
    return isInSelection(selectionRange, r, c);
  };

  const isRowSelected = (r: number): boolean => {
    if (!selectionRange) return false;
    const minR = Math.min(selectionRange.startRow, selectionRange.endRow);
    const maxR = Math.max(selectionRange.startRow, selectionRange.endRow);
    return r >= minR && r <= maxR;
  };

  const isColSelected = (c: number): boolean => {
    if (!selectionRange) return false;
    const minC = Math.min(selectionRange.startCol, selectionRange.endCol);
    const maxC = Math.max(selectionRange.startCol, selectionRange.endCol);
    return c >= minC && c <= maxC;
  };

  const contextRowCount = contextMenu ? contextMenu.maxRow - contextMenu.minRow + 1 : 1;
  const contextColCount = contextMenu ? contextMenu.maxCol - contextMenu.minCol + 1 : 1;

  return (
    <div
      ref={gridRef}
      className={`grid-container ${showGridLines ? 'show-grid' : ''} ${resizeCol !== null ? 'resizing' : ''}`}
      style={{
        '--cell-font-size': `${fontSize}px`,
        '--cell-line-height': `${Math.ceil(fontSize * 1.5)}px`,
        '--row-header-width': `${ROW_HEADER_WIDTH}px`,
      } as CSSProperties}
      onClick={handleGridClick}
      onContextMenu={handleGridContextMenu}
      tabIndex={0}
    >
      <table ref={tableRef} className="grid-table">
        <colgroup>
          <col style={{ width: ROW_HEADER_WIDTH }} className="row-header-col" />
          {columnWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr className="grid-header-row">
            <th
              className={`grid-corner-cell ${selectAll || (selectionRange && isInRange(0, 0) && isInRange(document.rows.length - 1, columnWidths.length - 1)) ? 'header-active' : ''}`}
              onClick={handleCornerClick}
            >
              <span className="corner-icon">⊞</span>
            </th>
            {columnWidths.map((_, colIdx) => (
              <th
                key={colIdx}
                className={`grid-col-header ${isColSelected(colIdx) ? 'header-active' : ''}`}
                data-col-header={colIdx}
                onClick={() => handleColHeaderClick(colIdx)}
              >
                <span className="col-header-label">{colLabel(colIdx)}</span>
                <div
                  className="col-resize-handle"
                  onMouseDown={(e) => handleResizeStart(colIdx, e)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {document.rows.map((row, rowIdx) => (
            <GridRow
              key={rowIdx}
              row={row}
              rowIndex={rowIdx}
              onCellMouseDown={handleCellMouseDown}
              onCellMouseEnter={handleCellMouseEnter}
              isCellSelected={isInRange}
              isRowSelected={isRowSelected(rowIdx)}
              onRowHeaderClick={handleRowHeaderClick}
            />
          ))}
          <tr className="grid-add-row">
            <td className="row-header-cell" />
            <td
              colSpan={columnWidths.length}
              onClick={() => insertRow(document.rows.length - 1)}
            >
              <span className="add-row-hint">+ 点击添加新行</span>
            </td>
          </tr>
        </tbody>
      </table>

      {contextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="context-menu"
            style={{
              position: 'fixed',
              top: contextMenu.top,
              left: contextMenu.left,
              zIndex: 9999,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button className="context-menu-item" onClick={() => runContextAction(() => useEditorStore.getState().copySelection())}>
              复制
            </button>
            <button
              className="context-menu-item"
              disabled={!clipboard}
              onClick={() => runContextAction(() => useEditorStore.getState().pasteClipboard(contextMenu.row, contextMenu.col))}
            >
              粘贴
            </button>
            <button className="context-menu-item" onClick={() => runContextAction(() => useEditorStore.getState().cutSelection())}>
              剪切
            </button>
            <button className="context-menu-item danger" onClick={() => runContextAction(() => useEditorStore.getState().deleteSelection())}>
              删除
            </button>

            <div className="context-menu-separator" />

            <div className="context-menu-item has-submenu">
              <span>插入行</span>
              <span className="submenu-arrow">›</span>
              <div className="context-submenu">
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertRowsAt(contextMenu.minRow, contextRowCount))}>
                  上增 {contextRowCount} 行
                </button>
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertRowsAt(contextMenu.maxRow + 1, contextRowCount))}>
                  下增 {contextRowCount} 行
                </button>
              </div>
            </div>

            <div className="context-menu-item has-submenu">
              <span>插入列</span>
              <span className="submenu-arrow">›</span>
              <div className="context-submenu">
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertColumnsAt(contextMenu.minCol, contextColCount))}>
                  左增 {contextColCount} 列
                </button>
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertColumnsAt(contextMenu.maxCol + 1, contextColCount))}>
                  右增 {contextColCount} 列
                </button>
              </div>
            </div>

            <div className="context-menu-separator" />

            <div className="context-menu-item has-submenu">
              <span>修改格式</span>
              <span className="submenu-arrow">›</span>
              <div className="context-submenu format-submenu">
                <button onClick={() => runContextAction(() => applyContextFormat('bold', contextMenu.textSelection))}>加粗</button>
                <button onClick={() => runContextAction(() => applyContextFormat('strikethrough', contextMenu.textSelection))}>删除线</button>
                <button onClick={() => runContextAction(() => applyContextFormat('warning', contextMenu.textSelection))}>警告</button>
                <button onClick={() => runContextAction(() => applyContextFormat('modified', contextMenu.textSelection))}>新增</button>
                <button onClick={() => runContextAction(() => applyContextFormat('color-red', contextMenu.textSelection))}>强调</button>
                <button onClick={() => runContextAction(() => applyContextFormat('color-green', contextMenu.textSelection))}>说明</button>
                <button onClick={() => runContextAction(() => applyContextFormat('color-blue', contextMenu.textSelection))}>参数</button>
                <button onClick={() => runContextAction(() => applyContextFormat('color-gray', contextMenu.textSelection))}>次要</button>
              </div>
            </div>
          </div>,
          window.document.body
        )}
    </div>
  );
}

function fullRange(
  doc: { rows: Array<{ cells: unknown[] }> },
  columnWidths: number[]
): SelectionRange {
  return {
    startRow: 0,
    startCol: 0,
    endRow: Math.max(0, doc.rows.length - 1),
    endCol: getMaxCol(doc, columnWidths),
  };
}

function normalizeRange(
  range: SelectionRange | null,
  doc: { rows: Array<{ cells: unknown[] }> },
  columnWidths: number[]
): Omit<ContextMenuState, 'top' | 'left' | 'row' | 'col' | 'textSelection'> {
  const fallback = fullRange(doc, columnWidths);
  const source = range || fallback;
  return {
    minRow: Math.max(0, Math.min(source.startRow, source.endRow)),
    maxRow: Math.min(Math.max(0, doc.rows.length - 1), Math.max(source.startRow, source.endRow)),
    minCol: Math.max(0, Math.min(source.startCol, source.endCol)),
    maxCol: Math.max(0, Math.max(source.startCol, source.endCol)),
  };
}

function getMaxCol(
  doc: { rows: Array<{ cells: unknown[] }> },
  columnWidths: number[]
): number {
  return Math.max(...doc.rows.map((row) => row.cells.length), columnWidths.length, 1) - 1;
}

function isInSelection(
  range: SelectionRange | null,
  row: number,
  col: number
): boolean {
  if (!range) return false;
  const minR = Math.min(range.startRow, range.endRow);
  const maxR = Math.max(range.startRow, range.endRow);
  const minC = Math.min(range.startCol, range.endCol);
  const maxC = Math.max(range.startCol, range.endCol);
  return row >= minR && row <= maxR && col >= minC && col <= maxC;
}
