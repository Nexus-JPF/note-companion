import { generateText } from "ai";
import {
  extractTextFromVisionImage,
  isRefusalText,
  REFUSAL_ERROR_MESSAGE,
  REFUSAL_RETRY_HINT,
} from "./ocr-extract";

jest.mock("ai", () => ({ generateText: jest.fn() }));
jest.mock("@/lib/models", () => ({ getVisionModel: jest.fn(() => "mock-model") }));

const mockGenerate = generateText as jest.Mock;
const image = {
  kind: "dataUrl" as const,
  dataUrl: "data:image/png;base64,iVBORw0KGgo=",
};

const reply = (text: string) => ({ text, usage: { totalTokens: 10 } });
const promptOf = (call: number): string =>
  mockGenerate.mock.calls[call][0].messages[0].content[0].text;

describe("isRefusalText", () => {
  it.each([
    "I'm sorry, I can't assist with that.",
    "I’m sorry, but I can’t help with that request.",
    "Sorry, I cannot process this image.",
    "I cannot assist with that.",
  ])("detects %s", (t) => expect(isRefusalText(t)).toBe(true));

  it.each([
    "",
    "Meeting notes\n- buy milk\n- call Sam",
    "Dear Sam, I'm sorry I missed your birthday. " + "x".repeat(400),
    "Todo: I can't forget to email Anna",
  ])("ignores %j", (t) => expect(isRefusalText(t)).toBe(false));
});

describe("extractTextFromVisionImage refusals", () => {
  beforeEach(() => mockGenerate.mockReset());

  it("returns text directly when there is no refusal", async () => {
    mockGenerate.mockResolvedValueOnce(reply("hello"));
    const r = await extractTextFromVisionImage({ image });
    expect(r).toEqual({ text: "hello", tokensUsed: 10 });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("retries once with a hint and returns the recovered text", async () => {
    mockGenerate
      .mockResolvedValueOnce(reply("I'm sorry, I can't assist with that."))
      .mockResolvedValueOnce(reply("Shopping list: eggs"));
    const r = await extractTextFromVisionImage({ image });
    expect(r.text).toBe("Shopping list: eggs");
    expect(r.error).toBeUndefined();
    expect(r.tokensUsed).toBe(20);
    expect(promptOf(1)).toContain(REFUSAL_RETRY_HINT);
  });

  it("returns an error when the retry is also a refusal", async () => {
    mockGenerate.mockResolvedValue(reply("I'm sorry, I can't assist with that."));
    const r = await extractTextFromVisionImage({ image });
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(r.text).toBe("");
    expect(r.error).toBe(REFUSAL_ERROR_MESSAGE);
  });

  it("retries on refusal even when retryOnEmpty is false", async () => {
    mockGenerate
      .mockResolvedValueOnce(reply("I cannot assist with that."))
      .mockResolvedValueOnce(reply("ok text"));
    const r = await extractTextFromVisionImage({ image, retryOnEmpty: false });
    expect(r.text).toBe("ok text");
  });
});
