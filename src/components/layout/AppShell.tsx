/**
 * 应用主布局
 */
import { useEffect } from 'react';
import Grid from '../grid/Grid';
import TopToolbar from '../toolbar/TopToolbar';
import ModeToggle from '../layout/ModeToggle';
import { useEditorStore } from '../../store/editor-store';
import SourceView from '../source/SourceView';
import { openFile, saveFile } from '../../core/io/file-handler';

const DEMO_DOCUMENT = `---
title: 搜索功能 PRD
author: 产品团队
modified: 2026-06-09
columns: [需求, 描述, 优先级, 状态]
columnWidths: [160, 400, 80, 100]
---
# 搜索功能 PRD
## 1. 背景与目标
\t当前搜索体验差，[red]用户流失严重[/red]\tP0\t!!紧急!!
\t提升搜索准确率和速度\tP0\t未开始

## 2. 需求列表
\t[ ] 全文搜索\t++新增++ [green]基于 ES 实现[/green]\tP0
\t[ ] 搜索建议\t[blue]API: /api/suggest[/blue]\tP1
\t[x] 搜索历史记录\t已完成
\t\t[x] 本地存储方案\t[gray]后续可能迁移到云端[/gray]
\t[?] AI 语义搜索\t待评估\tP2

## 3. 参考
[blue]接口文档 v2.3[/blue]\t~~旧版设计~~ [red]需重新评估[/red]
`;

export default function AppShell() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const loadFromText = useEditorStore((s) => s.loadFromText);
  const sourceText = useEditorStore((s) => s.sourceText);
  const focus = useEditorStore((s) => s.focus);
  const document = useEditorStore((s) => s.document);

  // 启动时加载示例文档
  useEffect(() => {
    loadFromText(DEMO_DOCUMENT);
  }, [loadFromText]);

  const handleOpen = async () => {
    const result = await openFile();
    if (result) {
      loadFromText(result.content);
    }
  };

  const handleSave = async () => {
    await saveFile(sourceText, 'document.tab.md');
  };

  const currentRow = document.rows[focus.row];
  const indent = currentRow?.indent || 0;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">PRD Writer</h1>
          <ModeToggle />
          <div className="file-actions">
            <button className="toolbar-btn" onClick={handleOpen}>📂 打开</button>
            <button className="toolbar-btn" onClick={handleSave}>💾 保存</button>
          </div>
        </div>
        <TopToolbar />
      </header>
      <main className="app-main">
        {viewMode === 'wysiwyg' ? <Grid /> : <SourceView />}
      </main>
      <footer className="app-statusbar">
        <span className="status-item">
          {viewMode === 'wysiwyg' ? '编辑模式' : '源码模式'}
        </span>
        <span className="status-divider" />
        <span className="status-item">
          行 {focus.row + 1} / 列 {focus.col + 1}
          {indent > 0 && ` / 缩进 ${indent}`}
        </span>
        <span className="status-divider" />
        <span className="status-item">
          {document.rows.filter((r) => !r.isEmpty).length} 行数据
        </span>
        <span className="status-spacer" />
        <span className="status-item status-hints">
          <kbd>Tab</kbd> 下一格 <kbd>Enter</kbd> 下一行 <kbd>Shift+Enter</kbd> 格内换行{' '}
          <kbd>Ctrl+B</kbd> 粗体 <kbd>/</kbd> 命令
        </span>
      </footer>
    </div>
  );
}
