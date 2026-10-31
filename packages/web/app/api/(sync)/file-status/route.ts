import { NextRequest, NextResponse } from "next/server";
import { getFileStatusForUser } from "@/lib/files-server";
import {
  handleAuthorizationV2,
  AuthorizationError,
} from "@/lib/handleAuthorization";

type FileStatusResponse = {
  status: string;
  text: string | null;
  error: string | null;
};

async function handleFileStatusRequest(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);

    if (!userId) {
      console.error("Unauthorized status check attempt - no userId");
      return NextResponse.json(
        { error: "Unauthorized - authentication required" },
        { status: 401 }
      );
    }

    const fileId = parseInt(
      request.nextUrl.searchParams.get("fileId") || "0",
      10
    );

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    const result = await getFileStatusForUser(fileId, userId);

    if (!result) {
      console.error(
        `Unexpected null result from getFileStatusForUser for fileId: ${fileId}`
      );
      return NextResponse.json(
        { error: "Failed to retrieve file status" },
        { status: 500 }
      );
    }

    if ("error" in result && result.error !== null) {
      return NextResponse.json(
        { error: result.error },
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

    return NextResponse.json(result as FileStatusResponse);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message || "Authorization failed" },
        { status: error.status || 403 }
      );
    }

    console.error("Status check error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to check file status",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleFileStatusRequest(request);
}

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { fileId } = requestData;

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    url.searchParams.set("fileId", fileId.toString());
    const modifiedRequest = new NextRequest(url, {
      headers: request.headers,
      method: "GET",
    });

    return handleFileStatusRequest(modifiedRequest);
  } catch (error) {
    console.error("Error parsing POST request:", error);
    return NextResponse.json(
      { error: "Invalid request format" },
      { status: 400 }
    );
  }
}
