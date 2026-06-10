/**
 * 模式切换按钮
 */
import { useEditorStore } from '../../store/editor-store';

export default function ModeToggle() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);

  return (
    <div className="mode-toggle">
      <button
        className={`mode-btn ${viewMode === 'wysiwyg' ? 'active' : ''}`}
        onClick={() => setViewMode('wysiwyg')}
      >
        编辑
      </button>
      <button
        className={`mode-btn ${viewMode === 'source' ? 'active' : ''}`}
        onClick={() => setViewMode('source')}
      >
        源码
      </button>
    </div>
  );
}
