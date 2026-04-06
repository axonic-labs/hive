import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setLoading(true);
    setError('');
    const ok = await login(apiKey.trim());
    setLoading(false);
    if (ok) {
      navigate('/spaces');
    } else {
      setError('Invalid API key');
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-deep)',
    }}>
      <div style={{
        width: 380,
        animation: 'fadeIn 0.4s ease-out',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--accent)',
            letterSpacing: '-0.04em',
            marginBottom: 8,
          }}>
            hive
          </div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
          }}>
            personal cloud
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="label">API Key</label>
            <input
              className="input"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              autoFocus
              style={{ textAlign: 'center' }}
            />
          </div>

          {error && (
            <div style={{
              color: 'var(--danger)',
              fontSize: 12,
              fontFamily: 'var(--mono)',
              textAlign: 'center',
              marginBottom: 12,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-accent"
            disabled={loading || !apiKey.trim()}
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
          >
            {loading ? 'Verifying...' : 'Authenticate'}
          </button>
        </form>
      </div>
    </div>
  );
}
