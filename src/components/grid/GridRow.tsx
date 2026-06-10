/**
 * 单行渲染
 */
import type { TabMLRow } from '../../types/tabml';
import { useEditorStore } from '../../store/editor-store';
import Cell from '../cell/Cell';
import { INDENT_WIDTH, SEPARATOR_HEIGHT } from '../../constants/format';
import { createEmptyCell } from '../../types/tabml';

interface GridRowProps {
  row: TabMLRow;
  rowIndex: number;
}

export default function GridRow({ row, rowIndex }: GridRowProps) {
  const columnWidths = useEditorStore((s) => s.columnWidths);
  const focus = useEditorStore((s) => s.focus);

  // 空行 = 分隔符
  if (row.isEmpty) {
    return (
      <tr className="grid-separator-row" style={{ height: SEPARATOR_HEIGHT }}>
        <td colSpan={columnWidths.length} className="grid-separator">
          <div className="separator-line" />
        </td>
      </tr>
    );
  }

  const indentPx = row.indent * INDENT_WIDTH;

  return (
    <tr className="grid-row" data-row-index={rowIndex}>
      {row.cells.map((cell, colIdx) => (
        <td
          key={colIdx}
          className={`grid-cell ${
            focus.row === rowIndex && focus.col === colIdx ? 'cell-focused' : ''
          }`}
          style={{
            paddingLeft: colIdx === 0 ? indentPx + 8 : 8,
          }}
        >
          <Cell cell={cell} rowIndex={rowIndex} colIndex={colIdx} />
        </td>
      ))}
      {/* 如果此行列数少于总列数，补空列 — 但可交互 */}
      {row.cells.length < columnWidths.length &&
        Array.from({ length: columnWidths.length - row.cells.length }).map((_, i) => {
          const colIdx = row.cells.length + i;
          return (
            <td
              key={`empty-${colIdx}`}
              className={`grid-cell ${
                focus.row === rowIndex && focus.col === colIdx ? 'cell-focused' : ''
              }`}
            >
              <Cell
                cell={createEmptyCell()}
                rowIndex={rowIndex}
                colIndex={colIdx}
              />
            </td>
          );
        })}
    </tr>
  );
}
