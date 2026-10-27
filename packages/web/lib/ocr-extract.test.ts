import { generateText } from "ai";
import {
  extractTextFromVisionImage,
  isRefusalText,
  REFUSAL_ERROR_MESSAGE,
  REFUSAL_RETRY_HINT,
  stripCodeFence,
} from "./ocr-extract";

jest.mock("ai", () => ({ generateText: jest.fn() }));
jest.mock("@/lib/models", () => ({ getVisionModel: jest.fn(() => "mock-model"),
  getVisionFallbackModel: jest.fn(() => null),
}));

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
    "Sorry, I'll be late Friday",
    "Apologies to Sam. Call back.",
    "I'm sorry, Dad",
    "I can't help but think about Monday",
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

  it("returns empty text without error when the hinted retry is empty", async () => {
    mockGenerate
      .mockResolvedValueOnce(reply("I cannot assist with that."))
      .mockResolvedValueOnce(reply(""));
    const r = await extractTextFromVisionImage({ image });
    expect(r.error).toBeUndefined();
    expect(r.text).toBe("");
  });

  it("retries on refusal even when retryOnEmpty is false", async () => {
    mockGenerate
      .mockResolvedValueOnce(reply("I cannot assist with that."))
      .mockResolvedValueOnce(reply("ok text"));
    const r = await extractTextFromVisionImage({ image, retryOnEmpty: false });
    expect(r.text).toBe("ok text");
  });

  it("falls back to the second model when the primary keeps refusing", async () => {
    mockGenerate
      .mockResolvedValueOnce(reply("I'm sorry, I can't assist with that."))
      .mockResolvedValueOnce(reply("I'm sorry, I can't assist with that."))
      .mockResolvedValueOnce(reply("Reunion lundi 14h"));
    const r = await extractTextFromVisionImage({
      image,
      fallbackModel: "fallback-model" as any,
    });
    expect(mockGenerate).toHaveBeenCalledTimes(3);
    expect(mockGenerate.mock.calls[2][0].model).toBe("fallback-model");
    expect(r.text).toBe("Reunion lundi 14h");
    expect(r.error).toBeUndefined();
  });

  it("falls back when the primary returns empty text twice", async () => {
    mockGenerate
      .mockResolvedValueOnce(reply(""))
      .mockResolvedValueOnce(reply(""))
      .mockResolvedValueOnce(reply("recovered"));
    const r = await extractTextFromVisionImage({
      image,
      fallbackModel: "fallback-model" as any,
    });
    expect(r.text).toBe("recovered");
  });

  it("errors when the fallback also refuses", async () => {
    mockGenerate.mockResolvedValue(reply("I cannot assist with that."));
    const r = await extractTextFromVisionImage({
      image,
      fallbackModel: "fallback-model" as any,
    });
    expect(r.refused).toBe(true);
    expect(r.error).toBe(REFUSAL_ERROR_MESSAGE);
  });

  it("strips a wrapping code fence from the transcription", async () => {
    mockGenerate.mockResolvedValueOnce(reply("```\nline one\nline two\n```"));
    const r = await extractTextFromVisionImage({ image });
    expect(r.text).toBe("line one\nline two");
  });
});

describe("stripCodeFence", () => {
  it("leaves unfenced text and inner fences alone", () => {
    expect(stripCodeFence("plain")).toBe("plain");
    expect(stripCodeFence("a ```x``` b")).toBe("a ```x``` b");
  });
});
