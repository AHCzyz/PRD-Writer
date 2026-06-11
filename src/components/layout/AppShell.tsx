/**
 * 应用主布局
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import Grid from '../grid/Grid';
import TopToolbar from '../toolbar/TopToolbar';
import { useEditorStore, type Tab } from '../../store/editor-store';
import {
  openExcelFile,
  openFile,
  saveFile,
  saveWorkspaceFile,
} from '../../core/io/file-handler';
import { commitActiveCellEditor } from '../cell/CellEditor';
import WorkspaceSidebar from '../workspace/WorkspaceSidebar';

export default function AppShell() {
  const focus = useEditorStore((s) => s.focus);
  const document = useEditorStore((s) => s.document);
  const openFileOrReplace = useEditorStore((s) => s.openFileOrReplace);
  const openImportedDocuments = useEditorStore((s) => s.openImportedDocuments);

  const [autoSave, setAutoSave] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const commitEditingCell = useCallback(() => {
    commitActiveCellEditor({ keepEditing: true, force: true });
  }, []);

  const saveTab = useCallback(async (tab: Tab): Promise<boolean> => {
    const api = (window as any).electronAPI;
    const state = useEditorStore.getState();

    if (tab.filePath && api?.saveFileToPath) {
      const ok = await api.saveFileToPath(tab.sourceText, tab.filePath);
      if (ok) {
        state.markTabDirty(tab.id, false);
      }
      return Boolean(ok);
    }

    if (tab.filePath) {
      const workspaceSaved = await saveWorkspaceFile(tab.filePath, tab.sourceText);
      if (workspaceSaved) {
        state.markTabDirty(tab.id, false);
        return true;
      }
    }

    const defaultName = tab.filePath
      ? tab.filePath.split(/[/\\]/).pop() || 'document.prd'
      : `${sanitizeFileName(tab.title || 'document')}.prd`;

    if (api?.saveFile) {
      const filePath = await api.saveFile(tab.sourceText, defaultName);
      if (!filePath) return false;
      state.setTabFilePath(tab.id, filePath);
      state.markTabDirty(tab.id, false);
      return true;
    }

    const saved = await saveFile(tab.sourceText, defaultName);
    if (saved) {
      state.markTabDirty(tab.id, false);
    }
    return saved;
  }, []);

  const saveDirtyTabs = useCallback(async (): Promise<boolean> => {
    commitEditingCell();
    const dirtyTabs = useEditorStore.getState().tabs.filter((t) => t.isDirty);
    for (const tab of dirtyTabs) {
      const ok = await saveTab(tab);
      if (!ok) return false;
    }
    return true;
  }, [commitEditingCell, saveTab]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    commitEditingCell();
    const state = useEditorStore.getState();
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!activeTab) return false;
    return saveTab(activeTab);
  }, [commitEditingCell, saveTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (autoSave) {
      autoSaveTimerRef.current = setInterval(() => {
        const state = useEditorStore.getState();
        const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
        if (activeTab?.isDirty && activeTab?.filePath) {
          void handleSave();
        }
      }, 30000);
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [autoSave, handleSave]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onCloseRequest) return;

    return api.onCloseRequest(async () => {
      commitEditingCell();
      const dirtyCount = useEditorStore.getState().tabs.filter((t) => t.isDirty).length;
      if (dirtyCount === 0) return true;

      const action = api.confirmUnsavedClose
        ? await api.confirmUnsavedClose(dirtyCount)
        : window.confirm('有未保存的修改，是否保存后关闭？')
          ? 'save'
          : 'discard';

      if (action === 'save') return saveDirtyTabs();
      if (action === 'discard') return true;
      return false;
    });
  }, [commitEditingCell, saveDirtyTabs]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.onOpenFileFromOS) {
      api.onOpenFileFromOS((data: { path: string; content: string }) => {
        openFileOrReplace(data.path, data.content);
      });
    }
  }, [openFileOrReplace]);

  const handleOpen = useCallback(async () => {
    const result = await openFile();
    if (result) {
      openFileOrReplace(result.name, result.content);
    }
  }, [openFileOrReplace]);

  const handleImportExcel = async () => {
    const result = await openExcelFile();
    if (!result) return;

    try {
      const { importExcelWorkbook } = await import('../../core/excel/importer');
      const sheets = importExcelWorkbook(result.data);
      if (sheets.length === 0) {
        window.alert('未找到可导入的工作表');
        return;
      }

      openImportedDocuments(
        sheets.map((sheet) => ({
          title: importedSheetTitle(result.name, sheet.name, sheets.length),
          document: sheet.document,
          columnWidths: sheet.columnWidths,
          filePath: null,
          isDirty: true,
        }))
      );
    } catch (err) {
      console.error('Failed to import Excel file:', err);
      window.alert('Excel 导入失败，请确认文件未损坏');
    }
  };

  const currentRow = document.rows[focus.row];
  const indent = currentRow?.indent || 0;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">PRD Writer</h1>
          <div className="file-actions">
            <button className="toolbar-btn" onClick={() => void handleImportExcel()}>导入Excel</button>
            <button className="toolbar-btn" onClick={handleOpen}>打开</button>
            <button className="toolbar-btn" onClick={() => void handleSave()}>保存</button>
            <label className="auto-save-label">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
              />
              自动保存
            </label>
          </div>
        </div>
        <TopToolbar />
      </header>
      <main className="app-main">
        <WorkspaceSidebar onSaveActive={handleSave} onOpenFile={handleOpen} />
        <section className="editor-main">
          <Grid />
        </section>
      </main>
      <footer className="app-statusbar">
        <span className="status-item">编辑模式</span>
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
          <kbd>Ctrl+S</kbd> 保存 <kbd>Tab</kbd> 下一格 <kbd>Enter</kbd> 下一行{' '}
          <kbd>Shift+Enter</kbd> 格内换行 <kbd>Ctrl+B</kbd> 粗体 <kbd>/</kbd> 命令
        </span>
      </footer>
    </div>
  );
}

function importedSheetTitle(fileName: string, sheetName: string, sheetCount: number): string {
  const base = fileName.replace(/\.[^.]+$/, '') || 'Excel';
  return sheetCount > 1 ? `${base} - ${sheetName}` : base;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  return cleaned || 'document';
}
