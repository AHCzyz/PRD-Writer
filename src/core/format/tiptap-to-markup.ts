/**
 * Tiptap JSON → Tab-ML markup
 * 将 Tiptap 编辑器内容转换回 Tab-ML markup 字符串
 */
import type { TabMLCell, InlineContent, TextRun, Mark, SemanticColor } from '../../types/tabml';
import type { JSONContent } from '@tiptap/core';

/**
 * 将 Tiptap JSON 输出转换为 TabMLCell
 */
export function tiptapToCell(json: JSONContent, originalCell: TabMLCell): TabMLCell {
  const cell: TabMLCell = {
    ...originalCell,
    content: [],
  };

  if (!json.content || json.content.length === 0) {
    cell.content = [{ type: 'text', text: '' }];
    return cell;
  }

  // 遍历 paragraphs
  for (const paragraph of json.content) {
    if (paragraph.type === 'paragraph' && paragraph.content) {
      for (const node of paragraph.content) {
        // 检查 Todo node
        if (node.type === 'todo') {
          cell.todo = node.attrs?.state as TabMLCell['todo'];
          continue;
        }

        // 检查 Heading prefix node
        if (node.type === 'heading-prefix') {
          cell.heading = node.attrs?.level as TabMLCell['heading'];
          continue;
        }

        const items = nodeToInlineContent(node);
        cell.content.push(...items);
      }
    }
  }

  if (cell.content.length === 0) {
    cell.content = [{ type: 'text', text: '' }];
  }

  return cell;
}

/**
 * 将 Tiptap 节点转换为 InlineContent 数组
 */
function nodeToInlineContent(node: JSONContent): InlineContent[] {
  if (node.type === 'text') {
    const run: TextRun = {
      type: 'text',
      text: node.text || '',
    };

    if (node.marks && node.marks.length > 0) {
      run.marks = node.marks
        .map(tiptapMarkToMark)
        .filter((m): m is Mark => m !== null);
      if (run.marks.length === 0) delete run.marks;
    }

    return [run];
  }

  if (node.type === 'image') {
    return [
      {
        type: 'image',
        src: (node.attrs?.src as string) || '',
        width: node.attrs?.width as number | undefined,
        height: node.attrs?.height as number | undefined,
      },
    ];
  }

  // hardBreak
  if (node.type === 'hardBreak') {
    return [{ type: 'text', text: '\n' }];
  }

  return [];
}

/**
 * 将 Tiptap mark 转换为 Tab-ML Mark
 */
function tiptapMarkToMark(tiptapMark: { type: string; attrs?: Record<string, unknown> }): Mark | null {
  switch (tiptapMark.type) {
    case 'bold':
      return { type: 'bold' };
    case 'tabml-strikethrough':
      return { type: 'strikethrough' };
    case 'tabml-warning':
      return { type: 'warning' };
    case 'tabml-modified':
      return { type: 'modified' };
    case 'tabml-semantic-color': {
      const color = tiptapMark.attrs?.color as string;
      if (color && ['red', 'green', 'blue', 'gray'].includes(color)) {
        return { type: 'semanticColor', attrs: { color: color as SemanticColor } };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * 从 Tiptap JSON 提取 Todo 状态
 */
export function extractTodoFromTiptap(json: JSONContent): TabMLCell['todo'] | undefined {
  if (!json.content) return undefined;
  for (const p of json.content) {
    if (p.content) {
      for (const node of p.content) {
        if (node.type === 'text' && node.text) {
          // 检查 Tiptap 渲染的 Todo 标记
          const todoEl = node.marks?.find((m) => m.type === 'todo-marker');
          if (todoEl) return todoEl.attrs?.state as TabMLCell['todo'];
        }
      }
    }
  }
  return undefined;
}
