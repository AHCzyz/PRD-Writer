/**
 * 编辑器全局状态管理 (Zustand)
 * 多标签页架构：tabs[] + activeTabId，顶层字段同步保持向后兼容
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
  createEmptyRow,
  getCellText,
} from '../types/tabml';
import { DEFAULT_COLUMN_WIDTH, DEFAULT_FONT_SIZE, DEFAULT_COL_COUNT, DEFAULT_ROW_COUNT } from '../constants/format';
import { serialize } from '../core/tabml/serializer';
import { parse } from '../core/tabml/parser';

/** 选区范围（矩形区域） */
export interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface NormalizedRange {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface GridClipboard {
  kind: 'cells' | 'rows' | 'columns';
  cells: TabMLCell[][];
  rows?: TabMLRow[];
  columnWidths?: number[];
}

export interface ImportedDocumentInput {
  title: string;
  document: TabMLDocument;
  filePath?: string | null;
  columnWidths?: number[];
  isDirty?: boolean;
}

/** 标签页数据 */
export interface Tab {
  id: string;
  title: string;
  filePath: string | null;
  document: TabMLDocument;
  focus: CellFocus;
  columnWidths: number[];
  sourceText: string;
  showGridLines: boolean;
  isDirty: boolean;
  fontSize: number;
  selectionRange: SelectionRange | null;
}

export interface EditorStore {
  // 多标签页
  tabs: Tab[];
  activeTabId: string;

  // 顶层同步字段（从 activeTab 同步，保持下游组件零改动）
  document: TabMLDocument;
  focus: CellFocus;
  columnWidths: number[];
  sourceText: string;
  showGridLines: boolean;
  pendingEditKey: string | null;
  fontSize: number;
  selectAll: boolean;
  selectionRange: SelectionRange | null;
  clipboard: GridClipboard | null;

  // 标签页操作
  addTab: (filePath?: string, content?: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  setTabFilePath: (id: string, filePath: string) => void;
  markTabDirty: (id: string, dirty: boolean) => void;
  /** 打开文件：若当前标签为空白未修改，替换；否则新建标签 */
  openFileOrReplace: (filePath: string, content: string) => void;
  openImportedDocuments: (items: ImportedDocumentInput[]) => void;

  // 文档操作
  setDocument: (doc: TabMLDocument) => void;
  loadFromText: (text: string) => void;

  updateCell: (row: number, col: number, cell: TabMLCell) => void;
  clearSelectionContent: () => void;
  deleteSelection: () => void;
  copySelection: () => GridClipboard | null;
  cutSelection: () => GridClipboard | null;
  pasteClipboard: (row?: number, col?: number) => void;

  insertRow: (after: number) => void;
  insertRowsAt: (index: number, count: number) => void;
  deleteRow: (index: number) => void;
  indentRow: (index: number, delta: 1 | -1) => void;

  addColumn: (rowIndex: number) => void;
  insertColumnsAt: (index: number, count: number) => void;
  setColumnWidth: (col: number, width: number) => void;
  ensureMinColumns: (rowIndex: number, minCols: number) => void;

  // 焦点
  setFocus: (focus: CellFocus) => void;
  clearFocus: () => void;

  // 编辑输入
  setPendingEditKey: (key: string | null) => void;
  clearPendingEditKey: () => void;

  // 选择
  setSelectAll: (val: boolean) => void;
  setSelectionRange: (range: SelectionRange | null) => void;
  selectRow: (rowIndex: number) => void;
  selectColumn: (colIndex: number) => void;
  selectAllCells: () => void;
  clearSelection: () => void;

  // 格式操作（非编辑态下应用到整个格子）
  applyFormat: (format: FormatType) => void;

  // UI
  toggleGridLines: () => void;

  // 字号
  setFontSize: (size: number) => void;
}

export type FormatType = 'bold' | 'strikethrough' | 'warning' | 'modified' | `color-${'red' | 'green' | 'blue' | 'gray'}`;

let tabCounter = 0;
function generateTabId(): string {
  tabCounter++;
  return `tab-${Date.now()}-${tabCounter}`;
}

function createEmptyTab(title = '未命名'): Tab {
  const doc = createEmptyDocument();
  return {
    id: generateTabId(),
    title,
    filePath: null,
    document: doc,
    focus: { row: 0, col: 0, editing: false },
    columnWidths: Array.from({ length: DEFAULT_COL_COUNT }, () => DEFAULT_COLUMN_WIDTH),
    sourceText: serialize(doc),
    showGridLines: true,
    isDirty: false,
    fontSize: DEFAULT_FONT_SIZE,
    selectionRange: null,
  };
}

/**
 * 确保文档至少有 minRows 行（不足时补充空行）
 * 防止保存后重开时行数变少
 */
function ensureMinRows(doc: TabMLDocument, minRows = DEFAULT_ROW_COUNT): void {
  while (doc.rows.length < minRows) {
    doc.rows.push(createEmptyRow(DEFAULT_COL_COUNT));
  }
}

function createTabFromContent(filePath: string, content: string): Tab {
  const doc = parse(content);
  // 若解析结果几乎为空（空文件或只有分隔行），使用默认网格
  const nonEmptyRows = doc.rows.filter((r) => !r.isEmpty);
  if (nonEmptyRows.length === 0) {
    const defaultDoc = createEmptyDocument();
    doc.rows = defaultDoc.rows;
  }
  ensureMinRows(doc);
  const widths = computeColumnWidths(doc);
  const title = filePath.split(/[/\\]/).pop() || '未命名';
  return {
    id: generateTabId(),
    title,
    filePath,
    document: doc,
    focus: { row: 0, col: 0, editing: false },
    columnWidths: widths,
    sourceText: serialize(doc),
    showGridLines: true,
    isDirty: false,
    fontSize: DEFAULT_FONT_SIZE,
    selectionRange: null,
  };
}

/** 从 tabs + activeTabId 同步顶层字段 */
function createTabFromDocument(input: ImportedDocumentInput, id = generateTabId()): Tab {
  const doc = normalizeImportedDocument(input.document);
  const columnWidths = normalizeImportedColumnWidths(doc, input.columnWidths);
  doc.frontmatter = { ...doc.frontmatter, columnWidths };
  const title = input.title || 'Imported';
  return {
    id,
    title,
    filePath: input.filePath ?? null,
    document: doc,
    focus: { row: 0, col: 0, editing: false },
    columnWidths,
    sourceText: serialize(doc),
    showGridLines: true,
    isDirty: input.isDirty ?? true,
    fontSize: DEFAULT_FONT_SIZE,
    selectionRange: null,
  };
}

function normalizeImportedDocument(doc: TabMLDocument): TabMLDocument {
  const rows = doc.rows.length > 0 ? doc.rows : [createEmptyRow(1)];
  return {
    ...doc,
    frontmatter: { ...doc.frontmatter },
    rows,
  };
}

function normalizeImportedColumnWidths(
  doc: TabMLDocument,
  columnWidths?: number[]
): number[] {
  const maxCols = Math.max(1, ...doc.rows.map((row) => row.cells.length), columnWidths?.length ?? 0);
  return Array.from({ length: maxCols }, (_, index) => {
    const value = columnWidths?.[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_COLUMN_WIDTH;
  });
}

function syncFromActive(tabs: Tab[], activeTabId: string, extra: Partial<EditorStore> = {}): Partial<EditorStore> {
  const active = tabs.find((t) => t.id === activeTabId);
  if (!active) return extra;
  return {
    tabs,
    activeTabId,
    document: active.document,
    focus: active.focus,
    columnWidths: active.columnWidths,
    sourceText: active.sourceText,
    showGridLines: active.showGridLines,
    fontSize: active.fontSize,
    selectionRange: active.selectionRange,
    ...extra,
  };
}

/** 更新 activeTab 并同步顶层字段 */
function updateActive(tabs: Tab[], activeTabId: string, partial: Partial<Tab>): Partial<EditorStore> {
  const updated = tabs.map((t) =>
    t.id === activeTabId ? { ...t, ...partial } : t
  );
  return syncFromActive(updated, activeTabId);
}

const initialTab = createEmptyTab();

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  document: initialTab.document,
  focus: initialTab.focus,
  columnWidths: initialTab.columnWidths,
  sourceText: initialTab.sourceText,
  showGridLines: initialTab.showGridLines,
  fontSize: initialTab.fontSize,
  pendingEditKey: null,
  selectAll: false,
  selectionRange: null,
  clipboard: null,

  // === 标签页操作 ===

  addTab: (filePath, content) => {
    const tab = filePath && content != null
      ? createTabFromContent(filePath, content)
      : createEmptyTab();
    const tabs = [...get().tabs, tab];
    set(syncFromActive(tabs, tab.id));
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) {
      // 最后一个标签：关闭后新建一个空标签
      const newTab = createEmptyTab();
      set(syncFromActive([newTab], newTab.id));
      return;
    }
    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    // 如果关闭的是当前活跃标签，切换到相邻标签
    let newActiveId = activeTabId;
    if (id === activeTabId) {
      const nextIdx = Math.min(idx, newTabs.length - 1);
      newActiveId = newTabs[nextIdx].id;
    }
    set(syncFromActive(newTabs, newActiveId));
  },

  switchTab: (id) => {
    const { tabs } = get();
    set(syncFromActive(tabs, id));
  },

  setTabFilePath: (id, filePath) => {
    const { tabs } = get();
    const title = filePath.split(/[/\\]/).pop() || '未命名';
    const updated = tabs.map((t) =>
      t.id === id ? { ...t, filePath, title, isDirty: false } : t
    );
    set(syncFromActive(updated, get().activeTabId));
  },

  markTabDirty: (id, dirty) => {
    const { tabs } = get();
    const updated = tabs.map((t) =>
      t.id === id ? { ...t, isDirty: dirty } : t
    );
    set({ tabs: updated });
  },

  openFileOrReplace: (filePath, content) => {
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId);
    // 若当前标签为空白且未修改，直接替换
    if (active && !active.isDirty && !active.filePath) {
      const doc = parse(content);
      const nonEmptyRows = doc.rows.filter((r) => !r.isEmpty);
      if (nonEmptyRows.length === 0) {
        const defaultDoc = createEmptyDocument();
        doc.rows = defaultDoc.rows;
      }
      ensureMinRows(doc);
      const widths = computeColumnWidths(doc);
      const title = filePath.split(/[/\\]/).pop() || '未命名';
      set(updateActive(tabs, activeTabId, {
        filePath,
        title,
        document: doc,
        sourceText: serialize(doc),
        columnWidths: widths,
        isDirty: false,
        focus: { row: 0, col: 0, editing: false },
        selectionRange: null,
      }));
      return;
    }
    // 否则新建标签
    const tab = createTabFromContent(filePath, content);
    const newTabs = [...tabs, tab];
    set(syncFromActive(newTabs, tab.id));
  },

  openImportedDocuments: (items) => {
    if (items.length === 0) return;
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId);
    const importedTabs = items.map((item) => createTabFromDocument(item));

    if (active && !active.isDirty && !active.filePath) {
      const [first, ...rest] = importedTabs;
      const replacement = { ...first, id: active.id };
      const newTabs = tabs
        .map((tab) => (tab.id === activeTabId ? replacement : tab))
        .concat(rest);
      set(syncFromActive(newTabs, replacement.id));
      return;
    }

    const newTabs = [...tabs, ...importedTabs];
    set(syncFromActive(newTabs, importedTabs[0].id));
  },

  // === 文档操作 ===

  setDocument: (doc) => {
    const { tabs, activeTabId } = get();
    set(updateActive(tabs, activeTabId, { document: doc, isDirty: true }));
  },

  loadFromText: (text) => {
    const doc = parse(text);
    // 若解析结果为空，使用默认网格
    const nonEmptyRows = doc.rows.filter((r) => !r.isEmpty);
    if (nonEmptyRows.length === 0) {
      const defaultDoc = createEmptyDocument();
      doc.rows = defaultDoc.rows;
    }
    ensureMinRows(doc);
    const widths = computeColumnWidths(doc);
    const { tabs, activeTabId } = get();
    set(updateActive(tabs, activeTabId, {
      document: doc,
      sourceText: serialize(doc),
      columnWidths: widths,
    }));
  },

  // === 单元格操作 ===

  updateCell: (row, col, cell) => {
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const doc = { ...active.document };
    const rows = [...doc.rows];
    const targetRow = { ...rows[row] };
    const cells = [...targetRow.cells];
    cells[col] = cell;
    targetRow.cells = cells;
    rows[row] = targetRow;
    doc.rows = rows;
    set(updateActive(tabs, activeTabId, {
      document: doc,
      sourceText: serialize(doc),
      isDirty: true,
    }));
  },

  clearSelectionContent: () => {
    const { tabs, activeTabId, selectAll } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const range = getActiveRange(active.document, active.focus, active.selectionRange, selectAll);
    const doc = { ...active.document };
    const rows = [...doc.rows];
    let changed = false;

    for (let r = range.minRow; r <= range.maxRow; r++) {
      const row = rows[r];
      if (!row || row.isEmpty) continue;
      const cells = [...row.cells];
      ensureCells(cells, range.maxCol + 1);

      for (let c = range.minCol; c <= range.maxCol; c++) {
        if (!isEmptyCell(cells[c])) {
          cells[c] = createEmptyCell();
          changed = true;
        }
      }

      rows[r] = { ...row, cells };
    }

    if (!changed) return;

    doc.rows = rows;
    set(updateActive(tabs, activeTabId, {
      document: doc,
      sourceText: serialize(doc),
      isDirty: true,
    }));
  },

  deleteSelection: () => {
    const { tabs, activeTabId, selectAll } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const range = getActiveRange(active.document, active.focus, active.selectionRange, selectAll);
    const fullRows = isFullRowRange(active.document, range);
    const fullCols = isFullColumnRange(active.document, range);

    if (fullRows && !fullCols) {
      const rows = [...active.document.rows];
      rows.splice(range.minRow, range.maxRow - range.minRow + 1);
      if (rows.length === 0) {
        rows.push(createEmptyRow(Math.max(getMaxColumnCount(active.document), DEFAULT_COL_COUNT)));
      }
      const doc = { ...active.document, rows };
      const nextRow = Math.min(range.minRow, rows.length - 1);
      set(updateActive(tabs, activeTabId, {
        document: doc,
        focus: { row: nextRow, col: 0, editing: false },
        sourceText: serialize(doc),
        isDirty: true,
        selectionRange: null,
      }));
      return;
    }

    if (fullCols && !fullRows) {
      const deleteCount = range.maxCol - range.minCol + 1;
      const rows = active.document.rows.map((row) => {
        if (row.isEmpty) return row;
        const cells = [...row.cells];
        ensureCells(cells, range.maxCol + 1);
        cells.splice(range.minCol, deleteCount);
        if (cells.length === 0) cells.push(createEmptyCell());
        return { ...row, cells };
      });
      const columnWidths = [...active.columnWidths];
      ensureWidths(columnWidths, range.maxCol + 1);
      columnWidths.splice(range.minCol, deleteCount);
      if (columnWidths.length === 0) columnWidths.push(DEFAULT_COLUMN_WIDTH);
      const doc = withColumnWidths({ ...active.document, rows }, columnWidths);
      set(updateActive(tabs, activeTabId, {
        document: doc,
        columnWidths,
        focus: { row: 0, col: Math.min(range.minCol, columnWidths.length - 1), editing: false },
        sourceText: serialize(doc),
        isDirty: true,
        selectionRange: null,
      }));
      return;
    }

    get().clearSelectionContent();
  },

  copySelection: () => {
    const { tabs, activeTabId, selectAll } = get();
    const active = tabs.find((t) => t.id === activeTabId);
    if (!active) return null;

    const range = getActiveRange(active.document, active.focus, active.selectionRange, selectAll);
    const fullRows = isFullRowRange(active.document, range);
    const fullCols = isFullColumnRange(active.document, range);
    const width = range.maxCol - range.minCol + 1;

    let clipboard: GridClipboard;

    if (fullRows && !fullCols) {
      const rows = active.document.rows
        .slice(range.minRow, range.maxRow + 1)
        .map(cloneRow);
      clipboard = {
        kind: 'rows',
        rows,
        cells: rows.map((row) => row.cells.map(cloneCell)),
      };
    } else if (fullCols && !fullRows) {
      const cells = active.document.rows.map((row) =>
        Array.from({ length: width }, (_, i) => readCell(row, range.minCol + i))
      );
      clipboard = {
        kind: 'columns',
        cells,
        columnWidths: Array.from(
          { length: width },
          (_, i) => active.columnWidths[range.minCol + i] ?? DEFAULT_COLUMN_WIDTH
        ),
      };
    } else {
      const cells: TabMLCell[][] = [];
      for (let r = range.minRow; r <= range.maxRow; r++) {
        const row = active.document.rows[r];
        cells.push(Array.from({ length: width }, (_, i) => readCell(row, range.minCol + i)));
      }
      clipboard = { kind: 'cells', cells };
    }

    set({ clipboard });
    return clipboard;
  },

  cutSelection: () => {
    const clipboard = get().copySelection();
    if (!clipboard) return null;
    get().deleteSelection();
    return clipboard;
  },

  pasteClipboard: (row, col) => {
    const { tabs, activeTabId, clipboard } = get();
    if (!clipboard) return;

    const active = tabs.find((t) => t.id === activeTabId)!;
    const doc = { ...active.document };
    let rows = [...doc.rows];
    const targetRow = clamp(row ?? active.focus.row, 0, rows.length);
    const targetCol = Math.max(0, col ?? active.focus.col);
    let columnWidths = [...active.columnWidths];

    if (clipboard.kind === 'rows') {
      const rowsToInsert = (clipboard.rows || []).map(cloneRow);
      if (rowsToInsert.length === 0) return;
      rows.splice(targetRow, 0, ...rowsToInsert);
      doc.rows = rows;
      set(updateActive(tabs, activeTabId, {
        document: doc,
        focus: { row: targetRow, col: 0, editing: false },
        sourceText: serialize(doc),
        isDirty: true,
      }));
      return;
    }

    if (clipboard.kind === 'columns') {
      const width = Math.max(...clipboard.cells.map((rowCells) => rowCells.length), 0);
      if (width === 0) return;
      while (rows.length < clipboard.cells.length) {
        rows.push(createEmptyRow(Math.max(getMaxColumnCount(doc), DEFAULT_COL_COUNT)));
      }
      rows = rows.map((rowItem, rowIndex) => {
        if (rowItem.isEmpty) return rowItem;
        const cells = [...rowItem.cells];
        ensureCells(cells, targetCol);
        const sourceCells = clipboard.cells[rowIndex] || Array.from({ length: width }, () => createEmptyCell());
        cells.splice(targetCol, 0, ...sourceCells.map(cloneCell));
        return { ...rowItem, cells };
      });
      ensureWidths(columnWidths, targetCol);
      columnWidths.splice(
        targetCol,
        0,
        ...(clipboard.columnWidths || Array.from({ length: width }, () => DEFAULT_COLUMN_WIDTH))
      );
      doc.rows = rows;
      const nextDoc = withColumnWidths(doc, columnWidths);
      set(updateActive(tabs, activeTabId, {
        document: nextDoc,
        columnWidths,
        focus: { row: 0, col: targetCol, editing: false },
        sourceText: serialize(nextDoc),
        isDirty: true,
      }));
      return;
    }

    const height = clipboard.cells.length;
    const width = Math.max(...clipboard.cells.map((rowCells) => rowCells.length), 0);
    if (height === 0 || width === 0) return;

    const baseCols = Math.max(getMaxColumnCount(doc), columnWidths.length, DEFAULT_COL_COUNT);
    while (rows.length <= targetRow) {
      rows.push(createEmptyRow(baseCols));
    }
    if (height > 1) {
      rows.splice(
        targetRow + 1,
        0,
        ...Array.from({ length: height - 1 }, () => createEmptyRow(baseCols))
      );
    }

    for (let i = 0; i < height; i++) {
      const rowIndex = targetRow + i;
      const rowItem = rows[rowIndex] || createEmptyRow(baseCols);
      const cells = [...rowItem.cells];
      ensureCells(cells, targetCol);
      cells.splice(targetCol, 0, ...clipboard.cells[i].map(cloneCell));
      rows[rowIndex] = { ...rowItem, isEmpty: false, cells };
    }

    const maxCols = Math.max(...rows.map((r) => r.cells.length), DEFAULT_COL_COUNT);
    ensureWidths(columnWidths, maxCols);
    doc.rows = rows;
    const nextDoc = withColumnWidths(doc, columnWidths);
    set(updateActive(tabs, activeTabId, {
      document: nextDoc,
      columnWidths,
      focus: { row: targetRow, col: targetCol, editing: false },
      sourceText: serialize(nextDoc),
      isDirty: true,
    }));
  },

  // === 行操作 ===

  insertRow: (after) => {
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const doc = { ...active.document };
    const rows = [...doc.rows];
    const maxCols = Math.max(...rows.map((r) => r.cells.length), DEFAULT_COL_COUNT);
    const newRow: TabMLRow = {
      indent: 0,
      cells: Array.from({ length: maxCols }, () => createEmptyCell()),
      isEmpty: false,
    };
    rows.splice(after + 1, 0, newRow);
    doc.rows = rows;
    set(updateActive(tabs, activeTabId, {
      document: doc,
      focus: { row: after + 1, col: 0, editing: false },
      sourceText: serialize(doc),
      isDirty: true,
    }));
  },

  insertRowsAt: (index, count) => {
    const safeCount = Math.max(1, Math.floor(count));
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const doc = { ...active.document };
    const rows = [...doc.rows];
    const insertAt = clamp(index, 0, rows.length);
    const maxCols = Math.max(getMaxColumnCount(active.document), active.columnWidths.length, DEFAULT_COL_COUNT);
    rows.splice(
      insertAt,
      0,
      ...Array.from({ length: safeCount }, () => createEmptyRow(maxCols))
    );
    doc.rows = rows;
    set(updateActive(tabs, activeTabId, {
      document: doc,
      focus: { row: insertAt, col: 0, editing: false },
      sourceText: serialize(doc),
      isDirty: true,
    }));
  },

  deleteRow: (index) => {
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const doc = { ...active.document };
    const rows = [...doc.rows];
    if (rows.length <= 1) return;
    rows.splice(index, 1);
    doc.rows = rows;
    const newFocusRow = Math.min(index, rows.length - 1);
    set(updateActive(tabs, activeTabId, {
      document: doc,
      focus: { row: newFocusRow, col: 0, editing: false },
      sourceText: serialize(doc),
      isDirty: true,
    }));
  },

  indentRow: (index, delta) => {
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const doc = { ...active.document };
    const rows = [...doc.rows];
    const row = { ...rows[index] };
    const newIndent = Math.max(0, Math.min(4, row.indent + delta));
    if (newIndent === row.indent) return;
    row.indent = newIndent;
    rows[index] = row;
    doc.rows = rows;
    set(updateActive(tabs, activeTabId, {
      document: doc,
      sourceText: serialize(doc),
      isDirty: true,
    }));
  },

  // === 列操作 ===

  addColumn: (rowIndex) => {
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const doc = { ...active.document };
    const rows = [...doc.rows];
    const row = { ...rows[rowIndex] };
    row.cells = [...row.cells, createEmptyCell()];
    rows[rowIndex] = row;
    doc.rows = rows;
    const newWidths = [...active.columnWidths];
    if (row.cells.length > newWidths.length) {
      newWidths.push(DEFAULT_COLUMN_WIDTH);
    }
    set(updateActive(tabs, activeTabId, {
      document: doc,
      columnWidths: newWidths,
      sourceText: serialize(doc),
      isDirty: true,
    }));
  },

  insertColumnsAt: (index, count) => {
    const safeCount = Math.max(1, Math.floor(count));
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const doc = { ...active.document };
    const rows = active.document.rows.map((row) => {
      if (row.isEmpty) return row;
      const cells = [...row.cells];
      const insertAt = clamp(index, 0, cells.length);
      ensureCells(cells, insertAt);
      cells.splice(insertAt, 0, ...Array.from({ length: safeCount }, () => createEmptyCell()));
      return { ...row, cells };
    });
    const columnWidths = [...active.columnWidths];
    const insertAt = clamp(index, 0, columnWidths.length);
    ensureWidths(columnWidths, insertAt);
    columnWidths.splice(insertAt, 0, ...Array.from({ length: safeCount }, () => DEFAULT_COLUMN_WIDTH));
    const nextDoc = withColumnWidths({ ...doc, rows }, columnWidths);
    set(updateActive(tabs, activeTabId, {
      document: nextDoc,
      columnWidths,
      focus: { row: 0, col: insertAt, editing: false },
      sourceText: serialize(nextDoc),
      isDirty: true,
    }));
  },

  setColumnWidth: (col, width) => {
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const widths = [...active.columnWidths];
    widths[col] = width;
    // 同步写入 frontmatter 以便序列化到文件中
    const doc = { ...active.document, frontmatter: { ...active.document.frontmatter, columnWidths: widths } };
    set(updateActive(tabs, activeTabId, {
      columnWidths: widths,
      document: doc,
      sourceText: serialize(doc),
      isDirty: true,
    }));
  },

  ensureMinColumns: (rowIndex, minCols) => {
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const doc = { ...active.document };
    const rows = [...doc.rows];
    const row = { ...rows[rowIndex] };
    if (row.cells.length >= minCols) return;
    row.cells = [
      ...row.cells,
      ...Array.from({ length: minCols - row.cells.length }, () => createEmptyCell()),
    ];
    rows[rowIndex] = row;
    doc.rows = rows;
    const widths = [...active.columnWidths];
    while (widths.length < minCols) widths.push(DEFAULT_COLUMN_WIDTH);
    set(updateActive(tabs, activeTabId, {
      document: doc,
      columnWidths: widths,
      sourceText: serialize(doc),
      isDirty: true,
    }));
  },

  // === 焦点 ===

  setFocus: (focus) => {
    const { tabs, activeTabId } = get();
    set(updateActive(tabs, activeTabId, { focus }));
  },

  clearFocus: () => {
    const { tabs, activeTabId } = get();
    set(updateActive(tabs, activeTabId, { focus: { row: 0, col: 0, editing: false } }));
  },

  // === 编辑输入 ===

  setPendingEditKey: (key) => set({ pendingEditKey: key }),
  clearPendingEditKey: () => set({ pendingEditKey: null }),

  setSelectAll: (val) => {
    const { tabs, activeTabId } = get();
    set({
      ...updateActive(tabs, activeTabId, { selectionRange: null }),
      selectAll: val,
    });
  },

  setSelectionRange: (range) => {
    const { tabs, activeTabId } = get();
    set({
      ...updateActive(tabs, activeTabId, { selectionRange: range }),
      selectAll: false,
    });
  },

  selectRow: (rowIndex) => {
    const { tabs, activeTabId, document } = get();
    const maxCol = Math.max(...document.rows.map((r) => r.cells.length), DEFAULT_COL_COUNT) - 1;
    const selectionRange = { startRow: rowIndex, startCol: 0, endRow: rowIndex, endCol: maxCol };
    set({
      ...updateActive(tabs, activeTabId, { selectionRange }),
      selectAll: false,
    });
  },

  selectColumn: (colIndex) => {
    const { tabs, activeTabId, document } = get();
    const selectionRange = { startRow: 0, startCol: colIndex, endRow: document.rows.length - 1, endCol: colIndex };
    set({
      ...updateActive(tabs, activeTabId, { selectionRange }),
      selectAll: false,
    });
  },

  selectAllCells: () => {
    const { tabs, activeTabId, document } = get();
    const maxCol = Math.max(...document.rows.map((r) => r.cells.length), DEFAULT_COL_COUNT) - 1;
    const selectionRange = { startRow: 0, startCol: 0, endRow: document.rows.length - 1, endCol: maxCol };
    set({
      ...updateActive(tabs, activeTabId, { selectionRange }),
      selectAll: false,
    });
  },

  clearSelection: () => {
    const { tabs, activeTabId } = get();
    set({
      ...updateActive(tabs, activeTabId, { selectionRange: null }),
      selectAll: false,
    });
  },

  // === 格式操作 ===

  applyFormat: (format) => {
    const { focus, tabs, activeTabId, selectionRange, selectAll } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    const newMark = makeMark(format);
    const doc = { ...active.document };
    const rows = [...doc.rows];

    const maxCol = Math.max(
      ...active.document.rows.map((r) => r.cells.length),
      DEFAULT_COL_COUNT
    ) - 1;

    const range = selectAll
      ? {
          startRow: 0,
          startCol: 0,
          endRow: active.document.rows.length - 1,
          endCol: maxCol,
        }
      : selectionRange || {
          startRow: focus.row,
          startCol: focus.col,
          endRow: focus.row,
          endCol: focus.col,
        };

    const minR = Math.max(0, Math.min(range.startRow, range.endRow));
    const maxR = Math.min(rows.length - 1, Math.max(range.startRow, range.endRow));
    const minC = Math.max(0, Math.min(range.startCol, range.endCol));
    const maxC = Math.max(range.startCol, range.endCol);

    let changed = false;

    for (let r = minR; r <= maxR; r++) {
      const row = rows[r];
      if (!row || row.isEmpty) continue;

      let nextRow: TabMLRow | null = null;
      let nextCells: TabMLCell[] | null = null;

      for (let c = minC; c <= maxC; c++) {
        const cell = row.cells[c];
        if (!cell || !getCellText(cell)) continue;

        const nextCell = applyMarkToCell(cell, newMark);
        if (nextCell === cell) continue;

        if (!nextRow) {
          nextRow = { ...row };
          nextCells = [...row.cells];
        }
        nextCells![c] = nextCell;
        changed = true;
      }

      if (nextRow && nextCells) {
        nextRow.cells = nextCells;
        rows[r] = nextRow;
      }
    }

    if (!changed) return;

    doc.rows = rows;
    set(updateActive(tabs, activeTabId, {
      document: doc,
      sourceText: serialize(doc),
      isDirty: true,
    }));
  },

  // === UI ===

  toggleGridLines: () => {
    const { tabs, activeTabId } = get();
    const active = tabs.find((t) => t.id === activeTabId)!;
    set(updateActive(tabs, activeTabId, { showGridLines: !active.showGridLines }));
  },

  setFontSize: (size) => {
    const { tabs, activeTabId } = get();
    const clamped = Math.max(10, Math.min(32, size));
    set(updateActive(tabs, activeTabId, { fontSize: clamped }));
  },
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
function makeMark(fmt: FormatType): Mark {
  if (fmt === 'bold') return { type: 'bold' };
  if (fmt === 'strikethrough') return { type: 'strikethrough' };
  if (fmt === 'warning') return { type: 'warning' };
  if (fmt === 'modified') return { type: 'modified' };
  const color = fmt.replace('color-', '') as 'red' | 'green' | 'blue' | 'gray';
  return { type: 'semanticColor', attrs: { color } };
}

function applyMarkToCell(cell: TabMLCell, newMark: Mark): TabMLCell {
  const textRuns = cell.content.filter((c) => c.type === 'text');
  if (textRuns.length === 0) return cell;

  const hasAll = textRuns.every((c) =>
    c.marks?.some((m) => marksEqual(m, newMark))
  );

  const newContent: InlineContent[] = cell.content.map((c) => {
    if (c.type !== 'text') return c;

    if (hasAll) {
      const marks = (c.marks || []).filter((m) => !marksEqual(m, newMark));
      return { ...c, marks: marks.length > 0 ? marks : undefined };
    }

    const marks = [...(c.marks || [])];
    if (newMark.type === 'semanticColor') {
      const filtered: Mark[] = marks.filter((m) => m.type !== 'semanticColor');
      filtered.push(newMark);
      return { ...c, marks: filtered };
    }

    if (marks.some((m) => marksEqual(m, newMark))) return c;
    marks.push(newMark);
    return { ...c, marks };
  });

  return { ...cell, content: newContent };
}

function computeColumnWidths(doc: TabMLDocument): number[] {
  const maxCols = Math.max(
    ...doc.rows.filter((r) => !r.isEmpty).map((r) => r.cells.length),
    3
  );
  const widths: number[] = [];
  if (doc.frontmatter.columnWidths && Array.isArray(doc.frontmatter.columnWidths)) {
    for (const w of doc.frontmatter.columnWidths) {
      const width = typeof w === 'number' ? w : Number(w);
      widths.push(Number.isFinite(width) ? width : DEFAULT_COLUMN_WIDTH);
    }
  }
  while (widths.length < maxCols) widths.push(DEFAULT_COLUMN_WIDTH);
  return widths;
}

function getActiveRange(
  doc: TabMLDocument,
  focus: CellFocus,
  range: SelectionRange | null,
  selectAll: boolean
): NormalizedRange {
  if (selectAll) {
    return {
      minRow: 0,
      maxRow: Math.max(0, doc.rows.length - 1),
      minCol: 0,
      maxCol: Math.max(0, getMaxColumnCount(doc) - 1),
    };
  }

  const source = range || {
    startRow: focus.row,
    startCol: focus.col,
    endRow: focus.row,
    endCol: focus.col,
  };

  const maxRow = Math.max(0, doc.rows.length - 1);
  return {
    minRow: clamp(Math.min(source.startRow, source.endRow), 0, maxRow),
    maxRow: clamp(Math.max(source.startRow, source.endRow), 0, maxRow),
    minCol: Math.max(0, Math.min(source.startCol, source.endCol)),
    maxCol: Math.max(0, Math.max(source.startCol, source.endCol)),
  };
}

function isFullRowRange(doc: TabMLDocument, range: NormalizedRange): boolean {
  return range.minCol === 0 && range.maxCol >= getMaxColumnCount(doc) - 1;
}

function isFullColumnRange(doc: TabMLDocument, range: NormalizedRange): boolean {
  return range.minRow === 0 && range.maxRow >= doc.rows.length - 1;
}

function getMaxColumnCount(doc: TabMLDocument): number {
  return Math.max(...doc.rows.map((row) => row.cells.length), DEFAULT_COL_COUNT);
}

function readCell(row: TabMLRow | undefined, col: number): TabMLCell {
  if (!row || row.isEmpty || !row.cells[col]) {
    return createEmptyCell();
  }
  return cloneCell(row.cells[col]);
}

function cloneRow(row: TabMLRow): TabMLRow {
  return {
    ...row,
    cells: row.cells.map(cloneCell),
  };
}

function cloneCell(cell: TabMLCell): TabMLCell {
  return {
    ...cell,
    content: cell.content.map((item) => {
      if (item.type === 'text') {
        return {
          ...item,
          marks: item.marks?.map((mark) => ({ ...mark })) as Mark[] | undefined,
        };
      }
      return { ...item };
    }),
    image: cell.image ? { ...cell.image } : undefined,
  };
}

function ensureCells(cells: TabMLCell[], count: number): void {
  while (cells.length < count) {
    cells.push(createEmptyCell());
  }
}

function ensureWidths(widths: number[], count: number): void {
  while (widths.length < count) {
    widths.push(DEFAULT_COLUMN_WIDTH);
  }
}

function isEmptyCell(cell: TabMLCell | undefined): boolean {
  if (!cell) return true;
  if (cell.heading || cell.todo || cell.image) return false;
  return cell.content.every((item) => {
    if (item.type === 'image') return false;
    return item.text.length === 0 && (!item.marks || item.marks.length === 0);
  });
}

function withColumnWidths(doc: TabMLDocument, columnWidths: number[]): TabMLDocument {
  return {
    ...doc,
    frontmatter: {
      ...doc.frontmatter,
      columnWidths,
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
