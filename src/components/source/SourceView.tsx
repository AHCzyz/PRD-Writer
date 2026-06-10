/**
 * 源码视图 (Monaco Editor)
 */
import { useCallback } from 'react';
import { useEditorStore } from '../../store/editor-store';

// 延迟加载 Monaco
import Editor from '@monaco-editor/react';

export default function SourceView() {
  const sourceText = useEditorStore((s) => s.sourceText);
  const syncFromSource = useEditorStore((s) => s.syncFromSource);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        syncFromSource(value);
      }
    },
    [syncFromSource]
  );

  return (
    <div className="source-view">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        value={sourceText}
        onChange={handleChange}
        theme="vs-dark"
        options={{
          fontSize: 14,
          fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
          lineNumbers: 'on',
          minimap: { enabled: false },
          wordWrap: 'on',
          tabSize: 4,
          insertSpaces: false,
          renderWhitespace: 'selection',
          scrollBeyondLastLine: false,
          padding: { top: 16 },
        }}
      />
    </div>
  );
}
