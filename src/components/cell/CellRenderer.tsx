/**
 * CellRenderer 单元格渲染器（非编辑状态）
 * 显示格式化 HTML，不显示任何标记符号
 */
import type { TabMLCell } from '../../types/tabml';
import { renderCellHTML } from '../../core/tabml/renderer';

interface CellRendererProps {
  cell: TabMLCell;
}

export default function CellRenderer({ cell }: CellRendererProps) {
  const html = renderCellHTML(cell);

  return (
    <div
      className="cell-renderer"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
