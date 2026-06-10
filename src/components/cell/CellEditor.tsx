/**
 * CellEditor — Tiptap 富文本单元格编辑器
 * Enter = 换行格子、Tab = 下一列、Shift+Enter = 格内换行
 * 从 store 读取 pendingEditKey 实现选中即替换
 * blur 同步提交：Grid mousedown 已在 blur 前执行，保证内容不丢失
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { Editor, type JSONContent } from '@tiptap/core';
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
  editing: boolean;
  onCommit: (newCell: TabMLCell, options?: { keepEditing?: boolean }) => void;
  onCancel: () => void;
  onTabNext: () => void;
  onTabPrev: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
}

export interface CommitActiveCellEditorOptions {
  keepEditing?: boolean;
  force?: boolean;
}

type ActiveCellEditorCommit = (options?: CommitActiveCellEditorOptions) => void;
type ActiveCellEditorHasChanges = () => boolean;

let activeCellEditorCommit: ActiveCellEditorCommit | null = null;
let activeCellEditorHasChanges: ActiveCellEditorHasChanges | null = null;

export function commitActiveCellEditor(options: CommitActiveCellEditorOptions = {}): boolean {
  if (!activeCellEditorCommit) return false;
  activeCellEditorCommit(options);
  return true;
}

export function hasActiveCellEditorChanges(): boolean {
  return activeCellEditorHasChanges?.() ?? false;
}

export function CellEditor({
  cell,
  editing,
  onCommit,
  onCancel,
  onTabNext,
  onTabPrev,
  onArrowUp,
  onArrowDown,
}: CellEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(!editing);
  const editorRef = useRef<Editor | null>(null);
  const cellRef = useRef(cell);
  const editingRef = useRef(editing);
  const handlersRef = useRef({
    onCommit,
    onCancel,
    onTabNext,
    onTabPrev,
    onArrowUp,
    onArrowDown,
  });
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const pendingEditKey = useEditorStore((s) => s.pendingEditKey);
  const clearPendingEditKey = useEditorStore((s) => s.clearPendingEditKey);
  editingRef.current = editing;

  useEffect(() => {
    cellRef.current = cell;
  }, [cell]);

  useEffect(() => {
    handlersRef.current = {
      onCommit,
      onCancel,
      onTabNext,
      onTabPrev,
      onArrowUp,
      onArrowDown,
    };
  }, [onCommit, onCancel, onTabNext, onTabPrev, onArrowUp, onArrowDown]);

  useEffect(() => {
    if (editing) {
      committedRef.current = false;
    } else {
      committedRef.current = true;
    }
  }, [editing]);

  const syncEditorContent = useCallback((options?: CommitActiveCellEditorOptions): boolean => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) {
      return false;
    }
    flushEditorDom(editor);
    const json = editor.getJSON();
    const newCell = tiptapToCell(json, cellRef.current);
    if (cellsEqual(newCell, cellRef.current)) {
      return true;
    }
    handlersRef.current.onCommit(newCell, options);
    return true;
  }, []);

  const handleCommit = useCallback((options?: CommitActiveCellEditorOptions) => {
    const editor = editorRef.current;
    if (editor && !editor.isDestroyed) {
      flushEditorDom(editor);
    }
    if (committedRef.current && !options?.force) return;
    committedRef.current = true;
    if (!syncEditorContent(options)) {
      handlersRef.current.onCommit(cellRef.current, options);
    }
  }, [syncEditorContent]);

  const hasUncommittedChanges = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) {
      return false;
    }
    flushEditorDom(editor);
    const newCell = tiptapToCell(editor.getJSON(), cellRef.current);
    return !cellsEqual(newCell, cellRef.current);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // 从 store 读取 pendingEditKey（选中即替换）
    const pendingKey = useEditorStore.getState().pendingEditKey;
    if (pendingKey != null) {
      useEditorStore.getState().clearPendingEditKey();
    }

    // 有 pending key 时用该 key 作为初始内容（替换旧内容）
    const content = pendingKey != null ? textToTiptapDoc(pendingKey) : markupToTiptapHTML(cell);

    const editor = new Editor({
      element: containerRef.current,
      content,
      extensions: getCellEditorExtensions(),
      autofocus: 'end',
      editable: true,
      onUpdate: () => {
        committedRef.current = false;
      },
      editorProps: {
        handleKeyDown: (_view, event) => {
          if (!editingRef.current) {
            return false;
          }

          // Enter = 提交并换行到下一格（Excel 风格）
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            handleCommit();
            handlersRef.current.onArrowDown();
            return true;
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            committedRef.current = true;
            handlersRef.current.onCancel();
            return true;
          }

          if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            handleCommit();
            if (event.shiftKey) {
              handlersRef.current.onTabPrev();
            } else {
              handlersRef.current.onTabNext();
            }
            return true;
          }

          if (event.key === 'ArrowUp' && isAtStart(editor)) {
            event.preventDefault();
            event.stopPropagation();
            handleCommit();
            handlersRef.current.onArrowUp();
            return true;
          }

          if (event.key === 'ArrowDown' && isAtEnd(editor)) {
            event.preventDefault();
            event.stopPropagation();
            handleCommit();
            handlersRef.current.onArrowDown();
            return true;
          }

          return false;
        },
        handleDOMEvents: {
          blur: (_view, event: FocusEvent) => {
            if (!editingRef.current) {
              return false;
            }
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
          contextmenu: (_view, event: Event) => {
            const mouseEvent = event as MouseEvent;
            if (!editor.state.selection.empty) {
              mouseEvent.preventDefault();
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

  // Keep commitActiveCellEditor pointed at the focused cell editor.
  useEffect(() => {
    activeCellEditorCommit = handleCommit;
    activeCellEditorHasChanges = hasUncommittedChanges;
    return () => {
      if (activeCellEditorCommit === handleCommit) {
        activeCellEditorCommit = null;
      }
      if (activeCellEditorHasChanges === hasUncommittedChanges) {
        activeCellEditorHasChanges = null;
      }
    };
  }, [handleCommit, hasUncommittedChanges]);

  useEffect(() => {
    if (!editing || pendingEditKey == null) return;
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;

    editor.commands.setContent(textToTiptapDoc(pendingEditKey), false);
    editor.commands.focus('end');
    committedRef.current = false;
    clearPendingEditKey();
  }, [editing, pendingEditKey, clearPendingEditKey]);

  // Reset browser-mode editor content from the store.
  useEffect(() => {
    if (!editing && editorRef.current && !editorRef.current.isDestroyed) {
      editorRef.current.commands.setContent(markupToTiptapHTML(cell), false);
    }
  }, [editing, cell]);

  return (
    <div className="cell-editor" ref={wrapperRef}>
      <FloatingToolbar editor={editorInstance} cellEl={wrapperRef.current} />
      <SlashCommand editor={editorInstance} />
      <div className="cell-editor-content" ref={containerRef} />
    </div>
  );
}

function textToTiptapDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text.length > 0 ? [{ type: 'text', text }] : [],
      },
    ],
  };
}

function flushEditorDom(editor: Editor): void {
  const view = editor.view as Editor['view'] & {
    domObserver?: { flush?: () => void };
  };
  view.domObserver?.flush?.();
}

function cellsEqual(a: TabMLCell, b: TabMLCell): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
