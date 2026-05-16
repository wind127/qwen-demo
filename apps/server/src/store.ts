import { randomUUID } from "node:crypto";
import type { ChatMessage, Conversation, MessageRole, MessageStatus } from "@qianwen/shared";
import { DEFAULT_CONVERSATION_TITLE, createConversationTitle } from "@qianwen/shared";

export interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  error?: string;
}

export function createChatStore() {
  const conversations = new Map<string, Conversation>();
  const messages = new Map<string, ChatMessage[]>();

  function listConversations() {
    return [...conversations.values()].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  function createConversation(title = DEFAULT_CONVERSATION_TITLE) {
    const timestamp = new Date().toISOString();
    const conversation: Conversation = {
      id: randomUUID(),
      title: title.trim() || DEFAULT_CONVERSATION_TITLE,
      pinned: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    conversations.set(conversation.id, conversation);
    messages.set(conversation.id, []);
    return conversation;
  }

  function getConversation(id: string) {
    return conversations.get(id);
  }

  function updateConversation(id: string, patch: Partial<Pick<Conversation, "title" | "pinned">>) {
    const conversation = conversations.get(id);
    if (!conversation) {
      return undefined;
    }

    const updated: Conversation = {
      ...conversation,
      ...(patch.title !== undefined ? { title: patch.title.trim() || DEFAULT_CONVERSATION_TITLE } : {}),
      ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      updatedAt: new Date().toISOString()
    };

    conversations.set(id, updated);
    return updated;
  }

  function deleteConversation(id: string) {
    const existed = conversations.delete(id);
    messages.delete(id);
    return existed;
  }

  function ensureConversation(id: string | undefined, firstMessage: string) {
    if (id) {
      const existing = getConversation(id);
      if (existing) {
        return existing;
      }
    }

    return createConversation(createConversationTitle(firstMessage));
  }

  function touchConversation(id: string, titleSource?: string) {
    const conversation = conversations.get(id);
    if (!conversation) {
      return undefined;
    }

    const nextTitle =
      conversation.title === DEFAULT_CONVERSATION_TITLE && titleSource
        ? createConversationTitle(titleSource)
        : conversation.title;

    const updated: Conversation = {
      ...conversation,
      title: nextTitle,
      updatedAt: new Date().toISOString()
    };

    conversations.set(id, updated);
    return updated;
  }

  function listMessages(conversationId: string) {
    return [...(messages.get(conversationId) ?? [])];
  }

  function addMessage(input: CreateMessageInput) {
    const timestamp = new Date().toISOString();
    const message: ChatMessage = {
      id: randomUUID(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      status: input.status ?? "sent",
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(input.error ? { error: input.error } : {})
    };

    messages.set(input.conversationId, [...(messages.get(input.conversationId) ?? []), message]);
    touchConversation(input.conversationId, input.role === "user" ? input.content : undefined);
    return message;
  }

  function updateMessage(messageId: string, patch: Partial<Pick<ChatMessage, "content" | "status" | "error">>) {
    for (const [conversationId, existingMessages] of messages.entries()) {
      const index = existingMessages.findIndex((message) => message.id === messageId);
      if (index === -1) {
        continue;
      }

      const updated: ChatMessage = {
        ...existingMessages[index],
        ...patch,
        updatedAt: new Date().toISOString()
      };

      const nextMessages = [...existingMessages];
      nextMessages[index] = updated;
      messages.set(conversationId, nextMessages);
      touchConversation(conversationId);
      return updated;
    }

    return undefined;
  }

  function clearMessages(conversationId: string) {
    messages.set(conversationId, []);
    touchConversation(conversationId);
    return listMessages(conversationId);
  }

  return {
    listConversations,
    createConversation,
    getConversation,
    updateConversation,
    deleteConversation,
    ensureConversation,
    listMessages,
    addMessage,
    updateMessage,
    clearMessages
  };
}

export type ChatStore = ReturnType<typeof createChatStore>;
