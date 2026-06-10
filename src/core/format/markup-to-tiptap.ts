/**
 * Tab-ML markup → Tiptap HTML
 * 将单元格 markup 字符串转换为 Tiptap 可解析的 HTML
 */
import type { TabMLCell, InlineContent, Mark, TextRun } from '../../types/tabml';

/**
 * 将 TabMLCell 转换为 Tiptap HTML 字符串
 */
export function markupToTiptapHTML(cell: TabMLCell): string {
  const parts: string[] = [];

  // 前缀标记（Todo）
  if (cell.todo === 'uncheck') parts.push('<span data-todo="uncheck" class="todo-marker todo-uncheck">☐</span> ');
  else if (cell.todo === 'check') parts.push('<span data-todo="check" class="todo-marker todo-check">☑</span> ');
  else if (cell.todo === 'question') parts.push('<span data-todo="question" class="todo-marker todo-question">?</span> ');

  // 标题前缀
  if (cell.heading === 1) parts.push('<span data-heading-level="1" class="heading-prefix heading-h1"># </span>');
  else if (cell.heading === 2) parts.push('<span data-heading-level="2" class="heading-prefix heading-h2">## </span>');
  else if (cell.heading === 3) parts.push('<span data-heading-level="3" class="heading-prefix heading-h3">### </span>');

  // 内联内容
  for (const item of cell.content) {
    parts.push(renderInlineToHTML(item));
  }

  // 图片
  if (cell.image) {
    parts.push(`<img src="${escapeAttr(cell.image.src)}" />`);
  }

  const html = parts.join('');
  return `<p>${html || '<br>'}</p>`;
}

function renderInlineToHTML(item: InlineContent): string {
  if (item.type === 'image') {
    return `<img src="${escapeAttr(item.src)}" />`;
  }
  return renderTextRunToHTML(item);
}

function renderTextRunToHTML(run: TextRun): string {
  let html = escapeHtml(run.text);

  if (!run.marks || run.marks.length === 0) return html;

  for (const mark of run.marks) {
    html = wrapMark(html, mark);
  }
  return html;
}

function wrapMark(html: string, mark: Mark): string {
  switch (mark.type) {
    case 'bold':
      return `<strong>${html}</strong>`;
    case 'strikethrough':
      return `<span class="mark-strikethrough">${html}</span>`;
    case 'warning':
      return `<span class="mark-warning">${html}</span>`;
    case 'modified':
      return `<span class="mark-modified">${html}</span>`;
    case 'semanticColor':
      return `<span data-color="${mark.attrs.color}" class="mark-color-${mark.attrs.color}">${html}</span>`;
    default:
      return html;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
