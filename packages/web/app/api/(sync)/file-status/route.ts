import { NextRequest, NextResponse } from "next/server";
import { getFileStatus } from "@/app/dashboard/sync/actions";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { clientErrorStatus } from "@/lib/auth-error-status";

// Define the response type locally
type FileStatusResponse = {
  status: string;
  text: string | null;
  error: string | null;
};

export async function GET(request: NextRequest) {
  try {
    // Validates the API key (mobile) or the Clerk session (web). A bare
    // Authorization header is never trusted on its own.
    const { userId } = await handleAuthorizationV2(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - authentication required" },
        { status: 401 }
      );
    }
    
    // Get fileId from request parameters
    const fileId = parseInt(request.nextUrl.searchParams.get("fileId") || "0", 10);

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    console.log(`Processing file status request for fileId: ${fileId}`);
    
    // getFileStatus only returns the file when it belongs to this user
    const result = await getFileStatus(fileId, userId);
    
    if (!result) {
      console.error(`Unexpected null result from getFileStatus for fileId: ${fileId}`);
      return NextResponse.json(
        { error: "Failed to retrieve file status" },
        { status: 500 }
      );
    }
    
    console.log(result);
    
    // and not null
    if ('error' in result && result.error !== null) {
      console.log(`Error in getFileStatus: ${result.error}`);
      // The caller is already authenticated here, so "Unauthorized" means the
      // file is someone else's: answer exactly like a missing file.
      const notFound =
        result.error === "Unauthorized" || result.error === "File not found";
      return NextResponse.json(
        { error: notFound ? "File not found" : result.error },
        { status: notFound ? 404 : 500 }
      );
    }

    // Ensure proper response structure before sending
    const response = result as FileStatusResponse;
    
    return NextResponse.json(response);
  } catch (error) {
    const clientStatus = clientErrorStatus(error);
    if (clientStatus) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Request failed" },
        { status: clientStatus }
      );
    }
    console.error("Status check error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { 
        error: "Failed to check file status", 
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// Also implement POST to handle the same requests from mobile app
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
    
    // Create a modified version of the request with the fileId as a query parameter
    const url = new URL(request.url);
    url.searchParams.set('fileId', fileId.toString());
    const modifiedRequest = new NextRequest(url, {
      headers: request.headers,
      method: 'GET'
    });
    
    return GET(modifiedRequest);
  } catch (error) {
    console.error("Error parsing POST request:", error);
    return NextResponse.json(
      { error: "Invalid request format" },
      { status: 400 }
    );
  }
}