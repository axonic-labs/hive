export interface ChatMessage {
  id: string;
  thread: string;
  author: string;
  source: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface ChatSearchResult extends ChatMessage {
  headline: string;
  rank: number;
}

export interface FileListEntry {
  id: string;
  path: string;
  filename: string;
  created_at: string;
  updated_at: string;
}

export interface FileEntry extends FileListEntry {
  content_text: string | null;
  content_blob: string | null;
  content_hash: string | null;
}

export interface SearchResult extends FileListEntry {
  headline: string;
  rank: number;
}
