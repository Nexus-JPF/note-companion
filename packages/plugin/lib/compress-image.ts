const MAX_IMAGE_EDGE = 1000;

export function isWebP(data: ArrayBuffer | Uint8Array): boolean {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return riff === "RIFF" && webp === "WEBP";
}

/**
 * Downscale oversized images with the browser canvas API (no Node `fs`).
 * Falls back to the original bytes if the image cannot be decoded.
 */
export async function compressImageForVision(
  data: ArrayBuffer
): Promise<ArrayBuffer> {
  if (!data || data.byteLength === 0) {
    throw new Error("Image data is empty");
  }

  if (
    typeof createImageBitmap !== "function" ||
    typeof activeDocument === "undefined"
  ) {
    return data;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([data]));
  } catch {
    return data;
  }

  try {
    let { width, height } = bitmap;
    if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
      const scale = Math.min(MAX_IMAGE_EDGE / width, MAX_IMAGE_EDGE / height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = activeDocument.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return data;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const pngBlob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!pngBlob) return data;

    return await pngBlob.arrayBuffer();
  } finally {
    bitmap.close();
  }
}
