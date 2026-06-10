/**
 * Cell 单元格组件
 * 聚焦单元格始终挂载 CellEditor（修复 IME 首次按键问题）
 * editing=false → editor editable 但网格层拦截普通按键
 * editing=true  → editor 完全接管输入
 */
import { useCallback } from 'react';
import type { TabMLCell } from '../../types/tabml';
import { useEditorStore } from '../../store/editor-store';
import CellRenderer from './CellRenderer';
import { CellEditor, commitActiveCellEditor } from './CellEditor';
import { GRID_EXPAND_BATCH } from '../../constants/format';

interface CellProps {
  cell: TabMLCell;
  rowIndex: number;
  colIndex: number;
}

export default function Cell({ cell, rowIndex, colIndex }: CellProps) {
  const focus = useEditorStore((s) => s.focus);
  const setFocus = useEditorStore((s) => s.setFocus);
  const updateCell = useEditorStore((s) => s.updateCell);
  const doc = useEditorStore((s) => s.document);
  const indentRow = useEditorStore((s) => s.indentRow);

  const isEditing = focus.row === rowIndex && focus.col === colIndex && focus.editing;
  const isFocused = focus.row === rowIndex && focus.col === colIndex;
  // 聚焦的单元格始终挂载 CellEditor，确保 contenteditable 存在以支持 IME
  const showEditor = isFocused;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    const { focus: currentFocus, setFocus: sf } = useEditorStore.getState();

    if (
      currentFocus.editing &&
      currentFocus.row === rowIndex &&
      currentFocus.col === colIndex &&
      target.closest('.cell-editor')
    ) {
      e.stopPropagation();
      return;
    }

    // Browse-mode cell selection should not start native text selection.
    e.preventDefault();
    // 当前聚焦格可能在浏览态接收了 IME 输入，切格前统一尝试提交。
    if (currentFocus.row !== rowIndex || currentFocus.col !== colIndex) {
      commitActiveCellEditor({ keepEditing: true, force: true });
    }
    // 设置当前单元格焦点（浏览模式）
    sf({ row: rowIndex, col: colIndex, editing: false });
  }, [rowIndex, colIndex]);

  const handleDoubleClick = useCallback(() => {
    setFocus({ row: rowIndex, col: colIndex, editing: true });
  }, [rowIndex, colIndex, setFocus]);

  const handleClick = useCallback(() => {
    const { focus: currentFocus } = useEditorStore.getState();
    // 当前聚焦格可能在浏览态接收了 IME 输入，切格前统一尝试提交。
    if (currentFocus.row !== rowIndex || currentFocus.col !== colIndex) {
      commitActiveCellEditor({ keepEditing: true, force: true });
    }
    // 当前格子正在编辑 → 不干扰（拖拽选文本后的 click 事件也会到这里）
    if (currentFocus.editing && currentFocus.row === rowIndex && currentFocus.col === colIndex) {
      return;
    }
    setFocus({ row: rowIndex, col: colIndex, editing: false });
  }, [rowIndex, colIndex, setFocus]);

  const handleCommit = useCallback(
    (newCell: TabMLCell, options?: { keepEditing?: boolean }) => {
      updateCell(rowIndex, colIndex, newCell);
      if (!options?.keepEditing) {
        setFocus({ row: rowIndex, col: colIndex, editing: false });
      }
    },
    [rowIndex, colIndex, updateCell, setFocus]
  );

  const handleCancel = useCallback(() => {
    setFocus({ row: rowIndex, col: colIndex, editing: false });
  }, [rowIndex, colIndex, setFocus]);

  const handleTabNext = useCallback(() => {
    const row = doc.rows[rowIndex];
    if (!row) return;
    const totalCols = row.cells.length;
    if (colIndex < totalCols - 1) {
      setFocus({ row: rowIndex, col: colIndex + 1, editing: true });
    } else if (colIndex === 0) {
      indentRow(rowIndex, 1);
      setFocus({ row: rowIndex, col: colIndex, editing: false });
    } else {
      if (rowIndex < doc.rows.length - 1) {
        setFocus({ row: rowIndex + 1, col: 0, editing: true });
      } else {
        useEditorStore.getState().insertColumnsAt(totalCols, GRID_EXPAND_BATCH);
        setFocus({ row: rowIndex, col: totalCols, editing: true });
      }
    }
  }, [rowIndex, colIndex, doc, setFocus, indentRow]);

  const handleTabPrev = useCallback(() => {
    if (colIndex > 0) {
      setFocus({ row: rowIndex, col: colIndex - 1, editing: true });
    } else {
      indentRow(rowIndex, -1);
      setFocus({ row: rowIndex, col: colIndex, editing: false });
    }
  }, [rowIndex, colIndex, setFocus, indentRow]);

  const handleArrowUp = useCallback(() => {
    if (rowIndex > 0) {
      let target = rowIndex - 1;
      while (target >= 0 && doc.rows[target].isEmpty) target--;
      if (target >= 0) {
        const targetCols = doc.rows[target].cells.length;
        setFocus({ row: target, col: Math.min(colIndex, targetCols - 1), editing: false });
      }
    }
  }, [rowIndex, colIndex, doc, setFocus]);

  const handleArrowDown = useCallback(() => {
    if (rowIndex < doc.rows.length - 1) {
      let target = rowIndex + 1;
      while (target < doc.rows.length && doc.rows[target].isEmpty) target++;
      if (target < doc.rows.length) {
        const targetCols = doc.rows[target].cells.length;
        setFocus({ row: target, col: Math.min(colIndex, targetCols - 1), editing: false });
      }
    } else {
      useEditorStore.getState().insertRowsAt(doc.rows.length, GRID_EXPAND_BATCH);
      setFocus({ row: rowIndex + 1, col: colIndex, editing: false });
    }
  }, [rowIndex, colIndex, doc, setFocus]);

  return (
    <div
      className={`cell-wrapper ${isFocused ? 'cell-wrapper-focused' : ''} ${isFocused && !isEditing ? 'cell-browse-mode' : ''}`}
      data-row={rowIndex}
      data-col={colIndex}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      tabIndex={isFocused ? 0 : -1}
    >
      {showEditor ? (
        <CellEditor
          cell={cell}
          editing={isEditing}
          onCommit={handleCommit}
          onCancel={handleCancel}
          onTabNext={handleTabNext}
          onTabPrev={handleTabPrev}
          onArrowUp={handleArrowUp}
          onArrowDown={handleArrowDown}
        />
      ) : (
        <CellRenderer cell={cell} />
      )}
    </div>
  );
}
