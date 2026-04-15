import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { User, SpaceConfig, SpaceMeta, SpacePermissionEntry } from '@hive/shared';

const DATA_DIR = process.env.DATA_DIR || '/data';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Users

const usersPath = () => path.join(DATA_DIR, 'auth', 'users.json');

export function getUsers(): User[] {
  const file = usersPath();
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function saveUsers(users: User[]): void {
  ensureDir(path.dirname(usersPath()));
  fs.writeFileSync(usersPath(), JSON.stringify(users, null, 2));
}

export function getUserByApiKey(apiKey: string): User | undefined {
  return getUsers().find(u => u.api_key === apiKey);
}

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id);
}

export function initSuperuser(): void {
  const file = usersPath();
  if (fs.existsSync(file)) return;

  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    console.error('ADMIN_API_KEY env var required on first boot');
    process.exit(1);
  }

  const admin: User = {
    id: uuidv4(),
    name: 'admin',
    api_key: adminKey,
    is_admin: true,
    created_at: new Date().toISOString(),
  };

  saveUsers([admin]);
  console.log('Superuser created from ADMIN_API_KEY');
}

// Spaces

export const spacesDir = () => path.join(DATA_DIR, 'spaces');

export function spaceRepoDir(space: string): string {
  return path.join(spacesDir(), space, 'repo');
}

export function listSpaceNames(): string[] {
  const dir = spacesDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f =>
    fs.statSync(path.join(dir, f)).isDirectory()
  );
}

export function listSpaces(): SpaceMeta[] {
  return listSpaceNames().map(name => {
    const config = getSpaceConfig(name);
    return {
      name,
      kind: config?.kind ?? 'files',
      provider: config?.provider ?? 'postgres',
    };
  });
}

export function getSpaceConfig(space: string): SpaceConfig | null {
  const file = path.join(spacesDir(), space, 'config.json');
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));

  // Migrate old { type: 'postgres', database_url } format
  if (raw.type && !raw.kind) {
    const migrated: SpaceConfig = { kind: 'files', provider: raw.type, database_url: raw.database_url };
    fs.writeFileSync(file, JSON.stringify(migrated, null, 2));
    return migrated;
  }

  return raw;
}

export function saveSpaceConfig(space: string, config: SpaceConfig): void {
  const dir = path.join(spacesDir(), space);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config, null, 2));
}

export function deleteSpaceDir(space: string): void {
  const dir = path.join(spacesDir(), space);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

// Permissions

export function getSpacePermissions(space: string): SpacePermissionEntry[] {
  const file = path.join(spacesDir(), space, 'permissions.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function saveSpacePermissions(space: string, perms: SpacePermissionEntry[]): void {
  const dir = path.join(spacesDir(), space);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'permissions.json'), JSON.stringify(perms, null, 2));
}
