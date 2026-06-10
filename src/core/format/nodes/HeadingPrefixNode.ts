/**
 * HeadingPrefixNode — Tiptap 自定义 Node
 * 处理 #, ##, ### 前缀标题
 * 注意：不使用 Tiptap 的 Heading node (block level)，
 * 而是在 inline 层面处理前缀，因为 Tab-ML 的标题前缀是单元格内容的一部分
 */
import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headingPrefix: {
      setHeadingPrefix: (level: 1 | 2 | 3) => ReturnType;
      removeHeadingPrefix: () => ReturnType;
    };
  }
}

export const HeadingPrefixNode = Node.create({
  name: 'heading-prefix',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      level: {
        default: 1,
        parseHTML: (element) => parseInt(element.getAttribute('data-level') || '1', 10),
        renderHTML: (attributes) => ({
          'data-level': attributes.level,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-heading-level]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const level = node.attrs.level;
    const prefix = '#'.repeat(level) + ' ';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `heading-prefix heading-h${level}`,
        'data-heading-level': level,
      }),
      prefix,
    ];
  },

  addCommands() {
    return {
      setHeadingPrefix:
        (level: 1 | 2 | 3) =>
        ({ state, commands }) =>
          commands.insertContentAt(
            state.selection.from,
            { type: 'heading-prefix', attrs: { level } }
          ),
      removeHeadingPrefix:
        () =>
        ({ state, commands }) => {
          const { from } = state.selection;
          const node = state.doc.nodeAt(from);
          if (node && node.type.name === 'heading-prefix') {
            return commands.deleteRange({ from, to: from + 1 });
          }
          return false;
        },
    };
  },
});
