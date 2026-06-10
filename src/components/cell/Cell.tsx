/**
 * Cell 单元格组件
 * 双状态：editing=false → CellRenderer, editing=true → CellEditor
 */
import { useCallback } from 'react';
import type { TabMLCell } from '../../types/tabml';
import { useEditorStore } from '../../store/editor-store';
import CellRenderer from './CellRenderer';
import { CellEditor } from './CellEditor';

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
  const addColumn = useEditorStore((s) => s.addColumn);

  const isEditing = focus.row === rowIndex && focus.col === colIndex && focus.editing;
  const isFocused = focus.row === rowIndex && focus.col === colIndex;

  const handleDoubleClick = useCallback(() => {
    setFocus({ row: rowIndex, col: colIndex, editing: true });
  }, [rowIndex, colIndex, setFocus]);

  const handleClick = useCallback(() => {
    // 如果当前正在编辑别的格子，先保存（退出编辑）
    const { focus: currentFocus, setFocus: sf } = useEditorStore.getState();
    if (currentFocus.editing && (currentFocus.row !== rowIndex || currentFocus.col !== colIndex)) {
      sf({ row: currentFocus.row, col: currentFocus.col, editing: false });
    }
    setFocus({ row: rowIndex, col: colIndex, editing: false });
  }, [rowIndex, colIndex, setFocus]);

  const handleCommit = useCallback(
    (newCell: TabMLCell) => {
      updateCell(rowIndex, colIndex, newCell);
      setFocus({ row: rowIndex, col: colIndex, editing: false });
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
        addColumn(rowIndex);
        setFocus({ row: rowIndex, col: totalCols, editing: true });
      }
    }
  }, [rowIndex, colIndex, doc, setFocus, indentRow, addColumn]);

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
    }
  }, [rowIndex, colIndex, doc, setFocus]);

  return (
    <div
      className={`cell-wrapper ${isFocused ? 'cell-wrapper-focused' : ''}`}
      data-row={rowIndex}
      data-col={colIndex}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      tabIndex={isFocused ? 0 : -1}
    >
      {isEditing ? (
        <CellEditor
          cell={cell}
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
