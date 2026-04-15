export interface User {
  id: string;
  name: string;
  api_key: string;
  is_admin: boolean;
  created_at: string;
}

export interface Permission {
  space: string;
  path: string;
  access: 'read' | 'read_write';
}

export interface PermissionGrant {
  path: string;
  access: 'read' | 'read_write';
}

export interface SpacePermissionEntry {
  user_id: string;
  grants: PermissionGrant[];
}

export interface PostgresFilesSpaceConfig {
  kind: 'files';
  provider: 'postgres';
  database_url: string;
}

export interface GitFilesSpaceConfig {
  kind: 'files';
  provider: 'git';
  remote_url?: string;
  remote_branch?: string;
}

export interface PostgresChatlogSpaceConfig {
  kind: 'chatlog';
  provider: 'postgres';
  database_url: string;
}

export type SpaceConfig = PostgresFilesSpaceConfig | GitFilesSpaceConfig | PostgresChatlogSpaceConfig;

export interface SpaceMeta {
  name: string;
  kind: SpaceConfig['kind'];
  provider: SpaceConfig['provider'];
}

export interface ChatMessage {
  id: string;
  thread: string;
  author: string;
  source: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface ThreadSummary {
  thread: string;
  message_count: number;
  last_message_at: string;
}

export interface FileEntry {
  id: string;
  path: string;
  filename: string;
  content_text: string | null;
  content_blob: Uint8Array | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileListEntry {
  id: string;
  path: string;
  filename: string;
  created_at: string;
  updated_at: string;
}

export interface ApiError {
  error: string;
  status: number;
}

export interface AgentConfig {
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
}

export interface LLMConfig {
  provider: 'anthropic' | 'openai';
  api_key: string;
  default_model: string;
}

export interface AgentRunSummary {
  thread: string;
  started_at: string;
  status: 'success' | 'error' | 'timeout';
  duration_ms: number;
}
