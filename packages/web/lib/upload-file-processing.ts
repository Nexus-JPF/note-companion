import sharp from "sharp";
import type { UploadedFile } from "@/drizzle/schema";
import { extractTextFromVisionImage } from "@/lib/ocr-extract";
import { prepareImageBufferForOcr } from "@/lib/prepare-image-for-ocr";
import {
  deriveR2KeyFromBlobUrl,
  downloadFromR2,
} from "@/lib/r2-client";

export const PDF_OCR_PAGE_LIMIT = Number.parseInt(
  process.env.PDF_OCR_PAGE_LIMIT || "10",
  10
);

export type UploadProcessResult = {
  status: "completed" | "error";
  textContent: string | null;
  generatedImageUrl: string | null;
  tokensUsed: number;
  error: string | null;
};

export function resolveUploadedFileR2Key(fileRecord: UploadedFile): string {
  if (fileRecord.r2Key) {
    return fileRecord.r2Key;
  }
  const derived = deriveR2KeyFromBlobUrl(fileRecord.blobUrl);
  if (!derived) {
    throw new Error(
      `Could not determine R2 key from blobUrl: ${fileRecord.blobUrl}`
    );
  }
  return derived;
}

export async function ocrImageFromR2(
  r2Key: string,
  fileType: string
): Promise<{ textContent: string; tokensUsed: number; error?: string }> {
  const raw = await downloadFromR2(r2Key);
  const prepared = await prepareImageBufferForOcr(raw, fileType);
  const result = await extractTextFromVisionImage({
    image: { kind: "buffer", buffer: prepared },
    retryOnEmpty: true,
  });
  if (result.error) {
    return { textContent: "", tokensUsed: 0, error: result.error };
  }
  return { textContent: result.text, tokensUsed: result.tokensUsed };
}

export async function ocrPdfFromR2(
  r2Key: string,
  pageLimit = PDF_OCR_PAGE_LIMIT
): Promise<{ textContent: string; tokensUsed: number; error?: string }> {
  const pdfBuffer = await downloadFromR2(r2Key);
  let pageCount = 1;
  try {
    const meta = await sharp(pdfBuffer, { density: 200 }).metadata();
    pageCount = Math.min(meta.pages ?? 1, pageLimit);
  } catch {
    pageCount = 1;
  }

  const parts: string[] = [];
  let tokensUsed = 0;

  for (let page = 0; page < pageCount; page++) {
    let png: Buffer;
    try {
      png = await sharp(pdfBuffer, { density: 200, page })
        .png()
        .toBuffer();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "PDF page render failed";
      return { textContent: "", tokensUsed: 0, error: message };
    }

    const result = await extractTextFromVisionImage({
      image: { kind: "buffer", buffer: png },
      retryOnEmpty: true,
    });
    if (result.error) {
      return { textContent: "", tokensUsed, error: result.error };
    }
    tokensUsed += result.tokensUsed;
    if (result.text) {
      parts.push(result.text);
    }
  }

  const textContent = parts.join("\n\n---\n\n");
  return { textContent, tokensUsed };
}

/** Shared OCR / text extraction for mobile sync uploads (not magic-diagram). */
export async function processUploadedFileForOcr(
  fileRecord: UploadedFile
): Promise<UploadProcessResult> {
  const fileId = fileRecord.id;
  let textContent: string | null = null;
  let tokensUsed = 0;
  let processingError: string | null = null;
  let generatedImageUrl: string | null = null;

  try {
    const processType = fileRecord.processType || "standard-ocr";
    const fileType = fileRecord.fileType.toLowerCase();
    const r2Key = resolveUploadedFileR2Key(fileRecord);

    if (
      processType === "standard-ocr" &&
      fileType.startsWith("image/")
    ) {
      const result = await ocrImageFromR2(r2Key, fileType);
      textContent = result.textContent;
      tokensUsed = result.tokensUsed;
      if (result.error) {
        processingError = result.error;
        textContent = null;
      } else if (!textContent?.trim()) {
        textContent = "[OCR completed, but no text extracted]";
      }
    } else if (fileType === "application/pdf" || fileType.includes("pdf")) {
      const result = await ocrPdfFromR2(r2Key);
      textContent = result.textContent;
      tokensUsed = result.tokensUsed;
      if (result.error) {
        processingError = result.error;
        textContent = null;
      } else if (!textContent?.trim()) {
        textContent = "[OCR completed, but no text extracted from PDF]";
      }
    } else if (fileType === "text/plain" || fileType === "text/markdown") {
      const buffer = await downloadFromR2(r2Key);
      textContent = buffer.toString("utf-8");
      tokensUsed = 0;
    } else {
      processingError = `Unsupported file type/processType: ${fileType} / ${processType}`;
      textContent = `[Unsupported: ${fileType}]`;
    }
  } catch (error: unknown) {
    console.error(`Error processing upload file ${fileId}:`, error);
    processingError =
      error instanceof Error ? error.message : "Unknown processing error";
    textContent = null;
    tokensUsed = 0;
  }

  const finalStatus = processingError ? "error" : "completed";
  return {
    status: finalStatus,
    textContent: processingError
      ? `[Processing Error: ${processingError}]`
      : textContent,
    generatedImageUrl,
    tokensUsed: processingError ? 0 : tokensUsed,
    error: processingError,
  };
}

/** Stale processing rows older than this are eligible for cron retry. */
export const PROCESSING_LEASE_MS = 15 * 60 * 1000;
