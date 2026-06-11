# PRD Writer

像 Excel 一样自由排版，像 Markdown 一样纯粹结构，但比两者都更 AI 友好。

PRD Writer 是一款基于 Tab-ML 格式的桌面文档编辑器，专为产品需求文档 (PRD) 设计。它将表格的结构化排版与富文本编辑能力结合，同时保持纯文本的简洁性和 AI 可读性。

## 功能特性

- **Tab-ML 格式** — 自定义的纯文本标记语言，用 Tab 分列、空格缩进、Markdown 风格内联语法
- **富文本编辑** — 基于 Tiptap 的 WYSIWYG 编辑，支持粗体、删除线、高亮、语义颜色等
- **Excel 导入** — 支持单文件和批量文件夹导入 `.xlsx` / `.xls` / `.xlsm` / `.csv`
- **工作区管理** — 左侧文件树浏览，多标签页编辑，自动保存
- **键盘导航** — Excel 风格的 Tab/Enter/Arrow 导航，快捷键格式化
- **Electron 桌面应用** — 原生窗口体验，支持文件关联和拖拽打开

## Tab-ML 语法速览

```
---
title: 搜索功能 PRD
columns: [需求, 描述, 优先级, 状态]
---
# 搜索功能 PRD
## 1. 背景与目标
	当前搜索体验差	P0	!!紧急!!
	提升搜索准确率和速度	P0	未开始

## 2. 需求列表
	[ ] 全文搜索	++新增++	P0
	[x] 搜索历史记录	已完成
		[x] 本地存储方案
```

**内联格式：**

| 语法 | 效果 | 快捷键 |
|------|------|--------|
| `**text**` | 粗体 | `Ctrl+B` |
| `~~text~~` | 删除线 | `Ctrl+Shift+S` |
| `!!text!!` | 黄色高亮 | `Ctrl+Shift+H` |
| `++text++` | 绿色标记 | `Ctrl+Shift+M` |
| `[red]text[/red]` | 语义颜色 | 斜杠命令 |

**单元格属性：** `# ` / `## ` / `### ` 标题前缀，`[ ]` / `[x]` / `[?]` Todo 状态

## 技术栈

| 层级 | 技术 |
|------|------|
| 构建 | Vite 6 |
| 框架 | React 18 + TypeScript 5 |
| 单元格编辑 | Tiptap 2 |
| 虚拟滚动 | TanStack Virtual 3 |
| 状态管理 | Zustand 5 |
| Excel 解析 | SheetJS (xlsx) |
| 桌面打包 | Electron |

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（浏览器）
npm run dev

# 启动 Electron 开发模式
npm run electron:dev

# 构建 + 打包 Windows 安装程序
npm run electron:build
```

## 项目结构

```
src/
├── main.tsx                    # 入口
├── App.tsx                     # 根组件
├── types/tabml.ts              # TabMLDocument 核心类型
├── constants/format.ts         # 格式常量
├── core/
│   ├── tabml/                  # Tab-ML 引擎
│   │   ├── parser.ts           # 文本 → 文档
│   │   ├── serializer.ts       # 文档 → 文本
│   │   └── renderer.ts         # 单元格 → HTML
│   ├── format/                 # Tiptap 富文本配置
│   │   ├── marks/              # 自定义 Mark（高亮/颜色等）
│   │   ├── markup-to-tiptap.ts # markup → Tiptap JSON
│   │   └── tiptap-to-markup.ts # Tiptap JSON → markup
│   ├── excel/importer.ts       # Excel 导入
│   ├── workspace/              # 工作区文件树
│   ├── io/file-handler.ts      # 文件读写
│   └── keyboard/shortcuts.ts   # 快捷键
├── store/editor-store.ts       # Zustand 全局状态
├── components/
│   ├── layout/AppShell.tsx     # 主布局
│   ├── grid/                   # 网格视图（虚拟滚动）
│   ├── cell/                   # 单元格（渲染/编辑切换）
│   ├── toolbar/                # 工具栏
│   └── workspace/              # 侧边栏
├── hooks/                      # 自定义 Hooks
└── styles/                     # 样式
electron/
├── main.cjs                    # Electron 主进程
├── preload.cjs                 # 预加载脚本
└── icon.png                    # 应用图标
```

## 设计原则

1. **TabMLDocument 为唯一真相源** — 所有视图从 document 派生，避免状态不一致
2. **惰性 Tiptap** — 仅活跃编辑单元格实例化 Tiptap，非活跃单元格渲染纯 HTML
3. **导航/编辑分离** — 明确区分 navigation mode（Tab/Arrow 跳转）和 edit mode（Enter/双击进入，Escape 退出）

## 许可

MIT
