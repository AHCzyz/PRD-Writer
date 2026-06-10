/**
 * CellShortcuts — Tiptap 快捷键扩展
 * Ctrl+B 加粗, Ctrl+D 删除线, Ctrl+K 警告, Ctrl+M 修改标记
 */
import { Extension } from '@tiptap/core';

export const CellShortcuts = Extension.create({
  name: 'cell-shortcuts',

  addKeyboardShortcuts() {
    return {
      'Mod-b': () => this.editor.chain().focus().toggleBold().run(),
      'Mod-d': () => this.editor.chain().focus().toggleMark('tabml-strikethrough').run(),
      'Mod-k': () => this.editor.chain().focus().toggleMark('tabml-warning').run(),
      'Mod-m': () => this.editor.chain().focus().toggleMark('tabml-modified').run(),
      'Mod-Shift-r': () =>
        this.editor.chain().focus().setMark('tabml-semantic-color', { color: 'red' }).run(),
      'Mod-Shift-g': () =>
        this.editor.chain().focus().setMark('tabml-semantic-color', { color: 'green' }).run(),
      'Mod-Shift-b': () =>
        this.editor.chain().focus().setMark('tabml-semantic-color', { color: 'blue' }).run(),
      'Mod-z': () => this.editor.chain().focus().undo().run(),
      'Mod-y': () => this.editor.chain().focus().redo().run(),
      'Mod-Shift-z': () => this.editor.chain().focus().redo().run(),
    };
  },
});
