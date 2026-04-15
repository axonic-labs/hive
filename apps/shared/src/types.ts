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

export type SpaceConfig = PostgresFilesSpaceConfig | GitFilesSpaceConfig;

export interface SpaceMeta {
  name: string;
  kind: SpaceConfig['kind'];
  provider: SpaceConfig['provider'];
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
