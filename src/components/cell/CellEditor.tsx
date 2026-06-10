/**
 * CellEditor — Tiptap 富文本单元格编辑器
 * Enter = 换行格子、Tab = 下一列、Shift+Enter = 格内换行
 * 从 store 读取 pendingEditKey 实现选中即替换
 * blur 同步提交：Grid mousedown 已在 blur 前执行，保证内容不丢失
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { Editor } from '@tiptap/core';
import { getCellEditorExtensions } from '../../core/format/cell-editor-config';
import { markupToTiptapHTML } from '../../core/format/markup-to-tiptap';
import { tiptapToCell } from '../../core/format/tiptap-to-markup';
import { getImageFromClipboard, getImageDimensions } from '../../core/image/image-handler';
import { FloatingToolbar } from '../toolbar/FloatingToolbar';
import { isToolbarInteracting } from '../toolbar/FloatingToolbar';
import { SlashCommand } from '../toolbar/SlashCommand';
import { useEditorStore } from '../../store/editor-store';
import type { TabMLCell } from '../../types/tabml';

interface CellEditorProps {
  cell: TabMLCell;
  onCommit: (newCell: TabMLCell) => void;
  onCancel: () => void;
  onTabNext: () => void;
  onTabPrev: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
}

export function CellEditor({
  cell,
  onCommit,
  onCancel,
  onTabNext,
  onTabPrev,
  onArrowUp,
  onArrowDown,
}: CellEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  const handleCommit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    const editor = editorRef.current;
    if (editor && !editor.isDestroyed) {
      const json = editor.getJSON();
      const newCell = tiptapToCell(json, cell);
      onCommit(newCell);
    } else {
      onCommit(cell);
    }
  }, [cell, onCommit]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 从 store 读取 pendingEditKey（选中即替换）
    const pendingKey = useEditorStore.getState().pendingEditKey;
    if (pendingKey) {
      useEditorStore.getState().clearPendingEditKey();
    }

    // 有 pending key 时用该 key 作为初始内容（替换旧内容）
    const html = pendingKey ? `<p>${escapeHtml(pendingKey)}</p>` : markupToTiptapHTML(cell);

    const editor = new Editor({
      element: containerRef.current,
      content: html,
      extensions: getCellEditorExtensions(),
      autofocus: 'end',
      editable: true,
      editorProps: {
        handleKeyDown: (_view, event) => {
          // Enter = 提交并换行到下一格（Excel 风格）
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleCommit();
            onArrowDown();
            return true;
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            committedRef.current = true;
            onCancel();
            return true;
          }

          if (event.key === 'Tab') {
            event.preventDefault();
            handleCommit();
            if (event.shiftKey) {
              onTabPrev();
            } else {
              onTabNext();
            }
            return true;
          }

          if (event.key === 'ArrowUp' && isAtStart(editor)) {
            event.preventDefault();
            handleCommit();
            onArrowUp();
            return true;
          }

          if (event.key === 'ArrowDown' && isAtEnd(editor)) {
            event.preventDefault();
            handleCommit();
            onArrowDown();
            return true;
          }

          return false;
        },
        handleDOMEvents: {
          blur: (_view, event: FocusEvent) => {
            // 如果焦点转移到工具栏 → 不提交
            const relatedTarget = event.relatedTarget as HTMLElement;
            if (relatedTarget?.closest('.floating-toolbar')) {
              return false;
            }
            // 工具栏正在被交互（mousedown preventDefault 保持了焦点）→ 不提交
            if (isToolbarInteracting()) {
              return false;
            }
            // 同步提交 — Grid 的 mousedown handler 已在 blur 之前执行
            // 这确保即使 React 随后卸载编辑器，内容也已保存到 store
            if (!committedRef.current) {
              handleCommit();
            }
            return false;
          },
          paste: (_view, event: ClipboardEvent) => {
            getImageFromClipboard(event).then((dataUrl) => {
              if (dataUrl) {
                event.preventDefault();
                getImageDimensions(dataUrl).then(({ width, height }) => {
                  const maxW = 300;
                  if (width > maxW) {
                    const ratio = maxW / width;
                    width = maxW;
                    height = Math.round(height * ratio);
                  }
                  editor
                    .chain()
                    .focus()
                    .insertImage(dataUrl, width, height)
                    .run();
                });
              }
            });
            return false;
          },
        },
      },
    });

    editorRef.current = editor;
    setEditorInstance(editor);

    return () => {
      editor.destroy();
      editorRef.current = null;
      setEditorInstance(null);
    };
  }, []); // 只在挂载时初始化一次

  return (
    <div className="cell-editor" ref={wrapperRef}>
      <FloatingToolbar editor={editorInstance} cellEl={wrapperRef.current} />
      <SlashCommand editor={editorInstance} />
      <div className="cell-editor-content" ref={containerRef} />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isAtStart(editor: Editor): boolean {
  const { selection } = editor.state;
  const { from } = selection;
  const resolvedPos = editor.state.doc.resolve(from);
  return resolvedPos.parentOffset === 0;
}

function isAtEnd(editor: Editor): boolean {
  const { selection } = editor.state;
  const { to } = selection;
  const resolvedPos = editor.state.doc.resolve(to);
  return resolvedPos.parentOffset === resolvedPos.parent.content.size;
}
