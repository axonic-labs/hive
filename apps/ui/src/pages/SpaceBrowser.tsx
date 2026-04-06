import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface FileEntry {
  id: string;
  path: string;
  filename: string;
  created_at: string;
  updated_at: string;
}

export function SpaceBrowser() {
  const { space, '*': pathParam } = useParams();
  const currentPath = pathParam || '';
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [showCreate, setShowCreate] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    const prefix = currentPath ? `?prefix=${currentPath}` : '';
    const data = await apiGet<FileEntry[]>(`/data/${space}/files${prefix}`);
    setEntries(data);
  };

  useEffect(() => { load(); }, [space, currentPath]);

  // Group into folders and files at current level
  const folders = new Set<string>();
  const files: FileEntry[] = [];

  entries.forEach(entry => {
    if (entry.filename === '.keep') {
      const folderPath = entry.path;
      if (currentPath) {
        if (folderPath.startsWith(currentPath + '/')) {
          const relative = folderPath.slice(currentPath.length + 1);
          if (!relative.includes('/')) folders.add(relative);
        }
      } else {
        if (!folderPath.includes('/')) folders.add(folderPath);
      }
      return;
    }

    const entryFullPath = entry.path ? `${entry.path}/${entry.filename}` : entry.filename;
    const relativePath = currentPath
      ? entryFullPath.startsWith(currentPath + '/') ? entryFullPath.slice(currentPath.length + 1) : null
      : entryFullPath;

    if (relativePath === null) return;

    const parts = relativePath.split('/');
    if (parts.length === 1) {
      files.push(entry);
    } else {
      folders.add(parts[0]);
    }
  });

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiPost(`/data/${space}/files`, {
        path: currentPath,
        filename: newName.endsWith('.md') ? newName : newName + '.md',
        content: '',
      });
      setNewName('');
      setShowCreate(null);
      load();
    } catch (err: unknown) {
      setError((err as { error?: string })?.error || 'Failed to create file');
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const folderPath = currentPath ? `${currentPath}/${newName}` : newName;
      await apiPost(`/data/${space}/files`, {
        path: folderPath,
        filename: '.keep',
        content: '',
      });
      setNewName('');
      setShowCreate(null);
      load();
    } catch (err: unknown) {
      setError((err as { error?: string })?.error || 'Failed to create folder');
    }
  };

  const handleDeleteFile = async (file: FileEntry) => {
    const filePath = file.path ? `${file.path}/${file.filename}` : file.filename;
    await apiDelete(`/data/${space}/files/${filePath}`);
    load();
  };

  const handleDeleteFolder = async (folderName: string) => {
    const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    await apiDelete(`/data/${space}/folders/${folderPath}`);
    load();
  };

  const pathParts = currentPath ? currentPath.split('/') : [];

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fade-in">
      {/* Breadcrumbs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 20,
        fontFamily: 'var(--mono)',
        fontSize: 13,
      }}>
        <span
          style={{ color: 'var(--accent-text)', cursor: 'pointer' }}
          onClick={() => navigate('/spaces')}
        >
          spaces
        </span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span
          style={{ color: currentPath ? 'var(--accent-text)' : 'var(--text-primary)', cursor: currentPath ? 'pointer' : 'default' }}
          onClick={() => currentPath && navigate(`/spaces/${space}`)}
        >
          {space}
        </span>
        {pathParts.map((part, i) => {
          const fullPath = pathParts.slice(0, i + 1).join('/');
          const isLast = i === pathParts.length - 1;
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span
                style={{
                  color: isLast ? 'var(--text-primary)' : 'var(--accent-text)',
                  cursor: isLast ? 'default' : 'pointer',
                }}
                onClick={() => !isLast && navigate(`/spaces/${space}/${fullPath}`)}
              >
                {part}
              </span>
            </span>
          );
        })}
      </div>

      {/* Actions */}
      <div className="page-header">
        <h1 className="page-title" style={{ fontSize: 16 }}>
          {currentPath ? pathParts[pathParts.length - 1] : space}
        </h1>
        {user?.is_admin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => { setShowCreate(showCreate === 'folder' ? null : 'folder'); setError(''); }}>
              + Folder
            </button>
            <button className="btn btn-accent btn-sm" onClick={() => { setShowCreate(showCreate === 'file' ? null : 'file'); setError(''); }}>
              + File
            </button>
          </div>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={showCreate === 'file' ? handleCreateFile : handleCreateFolder}
          className="card"
          style={{ marginBottom: 16 }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="label">{showCreate === 'file' ? 'Filename' : 'Folder name'}</label>
              <input
                className="input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={showCreate === 'file' ? 'entry.md' : 'journal'}
                autoFocus
                required
              />
            </div>
            <button type="submit" className="btn btn-accent btn-sm">Create</button>
          </div>
          {error && (
            <div style={{ color: 'var(--danger)', fontFamily: 'var(--mono)', fontSize: 12, marginTop: 8 }}>
              {error}
            </div>
          )}
        </form>
      )}

      {/* File listing */}
      <div style={{ display: 'grid', gap: 1 }}>
        {currentPath && (
          <Row
            icon="↩"
            name=".."
            onClick={() => {
              const parent = pathParts.slice(0, -1).join('/');
              navigate(`/spaces/${space}${parent ? '/' + parent : ''}`);
            }}
          />
        )}

        {[...folders].sort().map(folder => (
          <Row
            key={folder}
            icon="▸"
            name={folder}
            isFolder
            canDelete={user?.is_admin}
            onClick={() => {
              const path = currentPath ? `${currentPath}/${folder}` : folder;
              navigate(`/spaces/${space}/${path}`);
            }}
            onDelete={() => handleDeleteFolder(folder)}
          />
        ))}

        {files.sort((a, b) => a.filename.localeCompare(b.filename)).map(file => (
          <Row
            key={file.id}
            icon="◇"
            name={file.filename}
            meta={formatDate(file.updated_at)}
            canDelete={user?.is_admin}
            onClick={() => {
              const filePath = file.path ? `${file.path}/${file.filename}` : file.filename;
              navigate(`/spaces/${space}/edit/${filePath}`);
            }}
            onDelete={() => handleDeleteFile(file)}
          />
        ))}

        {folders.size === 0 && files.length === 0 && !currentPath && (
          <div className="empty-state">
            This space is empty. Create a file or folder to get started.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, name, meta, isFolder, canDelete, onClick, onDelete }: {
  icon: string;
  name: string;
  meta?: string;
  isFolder?: boolean;
  canDelete?: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setRemoving(true);
    // Animate out
    if (rowRef.current) {
      rowRef.current.style.transition = 'all 0.25s ease-out';
      rowRef.current.style.opacity = '0';
      rowRef.current.style.maxHeight = '0';
      rowRef.current.style.padding = '0 14px';
      rowRef.current.style.overflow = 'hidden';
    }
    setTimeout(() => onDelete?.(), 250);
  };

  return (
    <div
      ref={rowRef}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        maxHeight: 50,
        cursor: 'pointer',
        borderRadius: 'var(--radius)',
        transition: 'background 0.1s',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative',
      }}
      onMouseOver={e => {
        e.currentTarget.style.background = 'var(--bg-surface)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = 'transparent';
        if (!removing) setConfirmDelete(false);
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: isFolder ? 'var(--accent)' : 'var(--text-muted)',
          width: 14,
          textAlign: 'center',
        }}>
          {icon}
        </span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 13,
          fontWeight: isFolder ? 500 : 400,
          color: isFolder ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}>
          {name}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {meta && !confirmDelete && (
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}>
            {meta}
          </span>
        )}

        {canDelete && (
          confirmDelete ? (
            <span
              onClick={handleDelete}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--danger)',
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--danger-bg)',
                border: '1px solid rgba(196, 72, 62, 0.25)',
                cursor: 'pointer',
                animation: 'fadeIn 0.12s ease-out',
                whiteSpace: 'nowrap',
              }}
            >
              {isFolder ? 'delete folder + contents?' : 'delete?'}
            </span>
          ) : (
            <span
              onClick={handleDelete}
              className="row-delete-btn"
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--text-muted)',
                padding: '0 4px',
                cursor: 'pointer',
                opacity: 0,
                transition: 'opacity 0.1s, color 0.1s',
                lineHeight: 1,
              }}
            >
              ×
            </span>
          )
        )}
      </div>
    </div>
  );
}
