import { NextRequest, NextResponse } from "next/server";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { db, uploadedFiles } from "@/drizzle/schema";
import { isOwnedUploadKey } from "@/lib/r2-client";

export async function POST(request: NextRequest) {
  try {
    const authResult = await handleAuthorizationV2(request);
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // `publicUrl` is still sent by existing clients but is not trusted or stored:
    // the URL is rebuilt from the key below.
    const { key, originalName, fileType, processType } = (await request.json()) as {
      key: string;
      publicUrl?: string;
      originalName: string;
      fileType: string;
      processType?: string;
    };

    if (!key || !originalName || !fileType) {
      return NextResponse.json(
        { error: "Missing required fields (key, originalName, fileType)" },
        { status: 400 }
      );
    }

    // The key must be one of this user's uploads, so nobody can attach (and have
    // the server process) another user's file.
    if (!isOwnedUploadKey(key, userId)) {
      return NextResponse.json({ error: "Invalid file key" }, { status: 403 });
    }

    const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    if (!publicBase) {
      return NextResponse.json(
        { error: "R2_PUBLIC_URL environment variable is not configured" },
        { status: 500 }
      );
    }
    const blobUrl = `${publicBase}/${key}`;

    // Insert record into the database
    const [newRecord] = await db
      .insert(uploadedFiles)
      .values({
        userId: userId,
        r2Key: key, // Store the R2 object key
        blobUrl, // Built server-side from the verified key
        originalName: originalName,
        fileType: fileType,
        status: "pending", // Initial status, waiting for background processing
        processType: processType || "standard-ocr", // Use the provided processType or default
        // size can be added if sent from the client
        // embeddings will be generated later
      })
      .returning();

    if (!newRecord) {
      throw new Error("Failed to insert upload record into database");
    }

    console.log("Recorded new upload:", newRecord.id, key, processType || "standard-ocr");

    return NextResponse.json({ success: true, fileId: newRecord.id }, { status: 201 });

  } catch (error: unknown) {
    if (error && typeof error === 'object') {
      if ('status' in error && error.status === 401) {
        const message = 'message' in error ? String(error.message) : 'Unauthorized';
        return NextResponse.json({ error: message }, { status: 401 });
      }
    }
    console.error("Error recording upload:", error);
    // Check for specific database errors if needed
    const errorMessage = error instanceof Error ? error.message : "Failed to record upload";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 