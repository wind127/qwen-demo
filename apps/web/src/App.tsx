import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  AlertCircle,
  ArrowUp,
  Brain,
  Briefcase,
  Check,
  ChevronDown,
  Folder,
  Image,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wifi,
  X
} from "lucide-react";
import { createApiClient } from "@qianwen/api-client";
import type { ChatMessage, ChatStreamEvent, Conversation, HealthResponse } from "@qianwen/shared";
import { createConversationTitle } from "@qianwen/shared";
import { MessageBubble } from "./components/MessageBubble";

const LOCAL_STORAGE_KEY = "qianwen-web-state-v1";

interface PersistedState {
  conversations: Conversation[];
  messagesByConversation: Record<string, ChatMessage[]>;
  selectedConversationId?: string;
}

const emptyState: PersistedState = {
  conversations: [],
  messagesByConversation: {}
};

export function App() {
  const initialState = useMemo(loadPersistedState, []);
  const [conversations, setConversations] = useState<Conversation[]>(initialState.conversations);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>(
    initialState.messagesByConversation
  );
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(
    initialState.selectedConversationId
  );
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787"
      }),
    []
  );

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId);
  const selectedMessages = selectedConversationId ? messagesByConversation[selectedConversationId] ?? [] : [];
  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(query));
  }, [conversations, searchQuery]);

  useEffect(() => {
    const state: PersistedState = {
      conversations,
      messagesByConversation,
      selectedConversationId
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }, [conversations, messagesByConversation, selectedConversationId]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [selectedMessages.length, selectedMessages.at(-1)?.content]);

  useEffect(() => {
    if (!selectedConversationId || selectedConversationId in messagesByConversation) {
      return;
    }

    const conversationId = selectedConversationId;
    let active = true;

    async function loadSelectedMessages() {
      try {
        const response = await api.getMessages(conversationId);
        if (!active) {
          return;
        }

        setMessagesByConversation((current) => ({
          ...current,
          [conversationId]: response.messages
        }));
        setError(null);
      } catch {
        if (active) {
          setError("消息加载失败，已保留本地缓存。");
        }
      }
    }

    void loadSelectedMessages();
    return () => {
      active = false;
    };
  }, [api, messagesByConversation, selectedConversationId]);

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        const [healthResponse, conversationResponse] = await Promise.all([
          api.health(),
          api.listConversations()
        ]);

        if (!active) {
          return;
        }

        setHealth(healthResponse);
        setConversations((current) => mergeConversations(current, conversationResponse.conversations));
        setError(null);
      } catch {
        if (active) {
          setError("服务端未连接，历史记录仍可查看。请确认 apps/server 已启动。");
        }
      } finally {
        if (active) {
          setIsBooting(false);
        }
      }
    }

    boot();
    return () => {
      active = false;
    };
  }, [api]);

  const selectConversation = useCallback(
    async (conversationId: string) => {
      setSelectedConversationId(conversationId);
      if (messagesByConversation[conversationId]?.length) {
        return;
      }

      try {
        const response = await api.getMessages(conversationId);
        setMessagesByConversation((current) => ({
          ...current,
          [conversationId]: response.messages
        }));
      } catch {
        setError("消息加载失败，已保留本地缓存。");
      }
    },
    [api, messagesByConversation]
  );

  const createConversation = useCallback(
    async (title = "新会话") => {
      setError(null);
      const response = await api.createConversation({ title });
      setConversations((current) => upsertConversation(current, response.conversation));
      setMessagesByConversation((current) => ({
        ...current,
        [response.conversation.id]: current[response.conversation.id] ?? []
      }));
      setSelectedConversationId(response.conversation.id);
      return response.conversation;
    },
    [api]
  );

  const handleNewConversation = useCallback(async () => {
    try {
      await createConversation();
    } catch {
      setError("新建会话失败，请检查服务端状态。");
    }
  }, [createConversation]);

  const handleClearMessages = useCallback(async () => {
    if (!selectedConversationId) {
      return;
    }

    try {
      const response = await api.clearMessages(selectedConversationId);
      setMessagesByConversation((current) => ({
        ...current,
        [selectedConversationId]: response.messages
      }));
      setError(null);
    } catch {
      setError("清空会话失败，请稍后重试。");
    }
  }, [api, selectedConversationId]);

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      const conversation = conversations.find((item) => item.id === conversationId);
      if (!conversation) {
        return;
      }

      const confirmed = window.confirm(`删除会话“${conversation.title}”？此操作会同时移除本地历史。`);
      if (!confirmed) {
        return;
      }

      try {
        await api.deleteConversation(conversationId);
      } catch {
        setError("服务端删除失败，已先移除本地缓存。");
      }

      setConversations((current) => current.filter((item) => item.id !== conversationId));
      setMessagesByConversation((current) => {
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      setSelectedConversationId((current) => {
        if (current !== conversationId) {
          return current;
        }

        const nextConversation = sortConversations(conversations.filter((item) => item.id !== conversationId))[0];
        return nextConversation?.id;
      });
    },
    [api, conversations]
  );

  const handleTogglePinned = useCallback(
    async (conversation: Conversation) => {
      const nextPinned = !conversation.pinned;
      setConversations((current) =>
        sortConversations(current.map((item) => (item.id === conversation.id ? { ...item, pinned: nextPinned } : item)))
      );

      try {
        const response = await api.updateConversation(conversation.id, { pinned: nextPinned });
        setConversations((current) => upsertConversation(current, response.conversation));
        setError(null);
      } catch {
        setError("置顶状态同步失败，已保留本地修改。");
      }
    },
    [api]
  );

  const startRenameConversation = useCallback((conversation: Conversation) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
  }, []);

  const cancelRenameConversation = useCallback(() => {
    setEditingConversationId(null);
    setEditingTitle("");
  }, []);

  const submitRenameConversation = useCallback(
    async (conversationId: string) => {
      const title = editingTitle.trim();
      if (!title) {
        return;
      }

      setConversations((current) =>
        sortConversations(
          current.map((item) =>
            item.id === conversationId ? { ...item, title, updatedAt: new Date().toISOString() } : item
          )
        )
      );
      cancelRenameConversation();

      try {
        const response = await api.updateConversation(conversationId, { title });
        setConversations((current) => upsertConversation(current, response.conversation));
        setError(null);
      } catch {
        setError("重命名同步失败，已保留本地修改。");
      }
    },
    [api, cancelRenameConversation, editingTitle]
  );

  const handleSend = useCallback(async (retryPrompt?: string) => {
    const prompt = (retryPrompt ?? draft).trim();
    if (!prompt || isSending) {
      return;
    }

    if (!retryPrompt) {
      setDraft("");
    }
    setIsSending(true);
    setError(null);
    setFailedPrompt(null);

    try {
      const conversation =
        selectedConversation ?? (await createConversation(createConversationTitle(prompt)));

      await api.streamChat(
        {
          conversationId: conversation.id,
          message: prompt
        },
        {
          onEvent: (event) => {
            applyStreamEvent(event, setConversations, setMessagesByConversation, setSelectedConversationId);
          }
        }
      );
    } catch {
      setFailedPrompt(prompt);
      setError("发送失败，请确认服务端已启动后重试。");
    } finally {
      setIsSending(false);
    }
  }, [api, createConversation, draft, isSending, selectedConversation]);

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="会话列表">
        <div className="brand">
          <h1>千问</h1>
          <div className="sidebar-top-actions">
            <button type="button" aria-label="搜索入口" title="搜索">
              <Search size={18} />
            </button>
            <button type="button" aria-label="收起侧边栏" title="收起">
              <PanelLeft size={18} />
            </button>
          </div>
        </div>

        <div className="quick-create-row">
          <button className="primary-action" type="button" onClick={handleNewConversation} aria-label="新建会话">
            <Plus size={18} />
            <span>新建对话</span>
          </button>
          <button className="secondary-action" type="button" aria-label="新建快捷入口" title="快捷入口">
            <MessageSquare size={18} />
          </button>
        </div>

        <label className="conversation-search">
          <Search size={16} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索会话"
            aria-label="搜索会话"
          />
        </label>

        <nav className="workspace-nav" aria-label="千问导航">
          <button type="button">
            <Folder size={18} />
            <span>我的空间</span>
          </button>
          <button type="button">
            <Sparkles size={18} />
            <span>智能体</span>
          </button>
        </nav>

        <div className="section-label">最近对话</div>

        <div className="conversation-list">
          {filteredConversations.length === 0 ? (
            <div className="empty-list">
              <MessageSquare size={18} />
              <span>{conversations.length === 0 ? "还没有历史会话" : "没有匹配会话"}</span>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                className={conversation.id === selectedConversationId ? "conversation active" : "conversation"}
                key={conversation.id}
              >
                {editingConversationId === conversation.id ? (
                  <form
                    className="rename-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitRenameConversation(conversation.id);
                    }}
                  >
                    <input
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      aria-label="会话名称"
                      autoFocus
                    />
                    <button type="submit" aria-label="保存会话名称" title="保存">
                      <Check size={15} />
                    </button>
                    <button type="button" onClick={cancelRenameConversation} aria-label="取消重命名" title="取消">
                      <X size={15} />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      className="conversation-main"
                      type="button"
                      onClick={() => void selectConversation(conversation.id)}
                    >
                      <span>
                        {conversation.pinned ? <Pin size={13} /> : null}
                        {conversation.title}
                      </span>
                      <time>{formatTime(conversation.updatedAt)}</time>
                    </button>
                    <div className="conversation-actions">
                      <button
                        type="button"
                        onClick={() => void handleTogglePinned(conversation)}
                        aria-label={conversation.pinned ? "取消置顶" : "置顶会话"}
                        title={conversation.pinned ? "取消置顶" : "置顶"}
                      >
                        {conversation.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => startRenameConversation(conversation)}
                        aria-label="重命名会话"
                        title="重命名"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteConversation(conversation.id)}
                        aria-label="删除会话"
                        title="删除"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button type="button" aria-label="更多会话操作" title="更多">
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="server-status">
          <Wifi size={16} />
          <span>{health ? `服务端 ${health.modelMode}` : isBooting ? "连接中" : "离线缓存"}</span>
        </div>
      </aside>

      <section className="chat-panel" aria-label="聊天窗口">
        <header className="chat-header">
          <div className="chat-title-stack">
            <button className="mobile-menu-button" type="button" aria-label="打开侧边栏">
              <Menu size={22} />
            </button>
            <button className="model-selector" type="button" aria-label="切换模型">
              <span>Qwen3.5-千问</span>
              <ChevronDown size={16} />
            </button>
            <h2>{selectedConversation?.title ?? "选择或新建一个会话"}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => void handleClearMessages()}
            disabled={!selectedConversationId || selectedMessages.length === 0}
            aria-label="清空会话"
            title="清空会话"
          >
            <Trash2 size={18} />
          </button>
        </header>

        {error ? (
          <div className="error-banner" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            {failedPrompt ? (
              <button type="button" onClick={() => void handleSend(failedPrompt)} disabled={isSending}>
                重试
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="messages" aria-live="polite">
          {selectedMessages.length === 0 ? (
            <div className="welcome">
              <h3>你好，我是千问</h3>
              <p>可以向我提问、让我解释代码，或请我用 Markdown 整理方案。</p>
            </div>
          ) : (
            selectedMessages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
          <div ref={messagesEndRef} className="messages-end" />
        </div>

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="给千问发送消息..."
            rows={2}
          />
          <div className="composer-toolbar" aria-label="输入工具栏">
            <div className="composer-tools">
              <button type="button" className="tool-icon" aria-label="添加内容">
                <Plus size={20} />
              </button>
              <button type="button" className="tool-chip">
                <Sparkles size={17} />
                <span>任务助理</span>
              </button>
              <button type="button" className="tool-chip">
                <Brain size={17} />
                <span>思考</span>
              </button>
              <button type="button" className="tool-chip">
                <Briefcase size={17} />
                <span>办事</span>
              </button>
              <button type="button" className="tool-chip">
                <Image size={17} />
                <span>AI 生图</span>
              </button>
            </div>
            <div className="composer-actions">
              <button type="button" className="mic-button" aria-label="语音输入">
                <Mic size={18} />
              </button>
              <button className="send-button" type="submit" disabled={!draft.trim() || isSending} aria-label="发送消息">
                {isSending ? <Loader2 className="spinning" size={18} /> : <ArrowUp size={20} />}
              </button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? normalizePersistedState(JSON.parse(raw)) : emptyState;
  } catch {
    return emptyState;
  }
}

function mergeConversations(local: Conversation[], remote: Conversation[]) {
  return sortConversations([...remote, ...local].reduce<Conversation[]>((items, conversation) => upsertConversation(items, conversation), []));
}

function upsertConversation(items: Conversation[], conversation: Conversation) {
  const withoutCurrent = items.filter((item) => item.id !== conversation.id);
  return sortConversations([conversation, ...withoutCurrent]);
}

function sortConversations(items: Conversation[]) {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function upsertMessage(items: ChatMessage[], message: ChatMessage) {
  const index = items.findIndex((item) => item.id === message.id);
  if (index === -1) {
    return [...items, message];
  }

  const next = [...items];
  next[index] = message;
  return next;
}

function applyStreamEvent(
  event: ChatStreamEvent,
  setConversations: Dispatch<SetStateAction<Conversation[]>>,
  setMessagesByConversation: Dispatch<SetStateAction<Record<string, ChatMessage[]>>>,
  setSelectedConversationId: Dispatch<SetStateAction<string | undefined>>
) {
  if (event.type === "conversation") {
    setConversations((current) => upsertConversation(current, event.conversation));
    setSelectedConversationId(event.conversation.id);
    return;
  }

  if (event.type === "message") {
    setMessagesByConversation((current) => ({
      ...current,
      [event.message.conversationId]: upsertMessage(current[event.message.conversationId] ?? [], event.message)
    }));
    return;
  }

  if (event.type === "delta") {
    setMessagesByConversation((current) => ({
      ...current,
      [event.conversationId]: (current[event.conversationId] ?? []).map((message) =>
        message.id === event.messageId
          ? {
              ...message,
              content: `${message.content}${event.delta}`,
              status: "streaming",
              updatedAt: new Date().toISOString()
            }
          : message
      )
    }));
    return;
  }

  if (event.type === "done") {
    setMessagesByConversation((current) => ({
      ...current,
      [event.message.conversationId]: upsertMessage(current[event.message.conversationId] ?? [], event.message)
    }));
    return;
  }

  if (event.type === "error" && event.conversationId && event.messageId) {
    const conversationId = event.conversationId;
    const messageId = event.messageId;

    setMessagesByConversation((current) => ({
      ...current,
      [conversationId]: (current[conversationId] ?? []).map((message) =>
        message.id === messageId
          ? {
              ...message,
              status: "error",
              error: event.error,
              updatedAt: new Date().toISOString()
            }
          : message
      )
    }));
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function normalizePersistedState(value: unknown): PersistedState {
  const source = (value ?? {}) as Partial<PersistedState>;
  const conversations = Array.isArray(source.conversations) ? source.conversations.map(normalizeConversation) : [];
  const messagesByConversation =
    source.messagesByConversation && typeof source.messagesByConversation === "object"
      ? (source.messagesByConversation as Record<string, ChatMessage[]>)
      : {};

  return {
    conversations,
    messagesByConversation,
    selectedConversationId: typeof source.selectedConversationId === "string" ? source.selectedConversationId : undefined
  };
}

function normalizeConversation(conversation: Partial<Conversation>): Conversation {
  return {
    id: String(conversation.id ?? crypto.randomUUID()),
    title: conversation.title ?? "新会话",
    pinned: Boolean(conversation.pinned),
    createdAt: conversation.createdAt ?? new Date().toISOString(),
    updatedAt: conversation.updatedAt ?? new Date().toISOString()
  };
}
