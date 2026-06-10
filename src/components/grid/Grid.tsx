/**
 * Grid 主网格组件
 * HTML table + 键盘导航
 */
import { useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editor-store';
import GridRow from './GridRow';
import ColumnResizer from './ColumnResizer';
import { useKeyboardNavigation } from '../../hooks/use-keyboard-navigation';

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

  // 点击空白区域 → 保存编辑（退出编辑模式）
  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === gridRef.current || e.target === tableRef.current) {
        if (focus.editing) {
          setFocus({ row: focus.row, col: focus.col, editing: false });
        }
      }
    },
    [focus.row, focus.col, focus.editing, setFocus]
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
