import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import git from 'isomorphic-git';
// @ts-ignore — isomorphic-git http module lacks type declarations
import http from 'isomorphic-git/http/node/index.js';
import type { FileEntry, FileListEntry, GitFilesSpaceConfig } from '@hive/shared';
import type { FileProvider, FileVersion, SearchResult } from '../types.js';
import { spaceRepoDir } from '../../config/manager.js';

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function deterministicId(space: string, filePath: string, filename: string): string {
  const hash = sha256(`${space}/${filePath}/${filename}`);
  // Format as UUID v5-style
  return [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20, 32)].join('-');
}

function isTextFile(filename: string): boolean {
  const textExtensions = ['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.csv', '.xml', '.html', '.css', '.js', '.ts', '.sh', '.py', '.rb', '.go', '.rs', '.env', '.cfg', '.ini', '.log'];
  const ext = path.extname(filename).toLowerCase();
  return ext === '' || textExtensions.includes(ext);
}

// Per-space mutex to serialize git write operations
const locks = new Map<string, Promise<void>>();

async function withLock<T>(space: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(space) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>(r => { resolve = r; });
  locks.set(space, next);
  await prev;
  try {
    return await fn();
  } finally {
    resolve!();
  }
}

export class GitFileProvider implements FileProvider {
  readonly capabilities: { history: boolean; remoteSync: boolean };
  private dir: string;
  private space: string;
  private config: GitFilesSpaceConfig;

  constructor(space: string, config: GitFilesSpaceConfig) {
    this.space = space;
    this.config = config;
    this.dir = spaceRepoDir(space);
    this.capabilities = {
      history: true,
      remoteSync: !!config.remote_url,
    };
  }

  private safePath(filePath: string, filename: string): string {
    const rel = filePath ? `${filePath}/${filename}` : filename;
    const normalized = path.normalize(rel);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new Error('Invalid path');
    }
    return path.join(this.dir, normalized);
  }

  private relativePath(filePath: string, filename: string): string {
    const rel = filePath ? `${filePath}/${filename}` : filename;
    const normalized = path.normalize(rel);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new Error('Invalid path');
    }
    return normalized;
  }

  private fileEntry(filePath: string, filename: string, content: string, stat: fs.Stats): FileEntry {
    // Use mtime for both — birthtime is unreliable on Linux (ext4 returns epoch)
    return {
      id: deterministicId(this.space, filePath, filename),
      path: filePath,
      filename,
      content_text: content,
      content_blob: null,
      content_hash: sha256(content),
      created_at: stat.mtime.toISOString(),
      updated_at: stat.mtime.toISOString(),
    };
  }

  private async commit(message: string): Promise<void> {
    await git.commit({
      fs,
      dir: this.dir,
      message,
      author: { name: 'Hive', email: 'hive@localhost' },
    });
  }

  // Walk directory tree, returning { filePath, filename } pairs
  private walkDir(dir: string, prefix: string = ''): { filePath: string; filename: string }[] {
    const results: { filePath: string; filename: string }[] = [];
    if (!fs.existsSync(dir)) return results;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        // Synthesize .keep for UI folder detection
        results.push({ filePath: entryPath, filename: '.keep' });
        results.push(...this.walkDir(path.join(dir, entry.name), entryPath));
      } else {
        results.push({ filePath: prefix, filename: entry.name });
      }
    }
    return results;
  }

  private matchesPermissions(filePath: string, filename: string, permittedPrefixes: string[] | '*'): boolean {
    if (permittedPrefixes === '*') return true;
    const full = filePath ? `${filePath}/${filename}` : filename;
    return permittedPrefixes.some(p => {
      const clean = p.replace(/\/$/, '');
      return filePath === clean || filePath.startsWith(clean + '/') || full.startsWith(clean);
    });
  }

  async listFiles(prefix?: string, permittedPrefixes?: string[] | '*'): Promise<FileListEntry[]> {
    const perms = permittedPrefixes ?? '*';
    const all = this.walkDir(this.dir);

    return all
      .filter(({ filePath, filename }) => {
        // Filter by prefix
        if (prefix) {
          const cleanPrefix = prefix.replace(/\/$/, '');
          if (filePath !== cleanPrefix && !filePath.startsWith(cleanPrefix + '/')) {
            // Also check if the file itself matches
            const full = filePath ? `${filePath}/${filename}` : filename;
            if (!full.startsWith(cleanPrefix + '/') && filePath !== cleanPrefix) return false;
          }
        }
        return this.matchesPermissions(filePath, filename, perms);
      })
      .map(({ filePath, filename }) => {
        const full = this.safePath(filePath, filename);
        let stat: fs.Stats;
        try {
          // .keep files are virtual, use parent directory stat
          if (filename === '.keep') {
            const dirPath = path.join(this.dir, filePath);
            stat = fs.statSync(dirPath);
          } else {
            stat = fs.statSync(full);
          }
        } catch {
          stat = { birthtime: new Date(), mtime: new Date() } as fs.Stats;
        }
        return {
          id: deterministicId(this.space, filePath, filename),
          path: filePath,
          filename,
          created_at: stat.mtime.toISOString(),
          updated_at: stat.mtime.toISOString(),
        };
      });
  }

  async readFile(filePath: string, filename: string): Promise<FileEntry | null> {
    const full = this.safePath(filePath, filename);
    if (!fs.existsSync(full)) return null;

    const stat = fs.statSync(full);
    const content = fs.readFileSync(full, 'utf-8');
    return this.fileEntry(filePath, filename, content, stat);
  }

  async createFile(filePath: string, filename: string, content: string): Promise<FileEntry> {
    return withLock(this.space, async () => {
      const full = this.safePath(filePath, filename);
      if (fs.existsSync(full)) {
        throw new Error(`File "${filename}" already exists at this path`);
      }

      // Ensure parent directories
      const dir = path.dirname(full);
      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(full, content, 'utf-8');
      await git.add({ fs, dir: this.dir, filepath: this.relativePath(filePath, filename) });
      await this.commit(`Create ${this.relativePath(filePath, filename)}`);

      const stat = fs.statSync(full);
      return this.fileEntry(filePath, filename, content, stat);
    });
  }

  async writeFile(filePath: string, filename: string, content: string): Promise<FileEntry> {
    return withLock(this.space, async () => {
      const full = this.safePath(filePath, filename);
      const dir = path.dirname(full);
      fs.mkdirSync(dir, { recursive: true });

      const existed = fs.existsSync(full);
      fs.writeFileSync(full, content, 'utf-8');
      await git.add({ fs, dir: this.dir, filepath: this.relativePath(filePath, filename) });
      await this.commit(`${existed ? 'Update' : 'Create'} ${this.relativePath(filePath, filename)}`);

      const stat = fs.statSync(full);
      return this.fileEntry(filePath, filename, content, stat);
    });
  }

  async appendFile(filePath: string, filename: string, content: string): Promise<FileEntry> {
    return withLock(this.space, async () => {
      const full = this.safePath(filePath, filename);
      let existing = '';
      if (fs.existsSync(full)) {
        existing = fs.readFileSync(full, 'utf-8');
      } else {
        const dir = path.dirname(full);
        fs.mkdirSync(dir, { recursive: true });
      }

      const newContent = existing ? existing + '\n' + content : content;
      fs.writeFileSync(full, newContent, 'utf-8');
      await git.add({ fs, dir: this.dir, filepath: this.relativePath(filePath, filename) });
      await this.commit(`Append to ${this.relativePath(filePath, filename)}`);

      const stat = fs.statSync(full);
      return this.fileEntry(filePath, filename, newContent, stat);
    });
  }

  async deleteFile(filePath: string, filename: string): Promise<boolean> {
    return withLock(this.space, async () => {
      const full = this.safePath(filePath, filename);
      if (!fs.existsSync(full)) return false;

      fs.unlinkSync(full);
      await git.remove({ fs, dir: this.dir, filepath: this.relativePath(filePath, filename) });
      await this.commit(`Delete ${this.relativePath(filePath, filename)}`);

      // Clean up empty parent directories
      if (filePath) {
        let dirPath = path.join(this.dir, filePath);
        while (dirPath !== this.dir) {
          try {
            const entries = fs.readdirSync(dirPath);
            if (entries.length === 0) {
              fs.rmdirSync(dirPath);
            } else {
              break;
            }
          } catch { break; }
          dirPath = path.dirname(dirPath);
        }
      }

      return true;
    });
  }

  async deleteFolder(folderPath: string): Promise<number> {
    return withLock(this.space, async () => {
      const full = path.join(this.dir, folderPath);
      if (!fs.existsSync(full)) return 0;

      // Collect all files under this folder from the repo root walk
      const allFiles = this.walkDir(this.dir);
      const files = allFiles.filter(f =>
        f.filename !== '.keep' &&
        (f.filePath === folderPath || f.filePath.startsWith(folderPath + '/'))
      );
      for (const { filePath, filename } of files) {
        try {
          await git.remove({ fs, dir: this.dir, filepath: this.relativePath(filePath, filename) });
        } catch { /* may not be tracked */ }
      }

      fs.rmSync(full, { recursive: true });

      if (files.length > 0) {
        await this.commit(`Delete folder ${folderPath}`);
      }

      return files.length;
    });
  }

  async searchFiles(query: string, permittedPrefixes: string[] | '*'): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    const all = this.walkDir(this.dir);

    for (const { filePath, filename } of all) {
      if (filename === '.keep') continue;
      if (!this.matchesPermissions(filePath, filename, permittedPrefixes)) continue;
      if (!isTextFile(filename)) continue;

      const full = this.safePath(filePath, filename);
      try {
        const content = fs.readFileSync(full, 'utf-8');
        const lowerContent = content.toLowerCase();
        const idx = lowerContent.indexOf(lowerQuery);
        if (idx === -1) continue;

        // Build snippet
        const start = Math.max(0, idx - 40);
        const end = Math.min(content.length, idx + query.length + 40);
        const headline = (start > 0 ? '...' : '') +
          content.slice(start, idx) +
          '<b>' + content.slice(idx, idx + query.length) + '</b>' +
          content.slice(idx + query.length, end) +
          (end < content.length ? '...' : '');

        const stat = fs.statSync(full);
        results.push({
          id: deterministicId(this.space, filePath, filename),
          path: filePath,
          filename,
          created_at: stat.mtime.toISOString(),
          updated_at: stat.mtime.toISOString(),
          headline,
          rank: 1,
        });

        if (results.length >= 50) break;
      } catch { /* skip unreadable files */ }
    }

    return results;
  }

  // --- Git-specific: version history ---

  async getFileHistory(fullPath: string, limit: number = 50): Promise<FileVersion[]> {
    try {
      // Scan all commits — isomorphic-git doesn't support per-file log filtering
      const commits = await git.log({ fs, dir: this.dir });

      // Filter to commits that touched this file
      const versions: FileVersion[] = [];
      for (const commit of commits) {
        if (versions.length >= limit) break;
        // Check if this commit's tree has the file
        try {
          const { blob } = await git.readBlob({
            fs,
            dir: this.dir,
            oid: commit.oid,
            filepath: fullPath,
          });
          // Check if file was different from parent
          if (commit.commit.parent.length > 0) {
            try {
              const { blob: parentBlob } = await git.readBlob({
                fs,
                dir: this.dir,
                oid: commit.commit.parent[0],
                filepath: fullPath,
              });
              if (Buffer.from(blob).equals(Buffer.from(parentBlob))) continue;
            } catch {
              // File didn't exist in parent — this is the creation commit
            }
          }
          versions.push({
            oid: commit.oid,
            message: commit.commit.message.trim(),
            author: commit.commit.author.name,
            timestamp: new Date(commit.commit.author.timestamp * 1000).toISOString(),
          });
        } catch {
          // File doesn't exist at this commit
        }
      }

      return versions;
    } catch {
      return [];
    }
  }

  async getFileAtVersion(fullPath: string, oid: string): Promise<string | null> {
    try {
      const { blob } = await git.readBlob({ fs, dir: this.dir, oid, filepath: fullPath });
      return Buffer.from(blob).toString('utf-8');
    } catch {
      return null;
    }
  }

  async diffVersions(fullPath: string, oid1: string, oid2: string): Promise<{ before: string; after: string }> {
    const before = await this.getFileAtVersion(fullPath, oid1);
    const after = await this.getFileAtVersion(fullPath, oid2);
    return {
      before: before ?? '',
      after: after ?? '',
    };
  }

  async restoreVersion(fullPath: string, oid: string): Promise<FileEntry> {
    const content = await this.getFileAtVersion(fullPath, oid);
    if (content === null) throw new Error('File not found at this version');

    const parts = fullPath.split('/');
    const filename = parts.pop()!;
    const filePath = parts.join('/');

    return this.writeFile(filePath, filename, content);
  }

  async sync(): Promise<void> {
    if (!this.config.remote_url) throw new Error('No remote configured');

    await git.push({
      fs,
      http,
      dir: this.dir,
      remote: 'origin',
      ref: this.config.remote_branch || 'main',
    });
  }
}
