import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPut } from '../api/client';

interface UserInfo {
  id: string;
  name: string;
  is_admin: boolean;
  created_at: string;
}

interface PermissionGrant {
  path: string;
  access: 'read' | 'read_write';
}

interface SpacePermissionEntry {
  user_id: string;
  grants: PermissionGrant[];
}

interface SpaceMeta {
  name: string;
}

export function UserDetail() {
  const { id } = useParams();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [spaces, setSpaces] = useState<SpaceMeta[]>([]);
  const [permissions, setPermissions] = useState<Record<string, SpacePermissionEntry[]>>({});
  const [editingSpace, setEditingSpace] = useState<string | null>(null);
  const [newPath, setNewPath] = useState('');
  const [newAccess, setNewAccess] = useState<'read' | 'read_write'>('read');
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const [userData, spacesData] = await Promise.all([
        apiGet<UserInfo>(`/admin/users/${id}`),
        apiGet<SpaceMeta[]>('/admin/spaces'),
      ]);
      setUser(userData);
      setSpaces(spacesData);

      const permsMap: Record<string, SpacePermissionEntry[]> = {};
      for (const space of spacesData) {
        permsMap[space.name] = await apiGet<SpacePermissionEntry[]>(`/admin/spaces/${space.name}/permissions`);
      }
      setPermissions(permsMap);
    };
    load();
  }, [id]);

  const getUserGrants = (space: string): PermissionGrant[] => {
    const entry = permissions[space]?.find(p => p.user_id === id);
    return entry?.grants ?? [];
  };

  const savePermissions = async (space: string, grants: PermissionGrant[]) => {
    const spacePerms = [...(permissions[space] || [])];
    const idx = spacePerms.findIndex(p => p.user_id === id);

    if (grants.length === 0) {
      if (idx !== -1) spacePerms.splice(idx, 1);
    } else if (idx !== -1) {
      spacePerms[idx] = { user_id: id!, grants };
    } else {
      spacePerms.push({ user_id: id!, grants });
    }

    await apiPut(`/admin/spaces/${space}/permissions`, spacePerms);
    setPermissions(prev => ({ ...prev, [space]: spacePerms }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addGrant = async (space: string) => {
    if (!newPath.trim()) return;
    const grants = [...getUserGrants(space), { path: newPath.trim(), access: newAccess }];
    await savePermissions(space, grants);
    setNewPath('');
    setNewAccess('read');
  };

  const removeGrant = async (space: string, index: number) => {
    const grants = getUserGrants(space).filter((_, i) => i !== index);
    await savePermissions(space, grants);
  };

  if (!user) return null;

  return (
    <div className="fade-in">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--mono)',
        fontSize: 13,
        marginBottom: 24,
      }}>
        <span
          style={{ color: 'var(--accent-text)', cursor: 'pointer' }}
          onClick={() => navigate('/users')}
        >
          ← users
        </span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span>{user.name}</span>
        {user.is_admin && <span className="tag tag-accent">admin</span>}
        {saved && <span style={{ color: 'var(--success)', fontSize: 12, marginLeft: 8 }}>saved</span>}
      </div>

      <div style={{ marginBottom: 24 }}>
        <span className="label">Member since</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
          {new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {user.is_admin ? (
        <div className="card" style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          Admin has full access to all spaces.
        </div>
      ) : (
        <div>
          <h2 style={{
            fontFamily: 'var(--mono)',
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16,
            color: 'var(--text-secondary)',
          }}>
            Permissions by Space
          </h2>

          {spaces.length === 0 ? (
            <div className="empty-state">No spaces created yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {spaces.map(space => {
                const grants = getUserGrants(space.name);
                const isEditing = editingSpace === space.name;

                return (
                  <div key={space.name} className="card">
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: grants.length > 0 || isEditing ? 14 : 0,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14 }}>
                          {space.name}
                        </span>
                        {grants.length > 0 && (
                          <span className="tag tag-muted">{grants.length} grant{grants.length > 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <button
                        className="btn btn-sm"
                        onClick={() => setEditingSpace(isEditing ? null : space.name)}
                      >
                        {isEditing ? 'Done' : 'Edit'}
                      </button>
                    </div>

                    {/* Existing grants */}
                    {grants.map((g, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <code style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                          }}>
                            {g.path}
                          </code>
                          <span className={`tag ${g.access === 'read_write' ? 'tag-accent' : 'tag-muted'}`}>
                            {g.access === 'read_write' ? 'read/write' : 'read'}
                          </span>
                        </div>
                        {isEditing && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => removeGrant(space.name, i)}
                            style={{ padding: '2px 8px', fontSize: 11 }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add grant */}
                    {isEditing && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="label">Path</label>
                          <input
                            className="input"
                            value={newPath}
                            onChange={e => setNewPath(e.target.value)}
                            placeholder="journal/ or *"
                            style={{ fontSize: 12 }}
                          />
                        </div>
                        <select
                          className="input"
                          value={newAccess}
                          onChange={e => setNewAccess(e.target.value as 'read' | 'read_write')}
                          style={{ width: 130, fontSize: 12 }}
                        >
                          <option value="read">read</option>
                          <option value="read_write">read/write</option>
                        </select>
                        <button className="btn btn-accent btn-sm" onClick={() => addGrant(space.name)}>
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
