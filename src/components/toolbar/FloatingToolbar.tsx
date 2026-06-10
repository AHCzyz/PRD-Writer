/**
 * FloatingToolbar 浮动格式工具栏
 * 使用 Portal 渲染到 body，不受编辑器生命周期影响
 * 全局 mousedown 拦截防止编辑器失焦
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';

interface FloatingToolbarProps {
  editor: Editor | null;
  cellEl: HTMLElement | null;
}

const COLORS = [
  { key: 'red', label: 'R', title: '强调 (红色加粗)' },
  { key: 'green', label: 'G', title: '说明 (绿色底)' },
  { key: 'blue', label: 'B', title: '参数/信息 (蓝色)' },
  { key: 'gray', label: '⊘', title: '次要 (灰色引用)' },
];

/** 全局标记：工具栏正在被交互（防止编辑器 blur 提交） */
let toolbarInteracting = false;
export function isToolbarInteracting(): boolean {
  return toolbarInteracting;
}

export function FloatingToolbar({ editor, cellEl }: FloatingToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor || !cellEl) {
      setVisible(false);
      return;
    }

    const updateToolbar = () => {
      if (editor.isDestroyed) return;

      const { selection } = editor.state;
      const { from, to } = selection;

      if (from === to) {
        setVisible(false);
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setVisible(false);
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 相对于 viewport 定位（Portal 渲染到 body）
      setPosition({
        top: rect.top - 44,
        left: Math.max(8, rect.left + rect.width / 2 - 140),
      });
      setVisible(true);
    };

    // 不使用 blur 事件隐藏工具栏 — 仅靠 selectionUpdate
    editor.on('selectionUpdate', updateToolbar);
    editor.on('focus', updateToolbar);

    // 全局 mousedown：如果点在其他地方，隐藏工具栏
    const handleGlobalMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (toolbarRef.current?.contains(target)) return;
      // 点击了工具栏以外 → 不立即隐藏，让 selectionUpdate 处理
    };

    document.addEventListener('mousedown', handleGlobalMouseDown);

    return () => {
      editor.off('selectionUpdate', updateToolbar);
      editor.off('focus', updateToolbar);
      document.removeEventListener('mousedown', handleGlobalMouseDown);
    };
  }, [editor, cellEl]);

  // 全局 mousedown 拦截：防止点击工具栏时编辑器失焦
  useEffect(() => {
    if (!toolbarRef.current) return;
    const el = toolbarRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault(); // 防止编辑器失焦
      e.stopPropagation();
      toolbarInteracting = true;
    };
    const handleClick = () => {
      // 延迟重置，确保 blur handler 的 setTimeout 已检查过
      setTimeout(() => {
        toolbarInteracting = false;
      }, 300);
    };

    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('click', handleClick);
    return () => {
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('click', handleClick);
      toolbarInteracting = false;
    };
  }, [visible]);

  const applyFormat = useCallback(
    (action: string) => {
      if (!editor || editor.isDestroyed) return;
      editor.chain().focus();

      switch (action) {
        case 'bold':
          editor.chain().focus().toggleBold().run();
          break;
        case 'strikethrough':
          editor.chain().focus().toggleMark('tabml-strikethrough').run();
          break;
        case 'warning':
          editor.chain().focus().toggleMark('tabml-warning').run();
          break;
        case 'modified':
          editor.chain().focus().toggleMark('tabml-modified').run();
          break;
      }
    },
    [editor]
  );

  const applyColor = useCallback(
    (color: string) => {
      if (!editor || editor.isDestroyed) return;
      const { from, to } = editor.state.selection;

      const hasColor = editor.isActive('tabml-semantic-color', { color });
      if (hasColor) {
        editor.chain().focus().unsetMark('tabml-semantic-color').run();
      } else {
        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .setMark('tabml-semantic-color', { color })
          .run();
      }
    },
    [editor]
  );

  if (!visible || !editor) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      className="floating-toolbar"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
    >
      <button
        className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
        onClick={() => applyFormat('bold')}
        title="加粗 (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        className={`toolbar-btn ${editor.isActive('tabml-strikethrough') ? 'active' : ''}`}
        onClick={() => applyFormat('strikethrough')}
        title="废弃 (灰色底+删除线)"
      >
        <s>S</s>
      </button>
      <button
        className={`toolbar-btn ${editor.isActive('tabml-warning') ? 'active' : ''}`}
        onClick={() => applyFormat('warning')}
        title="警告 (红色加粗)"
      >
        <span style={{ color: '#dc2626', fontWeight: 'bold' }}>!</span>
      </button>
      <button
        className={`toolbar-btn ${editor.isActive('tabml-modified') ? 'active' : ''}`}
        onClick={() => applyFormat('modified')}
        title="新增/修改 (绿色底)"
      >
        <span style={{ background: '#dcfce7', padding: '0 2px' }}>+</span>
      </button>
      <span className="toolbar-divider" />
      {COLORS.map((c) => (
        <button
          key={c.key}
          className={`toolbar-btn toolbar-color-${c.key} ${
            editor.isActive('tabml-semantic-color', { color: c.key }) ? 'active' : ''
          }`}
          onClick={() => applyColor(c.key)}
          title={c.title}
        >
          {c.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
