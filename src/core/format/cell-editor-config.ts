/**
 * Tiptap 单元格编辑器配置
 * 汇总所有自定义 Marks 和扩展
 */
import StarterKit from '@tiptap/starter-kit';
import { StrikethroughMark } from './marks/StrikethroughMark';
import { WarningMark } from './marks/WarningMark';
import { ModifiedMark } from './marks/ModifiedMark';
import { SemanticColorMark } from './marks/SemanticColorMark';
import { CellShortcuts } from './CellShortcuts';
import { TodoNode } from './nodes/TodoNode';
import { HeadingPrefixNode } from './nodes/HeadingPrefixNode';
import { ImageNode } from './nodes/ImageNode';

/**
 * 获取 Tiptap 编辑器扩展列表
 * 注意：StarterKit 已包含 Bold，我们额外添加自定义 Marks
 */
export function getCellEditorExtensions() {
  return [
    StarterKit.configure({
      // 禁用不需要的 StarterKit 功能
      heading: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      // 保留 Bold, Italic, Strike(我们会覆盖), Code, HardBreak
      italic: false,
      code: false,
      strike: false, // 我们用自定义的 StrikethroughMark
    }),
    StrikethroughMark,
    WarningMark,
    ModifiedMark,
    SemanticColorMark,
    CellShortcuts,
    TodoNode,
    HeadingPrefixNode,
    ImageNode,
  ];
}
