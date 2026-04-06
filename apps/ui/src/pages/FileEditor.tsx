import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGetText, apiPutText } from '../api/client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Mode = 'view' | 'edit';

export function FileEditor() {
  const { space, '*': filePath } = useParams();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<Mode>('view');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  const isMarkdown = filePath?.endsWith('.md') || filePath?.endsWith('.mdx');

  useEffect(() => {
    const load = async () => {
      try {
        const text = await apiGetText(`/data/${space}/files/${filePath}`);
        setContent(text);
        setOriginalContent(text);
      } catch {
        setContent('');
        setOriginalContent('');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [space, filePath]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPutText(`/data/${space}/files/${filePath}`, content);
      setOriginalContent(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      setContent(content.substring(0, start) + '  ' + content.substring(end));
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const switchToEdit = () => {
    setMode('edit');
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const switchToView = () => {
    setMode('view');
  };

  const isDirty = content !== originalContent;
  const pathParts = filePath?.split('/') || [];
  const filename = pathParts[pathParts.length - 1];
  const folderPath = pathParts.slice(0, -1).join('/');

  // Non-markdown files always show editor
  const showRendered = isMarkdown && mode === 'view';

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 96px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 13 }}>
          <span
            style={{ color: 'var(--accent-text)', cursor: 'pointer' }}
            onClick={() => navigate(`/spaces/${space}${folderPath ? '/' + folderPath : ''}`)}
          >
            ← back
          </span>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span style={{ color: 'var(--text-secondary)' }}>{filename}</span>
          {isDirty && <span style={{ color: 'var(--accent)', fontSize: 11 }}>● unsaved</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && (
            <span style={{ color: 'var(--success)', fontFamily: 'var(--mono)', fontSize: 12 }}>
              saved
            </span>
          )}

          {/* View/Edit toggle */}
          {isMarkdown && (
            <div style={{
              display: 'flex',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
            }}>
              <button
                onClick={switchToView}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontFamily: 'var(--mono)',
                  border: 'none',
                  cursor: 'pointer',
                  background: mode === 'view' ? 'var(--bg-hover)' : 'transparent',
                  color: mode === 'view' ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.12s',
                }}
              >
                view
              </button>
              <button
                onClick={switchToEdit}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontFamily: 'var(--mono)',
                  border: 'none',
                  borderLeft: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: mode === 'edit' ? 'var(--bg-hover)' : 'transparent',
                  color: mode === 'edit' ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.12s',
                }}
              >
                edit
              </button>
            </div>
          )}

          <button
            className="btn btn-accent btn-sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Content area */}
      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : showRendered ? (
        <div
          className="markdown-body"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '28px 32px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            cursor: 'text',
          }}
          onDoubleClick={switchToEdit}
        >
          {content ? (
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Empty file. Double-click or press edit to start writing.
            </p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          style={{
            flex: 1,
            width: '100%',
            padding: 20,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--mono)',
            fontSize: 13,
            lineHeight: 1.7,
            resize: 'none',
            outline: 'none',
            caretColor: 'var(--accent)',
          }}
        />
      )}

      {/* Footer hint */}
      <div style={{
        marginTop: 8,
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--text-muted)',
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {showRendered ? 'double-click to edit' : '⌘S to save'}
      </div>
    </div>
  );
}
