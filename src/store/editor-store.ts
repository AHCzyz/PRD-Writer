/**
 * 编辑器全局状态管理 (Zustand)
 */
import { create } from 'zustand';
import type {
  TabMLDocument,
  TabMLRow,
  TabMLCell,
  CellFocus,
  InlineContent,
  Mark,
} from '../types/tabml';
import {
  createEmptyDocument,
  createEmptyCell,
  getCellText,
} from '../types/tabml';
import { DEFAULT_COLUMN_WIDTH } from '../constants/format';
import { serialize } from '../core/tabml/serializer';
import { parse } from '../core/tabml/parser';

export interface EditorStore {
  // 状态
  document: TabMLDocument;
  focus: CellFocus;
  viewMode: 'wysiwyg' | 'source';
  columnWidths: number[];
  sourceText: string;
  showGridLines: boolean;
  pendingEditKey: string | null;

  // 文档操作
  setDocument: (doc: TabMLDocument) => void;
  loadFromText: (text: string) => void;

  // 单元格操作
  updateCell: (row: number, col: number, cell: TabMLCell) => void;

  // 行操作
  insertRow: (after: number) => void;
  deleteRow: (index: number) => void;
  indentRow: (index: number, delta: 1 | -1) => void;

  // 列操作
  addColumn: (rowIndex: number) => void;
  setColumnWidth: (col: number, width: number) => void;
  ensureMinColumns: (rowIndex: number, minCols: number) => void;

  // 焦点
  setFocus: (focus: CellFocus) => void;
  clearFocus: () => void;

  // 编辑输入
  setPendingEditKey: (key: string | null) => void;
  clearPendingEditKey: () => void;

  // 格式操作（非编辑态下应用到整个格子）
  applyFormat: (format: FormatType) => void;

  // 视图模式
  setViewMode: (mode: 'wysiwyg' | 'source') => void;
  syncSourceText: () => void;
  syncFromSource: (text: string) => void;

  // UI
  toggleGridLines: () => void;
}

export type FormatType = 'bold' | 'strikethrough' | 'warning' | 'modified' | `color-${'red' | 'green' | 'blue' | 'gray'}`;

export const useEditorStore = create<EditorStore>((set, get) => ({
  document: createEmptyDocument(),
  focus: { row: 0, col: 0, editing: false },
  viewMode: 'wysiwyg',
  columnWidths: [DEFAULT_COLUMN_WIDTH, DEFAULT_COLUMN_WIDTH, DEFAULT_COLUMN_WIDTH],
  sourceText: '',
  showGridLines: true,
  pendingEditKey: null,

  setDocument: (doc) => {
    set({ document: doc });
  },

  loadFromText: (text) => {
    const doc = parse(text);
    const widths = computeColumnWidths(doc);
    set({ document: doc, sourceText: text, columnWidths: widths });
  },

  updateCell: (row, col, cell) => {
    const doc = { ...get().document };
    const rows = [...doc.rows];
    const targetRow = { ...rows[row] };
    const cells = [...targetRow.cells];
    cells[col] = cell;
    targetRow.cells = cells;
    rows[row] = targetRow;
    doc.rows = rows;
    set({ document: doc, sourceText: serialize(doc) });
  },

  insertRow: (after) => {
    const doc = { ...get().document };
    const rows = [...doc.rows];
    const maxCols = Math.max(...rows.map((r) => r.cells.length), 3);
    const newRow: TabMLRow = {
      indent: 0,
      cells: Array.from({ length: maxCols }, () => createEmptyCell()),
      isEmpty: false,
    };
    rows.splice(after + 1, 0, newRow);
    doc.rows = rows;
    set({
      document: doc,
      focus: { row: after + 1, col: 0, editing: false },
      sourceText: serialize(doc),
    });
  },

  deleteRow: (index) => {
    const doc = { ...get().document };
    const rows = [...doc.rows];
    if (rows.length <= 1) return;
    rows.splice(index, 1);
    doc.rows = rows;
    const newFocusRow = Math.min(index, rows.length - 1);
    set({
      document: doc,
      focus: { row: newFocusRow, col: 0, editing: false },
      sourceText: serialize(doc),
    });
  },

  indentRow: (index, delta) => {
    const doc = { ...get().document };
    const rows = [...doc.rows];
    const row = { ...rows[index] };
    const newIndent = Math.max(0, Math.min(4, row.indent + delta));
    if (newIndent === row.indent) return;
    row.indent = newIndent;
    rows[index] = row;
    doc.rows = rows;
    set({ document: doc, sourceText: serialize(doc) });
  },

  addColumn: (rowIndex) => {
    const doc = { ...get().document };
    const rows = [...doc.rows];
    const row = { ...rows[rowIndex] };
    row.cells = [...row.cells, createEmptyCell()];
    rows[rowIndex] = row;
    doc.rows = rows;
    const newWidths = [...get().columnWidths];
    if (row.cells.length > newWidths.length) {
      newWidths.push(DEFAULT_COLUMN_WIDTH);
    }
    set({ document: doc, columnWidths: newWidths, sourceText: serialize(doc) });
  },

  setColumnWidth: (col, width) => {
    const widths = [...get().columnWidths];
    widths[col] = width;
    set({ columnWidths: widths });
  },

  ensureMinColumns: (rowIndex, minCols) => {
    const doc = { ...get().document };
    const rows = [...doc.rows];
    const row = { ...rows[rowIndex] };
    if (row.cells.length >= minCols) return;
    row.cells = [
      ...row.cells,
      ...Array.from({ length: minCols - row.cells.length }, () => createEmptyCell()),
    ];
    rows[rowIndex] = row;
    doc.rows = rows;
    const widths = [...get().columnWidths];
    while (widths.length < minCols) widths.push(DEFAULT_COLUMN_WIDTH);
    set({ document: doc, columnWidths: widths, sourceText: serialize(doc) });
  },

  setFocus: (focus) => set({ focus }),
  clearFocus: () => set({ focus: { row: 0, col: 0, editing: false } }),

  setPendingEditKey: (key) => set({ pendingEditKey: key }),
  clearPendingEditKey: () => set({ pendingEditKey: null }),

  applyFormat: (format) => {
    const { focus, document } = get();
    const cell = document.rows[focus.row]?.cells[focus.col];
    if (!cell) return;

    const text = getCellText(cell);
    if (!text) return;

    const makeMark = (fmt: FormatType): Mark => {
      if (fmt === 'bold') return { type: 'bold' };
      if (fmt === 'strikethrough') return { type: 'strikethrough' };
      if (fmt === 'warning') return { type: 'warning' };
      if (fmt === 'modified') return { type: 'modified' };
      const color = fmt.replace('color-', '') as 'red' | 'green' | 'blue' | 'gray';
      return { type: 'semanticColor', attrs: { color } };
    };

    const newMark = makeMark(format);

    // 检查是否已有该格式（toggle）
    const hasAll = cell.content.every(
      (c) =>
        c.type === 'text' &&
        c.marks?.some((m) => marksEqual(m, newMark))
    );

    const newContent: InlineContent[] = cell.content.map((c) => {
      if (c.type !== 'text') return c;
      if (hasAll) {
        // 移除该格式
        const marks = (c.marks || []).filter((m) => !marksEqual(m, newMark));
        return { ...c, marks: marks.length > 0 ? marks : undefined };
      } else {
        // 添加该格式
        const marks = [...(c.marks || [])];
        // 颜色类互斥：移除其他颜色
        if (newMark.type === 'semanticColor') {
          const filtered: Mark[] = marks.filter((m) => m.type !== 'semanticColor');
          filtered.push(newMark);
          return { ...c, marks: filtered };
        }
        marks.push(newMark);
        return { ...c, marks };
      }
    });

    const newCell = { ...cell, content: newContent };
    const doc = { ...document };
    const rows = [...doc.rows];
    const targetRow = { ...rows[focus.row] };
    const cells = [...targetRow.cells];
    cells[focus.col] = newCell;
    targetRow.cells = cells;
    rows[focus.row] = targetRow;
    doc.rows = rows;
    set({ document: doc, sourceText: serialize(doc) });
  },

  setViewMode: (mode) => {
    if (mode === 'source') {
      set({ viewMode: 'source', sourceText: serialize(get().document) });
    } else {
      set({ viewMode: 'wysiwyg' });
    }
  },

  syncSourceText: () => {
    set({ sourceText: serialize(get().document) });
  },

  syncFromSource: (text) => {
    try {
      const doc = parse(text);
      set({ document: doc, sourceText: text });
    } catch {
      // 解析失败时不更新
    }
  },

  toggleGridLines: () => set((s) => ({ showGridLines: !s.showGridLines })),
}));

/** 比较两个 Mark 是否相等 */
function marksEqual(a: Mark, b: Mark): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'semanticColor' && b.type === 'semanticColor') {
    return a.attrs.color === b.attrs.color;
  }
  return true;
}

/**
 * 从文档推断列宽
 */
function computeColumnWidths(doc: TabMLDocument): number[] {
  const maxCols = Math.max(
    ...doc.rows.filter((r) => !r.isEmpty).map((r) => r.cells.length),
    3
  );
  const widths: number[] = [];
  // 从 frontmatter 读取
  if (doc.frontmatter.columnWidths && Array.isArray(doc.frontmatter.columnWidths)) {
    for (const w of doc.frontmatter.columnWidths as number[]) {
      widths.push(typeof w === 'number' ? w : DEFAULT_COLUMN_WIDTH);
    }
  }
  while (widths.length < maxCols) widths.push(DEFAULT_COLUMN_WIDTH);
  return widths;
}
