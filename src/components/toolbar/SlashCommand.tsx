/**
 * SlashCommand 斜杠命令弹窗
 * 在单元格输入 "/" 时弹出命令菜单
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/core';

interface SlashCommandProps {
  editor: Editor | null;
}

interface Command {
  key: string;
  label: string;
  description: string;
  action: (editor: Editor) => void;
}

const COMMANDS: Command[] = [
  {
    key: 'todo',
    label: '☐ Todo',
    description: '插入待办事项',
    action: (editor) => {
      editor.chain().focus().setContent('☐ ').run();
    },
  },
  {
    key: 'todo-check',
    label: '☑ Done',
    description: '插入已完成事项',
    action: (editor) => {
      editor.chain().focus().setContent('☑ ').run();
    },
  },
  {
    key: 'todo-question',
    label: '? Question',
    description: '插入待确认事项',
    action: (editor) => {
      editor.chain().focus().setContent('? ').run();
    },
  },
  {
    key: 'h1',
    label: '# H1',
    description: '一级标题',
    action: (editor) => {
      editor.chain().focus().setContent('# ').run();
    },
  },
  {
    key: 'h2',
    label: '## H2',
    description: '二级标题',
    action: (editor) => {
      editor.chain().focus().setContent('## ').run();
    },
  },
  {
    key: 'h3',
    label: '### H3',
    description: '三级标题',
    action: (editor) => {
      editor.chain().focus().setContent('### ').run();
    },
  },
  {
    key: 'bold',
    label: '**粗体**',
    description: '加粗文本',
    action: (editor) => {
      editor.chain().focus().toggleBold().run();
    },
  },
  {
    key: 'strike',
    label: '~~废弃~~',
    description: '删除线+灰色底',
    action: (editor) => {
      editor.chain().focus().toggleMark('tabml-strikethrough').run();
    },
  },
  {
    key: 'warning',
    label: '!!警告!!',
    description: '红色加粗',
    action: (editor) => {
      editor.chain().focus().toggleMark('tabml-warning').run();
    },
  },
  {
    key: 'modified',
    label: '++新增++',
    description: '绿色底',
    action: (editor) => {
      editor.chain().focus().toggleMark('tabml-modified').run();
    },
  },
];

export function SlashCommand({ editor }: SlashCommandProps) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const slashPosRef = useRef<number>(-1);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { from } = editor.state.selection;
      const textBefore = getTextBefore(editor, from);

      if (textBefore.endsWith('/')) {
        setVisible(true);
        setQuery('');
        setSelectedIndex(0);
        slashPosRef.current = from - 1;
        return;
      }

      // 检查是否在斜杠命令中
      const slashMatch = textBefore.match(/\/([a-zA-Z\u4e00-\u9fff]*)$/);
      if (slashMatch) {
        setVisible(true);
        setQuery(slashMatch[1].toLowerCase());
        setSelectedIndex(0);
        return;
      }

      setVisible(false);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  // 处理键盘事件
  useEffect(() => {
    if (!visible || !editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;

      const filtered = filteredCommands();
      if (filtered.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        executeCommand(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setVisible(false);
      }
    };

    const editorEl = editor.view.dom;
    editorEl.addEventListener('keydown', handleKeyDown, true);
    return () => editorEl.removeEventListener('keydown', handleKeyDown, true);
  }, [visible, selectedIndex, query, editor]);

  const filteredCommands = useCallback(() => {
    if (!query) return COMMANDS;
    return COMMANDS.filter(
      (cmd) =>
        cmd.key.includes(query) ||
        cmd.label.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
    );
  }, [query]);

  const executeCommand = useCallback(
    (cmd: Command) => {
      if (!editor) return;

      // 删除斜杠和查询文本
      const { from } = editor.state.selection;
      const slashPos = slashPosRef.current;
      if (slashPos >= 0 && from > slashPos) {
        editor
          .chain()
          .focus()
          .deleteRange({ from: slashPos, to: from })
          .run();
      }

      cmd.action(editor);
      setVisible(false);
    },
    [editor]
  );

  if (!visible || !editor) return null;

  const filtered = filteredCommands();
  if (filtered.length === 0) return null;

  return (
    <div ref={listRef} className="slash-command-popup">
      {filtered.map((cmd, i) => (
        <div
          key={cmd.key}
          className={`slash-command-item ${i === selectedIndex ? 'selected' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand(cmd);
          }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="slash-command-label">{cmd.label}</span>
          <span className="slash-command-desc">{cmd.description}</span>
        </div>
      ))}
    </div>
  );
}

function getTextBefore(editor: Editor, pos: number): string {
  const { doc } = editor.state;
  const resolved = doc.resolve(pos);
  const start = resolved.start();
  return doc.textBetween(start, pos, '\n');
}
