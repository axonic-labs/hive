import type { FileEntry, FileListEntry } from '@hive/shared';
import type { FileProvider, SearchResult } from '../types.js';
import { getPool } from '../../db/pools.js';
import { listFiles, readFile, createFile, writeFile, appendFile, deleteFile, deleteFolder } from '../../db/files.js';
import { searchFiles } from '../../db/search.js';

export class PostgresFileProvider implements FileProvider {
  readonly capabilities = { history: false, remoteSync: false } as const;

  constructor(private space: string) {}

  private get pool() {
    return getPool(this.space);
  }

  listFiles(prefix?: string, permittedPrefixes?: string[] | '*'): Promise<FileListEntry[]> {
    return listFiles(this.pool, this.space, prefix, permittedPrefixes);
  }

  readFile(filePath: string, filename: string): Promise<FileEntry | null> {
    return readFile(this.pool, this.space, filePath, filename);
  }

  createFile(filePath: string, filename: string, content: string): Promise<FileEntry> {
    return createFile(this.pool, this.space, filePath, filename, content);
  }

  writeFile(filePath: string, filename: string, content: string): Promise<FileEntry> {
    return writeFile(this.pool, this.space, filePath, filename, content);
  }

  appendFile(filePath: string, filename: string, content: string): Promise<FileEntry> {
    return appendFile(this.pool, this.space, filePath, filename, content);
  }

  deleteFile(filePath: string, filename: string): Promise<boolean> {
    return deleteFile(this.pool, this.space, filePath, filename);
  }

  deleteFolder(folderPath: string): Promise<number> {
    return deleteFolder(this.pool, this.space, folderPath);
  }

  searchFiles(query: string, permittedPrefixes: string[] | '*'): Promise<SearchResult[]> {
    return searchFiles(this.pool, this.space, query, permittedPrefixes);
  }
}
