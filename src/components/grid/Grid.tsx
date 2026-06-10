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
  GRID_EXPAND_BATCH,
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

type SubmenuKey = 'rows' | 'columns' | 'format';

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
  const fontSize = useEditorStore((s) => s.fontSize);
  const selectionRange = useEditorStore((s) => s.selectionRange);
  const selectAll = useEditorStore((s) => s.selectAll);
  const clipboard = useEditorStore((s) => s.clipboard);

  const gridRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [insertRowCountInput, setInsertRowCountInput] = useState('1');
  const [insertColCountInput, setInsertColCountInput] = useState('1');
  const [openSubmenu, setOpenSubmenu] = useState<SubmenuKey | null>(null);

  const dragRef = useRef<{
    dragging: boolean;
    mode: 'cells' | 'rows' | 'columns';
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

      dragRef.current = { dragging: true, mode: 'cells', startRow: rowIdx, startCol: colIdx };
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
    if (!dragRef.current?.dragging || dragRef.current.mode !== 'cells') return;
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

  const handleRowHeaderMouseDown = useCallback((rowIdx: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setContextMenu(null);
    commitActiveCellEditor({ keepEditing: true, force: true });

    const state = useEditorStore.getState();
    const maxCol = getMaxCol(state.document, state.columnWidths);
    dragRef.current = { dragging: true, mode: 'rows', startRow: rowIdx, startCol: 0 };
    state.setSelectionRange({
      startRow: rowIdx,
      startCol: 0,
      endRow: rowIdx,
      endCol: maxCol,
    });
    state.setFocus({ row: rowIdx, col: 0, editing: false });
  }, []);

  const handleRowHeaderMouseEnter = useCallback((rowIdx: number) => {
    if (!dragRef.current?.dragging || dragRef.current.mode !== 'rows') return;
    const state = useEditorStore.getState();
    const maxCol = getMaxCol(state.document, state.columnWidths);
    state.setSelectionRange({
      startRow: dragRef.current.startRow,
      startCol: 0,
      endRow: rowIdx,
      endCol: maxCol,
    });
  }, []);

  const handleColHeaderMouseDown = useCallback((colIdx: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setContextMenu(null);
    commitActiveCellEditor({ keepEditing: true, force: true });

    const state = useEditorStore.getState();
    dragRef.current = { dragging: true, mode: 'columns', startRow: 0, startCol: colIdx };
    state.setSelectionRange({
      startRow: 0,
      startCol: colIdx,
      endRow: Math.max(0, state.document.rows.length - 1),
      endCol: colIdx,
    });
    state.setFocus({ row: 0, col: colIdx, editing: false });
  }, []);

  const handleColHeaderMouseEnter = useCallback((colIdx: number) => {
    if (!dragRef.current?.dragging || dragRef.current.mode !== 'columns') return;
    const state = useEditorStore.getState();
    state.setSelectionRange({
      startRow: 0,
      startCol: dragRef.current.startCol,
      endRow: Math.max(0, state.document.rows.length - 1),
      endCol: colIdx,
    });
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
      const target = e.target as HTMLElement;
      if (target.closest('.context-menu')) return;
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
    const gridEl = gridRef.current;
    const target = e.target as HTMLElement;
    if (target.closest('.floating-toolbar')) return;
    if (gridEl?.contains(target)) {
      e.preventDefault();
      e.stopPropagation();
    }

    const state = useEditorStore.getState();
    let row = state.focus.row;
    let col = state.focus.col;
    let range: SelectionRange | null = null;
    const fromCellEditor = !!target.closest('.cell-editor');
    const textSelection = fromCellEditor && hasActiveCellEditorTextSelection();
    const contextTarget = gridEl
      ? findContextTarget(target, e.clientX, e.clientY, gridEl)
      : target;

    const colHeader = contextTarget?.closest('[data-col-header]') as HTMLElement | null;
    const rowHeader = contextTarget?.closest('[data-row-header]') as HTMLElement | null;
    const cellEl = contextTarget?.closest('[data-row][data-col]') as HTMLElement | null;

    if (colHeader && gridEl?.contains(colHeader)) {
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
    } else if (rowHeader && gridEl?.contains(rowHeader)) {
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
    } else if (cellEl && gridEl?.contains(cellEl)) {
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

    if (!textSelection) {
      commitActiveCellEditor({ keepEditing: true, force: true });
      state.setFocus({ row, col, editing: false });
    }

    const normalized = normalizeRange(range, state.document, state.columnWidths);
    setInsertRowCountInput(String(normalized.maxRow - normalized.minRow + 1));
    setInsertColCountInput(String(normalized.maxCol - normalized.minCol + 1));
    setOpenSubmenu(null);
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
    setOpenSubmenu(null);
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

    const handlePointerDown = (e: PointerEvent) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      setOpenSubmenu(null);
      setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenSubmenu(null);
        setContextMenu(null);
      }
    };

    window.document.addEventListener('pointerdown', handlePointerDown, true);
    window.document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.document.removeEventListener('pointerdown', handlePointerDown, true);
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

  const customRowInsertCount = parseInsertCount(insertRowCountInput);
  const customColInsertCount = parseInsertCount(insertColCountInput);

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
                onMouseDown={(e) => handleColHeaderMouseDown(colIdx, e)}
                onMouseEnter={() => handleColHeaderMouseEnter(colIdx)}
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
              onRowHeaderMouseDown={handleRowHeaderMouseDown}
              onRowHeaderMouseEnter={handleRowHeaderMouseEnter}
            />
          ))}
          <tr className="grid-add-row">
            <td className="row-header-cell" />
            <td
              colSpan={columnWidths.length}
              onClick={() => useEditorStore.getState().insertRowsAt(document.rows.length, GRID_EXPAND_BATCH)}
            >
              <span className="add-row-hint">+ 点击添加 {GRID_EXPAND_BATCH} 行</span>
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
              if (!(e.target as HTMLElement).closest('input')) {
                e.preventDefault();
              }
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onContextMenu={(e) => {
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

            <div
              className={`context-menu-item has-submenu ${openSubmenu === 'rows' ? 'submenu-open' : ''}`}
              onMouseEnter={() => setOpenSubmenu('rows')}
              onFocus={() => setOpenSubmenu('rows')}
            >
              <span>插入行</span>
              <span className="submenu-arrow">›</span>
              <div className="context-submenu insert-submenu">
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertRowsAt(contextMenu.minRow, 1))}>
                  上增 1 行
                </button>
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertRowsAt(contextMenu.maxRow + 1, 1))}>
                  下增 1 行
                </button>
                <label className="context-count-input">
                  <span>数量</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={insertRowCountInput}
                    onChange={(e) => setInsertRowCountInput(sanitizeCountInput(e.currentTarget.value))}
                  />
                </label>
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertRowsAt(contextMenu.minRow, customRowInsertCount))}>
                  上增 {customRowInsertCount} 行
                </button>
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertRowsAt(contextMenu.maxRow + 1, customRowInsertCount))}>
                  下增 {customRowInsertCount} 行
                </button>
              </div>
            </div>

            <div
              className={`context-menu-item has-submenu ${openSubmenu === 'columns' ? 'submenu-open' : ''}`}
              onMouseEnter={() => setOpenSubmenu('columns')}
              onFocus={() => setOpenSubmenu('columns')}
            >
              <span>插入列</span>
              <span className="submenu-arrow">›</span>
              <div className="context-submenu insert-submenu">
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertColumnsAt(contextMenu.minCol, 1))}>
                  左增 1 列
                </button>
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertColumnsAt(contextMenu.maxCol + 1, 1))}>
                  右增 1 列
                </button>
                <label className="context-count-input">
                  <span>数量</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={insertColCountInput}
                    onChange={(e) => setInsertColCountInput(sanitizeCountInput(e.currentTarget.value))}
                  />
                </label>
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertColumnsAt(contextMenu.minCol, customColInsertCount))}>
                  左增 {customColInsertCount} 列
                </button>
                <button onClick={() => runContextAction(() => useEditorStore.getState().insertColumnsAt(contextMenu.maxCol + 1, customColInsertCount))}>
                  右增 {customColInsertCount} 列
                </button>
              </div>
            </div>

            <div className="context-menu-separator" />

            <div
              className={`context-menu-item has-submenu ${openSubmenu === 'format' ? 'submenu-open' : ''}`}
              onMouseEnter={() => setOpenSubmenu('format')}
              onFocus={() => setOpenSubmenu('format')}
            >
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

function findContextTarget(
  target: HTMLElement,
  clientX: number,
  clientY: number,
  gridEl: HTMLElement
): HTMLElement | null {
  const selector = '[data-row][data-col], [data-row-header], [data-col-header]';
  const direct = target.closest(selector) as HTMLElement | null;
  if (direct && gridEl.contains(direct)) return direct;

  const offsets = [
    [1, 1],
    [2, 2],
    [4, 4],
    [6, 6],
    [8, 8],
    [10, 10],
    [12, 12],
    [1, 0],
    [0, 1],
    [-1, 1],
    [1, -1],
  ];

  for (const [dx, dy] of offsets) {
    const el = window.document.elementFromPoint(clientX + dx, clientY + dy) as HTMLElement | null;
    const snapped = el?.closest(selector) as HTMLElement | null;
    if (snapped && gridEl.contains(snapped)) return snapped;
  }

  return null;
}

function sanitizeCountInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3);
}

function parseInsertCount(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, n));
}
