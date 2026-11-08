import { ocrPdfFromBuffer } from "./ocr-pdf";
import { extractTextFromVisionImage, REFUSAL_ERROR_MESSAGE } from "./ocr-extract";

jest.mock("sharp", () =>
  jest.fn(() => ({
    metadata: async () => ({ pages: 3 }),
    png: () => ({ toBuffer: async () => Buffer.from("png") }),
  }))
);
jest.mock("./ocr-extract", () => ({
  extractTextFromVisionImage: jest.fn(),
  REFUSAL_ERROR_MESSAGE: "refused",
}));

const extract = extractTextFromVisionImage as jest.Mock;
const refused = { text: "", tokensUsed: 5, error: "refused", refused: true };
const ok = (text: string) => ({ text, tokensUsed: 5 });

describe("ocrPdfFromBuffer refusals", () => {
  beforeEach(() => extract.mockReset());

  it("keeps readable pages when one page is refused", async () => {
    extract
      .mockResolvedValueOnce(ok("page one"))
      .mockResolvedValueOnce(refused)
      .mockResolvedValueOnce(ok("page three"));
    const r = await ocrPdfFromBuffer(Buffer.from("pdf"));
    expect(r.error).toBeUndefined();
    expect(r.textContent).toContain("page one");
    expect(r.textContent).toContain("[Page 2 could not be read]");
    expect(r.textContent).toContain("page three");
  });

  it("errors when every page is refused", async () => {
    extract.mockResolvedValue(refused);
    const r = await ocrPdfFromBuffer(Buffer.from("pdf"));
    expect(r.error).toBe(REFUSAL_ERROR_MESSAGE);
    expect(r.textContent).toBe("");
  });
});
