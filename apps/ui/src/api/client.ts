const API_KEY_STORAGE_KEY = 'hive_api_key';

export function getStoredApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const apiKey = getStoredApiKey();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    clearStoredApiKey();
    window.location.href = '/ui/login';
  }
  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function apiPutText(path: string, text: string): Promise<Response> {
  const apiKey = getStoredApiKey();
  const res = await fetch(`/api${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'text/plain',
    },
    body: text,
  });
  if (res.status === 401) {
    clearStoredApiKey();
    window.location.href = '/ui/login';
  }
  return res;
}

export async function apiGetText(path: string): Promise<string> {
  const apiKey = getStoredApiKey();
  const res = await fetch(`/api${path}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (res.status === 401) {
    clearStoredApiKey();
    window.location.href = '/ui/login';
  }
  if (!res.ok) throw await res.json();
  return res.text();
}
