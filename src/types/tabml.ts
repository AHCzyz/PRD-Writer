/**
 * Tab-ML 核心类型定义
 * 定义文档结构：Document → Row → Cell → InlineContent
 */

/** 文档根节点 */
export interface TabMLDocument {
  frontmatter: Record<string, unknown>;
  rows: TabMLRow[];
}

/** 行 */
export interface TabMLRow {
  indent: number;           // 缩进级别 0-4
  cells: TabMLCell[];
  isEmpty: boolean;         // true = 视觉分隔行
}

/** 单元格 */
export interface TabMLCell {
  heading?: 1 | 2 | 3;     // # / ## / ###
  todo?: 'uncheck' | 'check' | 'question';
  content: InlineContent[];
  image?: ImageInfo;
}

/** 图片信息 */
export interface ImageInfo {
  src: string;
  width?: number;
  height?: number;
}

/** 内联内容 */
export type InlineContent = TextRun | ImageRef;

/** 文本片段（含可选标记） */
export interface TextRun {
  type: 'text';
  text: string;
  marks?: Mark[];
}

/** 图片引用 */
export interface ImageRef {
  type: 'image';
  src: string;
  width?: number;
  height?: number;
}

/** 内联标记 */
export type Mark =
  | { type: 'bold' }
  | { type: 'strikethrough' }
  | { type: 'warning' }
  | { type: 'modified' }
  | { type: 'semanticColor'; attrs: { color: SemanticColor } };

/** 语义颜色 */
export type SemanticColor = 'red' | 'green' | 'blue' | 'gray';

/** 焦点状态 */
export interface CellFocus {
  row: number;
  col: number;
  editing: boolean;
}

/** 空文档工厂 */
export function createEmptyDocument(): TabMLDocument {
  return {
    frontmatter: {},
    rows: [createEmptyRow()],
  };
}

/** 空行工厂 */
export function createEmptyRow(): TabMLRow {
  return {
    indent: 0,
    cells: [createEmptyCell()],
    isEmpty: false,
  };
}

/** 空单元格工厂 */
export function createEmptyCell(): TabMLCell {
  return {
    content: [{ type: 'text', text: '' }],
  };
}

/** 创建文本单元格 */
export function createTextCell(text: string): TabMLCell {
  return {
    content: [{ type: 'text', text }],
  };
}

/** 获取单元格的纯文本 */
export function getCellText(cell: TabMLCell): string {
  return cell.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('');
}
