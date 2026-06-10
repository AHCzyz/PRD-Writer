/**
 * 键盘导航 Hook
 * 实现 Excel 风格的网格导航：Tab/Shift+Tab/ArrowKeys
 * 选中即可输入：按可打印字符直接进入编辑模式并替换内容
 * Enter = 换行到下一行（始终，非编辑模式）
 */
import { useCallback, useEffect } from 'react';
import { useEditorStore } from '../store/editor-store';

export function useKeyboardNavigation() {
  const deleteRow = useEditorStore((s) => s.deleteRow);
  const indentRow = useEditorStore((s) => s.indentRow);
  const addColumn = useEditorStore((s) => s.addColumn);

  // 使用 getState() 避免闭包问题 — handler 始终读取最新 focus
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const { focus, document, setFocus, setPendingEditKey } = useEditorStore.getState();
    const { row, col, editing } = focus;
    const rows = document.rows;
    const currentRow = rows[row];
    if (!currentRow || currentRow.isEmpty) return;

    const totalCols = currentRow.cells.length;

    // 编辑模式下由 CellEditor 处理，这里只处理 Escape
    if (editing) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setFocus({ row, col, editing: false });
      }
      return;
    }

    switch (e.key) {
      case 'Tab': {
        e.preventDefault();
        if (e.shiftKey) {
          if (col === 0) {
            indentRow(row, -1);
          } else {
            setFocus({ row, col: col - 1, editing: false });
          }
        } else {
          if (col < totalCols - 1) {
            setFocus({ row, col: col + 1, editing: false });
          } else {
            if (row < rows.length - 1) {
              setFocus({ row: row + 1, col: 0, editing: false });
            } else {
              addColumn(row);
              setFocus({ row, col: totalCols, editing: false });
            }
          }
        }
        break;
      }

      case 'Enter': {
        // Enter = 移到下一行（Excel 风格）
        e.preventDefault();
        if (row < rows.length - 1) {
          let targetRow = row + 1;
          while (targetRow < rows.length && rows[targetRow].isEmpty) targetRow++;
          if (targetRow < rows.length) {
            const targetCols = rows[targetRow].cells.length;
            setFocus({ row: targetRow, col: Math.min(col, targetCols - 1), editing: false });
          }
        }
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        if (row > 0) {
          let targetRow = row - 1;
          while (targetRow >= 0 && rows[targetRow].isEmpty) targetRow--;
          if (targetRow >= 0) {
            const targetCols = rows[targetRow].cells.length;
            setFocus({ row: targetRow, col: Math.min(col, targetCols - 1), editing: false });
          }
        }
        break;
      }

      case 'ArrowDown': {
        e.preventDefault();
        if (row < rows.length - 1) {
          let targetRow = row + 1;
          while (targetRow < rows.length && rows[targetRow].isEmpty) targetRow++;
          if (targetRow < rows.length) {
            const targetCols = rows[targetRow].cells.length;
            setFocus({ row: targetRow, col: Math.min(col, targetCols - 1), editing: false });
          }
        }
        break;
      }

      case 'ArrowLeft': {
        if (col > 0) {
          e.preventDefault();
          setFocus({ row, col: col - 1, editing: false });
        }
        break;
      }

      case 'ArrowRight': {
        if (col < totalCols - 1) {
          e.preventDefault();
          setFocus({ row, col: col + 1, editing: false });
        }
        break;
      }

      case 'Delete':
      case 'Backspace': {
        const cellText = getCellPlainText(currentRow, col);
        if (cellText === '' && col === 0 && e.key === 'Backspace') {
          // 空格 + col=0 + Backspace = 删除行
          e.preventDefault();
          deleteRow(row);
        } else if (cellText !== '') {
          // 有内容的格子 → 清除内容
          e.preventDefault();
          const { updateCell } = useEditorStore.getState();
          const emptyCell = { ...currentRow.cells[col], content: [{ type: 'text' as const, text: '' }] };
          updateCell(row, col, emptyCell);
        }
        break;
      }

      case 'F2': {
        // F2 = 进入编辑模式（保留原有内容）
        e.preventDefault();
        setFocus({ row, col, editing: true });
        break;
      }

      default: {
        // 选中即可输入：可打印字符 → 进入编辑模式，替换内容
        if (isPrintableKey(e)) {
          e.preventDefault();
          setPendingEditKey(e.key);
          setFocus({ row, col, editing: true });
        }
        break;
      }
    }
  }, [deleteRow, indentRow, addColumn]);

  useEffect(() => {
    const el = document.querySelector('.grid-container');
    if (!el) return;
    el.addEventListener('keydown', handleKeyDown as EventListener);
    return () => el.removeEventListener('keydown', handleKeyDown as EventListener);
  }, [handleKeyDown]);
}

/**
 * 判断是否为可打印字符键
 */
function isPrintableKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  return e.key.length === 1;
}

/**
 * 获取单元格纯文本
 */
function getCellPlainText(
  row: { cells: Array<{ content: Array<{ type: string; text?: string }> }> },
  col: number
): string {
  const cell = row.cells[col];
  if (!cell) return '';
  return cell.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('');
}
