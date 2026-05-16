import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

const timestamp = "2026-05-12T00:00:00.000Z";

describe("Qianwen web app", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it("creates a conversation, sends a streamed message and persists history", async () => {
    vi.stubGlobal("fetch", vi.fn(mockFetch));
    const user = userEvent.setup();

    render(<App />);

    await screen.findByText("服务端 mock");
    await user.click(screen.getByRole("button", { name: "新建会话" }));
    await user.type(screen.getByPlaceholderText("给千问发送消息..."), "你好{enter}");

    await screen.findByText(/千问 Demo 助手/);
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
    expect(localStorage.getItem("qianwen-web-state-v1")).toContain("千问 Demo 助手");
  });

  it("pins, renames and deletes a conversation", async () => {
    vi.stubGlobal("fetch", vi.fn(mockFetch));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(<App />);

    await screen.findByText("服务端 mock");
    await user.click(screen.getByRole("button", { name: "新建会话" }));
    await user.click(screen.getByRole("button", { name: "置顶会话" }));

    expect(localStorage.getItem("qianwen-web-state-v1")).toContain('"pinned":true');

    await user.click(screen.getByRole("button", { name: "重命名会话" }));
    await user.clear(screen.getByLabelText("会话名称"));
    await user.type(screen.getByLabelText("会话名称"), "项目计划");
    await user.click(screen.getByRole("button", { name: "保存会话名称" }));

    expect(await screen.findAllByText("项目计划")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "删除会话" }));

    expect(screen.getByText("还没有历史会话")).toBeInTheDocument();
  });

  it("shows an error when stream request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/chat/stream")) {
          return new Response("failed", { status: 500 });
        }
        return mockFetch(input, init);
      })
    );
    const user = userEvent.setup();

    render(<App />);

    await screen.findByText("服务端 mock");
    await user.type(screen.getByPlaceholderText("给千问发送消息..."), "触发失败");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    await screen.findByRole("alert");
    expect(screen.getByText("发送失败，请确认服务端已启动后重试。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("retries the last failed prompt", async () => {
    let streamAttempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/chat/stream")) {
          streamAttempts += 1;
          if (streamAttempts === 1) {
            return new Response("failed", { status: 500 });
          }
        }
        return mockFetch(input, init);
      })
    );
    const user = userEvent.setup();

    render(<App />);

    await screen.findByText("服务端 mock");
    await user.type(screen.getByPlaceholderText("给千问发送消息..."), "请重试");
    await user.click(screen.getByRole("button", { name: "发送消息" }));
    await user.click(await screen.findByRole("button", { name: "重试" }));

    expect(await screen.findByText(/千问 Demo 助手/)).toBeInTheDocument();
    expect(streamAttempts).toBe(2);
  });

  it("loads messages for a persisted selected conversation without local message cache", async () => {
    vi.stubGlobal("fetch", vi.fn(mockFetch));
    localStorage.setItem(
      "qianwen-web-state-v1",
      JSON.stringify({
        conversations: [
          {
            id: "c1",
            title: "历史会话",
            pinned: false,
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ],
        messagesByConversation: {},
        selectedConversationId: "c1"
      })
    );

    render(<App />);

    expect(await screen.findByText("历史回答")).toBeInTheDocument();
  });
});

async function mockFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.endsWith("/health")) {
    return jsonResponse({
      status: "ok",
      service: "qianwen-demo-server",
      modelMode: "mock",
      timestamp,
      version: "0.1.0"
    });
  }

  if (url.endsWith("/conversations") && method === "GET") {
    return jsonResponse({ conversations: [] });
  }

  if (url.endsWith("/conversations") && method === "POST") {
    return jsonResponse({
      conversation: {
        id: "c1",
        title: "新会话",
        pinned: false,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });
  }

  if (url.endsWith("/conversations/c1") && method === "PATCH") {
    const body = JSON.parse(String(init?.body ?? "{}"));
    return jsonResponse({
      conversation: {
        id: "c1",
        title: body.title ?? "新会话",
        pinned: body.pinned ?? false,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });
  }

  if (url.endsWith("/conversations/c1") && method === "DELETE") {
    return jsonResponse({ conversations: [] });
  }

  if (url.endsWith("/conversations/c1/messages") && method === "GET") {
    return jsonResponse({
      conversation: {
        id: "c1",
        title: "历史会话",
        pinned: false,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      messages: [
        {
          id: "m1",
          conversationId: "c1",
          role: "assistant",
          content: "历史回答",
          status: "sent",
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ]
    });
  }

  if (url.endsWith("/chat/stream")) {
    const encoder = new TextEncoder();
    const assistantMessage = {
      id: "a1",
      conversationId: "c1",
      role: "assistant",
      content: "我是千问 Demo 助手。\n\n```ts\nconsole.log(\"done\");\n```",
      status: "sent",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    return new Response(
      new ReadableStream({
        start(controller) {
          const frames = [
            {
              type: "conversation",
              conversation: { id: "c1", title: "新会话", pinned: false, createdAt: timestamp, updatedAt: timestamp }
            },
            {
              type: "message",
              message: {
                id: "u1",
                conversationId: "c1",
                role: "user",
                content: "你好",
                status: "sent",
                createdAt: timestamp,
                updatedAt: timestamp
              }
            },
            {
              type: "message",
              message: { ...assistantMessage, content: "", status: "streaming" }
            },
            { type: "delta", messageId: "a1", conversationId: "c1", delta: assistantMessage.content },
            { type: "done", message: assistantMessage }
          ];

          for (const frame of frames) {
            controller.enqueue(encoder.encode(`event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`));
          }
          controller.close();
        }
      }),
      { status: 200, headers: { "content-type": "text/event-stream" } }
    );
  }

  return jsonResponse({}, 404);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
