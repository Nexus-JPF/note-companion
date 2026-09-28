import sharp from "sharp";

const MAX_OCR_EDGE = 2048;

export async function prepareImageBufferForOcr(
  buffer: Buffer,
  fileType: string
): Promise<Buffer> {
  const lower = fileType.toLowerCase();
  if (lower.includes("svg")) {
    throw new Error("SVG is not supported for OCR");
  }

  let input = buffer;
  if (lower.includes("heic") || lower.includes("heif")) {
    input = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
  }

  const image = sharp(input);
  const meta = await image.metadata();
  let pipeline = image;
  if (
    meta.width &&
    meta.height &&
    (meta.width > MAX_OCR_EDGE || meta.height > MAX_OCR_EDGE)
  ) {
    pipeline = pipeline.resize(MAX_OCR_EDGE, MAX_OCR_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const hasAlpha = meta.hasAlpha;
  if (hasAlpha) {
    return pipeline.png().toBuffer();
  }
  return pipeline.jpeg({ quality: 88 }).toBuffer();
}
