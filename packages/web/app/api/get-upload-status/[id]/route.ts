import { NextRequest, NextResponse } from "next/server";
import { signR2Url, signR2UrlsInText } from "@/lib/r2-client";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { db, uploadedFiles } from "@/drizzle/schema";
import { eq, is } from "drizzle-orm";

// Define the structure of the expected URL parameters
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await handleAuthorizationV2(request);
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fileIdStr = (await context.params).id;
    if (!fileIdStr) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    let fileId: number;
    try {
      fileId = parseInt(fileIdStr, 10);
      if (isNaN(fileId)) {
        throw new Error("Invalid numeric file ID");
      }
    } catch (e) {
      // Handle potential non-numeric IDs if needed, or return error
      console.warn(`Received non-numeric file ID: ${fileIdStr}`);
      // For now, assume IDs are numeric from the DB record
      return NextResponse.json({ error: "Invalid File ID format" }, { status: 400 });
    }

    // Query the database for the file record
    const [fileRecord] = await db
      .select({
        id: uploadedFiles.id,
        status: uploadedFiles.status,
        textContent: uploadedFiles.textContent,
        error: uploadedFiles.error,
        userId: uploadedFiles.userId,
        blobUrl: uploadedFiles.blobUrl,
        fileType: uploadedFiles.fileType,
        originalName: uploadedFiles.originalName,
        updatedAt: uploadedFiles.updatedAt,
      })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .limit(1);

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found", status: "error" }, { status: 404 });
    }

    // Check authorization: ensure the file belongs to the requesting user
    if (fileRecord.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return the relevant status information
    return NextResponse.json({
      status: fileRecord.status,
      text: await signR2UrlsInText(fileRecord.textContent, fileRecord.userId), // Mobile app expects 'text' field
      error: fileRecord.error,
      fileId: fileRecord.id, // Include fileId for confirmation
      url: await signR2Url(fileRecord.blobUrl, fileRecord.userId),
      mimeType: fileRecord.fileType,
      fileName: fileRecord.originalName,
      updatedAt: fileRecord.updatedAt,
    });

  } catch (error: unknown) {
    if (error && typeof error === 'object') {
      if ('status' in error && error.status === 401) {
        const message = 'message' in error ? String(error.message) : 'Unauthorized';
        return NextResponse.json({ error: message }, { status: 401 });
      }
    }
    console.error("Error fetching upload status:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch upload status";
    return NextResponse.json({ error: errorMessage, status: "error" }, { status: 500 });
  }
} 