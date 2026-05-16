import OpenAI from "openai";
import type { ChatMessage } from "@qianwen/shared";

export interface ModelProviderOptions {
  apiKey?: string;
  baseURL: string;
  model: string;
  forceMock?: boolean;
  mockDelayMs?: number;
}

export function createModelProvider(options: ModelProviderOptions) {
  const canUseQwen = Boolean(options.apiKey) && !options.forceMock;
  const client = canUseQwen
    ? new OpenAI({
        apiKey: options.apiKey,
        baseURL: options.baseURL
      })
    : null;

  async function generateReply(messages: ChatMessage[]) {
    if (client) {
      try {
        const completion = await client.chat.completions.create({
          model: options.model,
          messages: toModelMessages(messages),
          temperature: 0.7
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          return content;
        }
      } catch {
        return createMockReply(messages, true);
      }
    }

    return createMockReply(messages, false);
  }

  async function* streamReply(messages: ChatMessage[]) {
    if (client) {
      try {
        const stream = await client.chat.completions.create({
          model: options.model,
          messages: toModelMessages(messages),
          temperature: 0.7,
          stream: true
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        }
        return;
      } catch {
        yield* streamMockReply(messages, options.mockDelayMs ?? 20, true);
        return;
      }
    }

    yield* streamMockReply(messages, options.mockDelayMs ?? 20, false);
  }

  return {
    mode: canUseQwen ? ("qwen" as const) : ("mock" as const),
    generateReply,
    streamReply
  };
}

function toModelMessages(messages: ChatMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content:
        "你是千问 App Demo 的 AI 聊天助手。回答要简洁、清晰、可操作，必要时使用 Markdown。"
    },
    ...messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: message.content
      }))
  ];
}

function createMockReply(messages: ChatMessage[], fallbackFromQwen: boolean) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const userText = latestUserMessage?.content.trim() || "你好";
  const fallbackNote = fallbackFromQwen ? "（真实模型暂不可用，已切换到本地模拟回复。）\n\n" : "";

  return `${fallbackNote}我是千问 Demo 助手，已经收到你的问题：**${userText}**。

你现在看到的是可开箱运行的流式回复示例：

- 会话会保存在本地历史记录中
- 服务端协议兼容真实千问模型
- Markdown 和代码块可以直接渲染

\`\`\`ts
const brand = "千问";
console.log(\`\${brand} Demo 已完成一次问答闭环\`);
\`\`\``;
}

async function* streamMockReply(messages: ChatMessage[], delayMs: number, fallbackFromQwen: boolean) {
  const reply = createMockReply(messages, fallbackFromQwen);
  const chunks = reply.match(/[\s\S]{1,12}/g) ?? [reply];

  for (const chunk of chunks) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    yield chunk;
  }
}

export type ModelProvider = ReturnType<typeof createModelProvider>;
