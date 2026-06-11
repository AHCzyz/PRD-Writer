import { useState } from 'react';
import { useEditorStore } from '../../store/editor-store';
import {
  openWorkspace,
  readWorkspaceFile,
} from '../../core/io/file-handler';
import {
  type WorkspaceDescriptor,
  type WorkspaceNode,
} from '../../core/workspace/workspace-tree';

interface WorkspaceSidebarProps {
  onSaveActive: () => Promise<boolean>;
  onOpenFile: () => Promise<void>;
}

export default function WorkspaceSidebar({ onSaveActive, onOpenFile }: WorkspaceSidebarProps) {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const addTab = useEditorStore((s) => s.addTab);
  const switchTab = useEditorStore((s) => s.switchTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const openFileOrReplace = useEditorStore((s) => s.openFileOrReplace);
  const [workspace, setWorkspace] = useState<WorkspaceDescriptor | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState('选择一个目录作为工作区');
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const workspaceFilePaths = new Set(workspace ? flattenFilePaths(workspace.nodes) : []);
  const openDocumentTabs = tabs.filter((tab) => !tab.filePath || !workspaceFilePaths.has(tab.filePath));
  const dirtyPaths = new Set(
    tabs.filter((tab) => tab.filePath && tab.isDirty).map((tab) => tab.filePath as string)
  );

  const handleOpenWorkspace = async () => {
    setWorkspaceError(null);
    setWorkspaceStatus('正在扫描工作区...');

    try {
      const result = await openWorkspace({
        onRootSelected: (root) => {
          setWorkspace(root);
          setExpandedPaths(new Set([root.path]));
          setWorkspaceStatus('正在扫描工作区...');
        },
        onProgress: (count) => {
          setWorkspaceStatus(`正在扫描工作区... ${count} 项`);
        },
      });
      if (!result) {
        setWorkspaceStatus(workspace ? workspaceStatus : '选择一个目录作为工作区');
        return;
      }

      setWorkspace(result);
      setExpandedPaths(new Set([result.path, ...flattenDirectoryPaths(result.nodes)]));
      const fileCount = flattenFilePaths(result.nodes).length;
      setWorkspaceStatus(fileCount > 0 ? `${fileCount} 个文档` : '未找到支持的文档');
    } catch (err) {
      console.error('Failed to open workspace:', err);
      setWorkspaceError('工作区扫描失败');
      setWorkspaceStatus('请选择其他目录或检查权限');
    }
  };

  const handleCloseOpenDocument = (event: React.MouseEvent, tabId: string) => {
    event.stopPropagation();
    const tab = tabs.find((item) => item.id === tabId);
    if (tab?.isDirty && !window.confirm(`"${tab.title}" 有未保存的修改，确定关闭吗？`)) {
      return;
    }
    closeTab(tabId);
  };

  const handleOpenNode = async (node: WorkspaceNode) => {
    if (node.kind === 'directory') {
      setExpandedPaths((current) => {
        const next = new Set(current);
        if (next.has(node.path)) {
          next.delete(node.path);
        } else {
          next.add(node.path);
        }
        return next;
      });
      return;
    }

    setLoadingPath(node.path);
    try {
      const content = await readWorkspaceFile(node.path);
      openFileOrReplace(node.path, content);
    } catch (err) {
      console.error('Failed to open workspace file:', err);
      window.alert('打开工作区文件失败');
    } finally {
      setLoadingPath(null);
    }
  };

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-header">
        <div className="workspace-title">工作区</div>
        <button className="workspace-action" onClick={() => void handleOpenWorkspace()}>
          设置
        </button>
      </div>

      <div className="workspace-actions">
        <button className="workspace-action" onClick={() => addTab()}>
          新建
        </button>
        <button className="workspace-action" onClick={() => void onOpenFile()}>
          打开
        </button>
        <button className="workspace-action" onClick={() => void onSaveActive()}>
          保存
        </button>
      </div>

      {workspace ? (
        <div className="workspace-tree">
          <div className="workspace-root" title={workspace.path}>
            {workspace.name}
          </div>
          <div className={`workspace-status ${workspaceError ? 'error' : ''}`}>
            {workspaceError || workspaceStatus}
          </div>
          {workspace.nodes.length > 0 ? (
            workspace.nodes.map((node) => (
              <WorkspaceTreeNode
                key={node.path}
                node={node}
                depth={0}
                expandedPaths={expandedPaths}
                activePath={activeTab?.filePath ?? null}
                dirtyPaths={dirtyPaths}
                loadingPath={loadingPath}
                onOpen={handleOpenNode}
              />
            ))
          ) : (
            <div className="workspace-empty">没有可展开的子目录或文档</div>
          )}
        </div>
      ) : (
        <div className={`workspace-empty ${workspaceError ? 'error' : ''}`}>
          {workspaceError || workspaceStatus}
        </div>
      )}

      {openDocumentTabs.length > 0 && (
        <div className="workspace-open-docs">
          <div className="workspace-section-title">打开的文档</div>
          {openDocumentTabs.map((tab) => (
            <div
              key={tab.id}
              className={`workspace-open-doc ${tab.id === activeTabId ? 'active' : ''}`}
              title={tab.filePath || tab.title}
              onClick={() => switchTab(tab.id)}
            >
              <span className="workspace-node-icon">·</span>
              <span className="workspace-node-name">{tab.title}</span>
              {tab.isDirty && <span className="workspace-dirty-dot" />}
              <button
                className="workspace-close-doc"
                title="关闭"
                onClick={(event) => handleCloseOpenDocument(event, tab.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

interface WorkspaceTreeNodeProps {
  node: WorkspaceNode;
  depth: number;
  expandedPaths: Set<string>;
  activePath: string | null;
  dirtyPaths: Set<string>;
  loadingPath: string | null;
  onOpen: (node: WorkspaceNode) => void | Promise<void>;
}

function WorkspaceTreeNode({
  node,
  depth,
  expandedPaths,
  activePath,
  dirtyPaths,
  loadingPath,
  onOpen,
}: WorkspaceTreeNodeProps) {
  const expanded = node.kind === 'directory' && expandedPaths.has(node.path);
  const active = node.kind === 'file' && activePath === node.path;
  const dirty = node.kind === 'file' && dirtyPaths.has(node.path);
  const loading = loadingPath === node.path;

  return (
    <div className="workspace-node">
      <button
        className={`workspace-node-button ${active ? 'active' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        title={node.path}
        onClick={() => void onOpen(node)}
      >
        <span className="workspace-node-icon">
          {node.kind === 'directory' ? (expanded ? '▾' : '▸') : '·'}
        </span>
        <span className="workspace-node-name">{node.name}</span>
        {loading && <span className="workspace-node-meta">...</span>}
        {dirty && <span className="workspace-dirty-dot" />}
      </button>
      {node.kind === 'directory' && expanded && (
        <div>
          {node.children.map((child) => (
            <WorkspaceTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              activePath={activePath}
              dirtyPaths={dirtyPaths}
              loadingPath={loadingPath}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function flattenFilePaths(nodes: WorkspaceNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (node.kind === 'file') {
      result.push(node.path);
    } else {
      result.push(...flattenFilePaths(node.children));
    }
  }
  return result;
}

function flattenDirectoryPaths(nodes: WorkspaceNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (node.kind === 'directory') {
      result.push(node.path, ...flattenDirectoryPaths(node.children));
    }
  }
  return result;
}
