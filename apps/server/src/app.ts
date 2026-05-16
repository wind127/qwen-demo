import cors from "@fastify/cors";
import Fastify, { type FastifyReply } from "fastify";
import type { ChatRequest, ChatStreamEvent, CreateConversationRequest, UpdateConversationRequest } from "@qianwen/shared";
import { getServerConfig } from "./env";
import { createChatStore } from "./store";
import { createModelProvider } from "./model";

export interface BuildAppOptions {
  forceMock?: boolean;
  mockDelayMs?: number;
  forceStreamError?: boolean;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });
  const store = createChatStore();
  const config = getServerConfig();
  const modelProvider = createModelProvider({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    model: config.model,
    forceMock: options.forceMock,
    mockDelayMs: options.mockDelayMs
  });
  const streamReply: typeof modelProvider.streamReply = options.forceStreamError
    ? async function* () {
        throw new Error("Forced stream error");
      }
    : modelProvider.streamReply;

  app.register(cors, {
    origin: config.webOrigin
  });

  app.get("/health", async () => ({
    status: "ok" as const,
    service: "qianwen-demo-server" as const,
    modelMode: modelProvider.mode,
    timestamp: new Date().toISOString(),
    version: "0.1.0"
  }));

  app.get("/conversations", async () => ({
    conversations: store.listConversations()
  }));

  app.post<{ Body: CreateConversationRequest }>("/conversations", async (request) => ({
    conversation: store.createConversation(request.body?.title)
  }));

  app.patch<{ Params: { id: string }; Body: UpdateConversationRequest }>("/conversations/:id", async (request, reply) => {
    const conversation = store.updateConversation(request.params.id, {
      title: request.body?.title,
      pinned: request.body?.pinned
    });

    if (!conversation) {
      return reply.code(404).send({ error: "Conversation not found" });
    }

    return { conversation };
  });

  app.delete<{ Params: { id: string } }>("/conversations/:id", async (request, reply) => {
    const deleted = store.deleteConversation(request.params.id);
    if (!deleted) {
      return reply.code(404).send({ error: "Conversation not found" });
    }

    return {
      conversations: store.listConversations()
    };
  });

  app.get<{ Params: { id: string } }>("/conversations/:id/messages", async (request, reply) => {
    const conversation = store.getConversation(request.params.id);
    if (!conversation) {
      return reply.code(404).send({ error: "Conversation not found" });
    }

    return {
      conversation,
      messages: store.listMessages(conversation.id)
    };
  });

  app.delete<{ Params: { id: string } }>("/conversations/:id/messages", async (request, reply) => {
    const conversation = store.getConversation(request.params.id);
    if (!conversation) {
      return reply.code(404).send({ error: "Conversation not found" });
    }

    return {
      conversation,
      messages: store.clearMessages(conversation.id)
    };
  });

  app.post<{ Body: ChatRequest }>("/chat", async (request, reply) => {
    const prompt = validatePrompt(request.body?.message);
    if (!prompt) {
      return reply.code(400).send({ error: "message is required" });
    }

    const conversation = store.ensureConversation(request.body?.conversationId, prompt);
    const userMessage = store.addMessage({
      conversationId: conversation.id,
      role: "user",
      content: prompt,
      status: "sent"
    });
    const assistantMessage = store.addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: "",
      status: "pending"
    });

    try {
      const content = await modelProvider.generateReply(store.listMessages(conversation.id));
      const completedMessage = store.updateMessage(assistantMessage.id, {
        content,
        status: "sent"
      });

      return {
        conversation: store.getConversation(conversation.id) ?? conversation,
        userMessage,
        assistantMessage: completedMessage ?? assistantMessage
      };
    } catch (error) {
      const failedMessage = store.updateMessage(assistantMessage.id, {
        status: "error",
        error: getErrorMessage(error)
      });

      return reply.code(500).send({
        conversation,
        userMessage,
        assistantMessage: failedMessage ?? assistantMessage
      });
    }
  });

  app.post<{ Body: ChatRequest }>("/chat/stream", async (request, reply) => {
    const prompt = validatePrompt(request.body?.message);
    if (!prompt) {
      return reply.code(400).send({ error: "message is required" });
    }

    const conversation = store.ensureConversation(request.body?.conversationId, prompt);
    const userMessage = store.addMessage({
      conversationId: conversation.id,
      role: "user",
      content: prompt,
      status: "sent"
    });
    const assistantMessage = store.addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: "",
      status: "streaming"
    });

    startSse(reply, request.headers.origin);
    sendSse(reply, { type: "conversation", conversation: store.getConversation(conversation.id) ?? conversation });
    sendSse(reply, { type: "message", message: userMessage });
    sendSse(reply, { type: "message", message: assistantMessage });

    let content = "";
    try {
      for await (const delta of streamReply(store.listMessages(conversation.id))) {
        content += delta;
        sendSse(reply, {
          type: "delta",
          conversationId: conversation.id,
          messageId: assistantMessage.id,
          delta
        });
      }

      const completedMessage =
        store.updateMessage(assistantMessage.id, {
          content,
          status: "sent"
        }) ?? assistantMessage;
      sendSse(reply, { type: "done", message: completedMessage });
    } catch (error) {
      const failedMessage = store.updateMessage(assistantMessage.id, {
        content,
        status: "error",
        error: getErrorMessage(error)
      });
      sendSse(reply, {
        type: "error",
        conversationId: conversation.id,
        messageId: failedMessage?.id ?? assistantMessage.id,
        error: getErrorMessage(error)
      });
    } finally {
      reply.raw.end();
    }

    return reply;
  });

  return app;
}

function validatePrompt(message: string | undefined) {
  const prompt = message?.trim();
  return prompt ? prompt : null;
}

function startSse(reply: FastifyReply, origin?: string) {
  reply.raw.writeHead(200, {
    ...(origin
      ? {
          "access-control-allow-origin": origin,
          vary: "Origin"
        }
      : {
          "access-control-allow-origin": "*"
        }),
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  });
}

function sendSse(reply: FastifyReply, event: ChatStreamEvent) {
  reply.raw.write(`event: ${event.type}\n`);
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server error";
}
