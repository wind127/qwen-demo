export type MessageRole = "system" | "user" | "assistant";

export type MessageStatus = "pending" | "streaming" | "sent" | "error";

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface HealthResponse {
  status: "ok";
  service: "qianwen-demo-server";
  modelMode: "qwen" | "mock";
  timestamp: string;
  version: string;
}

export interface CreateConversationRequest {
  title?: string;
}

export interface CreateConversationResponse {
  conversation: Conversation;
}

export interface UpdateConversationRequest {
  title?: string;
  pinned?: boolean;
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface MessagesResponse {
  conversation: Conversation;
  messages: ChatMessage[];
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
}

export interface ChatResponse {
  conversation: Conversation;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export type ChatStreamEvent =
  | {
      type: "conversation";
      conversation: Conversation;
    }
  | {
      type: "message";
      message: ChatMessage;
    }
  | {
      type: "delta";
      messageId: string;
      conversationId: string;
      delta: string;
    }
  | {
      type: "done";
      message: ChatMessage;
    }
  | {
      type: "error";
      messageId?: string;
      conversationId?: string;
      error: string;
    };

export const DEFAULT_CONVERSATION_TITLE = "新会话";

export function createConversationTitle(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}
