/**
 * Tab-ML Parser
 * 将 .tab.md 纯文本解析为 TabMLDocument 结构
 */
import type {
  TabMLDocument,
  TabMLRow,
  TabMLCell,
  InlineContent,
  TextRun,
  ImageRef,
  Mark,
  SemanticColor,
} from '../../types/tabml';

/**
 * 解析 Tab-ML 文本为文档结构
 */
export function parse(input: string): TabMLDocument {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  let frontmatter: Record<string, unknown> = {};
  let startLine = 0;

  // 解析 YAML frontmatter
  if (lines[0]?.trim() === '---') {
    const endIdx = lines.indexOf('---', 1);
    if (endIdx !== -1) {
      frontmatter = parseFrontmatter(lines.slice(1, endIdx).join('\n'));
      startLine = endIdx + 1;
    }
  }

  const rows: TabMLRow[] = [];
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    rows.push(parseRow(line));
  }

  return { frontmatter, rows };
}

/**
 * 解析 YAML frontmatter（简化版，仅处理 key: value 和 key: [a, b]）
 */
function parseFrontmatter(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value: unknown = trimmed.slice(colonIdx + 1).trim();
    // 处理数组 [a, b, c]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''));
    }
    // 处理字符串引号
    if (typeof value === 'string') {
      value = value.replace(/^["']|["']$/g, '');
    }
    result[key] = value;
  }
  return result;
}

/**
 * 解析单行为 TabMLRow
 */
function parseRow(line: string): TabMLRow {
  // 空行 = 分隔符
  if (line.trim() === '') {
    return { indent: 0, cells: [], isEmpty: true };
  }

  // 计算行首缩进（tab 数量）
  let indent = 0;
  let content = line;
  while (content.startsWith('\t') && indent < 4) {
    indent++;
    content = content.slice(1);
  }

  // 按 \t 分割列
  const cellStrings = content.split('\t');
  const cells = cellStrings.map((s) => parseCell(s));

  return { indent, cells, isEmpty: false };
}

/**
 * 解析单元格字符串为 TabMLCell
 */
function parseCell(raw: string): TabMLCell {
  const cell: TabMLCell = { content: [] };
  let text = raw;

  // 检查标题前缀
  if (text.startsWith('### ')) {
    cell.heading = 3;
    text = text.slice(4);
  } else if (text.startsWith('## ')) {
    cell.heading = 2;
    text = text.slice(3);
  } else if (text.startsWith('# ')) {
    cell.heading = 1;
    text = text.slice(2);
  }

  // 检查 Todo 前缀
  if (text.startsWith('[ ] ')) {
    cell.todo = 'uncheck';
    text = text.slice(4);
  } else if (text.startsWith('[x] ')) {
    cell.todo = 'check';
    text = text.slice(4);
  } else if (text.startsWith('[?] ')) {
    cell.todo = 'question';
    text = text.slice(4);
  }

  // 检查整行图片（独占单元格）
  const imgMatch = text.match(/^!\[\]\(([^)\s]+)(?:\s*=(\d+)x(\d+))?\)$/);
  if (imgMatch) {
    cell.image = {
      src: imgMatch[1],
      width: imgMatch[2] ? parseInt(imgMatch[2], 10) : undefined,
      height: imgMatch[3] ? parseInt(imgMatch[3], 10) : undefined,
    };
    cell.content = [];
    return cell;
  }

  // 解析内联内容
  cell.content = parseInline(text);
  return cell;
}

/**
 * 解析内联标记
 */
function parseInline(text: string): InlineContent[] {
  const result: InlineContent[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // 匹配内联图片
    const imgMatch = remaining.match(/^!\[\]\(([^)\s]+)(?:\s*=(\d+)x(\d+))?\)/);
    if (imgMatch) {
      const imgRef: ImageRef = {
        type: 'image',
        src: imgMatch[1],
        width: imgMatch[2] ? parseInt(imgMatch[2], 10) : undefined,
        height: imgMatch[3] ? parseInt(imgMatch[3], 10) : undefined,
      };
      result.push(imgRef);
      remaining = remaining.slice(imgMatch[0].length);
      continue;
    }

    // 匹配标记：按优先级 ** > ~~ > !! > ++ > [color]
    const markMatch = findFirstMark(remaining);
    if (markMatch) {
      // 标记前的纯文本
      if (markMatch.index > 0) {
        result.push({ type: 'text', text: remaining.slice(0, markMatch.index) });
      }
      // 标记内容
      const innerText = remaining.slice(
        markMatch.index + markMatch.openLen,
        markMatch.index + markMatch.fullLen - markMatch.closeLen
      );
      const run: TextRun = {
        type: 'text',
        text: innerText,
        marks: [markMatch.mark],
      };
      result.push(run);
      remaining = remaining.slice(markMatch.index + markMatch.fullLen);
      continue;
    }

    // 无更多标记，剩余全部为纯文本
    result.push({ type: 'text', text: remaining });
    break;
  }

  return result;
}

interface MarkMatch {
  index: number;
  fullLen: number;
  openLen: number;
  closeLen: number;
  mark: Mark;
}

/**
 * 在文本中查找第一个标记
 */
function findFirstMark(text: string): MarkMatch | null {
  const patterns: Array<{ regex: RegExp; openLen: number; closeLen: number; mark: Mark }> = [
    { regex: /\*\*(.+?)\*\*/s, openLen: 2, closeLen: 2, mark: { type: 'bold' } },
    { regex: /~~(.+?)~~/s, openLen: 2, closeLen: 2, mark: { type: 'strikethrough' } },
    { regex: /!!(.+?)!!/s, openLen: 2, closeLen: 2, mark: { type: 'warning' } },
    { regex: /\+\+(.+?)\+\+/s, openLen: 2, closeLen: 2, mark: { type: 'modified' } },
  ];

  // 语义颜色 [color]text[/color]
  const colorRegex = /\[(red|green|blue|gray)\](.+?)\[\/\1\]/s;

  let best: MarkMatch | null = null;

  for (const p of patterns) {
    const m = text.match(p.regex);
    if (m && m.index !== undefined) {
      if (!best || m.index < best.index) {
        best = {
          index: m.index,
          fullLen: m[0].length,
          openLen: p.openLen,
          closeLen: p.closeLen,
          mark: p.mark,
        };
      }
    }
  }

  const cm = text.match(colorRegex);
  if (cm && cm.index !== undefined) {
    const color = cm[1] as SemanticColor;
    const openLen = cm[1].length + 2; // [color]
    const closeLen = cm[1].length + 3; // [/color]
    if (!best || cm.index < best.index) {
      best = {
        index: cm.index,
        fullLen: cm[0].length,
        openLen,
        closeLen,
        mark: { type: 'semanticColor', attrs: { color } },
      };
    }
  }

  return best;
}
