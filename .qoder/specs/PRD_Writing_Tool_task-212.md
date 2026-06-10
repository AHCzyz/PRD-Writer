# PRD 写作工具 — 完整实现方案

## 产品定位
> 像 Excel 一样自由排版，像 Markdown 一样纯粹结构，但比两者都更 AI 友好。

---

## 一、Tab-ML 完整语法规范

### 1.1 文件约定
- 扩展名: `.tab.md`
- 编码: UTF-8 (无 BOM)
- 行分隔: `\n` (LF)
- 列分隔: `\t` (Tab 字符, U+0009)

### 1.2 YAML Frontmatter
```yaml
---
title: "PRD: 用户认证模块"
author: "张三"
created: 2026-06-09
modified: 2026-06-09
version: "1.0"
columns: [功能模块, 需求描述, 优先级, 状态]
columnWidths: [160, 400, 80, 100]
tags: [prd, auth]
---
```
所有字段可选。`columnWidths` 为纯视觉元数据，不影响语义。

### 1.3 行结构
```
[缩进tabs]cell1\tcell2\tcell3
```
- 行首 `\t` = 缩进层级（每个 tab 一级，最多 4 级）
- `\t` 分隔列
- 空行 = 视觉分隔符（渲染为加宽间距）

### 1.4 内联格式

| 语法 | 渲染 | 快捷键 | 语义 |
|------|------|--------|------|
| `**text**` | **粗体** | `Ctrl+B` | 强调 |
| `~~text~~` | ~~删除线~~ | `Ctrl+Shift+S` | 废弃/删除 |
| `!!text!!` | 黄色高亮 | `Ctrl+Shift+H` | 警告/注意 |
| `++text++` | 绿色标记 | `Ctrl+Shift+M` | 新增/修改 |
| `[red]text[/red]` | 红色文字 | 斜杠命令 | 阻断 |
| `[green]text[/green]` | 绿色文字 | 斜杠命令 | 通过 |
| `[blue]text[/blue]` | 蓝色文字 | 斜杠命令 | 信息 |
| `[orange]text[/orange]` | 橙色文字 | 斜杠命令 | 注意 |
| `[gray]text[/gray]` | 灰色文字 | 斜杠命令 | 次要 |

**规则**: 格式可嵌套 `**~~粗体删除线~~**`；标记内不可包含其他标记的同类符号。

### 1.5 单元格级属性

| 前缀 | 含义 | 渲染 |
|------|------|------|
| `# ` | H1 标题行 | 大字号+粗体，列扩展全行 |
| `## ` | H2 标题行 | 中字号+粗体 |
| `### ` | H3 标题行 | 稍大字号+粗体 |
| `[ ] ` | 未开始 Todo | 空复选框 |
| `[x] ` | 已完成 Todo | 勾选框+删除线文字 |
| `[?] ` | 待确认 Todo | 问号框+高亮文字 |

### 1.6 图片
```
![](./images/screenshot.png)
![](./images/photo.png =300x200)
```
路径为相对路径，可选 `=WIDTHxHEIGHT` 尺寸后缀。

### 1.7 转义规则
| 字符 | 转义 |
|------|------|
| `\` | `\\` |
| 字面 Tab | `\t` (两个字符) |
| `**` | `\*\*` |
| `~~` | `\~\~` |
| `!!` | `\!\!` |
| `++` | `\+\+` |

### 1.8 完整文档示例
```
---
title: 搜索功能 PRD
author: 李四
modified: 2026-06-09
columns: [需求, 描述, 优先级, 状态]
columnWidths: [160, 400, 80, 100]
---
# 搜索功能 PRD
## 1. 背景与目标
→	当前搜索体验差，用户反馈多	P0	!!紧急!!
→	提升搜索准确率和速度	P0	未开始

## 2. 需求列表
→	[ ] 全文搜索	++新增++	P0
→	[ ] 搜索建议		P1
→	[x] 搜索历史记录	已完成
→→	[x] 本地存储方案
→	[?] AI 语义搜索	待评估	P2
![](images/search-flow.png =600x400)

## 3. 参考
[blue]竞品分析[/blue]	[red]需更新[/red]
```

---

## 二、技术架构

### 2.1 技术栈

| 层级 | 选择 | 理由 |
|------|------|------|
| **构建** | Vite 6 | 极速 HMR、ESM、Rollup 打包 |
| **框架** | React 18 + TypeScript 5 | 最大生态、类型安全 |
| **单元格编辑** | Tiptap 2 (MIT) | 清晰 Mark API、内置 undo/redo、处理 contenteditable 复杂性 |
| **虚拟滚动** | TanStack Virtual 3 | React 最成熟方案、动态行高、~5KB |
| **源码编辑** | Monaco Editor | VS Code 同款、Monarch 语法高亮、按需加载 |
| **状态管理** | Zustand 5 | 极简 ~1KB、内置 persist |
| **样式** | Tailwind CSS v4 + CSS Modules | 零运行时、ProseMirror 用 CSS Modules |
| **测试** | Vitest + Playwright | 快速单测 + E2E |

### 2.2 模块架构

```
┌──────────────────────────────────────────────────────────┐
│                    UI Shell (React)                       │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ TopBar   │  │FloatToolbar   │  │ SlashCommand     │  │
│  └──────────┘  └───────────────┘  └──────────────────┘  │
├──────────────────────────────────────────────────────────┤
│                   View Layer                              │
│  ┌────────────────────┐  ┌──────────────────────────┐   │
│  │  WYSIWYG Grid      │  │  Source View (Monaco)    │   │
│  │  HTML table +       │  │  Monarch Syntax Highlight│   │
│  │  TanStack Virtual   │  │  Editable / Read-only   │   │
│  │  ┌──────────────┐  │  └──────────────────────────┘   │
│  │  │CellEditor    │  │                                 │
│  │  │(Tiptap 实例) │  │                                 │
│  │  └──────────────┘  │                                 │
│  └────────────────────┘                                 │
├──────────────────────────────────────────────────────────┤
│                  State (Zustand Store)                    │
│  { document, focus, viewMode, columnWidths, history }    │
├──────────────────────────────────────────────────────────┤
│               Core Engine (Pure TypeScript)               │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Parser   │ │ Serializer│ │ Renderer │ │ Differ    │  │
│  │ .tab.md→ │ │ Doc→      │ │ Cell→    │ │ AI Copy   │  │
│  │   Doc    │ │   .tab.md │ │   HTML   │ │ Support   │  │
│  └──────────┘ └───────────┘ └──────────┘ └───────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2.3 数据流

```
[用户操作]
    │
    ├─[编辑模式]─→ 单元格编辑 → Tiptap onUpdate
    │                  → serializeCell() → store.updateCell(row,col,markup)
    │                  → 300ms debounce → 更新 sourceText
    │
    ├─[导航]─→ keyboardHandler → store.setFocus(row,col)
    │                            → scrollIntoView
    │
    └─[源码模式]─→ Monaco onChange
                      → 500ms debounce → parser.parse(text)
                      → store.setDocument(doc)
```

### 2.4 核心设计原则

1. **TabMLDocument 为唯一真相源** — 所有视图从 document 派生，避免状态不一致
2. **惰性 Tiptap** — 仅活跃编辑单元格实例化 Tiptap，非活跃单元格渲染纯 HTML
3. **Cell 双状态** — `{row, col, editing}` 三元组：editing=false 显示渲染 HTML，editing=true 挂载 Tiptap
4. **导航/编辑分离** — 明确区分 navigation mode（Tab/Arrow 跳转）和 edit mode（Enter/双击进入，Escape 退出）

---

## 三、项目目录结构

```
f:\Work\Excel_md\
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types/
│   │   └── tabml.ts                  # TabMLDocument, Row, Cell, Mark 类型
│   ├── constants/
│   │   └── format.ts                 # 格式标记、颜色映射、快捷键
│   ├── core/
│   │   ├── tabml/
│   │   │   ├── parser.ts             # parse(text) → TabMLDocument
│   │   │   ├── serializer.ts         # serialize(doc) → string
│   │   │   ├── renderer.ts           # renderCellHTML(cell) → string
│   │   │   └── __tests__/            # parser/serializer/roundtrip 测试
│   │   ├── format/
│   │   │   ├── marks/                # Tiptap 自定义 Mark 定义
│   │   │   │   ├── HighlightMark.ts       # !!text!!
│   │   │   │   ├── NewModifiedMark.ts     # ++text++
│   │   │   │   └── SemanticColorMark.ts   # [color]text[/color]
│   │   │   ├── TodoNode.ts           # [ ]/[x]/[?] Tiptap Node
│   │   │   ├── cell-editor-config.ts # Tiptap 配置汇总
│   │   │   ├── markup-to-tiptap.ts   # markup → Tiptap JSON
│   │   │   └── tiptap-to-markup.ts   # Tiptap JSON → markup
│   │   ├── commands/
│   │   │   ├── command-definitions.ts
│   │   │   └── command-executor.ts
│   │   ├── image/
│   │   │   ├── paste-handler.ts
│   │   │   └── image-store.ts
│   │   └── io/
│   │       └── file-handler.ts       # File System Access API
│   ├── store/
│   │   ├── editor-store.ts           # Zustand: doc, focus, viewMode
│   │   └── use-history.ts            # Undo/Redo 中间件
│   ├── components/
│   │   ├── grid/
│   │   │   ├── Grid.tsx              # 主网格 + TanStack Virtual
│   │   │   ├── GridRow.tsx           # 单行渲染
│   │   │   └── ColumnResizer.tsx     # 列宽拖拽
│   │   ├── cell/
│   │   │   ├── Cell.tsx              # 单元格包装（切换渲染/编辑）
│   │   │   ├── CellEditor.tsx        # Tiptap 富文本编辑器
│   │   │   ├── CellRenderer.tsx      # 格式化 HTML 渲染
│   │   │   ├── TodoCheckbox.tsx      # Todo 复选框
│   │   │   ├── ImageRenderer.tsx     # 图片+拖拽缩放
│   │   │   └── IndentIndicator.tsx   # 缩进指示器
│   │   ├── toolbar/
│   │   │   ├── FloatingToolbar.tsx   # 选中文本浮动工具栏
│   │   │   ├── TopToolbar.tsx        # 顶部简化 Ribbon
│   │   │   └── CopyButton.tsx        # 一键复制 Tab-ML
│   │   ├── source/
│   │   │   ├── SourceView.tsx        # Monaco 源码视图
│   │   │   └── tabml-language.ts     # Monarch 语法高亮定义
│   │   ├── commands/
│   │   │   └── SlashCommandPalette.tsx
│   │   └── layout/
│   │       ├── AppShell.tsx
│   │       └── ModeToggle.tsx
│   ├── hooks/
│   │   ├── use-keyboard-navigation.ts
│   │   ├── use-column-resize.ts
│   │   ├── use-format-shortcuts.ts
│   │   ├── use-indentation.ts
│   │   ├── use-image-resize.ts
│   │   ├── use-mode-sync.ts
│   │   └── use-undo-redo.ts
│   └── styles/
│       ├── index.css
│       ├── grid.css
│       └── editor.css
└── tests/
    ├── unit/
    └── e2e/
```

---

## 四、开发阶段

### Task 1: 项目初始化 (Phase 0)
**文件**: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`
- `npm create vite@latest . -- --template react-ts`
- 安装依赖: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/core`, `@tiptap/pm`, `@tanstack/react-virtual`, `@monaco-editor/react`, `zustand`, `tailwindcss`
- 建立目录结构
- 配置 Vitest + ESLint + Prettier

### Task 2: Tab-ML 类型系统 + Parser/Serializer (Phase 1 核心)
**文件**: `src/types/tabml.ts`, `src/core/tabml/parser.ts`, `src/core/tabml/serializer.ts`, `src/core/tabml/renderer.ts`
- 定义 `TabMLDocument`, `TabMLRow`, `TabMLCell`, `InlineContent`, `Mark` 类型
- Parser: 纯函数，处理 frontmatter、行分割、缩进、内联格式正则
- Serializer: Parser 逆操作
- Renderer: markup → HTML（用于非编辑状态的单元格显示）
- **关键**: 编写 round-trip 测试 `serialize(parse(text)) === text`

### Task 3: Zustand Store + 基础 Grid (Phase 1 视图)
**文件**: `src/store/editor-store.ts`, `src/components/grid/Grid.tsx`, `src/components/grid/GridRow.tsx`, `src/components/cell/Cell.tsx`
- Store: `{ document, focus: {row,col,editing}, viewMode, columnWidths, sourceText }`
- Grid: HTML `<table>` + TanStack Virtual 虚拟行
- Cell: 双状态组件（editing=false → CellRenderer, editing=true → contenteditable div）
- 空行渲染为加宽间距分隔符

### Task 4: 键盘导航 + 列宽调整 (Phase 1 交互)
**文件**: `src/hooks/use-keyboard-navigation.ts`, `src/components/grid/ColumnResizer.tsx`, `src/hooks/use-column-resize.ts`
- `Tab` → 下一列（行末→下一行首列；col=0 且在行首→增加缩进）
- `Shift+Tab` → 上一列（col=0→减少缩进）
- `Enter` → 下一行同列（col=0 非编辑→进入编辑；编辑中→插入新行）
- `Escape` → 退出编辑
- `ArrowUp/Down` → 跨行保持列
- 列宽拖拽 + 双击自适应

### Task 5: 纯文本单元格编辑 + 文件 I/O (Phase 1 完成)
**文件**: `src/components/cell/CellEditor.tsx`, `src/core/io/file-handler.ts`
- 双击或 Enter 进入编辑，Escape/blur 退出
- 编辑时 contenteditable div，退出时序列化回 markup
- File System Access API 打开/保存 `.tab.md` 文件
- **Phase 1 交付**: 可用的纯文本表格编辑器

### Task 6: Tiptap 富文本 + 自定义 Marks (Phase 2)
**文件**: `src/core/format/marks/*.ts`, `src/core/format/cell-editor-config.ts`, `src/core/format/markup-to-tiptap.ts`, `src/core/format/tiptap-to-markup.ts`
- 自定义 Tiptap Marks: Highlight(`!!`), NewModified(`++`), SemanticColor(`[color]`)
- 自定义 Tiptap Node: TodoNode(`[ ]/[x]/[?]`)
- markup ↔ Tiptap JSON 双向转换
- CellEditor 升级为 Tiptap 实例（仅活跃单元格实例化）

### Task 7: 工具栏 + 斜杠命令 + 快捷键 (Phase 2)
**文件**: `src/components/toolbar/TopToolbar.tsx`, `src/components/toolbar/FloatingToolbar.tsx`, `src/components/commands/SlashCommandPalette.tsx`, `src/hooks/use-format-shortcuts.ts`
- 顶部工具栏: 格式按钮 + 颜色选择 + Todo 切换 + 标题级别
- 浮动工具栏: 选中文本时弹出，定位在选区上方
- 斜杠命令: 输入 `/` 弹出菜单，支持关键字筛选
- 快捷键: `Ctrl+B/S/H/M` 格式切换

### Task 8: 缩进 + Todo + Heading + Undo/Redo (Phase 2 完成)
**文件**: `src/hooks/use-indentation.ts`, `src/components/cell/TodoCheckbox.tsx`, `src/components/cell/CellRenderer.tsx`, `src/store/use-history.ts`
- Tab at col=0 增加缩进，Shift+Tab 减少
- Todo 复选框点击切换状态
- Heading 行特殊渲染（大字号+粗体）
- Undo/Redo 基于 document 快照
- **Phase 2 交付**: 完整 WYSIWYG 编辑器

### Task 9: Monaco 源码视图 + 双模式同步 (Phase 3)
**文件**: `src/components/source/SourceView.tsx`, `src/components/source/tabml-language.ts`, `src/hooks/use-mode-sync.ts`, `src/components/layout/ModeToggle.tsx`
- Monaco Editor 延迟加载（仅切换到源码模式时 `import()`）
- Monarch 语法高亮: frontmatter、标记、缩进、Todo、颜色
- 双向同步: edit→source (serialize, 300ms debounce), source→edit (parse, 500ms debounce)
- 一键复制 Tab-ML 全文
- **Phase 3 交付**: 双模式完整编辑器

### Task 10: 图片粘贴 + 渲染 + 缩放 (Phase 3)
**文件**: `src/core/image/paste-handler.ts`, `src/core/image/image-store.ts`, `src/components/cell/ImageRenderer.tsx`, `src/hooks/use-image-resize.ts`
- `Ctrl+V` 检测剪贴板图片 → 保存到 images/ 目录 → 插入 markup
- 渲染 `<img>` + 拖拽边角调整大小
- 双击恢复原始尺寸

### Task 11: 打磨与生产就绪 (Phase 4)
**文件**: 各组件 CSS 优化、性能调优
- 空行分隔符视觉优化（淡灰色分隔线）
- 缩进连接线（树状结构视觉提示）
- 大文档性能优化（>1000 行）
- AI Copy 格式优化
- 可访问性 (a11y) 审计
- E2E 测试 (Playwright)
- **Phase 4 交付**: 生产就绪的 PRD 写作工具

---

## 五、关键接口定义

```typescript
// src/types/tabml.ts
interface TabMLDocument {
  frontmatter: Record<string, any>;
  rows: TabMLRow[];
}

interface TabMLRow {
  indent: number;           // 0-4
  cells: TabMLCell[];
  isEmpty: boolean;         // true = 分隔行
}

interface TabMLCell {
  heading?: 1 | 2 | 3;     // # / ## / ###
  todo?: 'uncheck' | 'check' | 'question';
  content: InlineContent[]; // 富文本内容
  image?: { src: string; width?: number; height?: number };
}

type InlineContent = TextRun | ImageRef;

interface TextRun {
  type: 'text';
  text: string;
  marks?: Mark[];
}

type Mark =
  | { type: 'bold' }
  | { type: 'strikethrough' }
  | { type: 'highlight' }
  | { type: 'modified' }
  | { type: 'color'; attrs: { color: string } };

// src/store/editor-store.ts
interface EditorStore {
  document: TabMLDocument;
  focus: { row: number; col: number; editing: boolean };
  viewMode: 'wysiwyg' | 'source';
  columnWidths: number[];
  sourceText: string;

  // Actions
  setDocument: (doc: TabMLDocument) => void;
  updateCell: (row: number, col: number, cell: TabMLCell) => void;
  setFocus: (focus: EditorStore['focus']) => void;
  setViewMode: (mode: 'wysiwyg' | 'source') => void;
  insertRow: (after: number) => void;
  deleteRow: (index: number) => void;
  indentRow: (index: number, delta: 1 | -1) => void;
  setColumnWidth: (col: number, width: number) => void;
}
```

---

## 六、风险矩阵与缓解

| 风险 | 等级 | 缓解 | 降级方案 |
|------|------|------|---------|
| Tiptap 多实例性能 | **高** | 仅活跃单元格实例化，非活跃渲染纯 HTML | 替换为自定义 contenteditable |
| 双向同步丢数据 | **高** | Document 为唯一真相源 + round-trip 测试 | 源码模式改只读 |
| 键盘导航与编辑冲突 | **中** | 明确 navigation/editing 两态切换 | F2 进入编辑(Excel 风格) |
| contenteditable 粘贴污染 | **中** | 拦截 paste，Tiptap 内置过滤 | 粘贴为纯文本 |
| Monaco 包体积 ~2MB | **低** | 动态 import() 延迟加载 | 替换为 CodeMirror 6 |
| 虚拟滚动 + 焦点协调 | **中** | 导航前 scrollIntoView | 小文档禁用虚拟化 |

---

## 七、被拒绝的替代方案

| 方案 | 拒绝理由 |
|------|---------|
| **ProseMirror 直接使用** | API 过于底层，开发效率低，学习曲线陡峭。Tiptap 是其上层封装，更务实 |
| **Canvas 渲染** | 富文本渲染在 Canvas 上工程量巨大，IME 兼容极难处理，严重过度工程化 |
| **Handsontable / AG Grid** | 单元格不支持真正富文本编辑，商业许可限制 |
| **Slate.js** | 稳定性差，API 频繁变动，表格支持薄弱 |
| **Lexical (Meta)** | 表格支持基础，生态年轻 |
| **Redux** | 项目规模不需要，Zustand 更简洁 |

---

## 八、交付时间线

| 阶段 | 周期 | 交付物 |
|------|------|--------|
| **Phase 1 MVP** | 2 周 | 纯文本网格编辑器 + Tab-ML 文件读写 + Tab 导航 |
| **Phase 2 富文本** | 2 周 | 所有格式 WYSIWYG + 工具栏 + 斜杠命令 + Undo/Redo |
| **Phase 3 双模式** | 2 周 | Monaco 源码视图 + 图片 + 双向同步 + 一键复制 |
| **Phase 4 打磨** | 2 周 | 视觉优化 + 性能 + a11y + 生产就绪 |
