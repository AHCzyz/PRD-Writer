/**
 * Grid 主网格组件
 * HTML table + 键盘导航
 * mousedown 同步提交：在 blur 之前保存编辑内容（根因修复）
 */
import { useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editor-store';
import GridRow from './GridRow';
import ColumnResizer from './ColumnResizer';
import { useKeyboardNavigation } from '../../hooks/use-keyboard-navigation';
import { isToolbarInteracting } from '../toolbar/FloatingToolbar';

export default function Grid() {
  const document = useEditorStore((s) => s.document);
  const columnWidths = useEditorStore((s) => s.columnWidths);
  const showGridLines = useEditorStore((s) => s.showGridLines);
  const focus = useEditorStore((s) => s.focus);
  const setFocus = useEditorStore((s) => s.setFocus);
  const insertRow = useEditorStore((s) => s.insertRow);

  const gridRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // 键盘导航
  useKeyboardNavigation();

  // mousedown 同步提交：保证在 blur 之前执行
  // 浏览器事件序: mousedown → (blur) → mouseup → click
  // 在 mousedown 时同步 setFocus({editing: false})，
  // React 卸载 CellEditor 前，blur handler 同步提交内容
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    // 监听 document 级别，覆盖 grid 外部点击（顶部工具栏、模式切换等）
    const handleMouseDown = (e: MouseEvent) => {
      const { focus: f } = useEditorStore.getState();
      if (!f.editing) return;
      if (isToolbarInteracting()) return;

      const target = e.target as HTMLElement;
      // 点击正在编辑的格子内部 → 不提交
      const editingCell = el.querySelector(
        `[data-row="${f.row}"][data-col="${f.col}"] .cell-editor`
      );
      if (editingCell && editingCell.contains(target)) return;

      // 点击浮动工具栏 → 不提交
      if (target.closest('.floating-toolbar')) return;

      // 同步退出编辑模式
      useEditorStore.getState().setFocus({ row: f.row, col: f.col, editing: false });
    };

    window.document.addEventListener('mousedown', handleMouseDown);
    return () => window.document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // 点击空白区域 → 保存编辑（兜底，正常由 mousedown 处理）
  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === gridRef.current || e.target === tableRef.current) {
        const { focus: f } = useEditorStore.getState();
        if (f.editing) {
          setFocus({ row: f.row, col: f.col, editing: false });
        }
      }
    },
    [setFocus]
  );

  // 聚焦到当前 cell 元素
  useEffect(() => {
    if (!gridRef.current) return;
    const cellEl = gridRef.current.querySelector(
      `[data-row="${focus.row}"][data-col="${focus.col}"]`
    ) as HTMLElement;
    if (cellEl && !focus.editing) {
      cellEl.focus();
      cellEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [focus.row, focus.col, focus.editing]);

  return (
    <div
      ref={gridRef}
      className={`grid-container ${showGridLines ? 'show-grid' : ''}`}
      onClick={handleGridClick}
      tabIndex={0}
    >
      <table ref={tableRef} className="grid-table">
        <colgroup>
          {columnWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <tbody>
          {document.rows.map((row, rowIdx) => (
            <GridRow key={rowIdx} row={row} rowIndex={rowIdx} />
          ))}
          {/* 末尾空白行，点击添加新行 */}
          <tr className="grid-add-row">
            <td
              colSpan={columnWidths.length}
              onClick={() => insertRow(document.rows.length - 1)}
            >
              <span className="add-row-hint">+ 点击添加新行</span>
            </td>
          </tr>
        </tbody>
      </table>
      <ColumnResizer columnWidths={columnWidths} />
    </div>
  );
}
