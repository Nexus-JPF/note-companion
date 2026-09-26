import { convertLegacyToUIMessage, getMessageText } from "./ui-message";
import {
  extractToolInvocationsFromMessage,
  toToolInvocation,
} from "../types/chat-api";
import type { UIMessage } from "ai";

describe("convertLegacyToUIMessage", () => {
  it("converts v4 content + toolInvocations into parts", () => {
    const message = convertLegacyToUIMessage({
      id: "m1",
      role: "assistant",
      content: "Done",
      toolInvocations: [
        {
          toolCallId: "t1",
          toolName: "getSearchQuery",
          args: { query: "inbox" },
          result: "[{}]",
          state: "result",
        },
      ],
    });

    expect(message.id).toBe("m1");
    expect(message.role).toBe("assistant");
    expect(getMessageText(message)).toBe("Done");
    const toolPart = message.parts.find(
      part => (part as { type?: string }).type === "tool-getSearchQuery"
    ) as { toolCallId: string; state: string; output?: unknown; input?: unknown };
    expect(toolPart.toolCallId).toBe("t1");
    expect(toolPart.state).toBe("output-available");
    expect(toolPart.output).toBe("[{}]");
    expect(toolPart.input).toEqual({ query: "inbox" });
  });

  it("passes through existing parts", () => {
    const message = convertLegacyToUIMessage({
      id: "m2",
      role: "user",
      parts: [{ type: "text", text: "hello" }],
    });
    expect(message.parts).toEqual([{ type: "text", text: "hello" }]);
  });

  it("rewrites v4 tool-invocation parts instead of passing them through", () => {
    const message = convertLegacyToUIMessage({
      id: "m4",
      role: "assistant",
      parts: [
        { type: "text", text: "searching" },
        {
          type: "tool-invocation",
          toolInvocation: {
            toolCallId: "t2",
            toolName: "getSearchQuery",
            args: { query: "inbox" },
            result: "[{}]",
            state: "result",
          },
        },
      ],
    });
    expect(message.parts.find(part => part.type === "text")).toEqual({
      type: "text",
      text: "searching",
    });
    expect(
      message.parts.some(part => part.type === "tool-invocation")
    ).toBe(false);
    const toolPart = message.parts.find(
      part => (part as { type?: string }).type === "tool-getSearchQuery"
    ) as { toolCallId: string; state: string; output?: unknown; input?: unknown };
    expect(toolPart.toolCallId).toBe("t2");
    expect(toolPart.state).toBe("output-available");
    expect(toolPart.output).toBe("[{}]");
    expect(toolPart.input).toEqual({ query: "inbox" });
  });

  it("converts experimental_attachments to file parts", () => {
    const message = convertLegacyToUIMessage({
      id: "m3",
      role: "user",
      content: "see image",
      experimental_attachments: [
        {
          name: "shot.png",
          contentType: "image/png",
          url: "data:image/png;base64,abc",
        },
      ],
    });
    const file = message.parts.find(part => part.type === "file") as {
      filename?: string;
      mediaType: string;
      url: string;
    };
    expect(file.filename).toBe("shot.png");
    expect(file.mediaType).toBe("image/png");
    expect(file.url).toContain("data:image/png");
  });
});

describe("extractToolInvocationsFromMessage", () => {
  it("reads v5 tool-* parts and maps output to result for handlers", () => {
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-getSearchQuery",
          toolCallId: "c1",
          state: "output-available",
          input: { query: "tags" },
          output: "ok",
        },
      ],
    } as unknown as UIMessage;

    const invocations = extractToolInvocationsFromMessage(message);
    expect(invocations).toEqual([
      {
        toolCallId: "c1",
        toolName: "getSearchQuery",
        args: { query: "tags" },
        result: "ok",
        state: "result",
      },
    ]);

    const client = toToolInvocation(invocations[0]);
    expect(client.args).toEqual({ query: "tags" });
    expect("result" in client).toBe(true);
    expect(client.result).toBe("ok");
  });

  it("omits result on pending tool calls so handlers still execute", () => {
    const message = {
      id: "a2",
      role: "assistant",
      parts: [
        {
          type: "tool-fetchUrlContent",
          toolCallId: "c2",
          state: "input-available",
          input: { url: "https://example.com" },
        },
      ],
    } as unknown as UIMessage;

    const client = toToolInvocation(
      extractToolInvocationsFromMessage(message)[0]
    );
    expect("result" in client).toBe(false);
    expect(client.args).toEqual({ url: "https://example.com" });
  });
});
