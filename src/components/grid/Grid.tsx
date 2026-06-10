/**
 * Grid 主网格组件
 * Excel 风格行列头 + 拖动多选 + 列宽调整
 */
import { useCallback, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore, type FormatType } from '../../store/editor-store';
import GridRow from './GridRow';
import { useKeyboardNavigation } from '../../hooks/use-keyboard-navigation';
import { isToolbarInteracting } from '../toolbar/FloatingToolbar';
import { commitActiveCellEditor } from '../cell/CellEditor';
import {
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
} from '../../constants/format';

/** 列索引转字母标签 (0→A, 25→Z, 26→AA) */
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
  const applyFormat = useEditorStore((s) => s.applyFormat);

  const gridRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const selectionToolbarRef = useRef<HTMLDivElement>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<{ top: number; left: number } | null>(null);

  // 拖动选区状态
  const dragRef = useRef<{
    dragging: boolean;
    startRow: number;
    startCol: number;
  } | null>(null);

  // 列宽拖拽状态
  const [resizeCol, setResizeCol] = useState<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  // 键盘导航
  useKeyboardNavigation();

  // === 拖动选区 ===
  const handleCellMouseDown = useCallback(
    (rowIdx: number, colIdx: number, e: React.MouseEvent) => {
      // 右键/中键不选
      if (e.button !== 0) return;
      e.preventDefault();
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
      // 同时设置 focus
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

  // 全局 mouseup 结束拖动
  useEffect(() => {
    const handleMouseUp = () => {
      if (dragRef.current?.dragging) {
        dragRef.current = null;
      }
    };
    window.document.addEventListener('mouseup', handleMouseUp);
    return () => window.document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // === 列宽拖拽 ===
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

  // === 行列头选择 ===
  const handleRowHeaderClick = useCallback((rowIdx: number) => {
    useEditorStore.getState().selectRow(rowIdx);
  }, []);

  const handleColHeaderClick = useCallback((colIdx: number) => {
    useEditorStore.getState().selectColumn(colIdx);
  }, []);

  const handleCornerClick = useCallback(() => {
    useEditorStore.getState().selectAllCells();
  }, []);

  // === mousedown 同步提交（编辑态退出）===
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

      commitActiveCellEditor({ keepEditing: true, force: true });
    };

    window.document.addEventListener('mousedown', handleMouseDown);
    return () => window.document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // 点击空白区域退出编辑
  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === gridRef.current || e.target === tableRef.current) {
        const { focus: f } = useEditorStore.getState();
        commitActiveCellEditor({ force: true });
        setFocus({ row: f.row, col: f.col, editing: false });
      }
    },
    [setFocus]
  );

  const handleGridContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.cell-editor') || target.closest('.floating-toolbar')) return;

      const cellEl = target.closest('[data-row][data-col]') as HTMLElement | null;
      if (!cellEl || !gridRef.current?.contains(cellEl)) return;

      const row = Number(cellEl.dataset.row);
      const col = Number(cellEl.dataset.col);
      if (!Number.isInteger(row) || !Number.isInteger(col)) return;

      e.preventDefault();
      e.stopPropagation();

      const state = useEditorStore.getState();
      commitActiveCellEditor({ keepEditing: true, force: true });

      const selected =
        state.selectAll || isInSelection(state.selectionRange, row, col);

      if (!selected) {
        state.setSelectionRange({
          startRow: row,
          startCol: col,
          endRow: row,
          endCol: col,
        });
      }

      state.setFocus({ row, col, editing: false });
      setSelectionToolbar({
        top: Math.max(8, e.clientY - 44),
        left: Math.max(8, e.clientX - 140),
      });
    },
    []
  );

  const handleSelectionFormat = useCallback(
    (format: FormatType) => {
      applyFormat(format);
      setSelectionToolbar(null);
    },
    [applyFormat]
  );

  useEffect(() => {
    if (!selectionToolbar) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (selectionToolbarRef.current?.contains(e.target as Node)) return;
      setSelectionToolbar(null);
    };

    window.document.addEventListener('mousedown', handleMouseDown);
    return () => window.document.removeEventListener('mousedown', handleMouseDown);
  }, [selectionToolbar]);

  useEffect(() => {
    if (!selectionRange && !selectAll) {
      setSelectionToolbar(null);
    }
  }, [selectionRange, selectAll]);

  // 聚焦当前 cell 元素
  useEffect(() => {
    if (!gridRef.current) return;
    const cellEl = gridRef.current.querySelector(
      `[data-row="${focus.row}"][data-col="${focus.col}"]`
    ) as HTMLElement;
    if (cellEl) {
      // 优先聚焦 CellEditor 的 contenteditable（始终挂载在聚焦单元格）
      const editable = cellEl.querySelector('.ProseMirror') as HTMLElement;
      if (editable) {
        editable.focus();
      } else {
        cellEl.focus();
      }
      cellEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [focus.row, focus.col, focus.editing]);

  /** 判断某格是否在选区内 */
  const isInRange = (r: number, c: number): boolean => {
    if (selectAll) return true;
    if (!selectionRange) return false;
    const { startRow, startCol, endRow, endCol } = selectionRange;
    const minR = Math.min(startRow, endRow);
    const maxR = Math.max(startRow, endRow);
    const minC = Math.min(startCol, endCol);
    const maxC = Math.max(startCol, endCol);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  };

  // 选中行高亮判断
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

  return (
    <div
      ref={gridRef}
      className={`grid-container ${showGridLines ? 'show-grid' : ''} ${resizeCol !== null ? 'resizing' : ''}`}
      style={{
        '--cell-font-size': `${fontSize}px`,
        '--cell-line-height': `${Math.ceil(fontSize * 1.5)}px`,
        '--row-header-width': `${ROW_HEADER_WIDTH}px`,
      } as React.CSSProperties}
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
            {/* 左上角全选按钮 */}
            <th
              className={`grid-corner-cell ${selectAll || (selectionRange && isInRange(0, 0) && isInRange(document.rows.length - 1, columnWidths.length - 1)) ? 'header-active' : ''}`}
              onClick={handleCornerClick}
            >
              <span className="corner-icon">⊞</span>
            </th>
            {/* 列头 A B C ... */}
            {columnWidths.map((_, colIdx) => (
              <th
                key={colIdx}
                className={`grid-col-header ${isColSelected(colIdx) ? 'header-active' : ''}`}
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
          {/* 末尾空白行，点击添加新行 */}
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
      {selectionToolbar &&
        createPortal(
          <div
            ref={selectionToolbarRef}
            className="floating-toolbar selection-toolbar"
            style={{
              position: 'fixed',
              top: selectionToolbar.top,
              left: selectionToolbar.left,
              zIndex: 9999,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button className="toolbar-btn" onClick={() => handleSelectionFormat('bold')} title="加粗">
              <strong>B</strong>
            </button>
            <button className="toolbar-btn" onClick={() => handleSelectionFormat('strikethrough')} title="废弃">
              <s>S</s>
            </button>
            <button className="toolbar-btn" onClick={() => handleSelectionFormat('warning')} title="警告">
              <span style={{ color: '#dc2626', fontWeight: 'bold' }}>!</span>
            </button>
            <button className="toolbar-btn" onClick={() => handleSelectionFormat('modified')} title="新增/修改">
              <span style={{ background: '#dcfce7', padding: '0 2px' }}>+</span>
            </button>
            <span className="toolbar-divider" />
            <button className="toolbar-btn toolbar-color-red" onClick={() => handleSelectionFormat('color-red')} title="强调">
              R
            </button>
            <button className="toolbar-btn toolbar-color-green" onClick={() => handleSelectionFormat('color-green')} title="说明">
              G
            </button>
            <button className="toolbar-btn toolbar-color-blue" onClick={() => handleSelectionFormat('color-blue')} title="参数/信息">
              B
            </button>
            <button className="toolbar-btn toolbar-color-gray" onClick={() => handleSelectionFormat('color-gray')} title="次要">
              -
            </button>
          </div>,
          window.document.body
        )}
    </div>
  );
}

function isInSelection(
  range: { startRow: number; startCol: number; endRow: number; endCol: number } | null,
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
