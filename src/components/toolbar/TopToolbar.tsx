/**
 * 顶部工具栏 — 格式按钮始终可见
 * 非编辑态：直接修改整个格子格式；编辑态：通过快捷键
 */
import { useEditorStore, type FormatType } from '../../store/editor-store';

export default function TopToolbar() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const focus = useEditorStore((s) => s.focus);
  const document = useEditorStore((s) => s.document);
  const updateCell = useEditorStore((s) => s.updateCell);
  const toggleGridLines = useEditorStore((s) => s.toggleGridLines);
  const showGridLines = useEditorStore((s) => s.showGridLines);
  const sourceText = useEditorStore((s) => s.sourceText);
  const applyFormat = useEditorStore((s) => s.applyFormat);
  const fontSize = useEditorStore((s) => s.fontSize);
  const setFontSize = useEditorStore((s) => s.setFontSize);

  if (viewMode !== 'wysiwyg') return null;

  const currentRow = document.rows[focus.row];
  const currentCell = currentRow?.cells[focus.col];

  const toggleHeading = (level: 1 | 2 | 3) => {
    if (!currentCell) return;
    const newHeading = currentCell.heading === level ? undefined : level;
    updateCell(focus.row, focus.col, { ...currentCell, heading: newHeading });
  };

  const toggleTodo = (state: 'uncheck' | 'check' | 'question') => {
    if (!currentCell) return;
    const newTodo = currentCell.todo === state ? undefined : state;
    updateCell(focus.row, focus.col, { ...currentCell, todo: newTodo });
  };

  const handleFormat = (format: FormatType) => {
    if (focus.editing) {
      // 编辑中：提示快捷键
      console.log(`快捷键: 在编辑中的格子内使用对应快捷键`);
    } else {
      // 非编辑态：应用到整个格子
      applyFormat(format);
    }
  };

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(sourceText);
    } catch {
      // fallback
    }
  };

  return (
    <div className="top-toolbar">
      {/* 标题 */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${currentCell?.heading === 1 ? 'active' : ''}`}
          onClick={() => toggleHeading(1)}
          title="标题1"
        >
          H1
        </button>
        <button
          className={`toolbar-btn ${currentCell?.heading === 2 ? 'active' : ''}`}
          onClick={() => toggleHeading(2)}
          title="标题2"
        >
          H2
        </button>
        <button
          className={`toolbar-btn ${currentCell?.heading === 3 ? 'active' : ''}`}
          onClick={() => toggleHeading(3)}
          title="标题3"
        >
          H3
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Todo */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${currentCell?.todo === 'uncheck' ? 'active' : ''}`}
          onClick={() => toggleTodo('uncheck')}
          title="待办"
        >
          ☐
        </button>
        <button
          className={`toolbar-btn ${currentCell?.todo === 'check' ? 'active' : ''}`}
          onClick={() => toggleTodo('check')}
          title="已完成"
        >
          ☑
        </button>
        <button
          className={`toolbar-btn ${currentCell?.todo === 'question' ? 'active' : ''}`}
          onClick={() => toggleTodo('question')}
          title="待确认"
        >
          ?
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* 内联格式 */}
      <div className="toolbar-group">
        <button className="toolbar-btn" title="加粗 (Ctrl+B)" onClick={() => handleFormat('bold')}>
          <strong>B</strong>
        </button>
        <button className="toolbar-btn" title="废弃 (Ctrl+D)" onClick={() => handleFormat('strikethrough')}>
          <s>S</s>
        </button>
        <button className="toolbar-btn" title="警告 (Ctrl+K)" onClick={() => handleFormat('warning')}>
          <span style={{ color: '#dc2626', fontWeight: 'bold' }}>!</span>
        </button>
        <button className="toolbar-btn" title="新增/修改 (Ctrl+M)" onClick={() => handleFormat('modified')}>
          <span style={{ background: '#dcfce7', padding: '0 2px' }}>+</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* 语义颜色 */}
      <div className="toolbar-group">
        <button className="toolbar-btn toolbar-color-red" title="强调-红色" onClick={() => handleFormat('color-red')}>
          R
        </button>
        <button className="toolbar-btn toolbar-color-green" title="说明-绿色" onClick={() => handleFormat('color-green')}>
          G
        </button>
        <button className="toolbar-btn toolbar-color-blue" title="参数-蓝色" onClick={() => handleFormat('color-blue')}>
          B
        </button>
        <button className="toolbar-btn toolbar-color-gray" title="次要-灰色" onClick={() => handleFormat('color-gray')}>
          ⊘
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* 工具 */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${showGridLines ? 'active' : ''}`}
          onClick={toggleGridLines}
          title="网格线"
        >
          ⊞
        </button>
        <button className="toolbar-btn" onClick={copySource} title="复制源码">
          📋
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* 字号 */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => setFontSize(fontSize - 1)}
          title="缩小字号"
          disabled={fontSize <= 10}
        >
          A-
        </button>
        <span className="font-size-display">{fontSize}px</span>
        <button
          className="toolbar-btn"
          onClick={() => setFontSize(fontSize + 1)}
          title="放大字号"
          disabled={fontSize >= 32}
        >
          A+
        </button>
      </div>
    </div>
  );
}
