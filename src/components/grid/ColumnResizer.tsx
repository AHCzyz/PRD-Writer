/**
 * 列宽拖拽调整 — 基于实际表格单元格位置
 */
import { useCallback, useRef, useState, useEffect } from 'react';
import { useEditorStore } from '../../store/editor-store';
import { MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH } from '../../constants/format';

interface ColumnResizerProps {
  columnWidths: number[];
}

export default function ColumnResizer({ columnWidths }: ColumnResizerProps) {
  const setColumnWidth = useEditorStore((s) => s.setColumnWidth);
  const [dragging, setDragging] = useState<number | null>(null);
  const [handlePositions, setHandlePositions] = useState<number[]>([]);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (colIdx: number, e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(colIdx);
      startXRef.current = e.clientX;
      startWidthRef.current = columnWidths[colIdx];

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        const newWidth = Math.max(
          MIN_COLUMN_WIDTH,
          Math.min(MAX_COLUMN_WIDTH, startWidthRef.current + delta)
        );
        setColumnWidth(colIdx, newWidth);
      };

      const handleMouseUp = () => {
        setDragging(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [columnWidths, setColumnWidth]
  );

  // 基于实际表格列位置计算手柄位置
  useEffect(() => {
    const updatePositions = () => {
      const grid = document.querySelector('.grid-container');
      const table = document.querySelector('.grid-table');
      if (!grid || !table) return;

      const gridRect = grid.getBoundingClientRect();
      void gridRect; // reserved for future use
      const cols = table.querySelectorAll('col');
      const positions: number[] = [];
      let accumulated = 0;

      cols.forEach((col, i) => {
        const w = col.getBoundingClientRect().width;
        accumulated += w;
        if (i < cols.length - 1) {
          // 相对于 grid-container 的 left 偏移
          // 需要加上 grid 的 scrollLeft
          positions.push(accumulated + grid.scrollLeft);
        }
      });

      setHandlePositions(positions);
    };

    updatePositions();

    // 监听 resize 和 scroll
    const grid = document.querySelector('.grid-container');
    if (grid) {
      grid.addEventListener('scroll', updatePositions);
    }
    window.addEventListener('resize', updatePositions);

    // columnWidths 变化时重新计算
    const timer = setTimeout(updatePositions, 50);

    return () => {
      if (grid) grid.removeEventListener('scroll', updatePositions);
      window.removeEventListener('resize', updatePositions);
      clearTimeout(timer);
    };
  }, [columnWidths]);

  return (
    <div className="column-resizers">
      {handlePositions.map((left, idx) => (
        <div
          key={idx}
          className={`column-resize-handle ${dragging === idx ? 'dragging' : ''}`}
          style={{ left }}
          onMouseDown={(e) => handleMouseDown(idx, e)}
        />
      ))}
    </div>
  );
}
