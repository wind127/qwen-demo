import { useState } from "react";
import { CircleAlert, Copy, Loader2, Pencil, RefreshCw, Share2, ThumbsDown, ThumbsUp, Volume2 } from "lucide-react";
import type { ChatMessage } from "@qianwen/shared";
import { MarkdownMessage } from "./MarkdownMessage";

interface MessageBubbleProps {
  message: ChatMessage;
  onNotice?: (message: string) => void;
  onRegenerate?: (message: ChatMessage) => void;
  onUseAsDraft?: (content: string) => void;
}

export function MessageBubble({ message, onNotice, onRegenerate, onUseAsDraft }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  function notify(text: string) {
    onNotice?.(text);
  }

  async function copyReply() {
    await navigator.clipboard?.writeText(message.content);
    notify("回复已复制。");
  }

  async function shareReply() {
    const shareApi = "share" in navigator ? navigator.share : undefined;
    if (shareApi) {
      await shareApi.call(navigator, {
        title: "千问回复",
        text: message.content
      });
      notify("已打开系统分享。");
      return;
    }

    await copyReply();
    notify("当前浏览器不支持系统分享，回复已复制。");
  }

  function speakReply() {
    if (!("speechSynthesis" in window) || !message.content.trim()) {
      notify("当前浏览器不支持朗读。");
      return;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(message.content));
    notify("正在朗读回复。");
  }

  function voteReply(nextVote: "up" | "down") {
    setVote(nextVote);
    notify(nextVote === "up" ? "已记录赞同反馈。" : "已记录反对反馈。");
  }

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
            <button type="button" aria-label="朗读回复" onClick={speakReply}>
              <Volume2 size={17} />
            </button>
            <button type="button" aria-label="分享回复" onClick={() => void shareReply()}>
              <Share2 size={17} />
            </button>
            <button type="button" aria-label="复制回复" onClick={() => void copyReply()}>
              <Copy size={17} />
            </button>
            <button
              type="button"
              aria-label="编辑回复"
              onClick={() => {
                onUseAsDraft?.(message.content);
                notify("回复内容已放入输入框。");
              }}
            >
              <Pencil size={17} />
            </button>
            <button
              type="button"
              aria-label="重新生成"
              onClick={() => {
                onRegenerate?.(message);
                notify("已请求重新生成。");
              }}
            >
              <RefreshCw size={17} />
            </button>
            <button type="button" aria-label="赞同回复" aria-pressed={vote === "up"} onClick={() => voteReply("up")}>
              <ThumbsUp size={17} />
            </button>
            <button
              type="button"
              aria-label="反对回复"
              aria-pressed={vote === "down"}
              onClick={() => voteReply("down")}
            >
              <ThumbsDown size={17} />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
