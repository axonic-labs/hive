import type { FileEntry, FileListEntry } from '@hive/shared';

export interface SearchResult extends FileListEntry {
  headline: string;
  rank: number;
}

export interface FileProvider {
  listFiles(prefix?: string, permittedPrefixes?: string[] | '*'): Promise<FileListEntry[]>;
  readFile(filePath: string, filename: string): Promise<FileEntry | null>;
  createFile(filePath: string, filename: string, content: string): Promise<FileEntry>;
  writeFile(filePath: string, filename: string, content: string): Promise<FileEntry>;
  appendFile(filePath: string, filename: string, content: string): Promise<FileEntry>;
  deleteFile(filePath: string, filename: string): Promise<boolean>;
  deleteFolder(folderPath: string): Promise<number>;
  searchFiles(query: string, permittedPrefixes: string[] | '*'): Promise<SearchResult[]>;

  readonly capabilities: {
    history: boolean;
    remoteSync: boolean;
  };
}

export interface FileVersion {
  oid: string;
  message: string;
  author: string;
  timestamp: string;
}
