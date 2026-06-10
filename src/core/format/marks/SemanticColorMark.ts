/**
 * SemanticColorMark — [color]text[/color] 语义颜色
 * red=强调, green=说明(底色), blue=参数/信息, gray=次要(引用样式)
 */
import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    semanticColor: {
      setSemanticColor: (color: string) => ReturnType;
      unsetSemanticColor: () => ReturnType;
    };
  }
}

export const SemanticColorMark = Mark.create({
  name: 'tabml-semantic-color',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-color'),
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          return {
            'data-color': attributes.color,
            class: `mark-color-${attributes.color}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-color]' },
      { tag: 'span.mark-color-red' },
      { tag: 'span.mark-color-green' },
      { tag: 'span.mark-color-blue' },
      { tag: 'span.mark-color-gray' },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-color': mark.attrs.color,
        class: `mark-color-${mark.attrs.color}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSemanticColor:
        (color: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetSemanticColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
