/**
 * WarningMark — !!text!! 警告标记
 * 渲染为红色加粗文字
 */
import { Mark, mergeAttributes } from '@tiptap/core';

export const WarningMark = Mark.create({
  name: 'tabml-warning',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: 'span.mark-warning' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'mark-warning',
      }),
      0,
    ];
  },
});
