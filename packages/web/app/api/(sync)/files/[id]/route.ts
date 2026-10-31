import { NextRequest, NextResponse } from "next/server";
import { deleteFileForUser } from "@/lib/files-server";
import {
  handleAuthorizationV2,
  AuthorizationError,
} from "@/lib/handleAuthorization";
import { db, uploadedFiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await handleAuthorizationV2(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const fileId = parseInt(id, 10);
    if (isNaN(fileId)) {
      return NextResponse.json(
        { error: "Invalid file ID format" },
        { status: 400 }
      );
    }

    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: file.status || "processing",
      fileId: file.id,
      url: file.blobUrl,
      text: file.textContent || "",
      error: file.error || undefined,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message || "Authorization failed" },
        { status: error.status || 403 }
      );
    }

    console.error("Error retrieving file:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to retrieve file" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return GET(request, context);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await handleAuthorizationV2(request);
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
      return NextResponse.json(
        { error: result.error || "Failed to delete file" },
        {
          status:
            result.error === "Unauthorized"
              ? 401
              : result.error === "File not found"
                ? 404
                : 500,
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message || "Authorization failed" },
        { status: error.status || 403 }
      );
    }

    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
