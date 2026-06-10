/**
 * TabBar 标签栏组件
 * 显示打开的文档标签，支持新建、关闭、切换
 */
import { useEditorStore } from '../../store/editor-store';

export default function TabBar() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const switchTab = useEditorStore((s) => s.switchTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const addTab = useEditorStore((s) => s.addTab);

  const handleTabClick = (id: string) => {
    switchTab(id);
  };

  const handleTabClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const tab = tabs.find((t) => t.id === id);
    if (tab?.isDirty) {
      const ok = window.confirm(`"${tab.title}" 有未保存的修改，确定关闭吗？`);
      if (!ok) return;
    }
    closeTab(id);
  };

  const handleTabAuxClick = (e: React.MouseEvent, id: string) => {
    // 中键关闭
    if (e.button === 1) {
      e.preventDefault();
      handleTabClose(e, id);
    }
  };

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'tab-active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
            onAuxClick={(e) => handleTabAuxClick(e, tab.id)}
          >
            <span className="tab-title">
              {tab.isDirty && <span className="tab-dirty-dot" />}
              {tab.title}
            </span>
            <button
              className="tab-close-btn"
              onClick={(e) => handleTabClose(e, tab.id)}
              title="关闭标签"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="tab-add-btn" onClick={() => addTab()} title="新建标签">
        +
      </button>
    </div>
  );
}
