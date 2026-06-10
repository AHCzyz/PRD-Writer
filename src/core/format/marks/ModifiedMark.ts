/**
 * ModifiedMark — ++text++ 新增/修改标记
 * 渲染为绿色底色
 */
import { Mark, mergeAttributes } from '@tiptap/core';

export const ModifiedMark = Mark.create({
  name: 'tabml-modified',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: 'span.mark-modified' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'mark-modified',
      }),
      0,
    ];
  },
});
