import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@/lib/handleAuthorization", () => ({
  handleAuthorizationV2: jest.fn(),
  AuthorizationError: class AuthorizationError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "AuthorizationError";
      this.status = status;
    }
  },
}));

jest.mock("@/lib/files-server", () => ({
  getFilesForUser: jest.fn(),
}));

import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { getFilesForUser } from "@/lib/files-server";

const mockHandleAuthorizationV2 = handleAuthorizationV2 as jest.Mock;
const mockGetFilesForUser = getFilesForUser as jest.Mock;

describe("GET /api/(sync)/files", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists files for the authorized API user", async () => {
    mockHandleAuthorizationV2.mockResolvedValueOnce({ userId: "api-user" });
    mockGetFilesForUser.mockResolvedValueOnce({
      files: [{ id: 1, originalName: "doc.pdf" }],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    const req = new NextRequest(
      "http://localhost:3010/api/files?page=1&limit=10",
      { method: "GET", headers: { authorization: "Bearer test-key" } }
    );

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetFilesForUser).toHaveBeenCalledWith(
      { page: 1, limit: 10 },
      "api-user"
    );
    expect(data.files).toHaveLength(1);
  });

  it("returns 401 when authorization yields no user", async () => {
    mockHandleAuthorizationV2.mockResolvedValueOnce({ userId: null });

    const req = new NextRequest("http://localhost:3010/api/files");
    const response = await GET(req);

    expect(response.status).toBe(401);
    expect(mockGetFilesForUser).not.toHaveBeenCalled();
  });
});
