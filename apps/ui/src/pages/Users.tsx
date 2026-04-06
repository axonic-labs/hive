import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';

interface User {
  id: string;
  name: string;
  is_admin: boolean;
  created_at: string;
  api_key?: string;
}

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    const data = await apiGet<User[]>('/admin/users');
    setUsers(data);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = await apiPost<User>('/admin/users', { name });
    setCreatedKey(user.api_key!);
    setName('');
    setShowCreate(false);
    load();
  };

  const handleCopy = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = async (id: string, userName: string) => {
    if (!confirm(`Delete user "${userName}"?`)) return;
    await apiDelete(`/admin/users/${id}`);
    load();
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        <button className="btn btn-accent" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {/* API key reveal modal */}
      {createdKey && (
        <div className="card" style={{
          marginBottom: 20,
          borderColor: 'var(--accent)',
          background: 'var(--accent-glow)',
        }}>
          <div style={{ marginBottom: 8 }}>
            <span className="label" style={{ color: 'var(--accent-text)' }}>
              API Key — copy now, it won't be shown again
            </span>
          </div>
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}>
            <code style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--bg-base)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              wordBreak: 'break-all',
              color: 'var(--text-primary)',
            }}>
              {createdKey}
            </code>
            <button className="btn btn-sm" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="btn btn-sm" onClick={() => setCreatedKey(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="label">Username</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="journal-bot"
                autoFocus
                required
              />
            </div>
            <button type="submit" className="btn btn-accent">Create</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gap: 1 }}>
        {users.map((u, i) => (
          <div
            key={u.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius)',
              borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'background 0.1s',
              animationDelay: `${i * 30}ms`,
            }}
            onClick={() => navigate(`/users/${u.id}`)}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontFamily: 'var(--mono)',
                fontWeight: 500,
                fontSize: 14,
              }}>
                {u.name}
              </span>
              {u.is_admin && <span className="tag tag-accent">admin</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}>
                {new Date(u.created_at).toLocaleDateString()}
              </span>
              {!u.is_admin && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={e => { e.stopPropagation(); handleDelete(u.id, u.name); }}
                >
                  delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
