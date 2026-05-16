import { CircleAlert, Copy, Loader2, Pencil, RefreshCw, Share2, ThumbsDown, ThumbsUp, Volume2 } from "lucide-react";
import type { ChatMessage } from "@qianwen/shared";
import { MarkdownMessage } from "./MarkdownMessage";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <article className={isAssistant ? "message assistant" : "message user"}>
      <div className="message-body">
        <div className="message-meta">
          <span>{isAssistant ? "千问" : "你"}</span>
          {message.status === "streaming" ? (
            <span className="status">
              <Loader2 className="spinning" size={14} />
              生成中
            </span>
          ) : null}
          {message.status === "error" ? (
            <span className="status error">
              <CircleAlert size={14} />
              失败
            </span>
          ) : null}
        </div>
        {isAssistant ? <MarkdownMessage content={message.content || "正在思考..."} /> : <p>{message.content}</p>}
        {message.error ? <p className="message-error">{message.error}</p> : null}
        {isAssistant ? (
          <div className="assistant-actions" aria-label="回复操作">
            <button type="button" aria-label="朗读回复">
              <Volume2 size={17} />
            </button>
            <button type="button" aria-label="分享回复">
              <Share2 size={17} />
            </button>
            <button
              type="button"
              aria-label="复制回复"
              onClick={() => void navigator.clipboard?.writeText(message.content)}
            >
              <Copy size={17} />
            </button>
            <button type="button" aria-label="编辑回复">
              <Pencil size={17} />
            </button>
            <button type="button" aria-label="重新生成">
              <RefreshCw size={17} />
            </button>
            <button type="button" aria-label="赞同回复">
              <ThumbsUp size={17} />
            </button>
            <button type="button" aria-label="反对回复">
              <ThumbsDown size={17} />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
