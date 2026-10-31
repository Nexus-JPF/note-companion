import "server-only";

import { db, uploadedFiles } from "@/drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import { put } from "@vercel/blob";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface FileListResponse {
  files: Array<{
    id: number;
    originalName: string;
    fileType: string;
    status: string;
    createdAt: Date;
    tokensUsed: number | null;
    error: string | null;
    textContent: string | null;
    blobUrl: string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FileStatusResponse {
  status: string;
  text: string | null;
  error: string | null;
}

export interface UploadFileParams {
  name: string;
  type: string;
  base64: string;
}

export interface UploadResponse {
  success: boolean;
  fileId?: number;
  status?: string;
  error?: string;
  retryable?: boolean;
}

export async function getFilesForUser(
  { page = 1, limit = 10 }: PaginationParams,
  userId: string
): Promise<FileListResponse | { error: string }> {
  try {
    const offset = (page - 1) * limit;

    const files = await db
      .select({
        id: uploadedFiles.id,
        originalName: uploadedFiles.originalName,
        fileType: uploadedFiles.fileType,
        status: uploadedFiles.status,
        createdAt: uploadedFiles.createdAt,
        tokensUsed: uploadedFiles.tokensUsed,
        error: uploadedFiles.error,
        textContent: uploadedFiles.textContent,
        blobUrl: uploadedFiles.blobUrl,
      })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.userId, userId))
      .orderBy(desc(uploadedFiles.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.userId, userId));

    return {
      files,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    console.error("List files error:", error);
    return { error: "Failed to list files" };
  }
}

export async function getFileStatusForUser(
  fileId: number,
  userId: string
): Promise<FileStatusResponse | { error: string }> {
  try {
    const [file] = await db
      .select({
        userId: uploadedFiles.userId,
        status: uploadedFiles.status,
        textContent: uploadedFiles.textContent,
        error: uploadedFiles.error,
      })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .limit(1);

    if (!file) {
      return { error: "File not found" };
    }

    if (file.userId !== userId) {
      return { error: "Unauthorized" };
    }

    return {
      status: file.status,
      text: file.textContent,
      error: file.error,
    };
  } catch (error) {
    console.error("Get file status error:", error);
    return { error: "Failed to get file status" };
  }
}

export async function uploadFileForUser(
  { name: fileName, type: mimeType, base64 }: UploadFileParams,
  userId: string
): Promise<UploadResponse> {
  try {
    if (!fileName || !mimeType || !base64) {
      return {
        success: false,
        error: "Missing required fields",
        retryable: true,
      };
    }

    const blobName = `${Date.now()}-${fileName.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;

    let normalizedMimeType = mimeType;
    if (mimeType.toLowerCase().includes("pdf")) {
      normalizedMimeType = "application/pdf";
    }

    const { url } = await put(blobName, Buffer.from(base64, "base64"), {
      contentType: normalizedMimeType,
      access: "public",
    });

    const [file] = await db
      .insert(uploadedFiles)
      .values({
        userId,
        originalName: fileName,
        fileType: normalizedMimeType,
        status: "uploaded",
        blobUrl: url,
      })
      .returning();

    return {
      success: true,
      fileId: file.id,
      status: file.status,
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: "Server error during upload",
      retryable: true,
    };
  }
}

export async function deleteFileForUser(
  fileId: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .limit(1);

    if (!file) {
      return { success: false, error: "File not found" };
    }

    if (file.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileId));

    return { success: true };
  } catch (error) {
    console.error("Delete file error:", error);
    return { success: false, error: "Failed to delete file" };
  }
}
