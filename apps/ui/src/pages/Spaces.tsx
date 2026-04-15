import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { useAuth } from '../hooks/useAuth';

type Provider = 'git' | 'postgres';

interface Space {
  name: string;
  kind?: string;
  provider?: string;
}

export function Spaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<Provider>('git');
  const [dbUrl, setDbUrl] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    const data = await apiGet<Space[]>('/admin/spaces');
    setSpaces(data);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName('');
    setProvider('git');
    setDbUrl('');
    setRemoteUrl('');
    setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const body: Record<string, string> = { name, kind: 'files', provider };
      if (provider === 'postgres') {
        body.database_url = dbUrl;
      }
      if (provider === 'git' && remoteUrl) {
        body.remote_url = remoteUrl;
      }
      await apiPost('/admin/spaces', body);
      resetForm();
      setShowCreate(false);
      load();
    } catch (err: unknown) {
      setError((err as { error?: string })?.error || 'Failed to create space');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (spaceName: string) => {
    const space = spaces.find(s => s.name === spaceName);
    const msg = space?.provider === 'postgres'
      ? `Delete space "${spaceName}"? This drops the database table.`
      : `Delete space "${spaceName}"? This removes the git repository.`;
    if (!confirm(msg)) return;
    await apiDelete(`/admin/spaces/${spaceName}`);
    load();
  };

  const providerLabel = (p?: string) => {
    if (p === 'git') return 'git';
    if (p === 'postgres') return 'pg';
    return null;
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Spaces</h1>
        {user?.is_admin && (
          <button
            className="btn btn-accent"
            onClick={() => { setShowCreate(!showCreate); if (showCreate) resetForm(); }}
          >
            {showCreate ? 'Cancel' : '+ New Space'}
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Space name */}
            <div>
              <label className="label">Space name</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="notes"
                pattern="[a-z][a-z0-9_]*"
                autoFocus
                required
              />
            </div>

            {/* Provider selection */}
            <div>
              <label className="label">Storage</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <ProviderOption
                  selected={provider === 'git'}
                  onClick={() => setProvider('git')}
                  icon="⎇"
                  name="Git"
                  description="Files on disk, version history"
                />
                <ProviderOption
                  selected={provider === 'postgres'}
                  onClick={() => setProvider('postgres')}
                  icon="⊞"
                  name="PostgreSQL"
                  description="Files in database, full-text search"
                />
              </div>
            </div>

            {/* Provider-specific fields */}
            {provider === 'postgres' && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <label className="label">Connection string</label>
                <input
                  className="input"
                  value={dbUrl}
                  onChange={e => setDbUrl(e.target.value)}
                  placeholder="postgresql://user:pass@host:5432/dbname"
                  required
                />
              </div>
            )}

            {provider === 'git' && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <label className="label">Remote URL <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
                <input
                  className="input"
                  value={remoteUrl}
                  onChange={e => setRemoteUrl(e.target.value)}
                  placeholder="https://github.com/you/repo.git"
                />
              </div>
            )}

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
                {providerLabel(s.provider) && (
                  <span className="tag tag-muted">{providerLabel(s.provider)}</span>
                )}
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

function ProviderOption({ selected, onClick, icon, name, description }: {
  selected: boolean;
  onClick: () => void;
  icon: string;
  name: string;
  description: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        background: selected ? 'var(--accent-glow)' : 'var(--bg-base)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
      onMouseOver={e => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--text-muted)';
      }}
      onMouseOut={e => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 14,
          color: selected ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'color 0.15s',
        }}>
          {icon}
        </span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 13,
          fontWeight: 600,
          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          transition: 'color 0.15s',
        }}>
          {name}
        </span>
      </div>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--text-muted)',
        lineHeight: 1.3,
      }}>
        {description}
      </span>
    </div>
  );
}
