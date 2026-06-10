/**
 * ImageNode — Tiptap 图片 Node
 * 支持粘贴图片、显示图片、拖拽缩放
 */
import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tabmlImage: {
      insertImage: (src: string, width?: number, height?: number) => ReturnType;
    };
  }
}

export const ImageNode = Node.create({
  name: 'image',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('src'),
        renderHTML: (attributes) => ({
          src: attributes.src,
        }),
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const w = element.getAttribute('width');
          return w ? parseInt(w, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const h = element.getAttribute('height');
          return h ? parseInt(h, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'tabml-image',
        draggable: 'false',
      }),
    ];
  },

  addCommands() {
    return {
      insertImage:
        (src: string, width?: number, height?: number) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { src, width, height },
          }),
    };
  },
});
