/**
 * Tab-ML Serializer
 * 将 TabMLDocument 结构序列化为 .tab.md 纯文本
 */
import type {
  TabMLDocument,
  TabMLRow,
  TabMLCell,
  InlineContent,
  Mark,
} from '../../types/tabml';
import { getCellText } from '../../types/tabml';

/**
 * 序列化文档为 Tab-ML 文本
 */
export function serialize(doc: TabMLDocument): string {
  const parts: string[] = [];

  // Frontmatter
  if (Object.keys(doc.frontmatter).length > 0) {
    parts.push('---');
    parts.push(serializeFrontmatter(doc.frontmatter));
    parts.push('---');
  }

  // Rows
  for (const row of doc.rows) {
    parts.push(serializeRow(row));
  }

  // 去除末尾多余空行
  let result = parts.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
}

/**
 * 序列化 frontmatter
 */
function serializeFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => String(v)).join(', ')}]`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  return lines.join('\n');
}

/**
 * 序列化行
 */
function serializeRow(row: TabMLRow): string {
  if (row.isEmpty) return '';

  const indentStr = '\t'.repeat(row.indent);
  const cellStrs = row.cells.map((c) => serializeCell(c));
  return indentStr + cellStrs.join('\t');
}

/**
 * 序列化单元格
 */
function serializeCell(cell: TabMLCell): string {
  const parts: string[] = [];

  // 标题前缀
  if (cell.heading === 1) parts.push('# ');
  else if (cell.heading === 2) parts.push('## ');
  else if (cell.heading === 3) parts.push('### ');

  // Todo 前缀
  if (cell.todo === 'uncheck') parts.push('[ ] ');
  else if (cell.todo === 'check') parts.push('[x] ');
  else if (cell.todo === 'question') parts.push('[?] ');

  // 图片独占
  if (cell.image && cell.content.length === 0) {
    const sizePart =
      cell.image.width && cell.image.height
        ? ` =${cell.image.width}x${cell.image.height}`
        : '';
    parts.push(`![](${cell.image.src}${sizePart})`);
    return parts.join('');
  }

  // 内联内容
  parts.push(serializeInline(cell.content));

  return parts.join('');
}

/**
 * 序列化内联内容
 */
function serializeInline(contents: InlineContent[]): string {
  return contents
    .map((c) => {
      if (c.type === 'image') {
        const sizePart = c.width && c.height ? ` =${c.width}x${c.height}` : '';
        return `![](${c.src}${sizePart})`;
      }
      if (c.marks && c.marks.length > 0) {
        return applyMarks(c.text, c.marks);
      }
      return c.text;
    })
    .join('');
}

/**
 * 将标记应用到文本
 */
function applyMarks(text: string, marks: Mark[]): string {
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'strikethrough':
        result = `~~${result}~~`;
        break;
      case 'warning':
        result = `!!${result}!!`;
        break;
      case 'modified':
        result = `++${result}++`;
        break;
      case 'semanticColor':
        result = `[${mark.attrs.color}]${result}[/${mark.attrs.color}]`;
        break;
    }
  }
  return result;
}

/**
 * 将单元格序列化为纯文本（无标记，用于显示）
 */
export function serializeCellPlainText(cell: TabMLCell): string {
  const parts: string[] = [];
  if (cell.heading) parts.push('#'.repeat(cell.heading) + ' ');
  if (cell.todo === 'uncheck') parts.push('[ ] ');
  if (cell.todo === 'check') parts.push('[x] ');
  if (cell.todo === 'question') parts.push('[?] ');
  parts.push(getCellText(cell));
  return parts.join('');
}
