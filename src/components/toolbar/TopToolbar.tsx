/**
 * 顶部工具栏
 */
import type { ReactNode } from 'react';
import { useEditorStore, type FormatType } from '../../store/editor-store';

interface ToolbarButtonProps {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}

function ToolbarButton({
  label,
  title,
  active,
  disabled,
  className = '',
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      className={`toolbar-btn top-toolbar-btn ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      <span className="toolbar-icon">{children}</span>
      <span className="toolbar-label">{label}</span>
    </button>
  );
}

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
    if (!focus.editing) {
      applyFormat(format);
    }
  };

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(sourceText);
    } catch {
      // Clipboard access can be unavailable in some shells.
    }
  };

  return (
    <div className="top-toolbar">
      <div className="toolbar-group">
        <ToolbarButton
          label="标题1"
          title="标题1"
          active={currentCell?.heading === 1}
          onClick={() => toggleHeading(1)}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          label="标题2"
          title="标题2"
          active={currentCell?.heading === 2}
          onClick={() => toggleHeading(2)}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          label="标题3"
          title="标题3"
          active={currentCell?.heading === 3}
          onClick={() => toggleHeading(3)}
        >
          H3
        </ToolbarButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton
          label="待办"
          title="待办"
          active={currentCell?.todo === 'uncheck'}
          onClick={() => toggleTodo('uncheck')}
        >
          □
        </ToolbarButton>
        <ToolbarButton
          label="完成"
          title="完成"
          active={currentCell?.todo === 'check'}
          onClick={() => toggleTodo('check')}
        >
          ☑
        </ToolbarButton>
        <ToolbarButton
          label="确认"
          title="待确认"
          active={currentCell?.todo === 'question'}
          onClick={() => toggleTodo('question')}
        >
          ?
        </ToolbarButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton label="加粗" title="加粗 (Ctrl+B)" onClick={() => handleFormat('bold')}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton label="删除" title="删除线" onClick={() => handleFormat('strikethrough')}>
          <span className="format-swatch format-swatch-delete">
            <s>S</s>
          </span>
        </ToolbarButton>
        <ToolbarButton label="警告" title="警告" onClick={() => handleFormat('warning')}>
          <span className="format-swatch format-swatch-warning">!</span>
        </ToolbarButton>
        <ToolbarButton label="新增" title="新增/修改" onClick={() => handleFormat('modified')}>
          <span className="format-swatch format-swatch-modified">+</span>
        </ToolbarButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton label="强调" title="强调-红色" className="toolbar-color-red" onClick={() => handleFormat('color-red')}>
          R
        </ToolbarButton>
        <ToolbarButton label="说明" title="说明-绿色" className="toolbar-color-green" onClick={() => handleFormat('color-green')}>
          G
        </ToolbarButton>
        <ToolbarButton label="参数" title="参数/信息-蓝色" className="toolbar-color-blue" onClick={() => handleFormat('color-blue')}>
          B
        </ToolbarButton>
        <ToolbarButton label="次要" title="次要-灰色" className="toolbar-color-gray" onClick={() => handleFormat('color-gray')}>
          -
        </ToolbarButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton
          label="网格"
          title="网格线"
          active={showGridLines}
          onClick={toggleGridLines}
        >
          #
        </ToolbarButton>
        <ToolbarButton label="源码" title="复制源码" onClick={copySource}>
          ⧉
        </ToolbarButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton
          label="缩小"
          title="缩小字号"
          disabled={fontSize <= 10}
          onClick={() => setFontSize(fontSize - 1)}
        >
          A-
        </ToolbarButton>
        <span className="font-size-display">{fontSize}px</span>
        <ToolbarButton
          label="放大"
          title="放大字号"
          disabled={fontSize >= 32}
          onClick={() => setFontSize(fontSize + 1)}
        >
          A+
        </ToolbarButton>
      </div>
    </div>
  );
}
