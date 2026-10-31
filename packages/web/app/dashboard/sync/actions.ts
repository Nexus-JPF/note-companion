"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  deleteFileForUser,
  getFilesForUser,
  getFileStatusForUser,
  uploadFileForUser,
  type FileListResponse,
  type FileStatusResponse,
  type UploadFileParams,
  type UploadResponse,
} from "@/lib/files-server";

export type {
  FileListResponse,
  FileStatusResponse,
  UploadFileParams,
  UploadResponse,
};

export async function getFiles({
  page = 1,
  limit = 10,
}: {
  page?: number;
  limit?: number;
}): Promise<FileListResponse | { error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized" };
  }
  return getFilesForUser({ page, limit }, userId);
}

export async function getFileStatus(
  fileId: number
): Promise<FileStatusResponse | { error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized" };
  }
  return getFileStatusForUser(fileId, userId);
}

export async function uploadFile(
  params: UploadFileParams
): Promise<UploadResponse> {
  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      error: "Unauthorized",
      retryable: false,
    };
  }
  return uploadFileForUser(params, userId);
}

export async function deleteFile(
  fileId: number
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await deleteFileForUser(fileId, userId);

  if (result.success) {
    revalidatePath("/dashboard/sync");
  }

  return result;
}
