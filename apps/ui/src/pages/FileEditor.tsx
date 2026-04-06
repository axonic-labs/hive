import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGetText, apiPutText } from '../api/client';

export function FileEditor() {
  const { space, '*': filePath } = useParams();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

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
    // Tab inserts spaces
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

  const isDirty = content !== originalContent;
  const pathParts = filePath?.split('/') || [];
  const filename = pathParts[pathParts.length - 1];
  const folderPath = pathParts.slice(0, -1).join('/');

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
          <button
            className="btn btn-accent btn-sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor */}
      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <textarea
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
        ⌘S to save
      </div>
    </div>
  );
}
