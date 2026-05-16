import { describe, expect, it } from "vitest";
import { DEFAULT_CONVERSATION_TITLE, createConversationTitle } from "./index";

describe("shared conversation helpers", () => {
  it("uses the default title for blank input", () => {
    expect(createConversationTitle("   ")).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  it("normalizes and truncates long titles", () => {
    expect(createConversationTitle("  介绍一下  千问 App Demo 的架构设计  ")).toBe(
      "介绍一下 千问 App Demo 的..."
    );
  });
});
