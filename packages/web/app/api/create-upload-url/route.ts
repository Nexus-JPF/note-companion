import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization'; // Assuming this handles auth
import { v4 as uuidv4 } from 'uuid'; // For unique filenames

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_REGION = process.env.R2_REGION || 'auto'; // R2 uses 'auto'

// Create R2 client only if all required env vars are present
// This prevents initialization errors when env vars are missing
let r2Client: S3Client | null = null;

if (R2_BUCKET && R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
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
    console.error('Failed to initialize R2 client:', error);
    r2Client = null;
  }
} else {
  console.error('Missing R2 environment variables! Client not initialized.');
}

export async function POST(request: NextRequest) {
  console.log('--- Create Upload URL Start ---'); // Add start marker
  console.log('Checking R2 Env Vars:', {
    R2_BUCKET: process.env.R2_BUCKET ? 'Loaded' : 'MISSING',
    R2_ENDPOINT: process.env.R2_ENDPOINT ? 'Loaded' : 'MISSING',
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? 'Loaded' : 'MISSING',
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY
      ? 'Loaded'
      : 'MISSING',
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL
      ? process.env.R2_PUBLIC_URL
      : 'MISSING or Undefined',
  });

  // Validate R2 configuration before processing
  if (
    !R2_BUCKET ||
    !R2_ENDPOINT ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY
  ) {
    const missingVars = [];
    if (!R2_BUCKET) missingVars.push('R2_BUCKET');
    if (!R2_ENDPOINT) missingVars.push('R2_ENDPOINT');
    if (!R2_ACCESS_KEY_ID) missingVars.push('R2_ACCESS_KEY_ID');
    if (!R2_SECRET_ACCESS_KEY) missingVars.push('R2_SECRET_ACCESS_KEY');

    console.error('Missing R2 environment variables:', missingVars);
    return NextResponse.json(
      { error: `Missing R2 configuration: ${missingVars.join(', ')}` },
      { status: 500 }
    );
  }

  if (!r2Client) {
    console.error('R2 client not initialized');
    return NextResponse.json(
      { error: 'R2 storage is not properly configured' },
      { status: 500 }
    );
  }

  if (!process.env.R2_PUBLIC_URL) {
    console.error('R2_PUBLIC_URL environment variable is missing');
    return NextResponse.json(
      { error: 'R2_PUBLIC_URL environment variable is not configured' },
      { status: 500 }
    );
  }

  try {
    const authResult = await handleAuthorizationV2(request);
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename, contentType } = (await request.json()) as {
      filename: string;
      contentType: string;
    };

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Missing filename or contentType' },
        { status: 400 }
      );
    }

    // Sanitize filename (optional, but recommended)
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Create a unique key prefixing with userId to ensure separation
    const key = `uploads/${userId}/${uuidv4()}-${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET!,
      Key: key,
      ContentType: contentType || 'application/octet-stream', // Use provided type or default
      // Add ACL if your bucket requires it, e.g., ACL: 'public-read' if needed
    });

    // Generate the presigned URL (expires in 1 hour)
    if (!r2Client) {
      throw new Error('R2 client is not initialized');
    }

    const uploadUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600,
    });

    // Construct the public URL (adjust based on your R2 public access setup)
    // This assumes a custom domain or standard R2 public URL pattern.
    // If your bucket isn't public, you might need another mechanism (e.g., signed GET URLs)
    console.log('R2_PUBLIC_URL from env:', process.env.R2_PUBLIC_URL);
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`; // Example public URL

    return NextResponse.json({ uploadUrl, key, publicUrl });
  } catch (error: unknown) {
    if (error && typeof error === 'object') {
      // Handle specific auth errors from handleAuthorizationV2 if they have a status
      if ('status' in error && error.status === 401) {
        // Check if message exists before accessing
        const message =
          'message' in error ? String(error.message) : 'Unauthorized';
        return NextResponse.json({ error: message }, { status: 401 });
      }
    }

    // Log full error details for debugging
    console.error('Error creating presigned URL:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });

    return NextResponse.json(
      {
        error: 'Failed to create upload URL',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
