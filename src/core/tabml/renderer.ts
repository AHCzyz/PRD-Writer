/**
 * Tab-ML Cell Renderer
 * 将单元格内容渲染为 HTML（用于非编辑状态的显示）
 */
import type { TabMLCell, InlineContent, Mark, TextRun } from '../../types/tabml';

/**
 * 将单元格渲染为 HTML 字符串
 */
export function renderCellHTML(cell: TabMLCell): string {
  const parts: string[] = [];

  // 标题样式
  if (cell.heading) {
    const sizes = { 1: '1.5em', 2: '1.25em', 3: '1.1em' };
    parts.push(`<span style="font-size:${sizes[cell.heading]};font-weight:bold;display:block">`);
  }

  // Todo 复选框
  if (cell.todo) {
    const icons = {
      uncheck: '<span class="todo-box todo-uncheck">☐</span> ',
      check: '<span class="todo-box todo-check">☑</span> ',
      question: '<span class="todo-box todo-question">?</span> ',
    };
    parts.push(icons[cell.todo]);
  }

  // 图片
  if (cell.image && hasOnlyEmptyText(cell.content)) {
    const w = cell.image.width ? ` width="${cell.image.width}"` : '';
    const h = cell.image.height ? ` height="${cell.image.height}"` : '';
    parts.push(`<img src="${escapeHtml(cell.image.src)}"${w}${h} class="cell-image" />`);
    if (cell.heading) parts.push('</span>');
    return parts.join('');
  }

  // 内联内容
  for (const item of cell.content) {
    parts.push(renderInlineContent(item));
  }

  if (cell.heading) parts.push('</span>');
  return parts.join('');
}

function hasOnlyEmptyText(content: InlineContent[]): boolean {
  if (content.length === 0) return true;
  return content.every((item) => item.type === 'text' && item.text.length === 0);
}

/**
 * 渲染单个内联内容
 */
function renderInlineContent(item: InlineContent): string {
  if (item.type === 'image') {
    const w = item.width ? ` width="${item.width}"` : '';
    const h = item.height ? ` height="${item.height}"` : '';
    return `<img src="${escapeHtml(item.src)}"${w}${h} class="inline-image" />`;
  }
  return renderTextRun(item);
}

/**
 * 渲染文本片段（含标记）
 */
function renderTextRun(run: TextRun): string {
  if (!run.marks || run.marks.length === 0) {
    return escapeHtml(run.text);
  }

  let html = escapeHtml(run.text);

  for (const mark of run.marks) {
    html = wrapWithMark(html, mark);
  }

  return html;
}

/**
 * 用标记包裹 HTML
 */
function wrapWithMark(html: string, mark: Mark): string {
  switch (mark.type) {
    case 'bold':
      return `<strong>${html}</strong>`;
    case 'strikethrough':
      return `<span class="mark-strikethrough">${html}</span>`;
    case 'warning':
      return `<span class="mark-warning">${html}</span>`;
    case 'modified':
      return `<span class="mark-modified">${html}</span>`;
    case 'semanticColor': {
      const color = mark.attrs.color;
      if (color === 'gray') {
        return `<span class="mark-color-gray">${html}</span>`;
      }
      return `<span class="mark-color-${color}">${html}</span>`;
    }
    default:
      return html;
  }
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
