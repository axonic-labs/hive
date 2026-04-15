import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { useAuth } from '../hooks/useAuth';

type Provider = 'git' | 'postgres';
type KindType = 'files' | 'chatlog';

interface Space {
  name: string;
  kind?: string;
  provider?: string;
}

export function Spaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [kind, setKind] = useState<KindType | null>(null);
  const [provider, setProvider] = useState<Provider>('git');
  const [name, setName] = useState('');
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
    setKind(null);
    setProvider('git');
    setName('');
    setDbUrl('');
    setRemoteUrl('');
    setError('');
  };

  const handleCancel = () => {
    setShowCreate(false);
    resetForm();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kind) return;
    setCreating(true);
    setError('');
    try {
      const body: Record<string, string> = { name, kind, provider };
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
    const msg = space?.provider === 'git'
      ? `Delete space "${spaceName}"? This removes the git repository.`
      : `Delete space "${spaceName}"? This drops the database table.`;
    if (!confirm(msg)) return;
    await apiDelete(`/admin/spaces/${spaceName}`);
    load();
  };

  const kindIcon = (k?: string) => k === 'chatlog' ? '◈' : '⬡';
  const kindColor = (k?: string) => k === 'chatlog' ? 'var(--accent-text)' : 'var(--accent)';
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
          <button className="btn btn-accent" onClick={() => showCreate ? handleCancel() : setShowCreate(true)}>
            {showCreate ? 'Cancel' : '+ New Space'}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          {/* Step 1: Kind selector */}
          {!kind ? (
            <div>
              <label className="label" style={{ marginBottom: 12 }}>Choose type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <OptionCard
                  icon="⬡"
                  title="Files"
                  description="Markdown files in folders. Notes, docs, configs."
                  selected={false}
                  onClick={() => setKind('files')}
                />
                <OptionCard
                  icon="◈"
                  title="Chatlog"
                  description="Threaded message streams. Journals, bot conversations."
                  selected={false}
                  onClick={() => { setKind('chatlog'); setProvider('postgres'); }}
                />
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gap: 14 }}>
                {/* Selected kind indicator */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: kindColor(kind) }}>
                      {kindIcon(kind)}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
                      {kind === 'chatlog' ? 'Chatlog' : 'Files'} Space
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => { setKind(null); setProvider('git'); }}
                    style={{ fontSize: 11 }}
                  >
                    change type
                  </button>
                </div>

                {/* Space name */}
                <div>
                  <label className="label">Space name</label>
                  <input
                    className="input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={kind === 'chatlog' ? 'chatlogs' : 'notes'}
                    pattern="[a-z][a-z0-9_]*"
                    autoFocus
                    required
                  />
                </div>

                {/* Step 2: Provider selection (files only — chatlog is always postgres) */}
                {kind === 'files' && (
                  <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <label className="label">Storage</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <OptionCard
                        icon="⎇"
                        title="Git"
                        description="Files on disk, version history"
                        selected={provider === 'git'}
                        onClick={() => setProvider('git')}
                        compact
                      />
                      <OptionCard
                        icon="⊞"
                        title="PostgreSQL"
                        description="Files in database, full-text search"
                        selected={provider === 'postgres'}
                        onClick={() => setProvider('postgres')}
                        compact
                      />
                    </div>
                  </div>
                )}

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

                {provider === 'git' && kind === 'files' && (
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
        </div>
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
                  fontFamily: 'var(--mono)', fontSize: 13,
                  color: kindColor(s.kind), opacity: 0.5,
                }}>
                  {kindIcon(s.kind)}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14 }}>
                  {s.name}
                </span>
                {s.kind === 'chatlog' && (
                  <span className="tag tag-muted" style={{ fontSize: 10 }}>chat</span>
                )}
                {providerLabel(s.provider) && (
                  <span className="tag tag-muted" style={{ fontSize: 10 }}>{providerLabel(s.provider)}</span>
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

function OptionCard({ icon, title, description, selected, onClick, compact }: {
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: compact ? '12px 14px' : '16px',
        borderRadius: compact ? 'var(--radius)' : 'var(--radius-lg)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        background: selected ? 'var(--accent-glow)' : 'var(--bg-elevated)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseOver={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
      onMouseOut={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {compact ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 14,
              color: selected ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'color 0.15s',
            }}>
              {icon}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600,
              color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'color 0.15s',
            }}>
              {title}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>
            {description}
          </span>
        </>
      ) : (
        <>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 16, marginBottom: 6,
            color: 'var(--accent)',
          }}>
            {icon}
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600,
            color: 'var(--text-primary)', marginBottom: 4,
          }}>
            {title}
          </div>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 12, lineHeight: 1.4,
            color: 'var(--text-muted)',
          }}>
            {description}
          </div>
        </>
      )}
    </div>
  );
}
