import { useEffect, useState } from 'react';
import { apiGet, apiPut } from '../api/client';
import type { LLMConfig } from '@hive/shared';

export function Settings() {
  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-5-20250514');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [keyEdited, setKeyEdited] = useState(false);

  useEffect(() => {
    apiGet<LLMConfig | null>('/admin/agents/config/llm').then(data => {
      if (data) {
        setProvider(data.provider);
        setHasExistingKey(true);
        setDefaultModel(data.default_model);
      }
      setLoaded(true);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!hasExistingKey && !apiKey) {
      setError('API key is required');
      return;
    }
    try {
      const body: Record<string, string> = { provider, default_model: defaultModel };
      if (keyEdited && apiKey) body.api_key = apiKey;
      await apiPut('/admin/agents/config/llm', body);
      setSaved(true);
      setHasExistingKey(true);
      setKeyEdited(false);
      setApiKey('');
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError((err as { error?: string })?.error || 'Failed to save');
    }
  };

  if (!loaded) return null;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        {saved && (
          <span style={{ color: 'var(--success)', fontFamily: 'var(--mono)', fontSize: 12 }}>saved</span>
        )}
      </div>

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600 }}>LLM Configuration</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
            Used by all agents
          </span>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label className="label">Provider</label>
              <select className="input" value={provider} onChange={e => setProvider(e.target.value)}>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="label">API Key</label>
              <input
                className="input"
                type="password"
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setKeyEdited(true); }}
                placeholder={hasExistingKey ? '••••••••  (leave empty to keep current)' : 'sk-ant-...'}
                required={!hasExistingKey}
              />
            </div>
            <div>
              <label className="label">Default Model</label>
              <input
                className="input"
                value={defaultModel}
                onChange={e => setDefaultModel(e.target.value)}
                placeholder="claude-sonnet-4-5-20250514"
                required
              />
            </div>
            {error && (
              <div style={{ color: 'var(--danger)', fontFamily: 'var(--mono)', fontSize: 12 }}>{error}</div>
            )}
            <button type="submit" className="btn btn-accent">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
