import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface Space {
  name: string;
  schema: 'files' | 'chatlog';
}

type SchemaType = 'files' | 'chatlog';

export function Spaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [schema, setSchema] = useState<SchemaType | null>(null);
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
    if (!schema) return;
    setCreating(true);
    setError('');
    try {
      await apiPost('/admin/spaces', { name, type: 'postgres', database_url: dbUrl, schema });
      setName('');
      setDbUrl('');
      setSchema(null);
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

  const handleCancel = () => {
    setShowCreate(false);
    setSchema(null);
    setName('');
    setDbUrl('');
    setError('');
  };

  const schemaIcon = (s: SchemaType) => s === 'chatlog' ? '◈' : '⬡';
  const schemaColor = (s: SchemaType) => s === 'chatlog' ? 'var(--accent-text)' : 'var(--accent)';

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
          {/* Schema type selector */}
          {!schema ? (
            <div>
              <label className="label" style={{ marginBottom: 12 }}>Choose type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <SchemaCard
                  icon="⬡"
                  title="Files"
                  description="Markdown files in folders. Notes, docs, configs."
                  selected={schema === 'files'}
                  onClick={() => setSchema('files')}
                />
                <SchemaCard
                  icon="◈"
                  title="Chatlog"
                  description="Threaded message streams. Journals, bot conversations, chat logs."
                  selected={schema === 'chatlog'}
                  onClick={() => setSchema('chatlog')}
                />
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gap: 14 }}>
                {/* Selected type indicator */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: schemaColor(schema) }}>
                      {schemaIcon(schema)}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
                      {schema === 'chatlog' ? 'Chatlog' : 'Files'} Space
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setSchema(null)}
                    style={{ fontSize: 11 }}
                  >
                    change type
                  </button>
                </div>

                <div>
                  <label className="label">Space name</label>
                  <input
                    className="input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={schema === 'chatlog' ? 'chatlogs' : 'notes'}
                    pattern="[a-z][a-z0-9_]*"
                    autoFocus
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
                  color: schemaColor(s.schema), opacity: 0.5,
                }}>
                  {schemaIcon(s.schema)}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14 }}>
                  {s.name}
                </span>
                {s.schema === 'chatlog' && (
                  <span className="tag tag-muted" style={{ fontSize: 10 }}>chat</span>
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

function SchemaCard({ icon, title, description, selected, onClick }: {
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px',
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        background: selected ? 'var(--accent-glow)' : 'var(--bg-elevated)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseOver={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
      onMouseOut={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
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
    </div>
  );
}
