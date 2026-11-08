jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/files-server", () => ({
  getFilesForUser: jest.fn(),
  getFileStatusForUser: jest.fn(),
  uploadFileForUser: jest.fn(),
  deleteFileForUser: jest.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import {
  getFilesForUser,
  getFileStatusForUser,
  uploadFileForUser,
  deleteFileForUser,
} from "@/lib/files-server";
import { getFiles, getFileStatus, uploadFile, deleteFile } from "./actions";

const mockAuth = jest.mocked(auth);
const mockGetFilesForUser = getFilesForUser as jest.Mock;
const mockGetFileStatusForUser = getFileStatusForUser as jest.Mock;
const mockUploadFileForUser = uploadFileForUser as jest.Mock;
const mockDeleteFileForUser = deleteFileForUser as jest.Mock;

describe("dashboard sync server actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "session-user" } as Awaited<
      ReturnType<typeof auth>
    >);
  });

  it("getFiles uses the Clerk session user and ignores extra caller arguments", async () => {
    mockGetFilesForUser.mockResolvedValueOnce({
      files: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    await (getFiles as (...args: unknown[]) => Promise<unknown>)(
      { page: 1, limit: 10 },
      "attacker-user-id"
    );

    expect(mockGetFilesForUser).toHaveBeenCalledWith(
      { page: 1, limit: 10 },
      "session-user"
    );
    expect(mockGetFilesForUser).not.toHaveBeenCalledWith(
      expect.anything(),
      "attacker-user-id"
    );
  });

  it("getFiles returns Unauthorized when there is no session", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null } as Awaited<
      ReturnType<typeof auth>
    >);

    const result = await getFiles({ page: 1, limit: 10 });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockGetFilesForUser).not.toHaveBeenCalled();
  });

  it("getFileStatus uses the session user only", async () => {
    mockGetFileStatusForUser.mockResolvedValueOnce({
      status: "uploaded",
      text: null,
      error: null,
    });

    await (getFileStatus as (...args: unknown[]) => Promise<unknown>)(
      42,
      "attacker-user-id"
    );

    expect(mockGetFileStatusForUser).toHaveBeenCalledWith(42, "session-user");
  });

  it("uploadFile uses the session user only", async () => {
    mockUploadFileForUser.mockResolvedValueOnce({ success: true, fileId: 1 });

    await (uploadFile as (...args: unknown[]) => Promise<unknown>)(
      { name: "a.pdf", type: "application/pdf", base64: "abc" },
      "attacker-user-id"
    );

    expect(mockUploadFileForUser).toHaveBeenCalledWith(
      { name: "a.pdf", type: "application/pdf", base64: "abc" },
      "session-user"
    );
  });

  it("deleteFile uses the session user only", async () => {
    mockDeleteFileForUser.mockResolvedValueOnce({ success: true });

    await (deleteFile as (...args: unknown[]) => Promise<unknown>)(
      99,
      "attacker-user-id"
    );

    expect(mockDeleteFileForUser).toHaveBeenCalledWith(99, "session-user");
  });
});
