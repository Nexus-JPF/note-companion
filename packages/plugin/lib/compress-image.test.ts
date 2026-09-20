import { isWebP } from "./compress-image";

function bytesFromAscii(text: string): Uint8Array {
  return Uint8Array.from(text, char => char.charCodeAt(0));
}

describe("isWebP", () => {
  it("detects a RIFF/WEBP header", () => {
    const header = new Uint8Array(12);
    header.set(bytesFromAscii("RIFF"), 0);
    header.set(bytesFromAscii("WEBP"), 8);
    expect(isWebP(header)).toBe(true);
  });

  it("rejects non-webp bytes", () => {
    expect(isWebP(bytesFromAscii("not an image"))).toBe(false);
  });

  it("rejects short buffers", () => {
    expect(isWebP(new Uint8Array([1, 2, 3]))).toBe(false);
  });
});
