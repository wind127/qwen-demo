import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyCode() {
    await navigator.clipboard?.writeText(code);
    setCopied(true);
  }

  return (
    <figure className="code-block">
      <figcaption>
        <span>{language ?? "code"}</span>
        <button type="button" onClick={() => void copyCode()} aria-label="复制代码">
          {copied ? <Check size={15} /> : <Copy size={15} />}
          <span>{copied ? "已复制" : "复制"}</span>
        </button>
      </figcaption>
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  );
}
