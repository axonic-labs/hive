import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';
import type { AgentConfig } from '@hive/shared';

interface AgentWithExtras extends AgentConfig {
  api_key?: string;
  running?: boolean;
}

interface SpaceInfo {
  name: string;
  schema: string;
}

export function Agents() {
  const [agents, setAgents] = useState<AgentWithExtras[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState('');
  const [logSpace, setLogSpace] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const load = async () => {
    const [data, spaceData] = await Promise.all([
      apiGet<AgentWithExtras[]>('/admin/agents'),
      apiGet<SpaceInfo[]>('/admin/spaces'),
    ]);
    setAgents(data);
    setSpaces(spaceData);
    if (!logSpace && spaceData.length > 0) {
      const chatlog = spaceData.find(s => s.schema === 'chatlog');
      setLogSpace(chatlog?.name || spaceData[0].name);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await apiPost<AgentWithExtras>('/admin/agents', {
        name, prompt, schedule: schedule || null, log_space: logSpace,
      });
      setCreatedKey(result.api_key!);
      setName('');
      setPrompt('');
      setSchedule('');
      setShowCreate(false);
      load();
    } catch (err: unknown) {
      setError((err as { error?: string })?.error || 'Failed to create agent');
    }
  };

  const handleRun = async (agentName: string) => {
    setRunningAgents(prev => new Set(prev).add(agentName));
    try {
      await apiPost(`/admin/agents/${agentName}/run`);
      // Poll until agent finishes
      const poll = setInterval(async () => {
        try {
          const data = await apiGet<AgentWithExtras>(`/admin/agents/${agentName}`);
          if (!data.running) {
            setRunningAgents(prev => { const s = new Set(prev); s.delete(agentName); return s; });
            clearInterval(poll);
          }
        } catch {
          setRunningAgents(prev => { const s = new Set(prev); s.delete(agentName); return s; });
          clearInterval(poll);
        }
      }, 3000);
    } catch {
      setRunningAgents(prev => { const s = new Set(prev); s.delete(agentName); return s; });
    }
  };

  const handleDelete = async (agentName: string) => {
    if (!confirm(`Delete agent "${agentName}"? This also deletes its user account.`)) return;
    await apiDelete(`/admin/agents/${agentName}`);
    load();
  };

  const handleCopy = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Agents</h1>
        <button className="btn btn-accent" onClick={() => { setShowCreate(!showCreate); setError(''); }}>
          {showCreate ? 'Cancel' : '+ New Agent'}
        </button>
      </div>

      {/* API key reveal */}
      {createdKey && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--accent)', background: 'var(--accent-glow)' }}>
          <span className="label" style={{ color: 'var(--accent-text)', marginBottom: 8, display: 'block' }}>
            Agent API Key — copy now, won't be shown again
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius)',
              fontFamily: 'var(--mono)', fontSize: 12, wordBreak: 'break-all', color: 'var(--text-primary)',
            }}>{createdKey}</code>
            <button className="btn btn-sm" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</button>
            <button className="btn btn-sm" onClick={() => setCreatedKey(null)}>Done</button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label className="label">Agent name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)}
                placeholder="dreamer" pattern="[a-z][a-z0-9_-]*" required autoFocus />
            </div>
            <div>
              <label className="label">System prompt</label>
              <textarea className="input" value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder="You are Dreamer, a nightly reflection agent..."
                required rows={5} style={{ resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.6 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="label">Schedule (cron, optional)</label>
                <input className="input" value={schedule} onChange={e => setSchedule(e.target.value)}
                  placeholder="0 4 * * *" />
              </div>
              <div>
                <label className="label">Log space</label>
                <select className="input" value={logSpace} onChange={e => setLogSpace(e.target.value)}>
                  {spaces.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontFamily: 'var(--mono)', fontSize: 12 }}>{error}</div>}
            <button type="submit" className="btn btn-accent">Create Agent</button>
          </div>
        </form>
      )}

      {/* Agent list */}
      {agents.length === 0 && !showCreate ? (
        <div className="empty-state">No agents yet. Create one to get started.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {agents.map((agent, i) => {
            const isRunning = runningAgents.has(agent.name);
            return (
              <div key={agent.name} className="card" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', transition: 'border-color 0.15s', animationDelay: `${i * 40}ms`,
              }}
                onClick={() => navigate(`/agents/${agent.name}`)}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Status dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: agent.enabled ? (isRunning ? 'var(--accent)' : 'var(--success)') : 'var(--text-muted)',
                    boxShadow: isRunning ? '0 0 8px var(--accent)' : 'none',
                    transition: 'all 0.3s',
                    animation: isRunning ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  }} />
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14 }}>{agent.name}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {agent.schedule || 'manual only'}
                      {!agent.enabled && ' · disabled'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleRun(agent.name)}
                    disabled={isRunning || !agent.enabled}
                    style={{ minWidth: 60 }}
                  >
                    {isRunning ? '...' : 'Run'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(agent.name)}>
                    delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
