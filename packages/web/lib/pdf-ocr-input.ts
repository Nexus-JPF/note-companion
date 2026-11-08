export const DEFAULT_MAX_PDF_OCR_BYTES = 25 * 1024 * 1024;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export type PdfOcrValidationResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string; status: number };

export function getMaxPdfOcrBytes(): number {
  const raw = process.env.MAX_FILE_SIZE;
  if (!raw) {
    return DEFAULT_MAX_PDF_OCR_BYTES;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_PDF_OCR_BYTES;
}

function extractBase64Payload(pdf: string): string {
  if (!pdf.startsWith("data:")) {
    return pdf;
  }
  const commaIndex = pdf.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid data URL format");
  }
  return pdf.slice(commaIndex + 1);
}

export function validatePdfOcrInput(
  pdf: unknown,
  maxBytes = getMaxPdfOcrBytes()
): PdfOcrValidationResult {
  if (!pdf || typeof pdf !== "string" || !pdf.trim()) {
    return { ok: false, error: "Missing or invalid PDF data", status: 400 };
  }

  let base64: string;
  try {
    base64 = extractBase64Payload(pdf.trim());
  } catch {
    return { ok: false, error: "Invalid PDF data URL", status: 400 };
  }

  if (!BASE64_PATTERN.test(base64.replace(/\s/g, ""))) {
    return { ok: false, error: "Invalid base64 PDF payload", status: 400 };
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    return { ok: false, error: "PDF data is empty", status: 400 };
  }
  if (buffer.length > maxBytes) {
    return {
      ok: false,
      error: `PDF exceeds maximum size (${maxBytes} bytes)`,
      status: 413,
    };
  }

  const header = buffer.subarray(0, 5).toString("ascii");
  if (!header.startsWith("%PDF")) {
    return { ok: false, error: "File is not a valid PDF", status: 400 };
  }

  return { ok: true, buffer };
}
