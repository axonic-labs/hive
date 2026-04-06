import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPut, apiPost } from '../api/client';

interface AgentConfig {
  name: string;
  user_id: string;
  schedule: string | null;
  model: string | null;
  prompt: string;
  enabled: boolean;
  timeout_ms: number;
  log_space: string;
  log_thread_prefix: string;
  created_at: string;
  running?: boolean;
}

export function AgentDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState('');
  const [model, setModel] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    apiGet<AgentConfig>(`/admin/agents/${name}`).then(data => {
      setAgent(data);
      setPrompt(data.prompt);
      setSchedule(data.schedule || '');
      setModel(data.model || '');
      setEnabled(data.enabled);
      setRunning(data.running || false);
    });
  }, [name]);

  const handleSave = async () => {
    await apiPut(`/admin/agents/${name}`, {
      prompt, schedule: schedule || null, model: model || null, enabled,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRun = async () => {
    setRunning(true);
    await apiPost(`/admin/agents/${name}/run`);
    setTimeout(() => setRunning(false), 5000);
  };

  if (!agent) return null;

  const isDirty = prompt !== agent.prompt || schedule !== (agent.schedule || '') ||
    model !== (agent.model || '') || enabled !== agent.enabled;

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)', fontSize: 13 }}>
          <span style={{ color: 'var(--accent-text)', cursor: 'pointer' }} onClick={() => navigate('/agents')}>
            ← agents
          </span>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{agent.name}</span>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', marginLeft: 4,
            background: enabled ? (running ? 'var(--accent)' : 'var(--success)') : 'var(--text-muted)',
            animation: running ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }} />
          {saved && <span style={{ color: 'var(--success)', fontSize: 12, marginLeft: 4 }}>saved</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={handleRun} disabled={running || !enabled}>
            {running ? 'Running...' : 'Run Now'}
          </button>
          <button className="btn btn-accent btn-sm" onClick={handleSave} disabled={!isDirty}>
            Save
          </button>
        </div>
      </div>

      {/* Prompt */}
      <div style={{ marginBottom: 20 }}>
        <label className="label">System Prompt</label>
        <textarea
          className="input"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={12}
          style={{
            resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 13,
            lineHeight: 1.7, caretColor: 'var(--accent)',
          }}
        />
      </div>

      {/* Config row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div>
          <label className="label">Schedule (cron)</label>
          <input className="input" value={schedule} onChange={e => setSchedule(e.target.value)}
            placeholder="0 4 * * *" />
        </div>
        <div>
          <label className="label">Model override</label>
          <input className="input" value={model} onChange={e => setModel(e.target.value)}
            placeholder="Use default" />
        </div>
        <div>
          <label className="label">Status</label>
          <button
            className={`btn btn-sm ${enabled ? '' : 'btn-danger'}`}
            onClick={() => setEnabled(!enabled)}
            style={{ width: '100%', justifyContent: 'center', marginTop: 0 }}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <span className="label">Log space</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
              {agent.log_space}
            </span>
          </div>
          <div>
            <span className="label">Log thread prefix</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
              {agent.log_thread_prefix}
            </span>
          </div>
          <div>
            <span className="label">Created</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
              {new Date(agent.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div>
            <span className="label">View logs</span>
            <span
              style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent-text)', cursor: 'pointer' }}
              onClick={() => navigate(`/spaces/${agent.log_space}`)}
            >
              {agent.log_space} → {agent.log_thread_prefix}/
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
