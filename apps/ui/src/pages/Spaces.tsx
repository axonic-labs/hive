import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface Space {
  name: string;
}

export function Spaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [dbUrl, setDbUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    const data = await apiGet<Space[]>('/admin/spaces');
    setSpaces(data);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await apiPost('/admin/spaces', { name, type: 'postgres', database_url: dbUrl });
      setName('');
      setDbUrl('');
      setShowCreate(false);
      load();
    } catch (err: unknown) {
      setError((err as { error?: string })?.error || 'Failed to create space');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (spaceName: string) => {
    if (!confirm(`Delete space "${spaceName}"? This drops the database table.`)) return;
    await apiDelete(`/admin/spaces/${spaceName}`);
    load();
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Spaces</h1>
        {user?.is_admin && (
          <button className="btn btn-accent" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : '+ New Space'}
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label className="label">Space name</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="notes"
                pattern="[a-z][a-z0-9_]*"
                required
              />
            </div>
            <div>
              <label className="label">Postgres connection string</label>
              <input
                className="input"
                value={dbUrl}
                onChange={e => setDbUrl(e.target.value)}
                placeholder="postgresql://user:pass@host:5432/dbname"
                required
              />
            </div>
            {error && (
              <div style={{ color: 'var(--danger)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-accent" disabled={creating}>
              {creating ? 'Creating...' : 'Create Space'}
            </button>
          </div>
        </form>
      )}

      {spaces.length === 0 && !showCreate ? (
        <div className="empty-state">
          No spaces yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {spaces.map((s, i) => (
            <div
              key={s.name}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                animationDelay: `${i * 50}ms`,
              }}
              onClick={() => navigate(`/spaces/${s.name}`)}
              onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 13,
                  color: 'var(--accent)',
                  opacity: 0.5,
                }}>⬡</span>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontWeight: 600,
                  fontSize: 14,
                }}>
                  {s.name}
                </span>
              </div>
              {user?.is_admin && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={e => { e.stopPropagation(); handleDelete(s.name); }}
                >
                  delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
