import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_REGION = process.env.R2_REGION || "auto";
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

export function getR2ConfigError(): string | null {
  if (
    !R2_BUCKET ||
    !R2_ENDPOINT ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY
  ) {
    return "Missing R2 environment variables";
  }
  return null;
}

let cachedClient: S3Client | null = null;

export function getR2Client(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }
  const configError = getR2ConfigError();
  if (configError) {
    throw new Error(configError);
  }
  cachedClient = new S3Client({
    endpoint: R2_ENDPOINT,
    region: R2_REGION,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
  return cachedClient;
}

export async function downloadFromR2(key: string): Promise<Buffer> {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  const response = await client.send(command);
  if (!response.Body) {
    throw new Error("No body received from R2 getObject");
  }
  const byteArray = await response.Body.transformToByteArray();
  return Buffer.from(byteArray);
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: "public-read",
  });
  await client.send(command);
}

export function deriveR2KeyFromBlobUrl(blobUrl: string): string | null {
  const urlParts = blobUrl.split("/");
  const uploadSegmentIndex = urlParts.findIndex((part) => part === "uploads");
  if (uploadSegmentIndex !== -1 && uploadSegmentIndex < urlParts.length - 1) {
    return urlParts.slice(uploadSegmentIndex).join("/");
  }
  return null;
}
