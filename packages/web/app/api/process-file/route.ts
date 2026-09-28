import { NextRequest, NextResponse } from "next/server";
import { db, uploadedFiles } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { incrementAndLogTokenUsage } from "@/lib/incrementAndLogTokenUsage";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { processUploadedFileForOcr } from "@/lib/upload-file-processing";

export const maxDuration = 800;

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let fileId: number | null = null;

  try {
    const authResult = await handleAuthorizationV2(request);
    userId = authResult.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as { fileId: number | string };
    if (!payload.fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    fileId = Number(payload.fileId);
    if (Number.isNaN(fileId)) {
      return NextResponse.json(
        { error: "Invalid file ID format" },
        { status: 400 }
      );
    }

    const [fileRecord] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .limit(1);

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (fileRecord.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (fileRecord.status === "completed" || fileRecord.status === "error") {
      return NextResponse.json({
        success: true,
        message: `File already processed with status: ${fileRecord.status}`,
        status: fileRecord.status,
        text: fileRecord.textContent,
        error: fileRecord.error,
      });
    }

    if (fileRecord.status === "processing") {
      return NextResponse.json({
        success: true,
        message: "File is already being processed",
        status: "processing",
      });
    }

    const claimResult = await db
      .update(uploadedFiles)
      .set({ status: "processing", updatedAt: new Date(), error: null })
      .where(
        and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.status, "pending"))
      )
      .returning();

    if (!claimResult.length) {
      return NextResponse.json({
        success: true,
        message: "File processing already claimed by another worker",
        status: fileRecord.status,
      });
    }

    const result = await processUploadedFileForOcr(claimResult[0]);

    await db
      .update(uploadedFiles)
      .set({
        status: result.status,
        textContent: result.textContent,
        tokensUsed: result.tokensUsed,
        error: result.error,
        updatedAt: new Date(),
      })
      .where(eq(uploadedFiles.id, fileId));

    if (result.status === "completed" && result.tokensUsed > 0) {
      try {
        await incrementAndLogTokenUsage(userId, result.tokensUsed);
      } catch (tokenError) {
        console.error(
          `Failed to increment token usage for user ${userId} after file ${fileId}:`,
          tokenError
        );
      }
    }

    if (result.status === "completed") {
      return NextResponse.json({
        success: true,
        message: "File processed successfully.",
        status: result.status,
        text: result.textContent,
      });
    }

    return NextResponse.json({
      success: false,
      message: "File processing failed.",
      status: result.status,
      error: result.error,
    });
  } catch (error: unknown) {
    console.error(
      `Unhandled error in /api/process-file for file ID ${fileId}:`,
      error
    );

    if (fileId && userId) {
      try {
        await db
          .update(uploadedFiles)
          .set({
            status: "error",
            error: `Unhandled API Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
            updatedAt: new Date(),
          })
          .where(
            and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.userId, userId))
          );
      } catch (dbUpdateError) {
        console.error(
          `Failed to mark file ${fileId} as error after unhandled exception:`,
          dbUpdateError
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to process file due to an internal server error." },
      { status: 500 }
    );
  }
}
