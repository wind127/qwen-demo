import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  ConversationsResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  HealthResponse,
  MessagesResponse,
  UpdateConversationRequest
} from "@qianwen/shared";

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface StreamChatOptions {
  signal?: AbortSignal;
  onEvent?: (event: ChatStreamEvent) => void;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetcher = options.fetchImpl ?? fetch;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {})
      }
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, response.status, body);
    }

    return body as T;
  }

  return {
    health: () => request<HealthResponse>("/health"),
    listConversations: () => request<ConversationsResponse>("/conversations"),
    createConversation: (body: CreateConversationRequest = {}) =>
      request<CreateConversationResponse>("/conversations", {
        method: "POST",
        body: JSON.stringify(body)
      }),
    updateConversation: (conversationId: string, body: UpdateConversationRequest) =>
      request<CreateConversationResponse>(`/conversations/${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
    deleteConversation: (conversationId: string) =>
      request<ConversationsResponse>(`/conversations/${conversationId}`, {
        method: "DELETE"
      }),
    getMessages: (conversationId: string) =>
      request<MessagesResponse>(`/conversations/${conversationId}/messages`),
    clearMessages: (conversationId: string) =>
      request<MessagesResponse>(`/conversations/${conversationId}/messages`, {
        method: "DELETE"
      }),
    chat: (body: ChatRequest) =>
      request<ChatResponse>("/chat", {
        method: "POST",
        body: JSON.stringify(body)
      }),
    streamChat: async (body: ChatRequest, streamOptions: StreamChatOptions = {}) => {
      const response = await fetcher(`${baseUrl}/chat/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream"
        },
        body: JSON.stringify(body),
        signal: streamOptions.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new ApiError(`HTTP ${response.status}`, response.status, text);
      }

      const events: ChatStreamEvent[] = [];
      for await (const event of parseSseStream(response)) {
        events.push(event);
        streamOptions.onEvent?.(event);
      }

      return events;
    }
  };
}

export type QianwenApiClient = ReturnType<typeof createApiClient>;

async function* parseSseStream(response: Response): AsyncGenerator<ChatStreamEvent> {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\n\n/);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (event) {
        yield event;
      }
    }
  }

  buffer += decoder.decode();
  const event = parseSseFrame(buffer);
  if (event) {
    yield event;
  }
}

function parseSseFrame(frame: string): ChatStreamEvent | null {
  const dataLines = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  return JSON.parse(dataLines.join("\n")) as ChatStreamEvent;
}
