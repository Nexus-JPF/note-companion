import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { v4 as uuidv4 } from "uuid";

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_REGION = process.env.R2_REGION || "auto";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Create R2 client only if all required env vars are present
let r2Client: S3Client | null = null;

if (
  R2_BUCKET &&
  R2_ENDPOINT &&
  R2_ACCESS_KEY_ID &&
  R2_SECRET_ACCESS_KEY
) {
  try {
    r2Client = new S3Client({
      endpoint: R2_ENDPOINT,
      region: R2_REGION,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  } catch (error) {
    console.error("Failed to initialize R2 client:", error);
    r2Client = null;
  }
}

export const maxDuration = 300; // 5 minutes for large files

// Handle OPTIONS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(request: NextRequest) {
  // Validate R2 configuration
  if (!R2_BUCKET || !R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    const missingVars = [];
    if (!R2_BUCKET) missingVars.push('R2_BUCKET');
    if (!R2_ENDPOINT) missingVars.push('R2_ENDPOINT');
    if (!R2_ACCESS_KEY_ID) missingVars.push('R2_ACCESS_KEY_ID');
    if (!R2_SECRET_ACCESS_KEY) missingVars.push('R2_SECRET_ACCESS_KEY');

    console.error("Missing R2 environment variables:", missingVars);
    return NextResponse.json(
      { error: `Missing R2 configuration: ${missingVars.join(', ')}` },
      { status: 500 }
    );
  }

  if (!r2Client) {
    console.error("R2 client not initialized");
    return NextResponse.json(
      { error: "R2 storage is not properly configured" },
      { status: 500 }
    );
  }

  if (!R2_PUBLIC_URL) {
    console.error("R2_PUBLIC_URL environment variable is missing");
    return NextResponse.json(
      { error: "R2_PUBLIC_URL environment variable is not configured" },
      { status: 500 }
    );
  }

  try {
    // Authenticate user
    const authResult = await handleAuthorizationV2(request);
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get extension from URL query parameter (avoids CORS header issues)
    const { searchParams } = new URL(request.url);
    const extensionFromQuery = searchParams.get("extension");

    // Get the audio file from the request
    const contentType = request.headers.get("content-type") || "";

    let audioBuffer: ArrayBuffer;
    let fileExtension: string;
    let mimeType: string;

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form data
      const formData = await request.formData();
      const audioFile = formData.get("audio") as File;

      if (!audioFile) {
        return NextResponse.json(
          { error: "No audio file provided" },
          { status: 400 }
        );
      }

      audioBuffer = await audioFile.arrayBuffer();
      fileExtension = audioFile.name.split(".").pop()?.toLowerCase() || "webm";
      mimeType = audioFile.type || `audio/${fileExtension}`;
    } else if (contentType.includes("application/octet-stream") || contentType.includes("audio/")) {
      // Handle raw binary audio data
      audioBuffer = await request.arrayBuffer();

      // Get extension from query param, content-type, or default to webm
      if (extensionFromQuery) {
        fileExtension = extensionFromQuery.toLowerCase();
      } else {
        // Extract from content-type
        const match = contentType.match(/audio\/(\w+)/);
        fileExtension = match ? match[1] : "webm";
      }
      mimeType = contentType || `audio/${fileExtension}`;
    } else {
      // Try to parse as JSON with base64 data
      try {
        const body = await request.json();
        if (body.audio && body.extension) {
          const base64Data = body.audio.split(";base64,").pop();
          if (!base64Data) {
            return NextResponse.json(
              { error: "Invalid base64 data" },
              { status: 400 }
            );
          }
          audioBuffer = Buffer.from(base64Data, "base64").buffer;
          fileExtension = body.extension;
          mimeType = body.contentType || `audio/${fileExtension}`;
        } else {
          return NextResponse.json(
            { error: "Missing audio data or extension" },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Unsupported content type. Expected multipart/form-data, audio/*, or application/json with base64" },
          { status: 400 }
        );
      }
    }

    // Check file size (25MB limit for OpenAI Whisper)
    const fileSizeInMB = audioBuffer.byteLength / (1024 * 1024);
    if (fileSizeInMB > 25) {
      return NextResponse.json(
        {
          error: "Audio file is too large. Please use a file smaller than 25MB.",
        },
        { status: 400 }
      );
    }

    // Generate unique key for R2
    const safeFilename = `audio-${Date.now()}.${fileExtension}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `uploads/${userId}/${uuidv4()}-${safeFilename}`;

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET!,
      Key: key,
      Body: Buffer.from(audioBuffer),
      ContentType: mimeType,
    });

    await r2Client.send(command);

    // Construct public URL
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    console.log(`Successfully uploaded audio to R2: ${key}`);

    return NextResponse.json({
      success: true,
      key,
      publicUrl,
      fileSize: audioBuffer.byteLength,
    });

  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
      const message = 'message' in error ? String(error.message) : 'Unauthorized';
      return NextResponse.json(
        { error: message },
        { status: 401 }
      );
    }

    console.error("Error uploading audio to R2:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: "Failed to upload audio to R2",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

