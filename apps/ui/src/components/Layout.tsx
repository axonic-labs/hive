import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 48,
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--accent)',
            letterSpacing: '-0.03em',
          }}>
            hive
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <NavItem to="/spaces">Spaces</NavItem>
            {user?.is_admin && <NavItem to="/agents">Agents</NavItem>}
            {user?.is_admin && <NavItem to="/users">Users</NavItem>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            {user?.name}
            {user?.is_admin && (
              <span style={{ color: 'var(--accent-dim)', marginLeft: 6 }}>admin</span>
            )}
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 4,
              transition: 'color 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            logout
          </button>
        </div>
      </nav>
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        fontFamily: 'var(--mono)',
        fontSize: 13,
        fontWeight: 500,
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        textDecoration: 'none',
        padding: '6px 12px',
        borderRadius: 'var(--radius)',
        background: isActive ? 'var(--bg-elevated)' : 'transparent',
        transition: 'all 0.15s ease',
        letterSpacing: '-0.01em',
      })}
    >
      {children}
    </NavLink>
  );
}
