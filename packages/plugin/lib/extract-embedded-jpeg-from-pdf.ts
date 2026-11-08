/**
 * Photo PDFs from Preview/macOS often wrap a single DCT (JPEG) stream.
 * Extract the largest JPEG segment for vision OCR when pdf.js canvas render fails.
 */
export function extractLargestJpegFromPdf(
  pdfData: ArrayBuffer | Uint8Array
): ArrayBuffer | null {
  const bytes =
    pdfData instanceof Uint8Array ? pdfData : new Uint8Array(pdfData);
  if (bytes.length < 4) {
    return null;
  }

  let bestStart = -1;
  let bestLength = 0;

  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] !== 0xff || bytes[i + 1] !== 0xd8 || bytes[i + 2] !== 0xff) {
      continue;
    }

    let end = -1;
    for (let j = i + 3; j < bytes.length - 1; j++) {
      if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
        end = j + 2;
        break;
      }
    }

    if (end <= i) {
      continue;
    }

    const length = end - i;
    if (length > bestLength) {
      bestLength = length;
      bestStart = i;
    }
  }

  if (bestStart < 0 || bestLength < 256) {
    return null;
  }

  const jpegBytes = bytes.slice(bestStart, bestStart + bestLength);
  return jpegBytes.buffer.slice(
    jpegBytes.byteOffset,
    jpegBytes.byteOffset + jpegBytes.byteLength
  );
}
