/**
 * StrikethroughMark — ~~text~~ 废弃标记
 * 渲染为删除线 + 灰色底色
 */
import { Mark, mergeAttributes } from '@tiptap/core';

export const StrikethroughMark = Mark.create({
  name: 'tabml-strikethrough',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: 'span.mark-strikethrough' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'mark-strikethrough',
      }),
      0,
    ];
  },
});
