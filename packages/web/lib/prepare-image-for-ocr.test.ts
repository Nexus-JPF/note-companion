import sharp from "sharp";
import { prepareImageBufferForOcr } from "./prepare-image-for-ocr";

describe("prepareImageBufferForOcr", () => {
  it("applies EXIF orientation", async () => {
    // 40x20 pixels tagged orientation 6 (display rotated 90°) => 20x40 once oriented.
    const src = await sharp({
      create: { width: 40, height: 20, channels: 3, background: "#888" },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const out = await prepareImageBufferForOcr(src, "image/jpeg");
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([20, 40]);
  });
});
