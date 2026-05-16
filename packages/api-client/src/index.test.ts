import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./index";

describe("api client", () => {
  it("parses server-sent chat stream events", async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => {
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'event: delta\ndata: {"type":"delta","messageId":"m1","conversationId":"c1","delta":"你好"}\n\n'
              )
            );
            controller.enqueue(
              encoder.encode(
                'event: done\ndata: {"type":"done","message":{"id":"m1","conversationId":"c1","role":"assistant","content":"你好","status":"sent","createdAt":"2026-05-12T00:00:00.000Z","updatedAt":"2026-05-12T00:00:00.000Z"}}\n\n'
              )
            );
            controller.close();
          }
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    });

    const client = createApiClient({ baseUrl: "http://local.test/", fetchImpl });
    const events = await client.streamChat({ message: "hi" });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "delta", delta: "你好" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://local.test/chat/stream",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("parses done, error and multiline data frames", async () => {
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async () => {
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                [
                  "event: delta",
                  'data: {"type":"delta",',
                  'data: "messageId":"m2","conversationId":"c2","delta":"多行"}',
                  "",
                  ""
                ].join("\n")
              )
            );
            controller.enqueue(
              encoder.encode(
                'event: error\ndata: {"type":"error","messageId":"m2","conversationId":"c2","error":"模型失败"}\n\n'
              )
            );
            controller.enqueue(
              encoder.encode(
                'event: done\ndata: {"type":"done","message":{"id":"m2","conversationId":"c2","role":"assistant","content":"多行","status":"sent","createdAt":"2026-05-14T00:00:00.000Z","updatedAt":"2026-05-14T00:00:00.000Z"}}\n\n'
              )
            );
            controller.close();
          }
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    });

    const client = createApiClient({ baseUrl: "http://local.test", fetchImpl });
    const events = await client.streamChat({ conversationId: "c2", message: "hi" });

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ type: "delta", messageId: "m2", delta: "多行" });
    expect(events[1]).toMatchObject({ type: "error", messageId: "m2", error: "模型失败" });
    expect(events[2]).toMatchObject({ type: "done", message: { id: "m2", status: "sent" } });
  });
});
