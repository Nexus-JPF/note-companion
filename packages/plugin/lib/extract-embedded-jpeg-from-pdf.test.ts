import { readFileSync } from "fs";
import { extractLargestJpegFromPdf } from "./extract-embedded-jpeg-from-pdf";

describe("extractLargestJpegFromPdf", () => {
  it("returns null for non-PDF bytes", () => {
    expect(extractLargestJpegFromPdf(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("extracts a JPEG from a photo PDF fixture when present", () => {
    const fixturePath =
      "/Users/jean-philippefong/.cursor/projects/Users-jean-philippefong-Developer-GitHub-note-companion/attachments/61a367ca-4ddc-4a4f-8052-c5a73caafe2e/IMG_9207.png.pdf";
    let pdf: Buffer;
    try {
      pdf = readFileSync(fixturePath);
    } catch {
      return;
    }
    const jpeg = extractLargestJpegFromPdf(pdf);
    expect(jpeg).not.toBeNull();
    if (jpeg) {
      const header = new Uint8Array(jpeg, 0, 3);
      expect(header[0]).toBe(0xff);
      expect(header[1]).toBe(0xd8);
      expect(header[2]).toBe(0xff);
      expect(jpeg.byteLength).toBeGreaterThan(10_000);
    }
  });
});
