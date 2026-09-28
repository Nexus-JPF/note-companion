import { NextRequest, NextResponse } from "next/server";
import { db, uploadedFiles, UploadedFile, checkTokenUsage } from "@/drizzle/schema";
import { eq, and, or, lt } from "drizzle-orm";
import { incrementAndLogTokenUsage } from "@/lib/incrementAndLogTokenUsage";
import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import {
  downloadFromR2,
  uploadToR2,
  R2_PUBLIC_URL,
} from "@/lib/r2-client";
import {
  PROCESSING_LEASE_MS,
  processUploadedFileForOcr,
  resolveUploadedFileR2Key,
  type UploadProcessResult,
} from "@/lib/upload-file-processing";

export const maxDuration = 800;

function getOpenAIImageClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
  });
}

async function processMagicDiagram(
  r2Key: string,
  originalFileName: string,
  userId: string
): Promise<{ generatedImageUrl: string; tokensUsed: number; error?: string }> {
  let tempImagePath: string | null = null;
  try {
    const originalImageBuffer = await downloadFromR2(r2Key);
    const tempDir = os.tmpdir();
    const safeFileName = path.basename(originalFileName);
    const extension = path.extname(safeFileName) || ".png";
    tempImagePath = path.join(
      tempDir,
      `${Date.now()}-${path.basename(safeFileName, extension)}${extension}`
    );
    fs.writeFileSync(
      tempImagePath,
      originalImageBuffer as unknown as Uint8Array
    );

    const generationPrompt = `Digitize this sketch image into a clean, well-rendered diagram suitable for digital files. Preserve the core elements and connections shown in the sketch. Original filename for context: ${originalFileName}.`;

    const imageStream = fs.createReadStream(tempImagePath);
    let mimeType = "image/png";
    const fileExt = path.extname(tempImagePath).toLowerCase();
    if (fileExt === ".jpg" || fileExt === ".jpeg") {
      mimeType = "image/jpeg";
    } else if (fileExt === ".webp") {
      mimeType = "image/webp";
    }

    const preparedImage = await toFile(
      imageStream,
      path.basename(tempImagePath),
      { type: mimeType }
    );

    const response = await getOpenAIImageClient().images.edit({
      model: "gpt-image-1",
      image: preparedImage,
      prompt: generationPrompt,
      n: 1,
    });

    const imageBase64 = response.data[0]?.b64_json;
    if (!imageBase64) {
      throw new Error(
        "Image generation failed, no b64_json returned in the response."
      );
    }

    const generatedImageBuffer = Buffer.from(imageBase64, "base64");
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const generatedR2Key = `generated/${userId}/${Date.now()}-${uniqueSuffix}-${path.basename(
      originalFileName,
      extension
    )}.png`;

    await uploadToR2(generatedR2Key, generatedImageBuffer, "image/png");
    const generatedPublicUrl = `${R2_PUBLIC_URL}/${generatedR2Key}`;

    return { generatedImageUrl: generatedPublicUrl, tokensUsed: 5000 };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error generating diagram";
    return {
      generatedImageUrl: "",
      tokensUsed: 0,
      error: `Error generating diagram: ${errorMessage}`,
    };
  } finally {
    if (tempImagePath) {
      try {
        fs.unlinkSync(tempImagePath);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}

async function processSingleFileRecord(
  fileRecord: UploadedFile
): Promise<UploadProcessResult> {
  const processType = fileRecord.processType || "standard-ocr";
  const fileType = fileRecord.fileType.toLowerCase();

  if (processType === "magic-diagram" && fileType.startsWith("image/")) {
    const r2Key = resolveUploadedFileR2Key(fileRecord);
    const result = await processMagicDiagram(
      r2Key,
      fileRecord.originalName,
      fileRecord.userId
    );
    if (result.error) {
      return {
        status: "error",
        textContent: `[Error generating diagram: ${result.error}]`,
        generatedImageUrl: null,
        tokensUsed: 0,
        error: result.error,
      };
    }
    return {
      status: "completed",
      textContent: `[Generated Diagram Image](${result.generatedImageUrl})`,
      generatedImageUrl: result.generatedImageUrl,
      tokensUsed: result.tokensUsed,
      error: null,
    };
  }

  return processUploadedFileForOcr(fileRecord);
}

export async function GET(request: NextRequest) {
  console.log("[/api/process-pending-uploads] Worker starting...");
  const cronSecret = request.headers.get("authorization")?.split(" ")[1];
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let processedCount = 0;
  let errorCount = 0;
  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);

  try {
    const pendingFiles = await db
      .select()
      .from(uploadedFiles)
      .where(
        or(
          eq(uploadedFiles.status, "pending"),
          and(
            eq(uploadedFiles.status, "processing"),
            lt(uploadedFiles.updatedAt, staleBefore)
          )
        )
      )
      .limit(10);

    if (pendingFiles.length === 0) {
      return NextResponse.json({ message: "No pending files" });
    }

    for (const fileRecord of pendingFiles) {
      const fileId = fileRecord.id;
      const userId = fileRecord.userId;

      try {
        const { remaining, usageError } = await checkTokenUsage(userId);
        if (usageError || remaining <= 0) {
          await db
            .update(uploadedFiles)
            .set({
              status: "error",
              error: "Token limit exceeded. Please upgrade your plan for more tokens.",
              updatedAt: new Date(),
            })
            .where(eq(uploadedFiles.id, fileId));
          errorCount++;
          continue;
        }

        const claimResult = await db
          .update(uploadedFiles)
          .set({ status: "processing", updatedAt: new Date(), error: null })
          .where(
            and(
              eq(uploadedFiles.id, fileId),
              or(
                eq(uploadedFiles.status, "pending"),
                and(
                  eq(uploadedFiles.status, "processing"),
                  lt(uploadedFiles.updatedAt, staleBefore)
                )
              )
            )
          )
          .returning();

        if (!claimResult.length) {
          continue;
        }

        const result = await processSingleFileRecord(claimResult[0]);

        await db
          .update(uploadedFiles)
          .set({
            status: result.status,
            textContent: result.textContent,
            generatedImageUrl: result.generatedImageUrl,
            tokensUsed: result.tokensUsed,
            error: result.error,
            updatedAt: new Date(),
          })
          .where(eq(uploadedFiles.id, fileId));

        if (result.status === "completed" && result.tokensUsed > 0) {
          processedCount++;
          try {
            await incrementAndLogTokenUsage(userId, result.tokensUsed);
          } catch (tokenError) {
            console.error(
              `Failed to increment token usage for user ${userId} after file ${fileId}:`,
              tokenError
            );
          }
        } else if (result.status === "error") {
          errorCount++;
        } else {
          processedCount++;
        }
      } catch (loopError) {
        console.error(`Critical error processing file ${fileId}:`, loopError);
        errorCount++;
        try {
          await db
            .update(uploadedFiles)
            .set({
              status: "error",
              error: `Processing Loop Error: ${
                loopError instanceof Error ? loopError.message : String(loopError)
              }`,
              updatedAt: new Date(),
            })
            .where(eq(uploadedFiles.id, fileId));
        } catch {
          /* ignore */
        }
      }
    }

    return NextResponse.json({
      message: `Processing complete. Attempted: ${pendingFiles.length}, Succeeded: ${processedCount}, Errors: ${errorCount}`,
    });
  } catch (error: unknown) {
    console.error("Error in background processing job:", error);
    return NextResponse.json(
      {
        error: "Background processing job failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
