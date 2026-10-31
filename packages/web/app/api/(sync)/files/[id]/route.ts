import { NextRequest, NextResponse } from "next/server";
import { deleteFile } from "@/app/dashboard/sync/actions";
import { auth } from "@clerk/nextjs/server";
import { db, uploadedFiles } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";

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
      url: file.blobUrl,
      text: file.textContent || '',
      error: file.error || undefined
    });
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const status = (error as { status?: unknown }).status;
      if (status === 401 || status === 403) {
        const message =
          "message" in error ? String((error as { message?: unknown }).message) : "Unauthorized";
        return NextResponse.json({ error: message }, { status });
      }
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
    const { id } = await params;
    // Check authentication first
    const { userId } = await auth();
    if (!userId) {
      console.error("Unauthorized file deletion attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const fileId = parseInt(id, 10);
    if (isNaN(fileId)) {
      return NextResponse.json(
        { error: "Invalid file ID" },
        { status: 400 }
      );
    }

    const result = await deleteFile(fileId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to delete file" },
        { status: result.error === "Unauthorized" ? 401 : 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}