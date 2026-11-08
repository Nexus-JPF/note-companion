import { validatePdfOcrInput } from "./pdf-ocr-input";

describe("validatePdfOcrInput", () => {
  it("rejects missing pdf", () => {
    const result = validatePdfOcrInput(undefined);
    expect(result.ok).toBe(false);
  });

  it("accepts minimal valid PDF header", () => {
    const buffer = Buffer.from("%PDF-1.4\n%EOF");
    const base64 = buffer.toString("base64");
    const result = validatePdfOcrInput(base64);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.buffer.toString("ascii", 0, 4)).toBe("%PDF");
    }
  });
});
