/**
 * 单行渲染 — 行号头 + 数据格子 + 选区高亮
 */
import type { TabMLRow } from '../../types/tabml';
import { isCellFrozenByRowImage, useEditorStore } from '../../store/editor-store';
import Cell from '../cell/Cell';
import { INDENT_WIDTH } from '../../constants/format';
import { createEmptyCell } from '../../types/tabml';

interface GridRowProps {
  row: TabMLRow;
  rowIndex: number;
  onCellMouseDown: (rowIdx: number, colIdx: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (rowIdx: number, colIdx: number) => void;
  isCellSelected: (row: number, col: number) => boolean;
  isRowSelected: boolean;
  onRowHeaderMouseDown: (rowIdx: number, e: React.MouseEvent) => void;
  onRowHeaderMouseEnter: (rowIdx: number) => void;
}

export default function GridRow({
  row,
  rowIndex,
  onCellMouseDown,
  onCellMouseEnter,
  isCellSelected,
  isRowSelected,
  onRowHeaderMouseDown,
  onRowHeaderMouseEnter,
}: GridRowProps) {
  const columnWidths = useEditorStore((s) => s.columnWidths);
  const focus = useEditorStore((s) => s.focus);
  const selectAll = useEditorStore((s) => s.selectAll);

  // 空行 = 分隔符（渲染为正常空行，保证可见高度与列区分）
  if (row.isEmpty) {
    return (
      <tr className="grid-row" data-row-index={rowIndex}>
        <td
          className={`row-header-cell ${isRowSelected ? 'header-active' : ''}`}
          data-row-header={rowIndex}
          onMouseDown={(e) => onRowHeaderMouseDown(rowIndex, e)}
          onMouseEnter={() => onRowHeaderMouseEnter(rowIndex)}
        >
          <span className="row-header-label">{rowIndex + 1}</span>
        </td>
        {Array.from({ length: columnWidths.length }).map((_, colIdx) => (
          <td
            key={colIdx}
            className={`grid-cell`}
            data-row={rowIndex}
            data-col={colIdx}
            onMouseDown={(e) => onCellMouseDown(rowIndex, colIdx, e)}
            onMouseEnter={() => onCellMouseEnter(rowIndex, colIdx)}
          >
            <Cell cell={createEmptyCell()} rowIndex={rowIndex} colIndex={colIdx} frozen={false} />
          </td>
        ))}
      </tr>
    );
  }

  const indentPx = row.indent * INDENT_WIDTH;

  return (
    <tr className="grid-row" data-row-index={rowIndex}>
      {/* 行号头 */}
      <td
        className={`row-header-cell ${isRowSelected ? 'header-active' : ''}`}
        data-row-header={rowIndex}
        onMouseDown={(e) => onRowHeaderMouseDown(rowIndex, e)}
        onMouseEnter={() => onRowHeaderMouseEnter(rowIndex)}
      >
        <span className="row-header-label">{rowIndex + 1}</span>
      </td>
      {/* 数据格子 */}
      {row.cells.map((cell, colIdx) => {
        const isSelected = selectAll || isCellSelected(rowIndex, colIdx);
        const isFocused = focus.row === rowIndex && focus.col === colIdx;
        const frozen = isCellFrozenByRowImage(row, colIdx);
        return (
          <td
            key={colIdx}
            className={`grid-cell ${isFocused ? 'cell-focused' : ''} ${isSelected ? 'cell-selected' : ''} ${frozen ? 'cell-frozen' : ''}`}
            data-row={rowIndex}
            data-col={colIdx}
            style={{
              paddingLeft: colIdx === 0 ? indentPx + 4 : 4,
            }}
            onMouseDown={(e) => onCellMouseDown(rowIndex, colIdx, e)}
            onMouseEnter={() => onCellMouseEnter(rowIndex, colIdx)}
          >
            <Cell cell={cell} rowIndex={rowIndex} colIndex={colIdx} frozen={frozen} />
          </td>
        );
      })}
      {/* 补空列 */}
      {row.cells.length < columnWidths.length &&
        Array.from({ length: columnWidths.length - row.cells.length }).map((_, i) => {
          const colIdx = row.cells.length + i;
          const isSelected = selectAll || isCellSelected(rowIndex, colIdx);
          const isFocused = focus.row === rowIndex && focus.col === colIdx;
          const frozen = isCellFrozenByRowImage(row, colIdx);
          return (
            <td
              key={`empty-${colIdx}`}
              className={`grid-cell ${isFocused ? 'cell-focused' : ''} ${isSelected ? 'cell-selected' : ''} ${frozen ? 'cell-frozen' : ''}`}
              data-row={rowIndex}
              data-col={colIdx}
              onMouseDown={(e) => onCellMouseDown(rowIndex, colIdx, e)}
              onMouseEnter={() => onCellMouseEnter(rowIndex, colIdx)}
            >
              <Cell
                cell={createEmptyCell()}
                rowIndex={rowIndex}
                colIndex={colIdx}
                frozen={frozen}
              />
            </td>
          );
        })}
    </tr>
  );
}
