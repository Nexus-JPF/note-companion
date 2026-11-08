import { NextRequest, NextResponse } from "next/server";
import { deleteFileForUser } from "@/lib/files-server";
import { db, uploadedFiles } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { clientErrorStatus } from "@/lib/auth-error-status";
import { authenticateUser } from "@/lib/authenticate-user";
import { signR2Url, signR2UrlsInText } from "@/lib/r2-client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validates the API key (mobile) or the Clerk session (web). Never trust a
    // bare Authorization header: that would let anyone read anyone's file.
    const { userId } = await handleAuthorizationV2(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the file ID
    const fileId = parseInt(id, 10);
    if (isNaN(fileId)) {
      return NextResponse.json(
        { error: "Invalid file ID format" },
        { status: 400 }
      );
    }

    // Only the owner's file. A file that belongs to someone else looks exactly
    // like a file that does not exist, so ids cannot be probed.
    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.userId, userId)))
      .limit(1);

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Return the file data with appropriate format for the mobile app
    return NextResponse.json({
      status: file.status || 'processing',
      fileId: file.id,
      url: await signR2Url(file.blobUrl, userId),
      text: (await signR2UrlsInText(file.textContent, userId)) || '',
      error: file.error || undefined
    });
  } catch (error) {
    const clientStatus = clientErrorStatus(error);
    if (clientStatus) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Request failed" },
        { status: clientStatus }
      );
    }
    console.error("Error retrieving file:", error);
    return NextResponse.json(
      { error: "Failed to retrieve file" },
      { status: 500 }
    );
  }
}

// Also implement POST to handle the same requests (for compatibility with the mobile app)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return GET(request, { params });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // An API key (mobile) or the Clerk session (web). Identity only: people can
    // always delete their own files, whatever their plan or token balance.
    const userId = await authenticateUser(request);
    if (!userId) {
      console.error("Unauthorized file deletion attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const fileId = parseInt(id, 10);
    if (isNaN(fileId)) {
      return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
    }

    const result = await deleteFileForUser(fileId, userId);

    if (!result.success) {
      // Someone else's file looks exactly like a missing one
      const notFound =
        result.error === "Unauthorized" || result.error === "File not found";
      return NextResponse.json(
        { error: notFound ? "File not found" : result.error || "Failed to delete file" },
        { status: notFound ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const clientStatus = clientErrorStatus(error);
    if (clientStatus) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Request failed" },
        { status: clientStatus }
      );
    }
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
