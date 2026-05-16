import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

describe("qianwen server", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp({ forceMock: true, mockDelayMs: 0 });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns health status", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "qianwen-demo-server",
      modelMode: "mock"
    });
  });

  it("creates conversations and stores messages", async () => {
    const conversationResponse = await app.inject({
      method: "POST",
      url: "/conversations",
      payload: { title: "测试会话" }
    });
    const conversation = conversationResponse.json().conversation;

    const chatResponse = await app.inject({
      method: "POST",
      url: "/chat",
      payload: { conversationId: conversation.id, message: "你好，千问" }
    });

    expect(chatResponse.statusCode).toBe(200);
    expect(chatResponse.json().assistantMessage.content).toContain("千问 Demo 助手");

    const messagesResponse = await app.inject({
      method: "GET",
      url: `/conversations/${conversation.id}/messages`
    });

    expect(messagesResponse.json().messages).toHaveLength(2);
  });

  it("streams mock chat events", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/chat/stream",
      payload: { message: "请介绍 demo" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.payload).toContain("event: delta");
    expect(response.payload).toContain("event: done");
  });

  it("rejects empty stream chat requests", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/chat/stream",
      payload: { message: "   " }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "message is required" });
  });

  it("creates a new conversation when stream conversation id is missing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/chat/stream",
      payload: { conversationId: "missing", message: "不存在的会话" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.payload).toContain("event: conversation");
    expect(response.payload).toContain("不存在的会话");
    expect(response.payload).not.toContain('"id":"missing"');
  });

  it("emits stream error events when model streaming fails", async () => {
    const errorApp = buildApp({ forceMock: true, forceStreamError: true });
    await errorApp.ready();

    try {
      const response = await errorApp.inject({
        method: "POST",
        url: "/chat/stream",
        payload: { message: "触发流式错误" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.payload).toContain("event: error");
      expect(response.payload).toContain("Forced stream error");
    } finally {
      await errorApp.close();
    }
  });

  it("rejects empty chat requests", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/chat",
      payload: { message: "   " }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "message is required" });
  });

  it("returns 404 for missing conversations", async () => {
    const messagesResponse = await app.inject({
      method: "GET",
      url: "/conversations/missing/messages"
    });
    const deleteResponse = await app.inject({
      method: "DELETE",
      url: "/conversations/missing"
    });

    expect(messagesResponse.statusCode).toBe(404);
    expect(deleteResponse.statusCode).toBe(404);
  });

  it("clears conversation messages", async () => {
    const chatResponse = await app.inject({
      method: "POST",
      url: "/chat",
      payload: { message: "需要清空的会话" }
    });
    const conversationId = chatResponse.json().conversation.id;

    const clearResponse = await app.inject({
      method: "DELETE",
      url: `/conversations/${conversationId}/messages`
    });

    expect(clearResponse.statusCode).toBe(200);
    expect(clearResponse.json().messages).toEqual([]);
  });

  it("renames, pins and deletes conversations", async () => {
    const conversationResponse = await app.inject({
      method: "POST",
      url: "/conversations",
      payload: { title: "原始标题" }
    });
    const conversation = conversationResponse.json().conversation;

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/conversations/${conversation.id}`,
      payload: { title: "新标题", pinned: true }
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().conversation).toMatchObject({
      title: "新标题",
      pinned: true
    });

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/conversations/${conversation.id}`
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().conversations).toEqual([]);
  });
});
