/**
 * TodoNode — Tiptap 自定义 Node
 * 渲染为交互式复选框 [ ] / [x] / [?]
 */
import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    todo: {
      insertTodo: (state?: 'uncheck' | 'check' | 'question') => ReturnType;
      toggleTodo: () => ReturnType;
    };
  }
}

export const TodoNode = Node.create({
  name: 'todo',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      state: {
        default: 'uncheck',
        parseHTML: (element) => element.getAttribute('data-todo') || 'uncheck',
        renderHTML: (attributes) => ({
          'data-todo': attributes.state,
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-todo]' },
      { tag: 'span.todo-marker' },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const state = node.attrs.state;
    let icon = '☐';
    if (state === 'check') icon = '☑';
    if (state === 'question') icon = '?';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `todo-marker todo-${state}`,
        'data-todo': state,
      }),
      icon,
    ];
  },

  addCommands() {
    return {
      insertTodo:
        (state = 'uncheck') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { state } }),
      toggleTodo:
        () =>
        ({ state, commands }) => {
          // 查找当前 todo 节点并切换状态
          const { from } = state.selection;
          const node = state.doc.nodeAt(from - 1) || state.doc.nodeAt(from);
          if (node && node.type.name === 'todo') {
            const states: Array<'uncheck' | 'check' | 'question'> = [
              'uncheck',
              'check',
              'question',
            ];
            const currentIdx = states.indexOf(node.attrs.state);
            const nextState = states[(currentIdx + 1) % states.length];
            return commands.command(({ tr }) => {
              tr.setNodeMarkup(from - 1, undefined, { state: nextState });
              return true;
            });
          }
          return false;
        },
    };
  },
});
