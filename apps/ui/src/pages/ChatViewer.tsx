import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface ChatMessage {
  id: string;
  thread: string;
  author: string;
  source: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
}

interface ThreadSummary {
  thread: string;
  message_count: number;
  last_message_at: string;
}

export function ChatViewer() {
  const { space } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newThread, setNewThread] = useState('');
  const [showNewThread, setShowNewThread] = useState(false);
  const [confirmDeleteThread, setConfirmDeleteThread] = useState<string | null>(null);

  // Compose
  const [author, setAuthor] = useState('user');
  const [content, setContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadThreads = async () => {
    const data = await apiGet<ThreadSummary[]>(`/data/${space}/threads`);
    setThreads(data);
    if (!selectedThread && data.length > 0) {
      setSelectedThread(data[0].thread);
    }
  };

  const loadMessages = async (thread: string) => {
    setLoadingMessages(true);
    const data = await apiGet<ChatMessage[]>(`/data/${space}/messages?thread=${encodeURIComponent(thread)}&limit=200`);
    setMessages(data);
    setLoadingMessages(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  useEffect(() => { loadThreads(); }, [space]);
  useEffect(() => {
    if (selectedThread) loadMessages(selectedThread);
  }, [selectedThread]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !selectedThread) return;
    await apiPost(`/data/${space}/messages`, {
      thread: selectedThread,
      author,
      content: content.trim(),
    });
    setContent('');
    loadMessages(selectedThread);
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThread.trim()) return;
    // Create thread by posting a system message
    await apiPost(`/data/${space}/messages`, {
      thread: newThread.trim(),
      author: 'system',
      content: `Thread created`,
    });
    setSelectedThread(newThread.trim());
    setNewThread('');
    setShowNewThread(false);
    loadThreads();
  };

  const handleDeleteMessage = async (id: string) => {
    await apiDelete(`/data/${space}/messages/${id}`);
    if (selectedThread) loadMessages(selectedThread);
  };

  const handleDeleteThread = async (thread: string) => {
    await apiDelete(`/data/${space}/threads/${encodeURIComponent(thread)}`);
    setConfirmDeleteThread(null);
    if (selectedThread === thread) {
      setSelectedThread(null);
      setMessages([]);
    }
    loadThreads();
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return formatTime(d);
    if (diff < 604800000) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group messages by date for visual separators
  const messagesByDate: { date: string; messages: ChatMessage[] }[] = [];
  messages.forEach(msg => {
    const dateStr = new Date(msg.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const last = messagesByDate[messagesByDate.length - 1];
    if (last && last.date === dateStr) {
      last.messages.push(msg);
    } else {
      messagesByDate.push({ date: dateStr, messages: [msg] });
    }
  });

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 96px)', display: 'flex', flexDirection: 'column' }}>
      {/* Breadcrumbs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
        fontFamily: 'var(--mono)', fontSize: 13,
      }}>
        <span style={{ color: 'var(--accent-text)', cursor: 'pointer' }} onClick={() => navigate('/spaces')}>
          spaces
        </span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{space}</span>
        <span className="tag tag-muted" style={{ marginLeft: 4 }}>chat</span>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', gap: 1, overflow: 'hidden', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>

        {/* Thread sidebar */}
        <div style={{
          width: 220, flexShrink: 0, background: 'var(--bg-base)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Threads
            </span>
            <button
              onClick={() => setShowNewThread(!showNewThread)}
              style={{
                background: 'none', border: 'none', color: 'var(--accent-text)',
                fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer', padding: '0 4px',
              }}
            >+</button>
          </div>

          {showNewThread && (
            <form onSubmit={handleCreateThread} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <input
                className="input"
                value={newThread}
                onChange={e => setNewThread(e.target.value)}
                placeholder="thread name"
                autoFocus
                style={{ fontSize: 12, padding: '5px 8px' }}
              />
            </form>
          )}

          <div style={{ flex: 1, overflow: 'auto' }}>
            {threads.map(t => (
              <div
                key={t.thread}
                onClick={() => setSelectedThread(t.thread)}
                onMouseOut={() => setConfirmDeleteThread(null)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: selectedThread === t.thread ? 'var(--bg-surface)' : 'transparent',
                  borderLeft: selectedThread === t.thread ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'all 0.1s',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500,
                    color: selectedThread === t.thread ? 'var(--text-primary)' : 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.thread}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                    {t.message_count} msg · {formatDate(t.last_message_at)}
                  </div>
                </div>
                {user?.is_admin && (
                  confirmDeleteThread === t.thread ? (
                    <span
                      onClick={e => { e.stopPropagation(); handleDeleteThread(t.thread); }}
                      style={{
                        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--danger)',
                        padding: '1px 6px', borderRadius: 3, background: 'var(--danger-bg)',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >delete?</span>
                  ) : (
                    <span
                      className="row-delete-btn"
                      onClick={e => { e.stopPropagation(); setConfirmDeleteThread(t.thread); }}
                      style={{
                        fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)',
                        padding: '0 4px', cursor: 'pointer', opacity: 0, transition: 'opacity 0.1s',
                      }}
                    >×</span>
                  )
                )}
              </div>
            ))}
            {threads.length === 0 && (
              <div style={{ padding: '20px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                No threads yet
              </div>
            )}
          </div>
        </div>

        {/* Message area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
          {selectedThread ? (
            <>
              {/* Messages */}
              <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                {loadingMessages ? (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
                    Loading...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
                    No messages in this thread
                  </div>
                ) : (
                  messagesByDate.map(group => (
                    <div key={group.date}>
                      {/* Date separator */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px',
                      }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                        <span style={{
                          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
                        }}>
                          {group.date}
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                      </div>

                      {group.messages.map(msg => (
                        <MessageRow
                          key={msg.id}
                          msg={msg}
                          canDelete={user?.is_admin}
                          onDelete={() => handleDeleteMessage(msg.id)}
                        />
                      ))}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <form onSubmit={handleSend} style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex', gap: 8, alignItems: 'center',
                background: 'var(--bg-base)',
              }}>
                <select
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  className="input"
                  style={{ width: 100, fontSize: 12, padding: '6px 8px', flexShrink: 0 }}
                >
                  <option value="user">user</option>
                  <option value="assistant">assistant</option>
                  <option value="system">system</option>
                </select>
                <input
                  className="input"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Type a message..."
                  style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                />
                <button type="submit" className="btn btn-accent btn-sm" disabled={!content.trim()}>
                  Send
                </button>
              </form>
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-muted)',
            }}>
              {threads.length > 0 ? 'Select a thread' : 'Create a thread to start'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageRow({ msg, canDelete, onDelete }: {
  msg: ChatMessage;
  canDelete?: boolean;
  onDelete: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const isAssistant = msg.author === 'assistant';
  const isSystem = msg.author === 'system';

  const time = new Date(msg.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  return (
    <div
      style={{
        display: 'flex', gap: 10, padding: '6px 0',
        opacity: isSystem ? 0.5 : 1,
      }}
      onMouseOut={() => setConfirmDel(false)}
    >
      {/* Timestamp */}
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
        minWidth: 40, flexShrink: 0, marginTop: 2,
      }}>
        {time}
      </span>

      {/* Author tag */}
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
        minWidth: 70, flexShrink: 0, marginTop: 2,
        color: isAssistant ? 'var(--accent-text)' : isSystem ? 'var(--text-muted)' : 'var(--success)',
      }}>
        {msg.author}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: 'var(--sans)', fontSize: 14, lineHeight: 1.5,
          color: isSystem ? 'var(--text-muted)' : 'var(--text-primary)',
          fontStyle: isSystem ? 'italic' : 'normal',
          wordBreak: 'break-word',
        }}>
          {msg.content}
        </span>
        {msg.source && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)',
            marginLeft: 8, verticalAlign: 'middle',
          }}>
            via {msg.source}
          </span>
        )}
      </div>

      {/* Delete */}
      {canDelete && (
        confirmDel ? (
          <span
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--danger)',
              padding: '1px 6px', borderRadius: 3, background: 'var(--danger-bg)',
              cursor: 'pointer', flexShrink: 0, alignSelf: 'center',
            }}
          >del?</span>
        ) : (
          <span
            className="row-delete-btn"
            onClick={e => { e.stopPropagation(); setConfirmDel(true); }}
            style={{
              fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)',
              padding: '0 4px', cursor: 'pointer', opacity: 0, transition: 'opacity 0.1s',
              flexShrink: 0, alignSelf: 'center',
            }}
          >×</span>
        )
      )}
    </div>
  );
}
