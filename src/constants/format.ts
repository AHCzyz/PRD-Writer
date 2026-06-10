/**
 * 格式常量定义
 */

/** 语义颜色映射：颜色名 → CSS 值 */
export const SEMANTIC_COLORS = {
  red: { text: '#dc2626', bg: 'transparent', fontWeight: 'bold' },
  green: { text: '#166534', bg: '#dcfce7', fontWeight: 'normal' },
  blue: { text: '#2563eb', bg: 'transparent', fontWeight: 'normal' },
  gray: { text: '#6b7280', bg: 'transparent', fontWeight: 'normal' },
} as const;

/** 标记的 CSS 渲染配置 */
export const MARK_STYLES = {
  bold: { fontWeight: 'bold' },
  strikethrough: { textDecoration: 'line-through', backgroundColor: '#f3f4f6', color: '#9ca3af' },
  warning: { color: '#dc2626', fontWeight: 'bold' },
  modified: { backgroundColor: '#dcfce7' },
} as const;

/** 快捷键定义 */
export const SHORTCUTS = {
  bold: 'Ctrl+B',
  strikethrough: 'Ctrl+Shift+S',
  warning: 'Ctrl+Shift+H',
  modified: 'Ctrl+Shift+M',
} as const;

/** 默认列宽 (px) */
export const DEFAULT_COLUMN_WIDTH = 200;
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 800;

/** 缩进宽度 (px per level) */
export const INDENT_WIDTH = 24;

/** 空行分隔符高度 (px) */
export const SEPARATOR_HEIGHT = 12;

/** 默认行高 (px) */
export const DEFAULT_ROW_HEIGHT = 32;

/** 防抖时间 (ms) */
export const DEBOUNCE_EDIT = 300;
export const DEBOUNCE_SOURCE = 500;
