/**
 * 键盘导航 Hook
 * 实现 Excel 风格的网格导航：Tab/Shift+Tab/ArrowKeys
 * 选中即可输入：按可打印字符直接进入编辑模式并替换内容
 * Enter = 换行到下一行（始终，非编辑模式）
 */
import { useCallback, useEffect } from 'react';
import { useEditorStore } from '../store/editor-store';
import { commitActiveCellEditor, hasActiveCellEditorChanges } from '../components/cell/CellEditor';

export function useKeyboardNavigation() {
  const deleteRow = useEditorStore((s) => s.deleteRow);
  const indentRow = useEditorStore((s) => s.indentRow);
  const addColumn = useEditorStore((s) => s.addColumn);

  // 使用 getState() 避免闭包问题 — handler 始终读取最新 focus
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (e.defaultPrevented && target?.closest('.cell-editor')) return;

    const { focus, document, setFocus, setPendingEditKey, selectAll, selectionRange, selectAllCells, clearSelection } = useEditorStore.getState();
    const { row, col, editing } = focus;
    const rows = document.rows;
    const currentRow = rows[row];

    // Ctrl+A = 全选/取消全选
    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (selectAll || selectionRange) {
        clearSelection();
      } else {
        selectAllCells();
      }
      return;
    }

    // 任何非修饰键操作取消选区
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      if (selectAll || selectionRange) clearSelection();
    }

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
        commitActiveCellEditor({ keepEditing: true, force: true });
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
        commitActiveCellEditor({ keepEditing: true, force: true });
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
        commitActiveCellEditor({ keepEditing: true, force: true });
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
        commitActiveCellEditor({ keepEditing: true, force: true });
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
          commitActiveCellEditor({ keepEditing: true, force: true });
          setFocus({ row, col: col - 1, editing: false });
        }
        break;
      }

      case 'ArrowRight': {
        if (col < totalCols - 1) {
          e.preventDefault();
          commitActiveCellEditor({ keepEditing: true, force: true });
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
        // IME 输入时不拦截，让 Tiptap 自然处理
        if (isPrintableKey(e)) {
          if (hasActiveCellEditorChanges()) {
            setFocus({ row, col, editing: true });
            return;
          }
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

    // IME 输入开始（拼音、日文等）
    // 如果当前不在编辑模式 → 进入编辑模式但不注入 key
    // 如果已在编辑模式（keydown 先于 compositionstart）→ 清除误插的英文字母
    const handleCompositionStart = () => {
      const { focus: f, setFocus: sf, pendingEditKey, clearPendingEditKey } = useEditorStore.getState();
      if (!f.editing) {
        // keydown 尚未触发或已被跳过 → 直接进入编辑模式，不设置 pendingKey
        // 后续 IME 组合键将自然流入 CellEditor
        sf({ row: f.row, col: f.col, editing: true });
      } else if (pendingEditKey) {
        // keydown 先于 compositionstart 触发了，误插了英文字母
        // 清除 pendingKey 并从编辑器中删除该字符
        clearPendingEditKey();
        requestAnimationFrame(() => {
          const pmEl = window.document.querySelector('.cell-editor-content .ProseMirror');
          if (pmEl) {
            // ProseMirror 在 dom 上附加了 view 引用
            const view = (pmEl as any).pmView;
            if (view && !view.destroyed) {
              const { state } = view;
              const { from } = state.selection;
              if (from > 0) {
                // 删除光标前的一个字符（误插的英文字母）
                const tr = state.tr.delete(from - 1, from);
                view.dispatch(tr);
              }
            }
          }
        });
      }
    };
    el.addEventListener('compositionstart', handleCompositionStart);

    return () => {
      el.removeEventListener('keydown', handleKeyDown as EventListener);
      el.removeEventListener('compositionstart', handleCompositionStart);
    };
  }, [handleKeyDown]);
}

/**
 * 判断是否为可打印字符键（排除 IME 输入）
 */
function isPrintableKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  // IME 正在处理组合输入 → 不拦截
  if (e.isComposing || e.keyCode === 229) return false;
  // Chromium 对 IME 处理中的按键返回 'Process'
  if (e.key === 'Process') return false;
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
