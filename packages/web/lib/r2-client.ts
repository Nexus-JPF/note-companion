import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

/**
 * True when `key` is an upload this user created: `uploads/<userId>/<name>`.
 * Use it before reading or recording any client-supplied R2 key, so one user
 * can never point the server at another user's file.
 */
export function isOwnedUploadKey(key: unknown, userId: string): key is string {
  if (typeof key !== "string" || !userId) return false;
  const prefix = `uploads/${userId}/`;
  if (!key.startsWith(prefix) || key.length <= prefix.length || key.length > 1024) {
    return false;
  }
  // No path tricks
  return !key.split("/").some((segment) => segment === ".." || segment === ".");
}

export function deriveR2KeyFromBlobUrl(blobUrl: string): string | null {
  const urlParts = blobUrl.split("/");
  const uploadSegmentIndex = urlParts.findIndex((part) => part === "uploads");
  if (uploadSegmentIndex !== -1 && uploadSegmentIndex < urlParts.length - 1) {
    return urlParts.slice(uploadSegmentIndex).join("/");
  }
  return null;
}

/**
 * Links to stored files are signed on every read and expire, so the bucket
 * does not have to be publicly readable. The database keeps the plain
 * `${R2_PUBLIC_URL}/<key>` strings; they are swapped for signed links on the
 * way out (see signR2Url / signR2UrlsInText).
 */
export const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNABLE_PREFIXES = ["uploads/", "generated/"];

function publicBase(): string | null {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  return base || null;
}

/** The R2 key behind one of our public file links, or null for any other URL. */
export function r2KeyFromPublicUrl(url: unknown): string | null {
  const base = publicBase();
  if (typeof url !== "string" || !base || !url.startsWith(`${base}/`)) return null;
  const key = url.slice(base.length + 1);
  if (!SIGNABLE_PREFIXES.some((prefix) => key.startsWith(prefix))) return null;
  if (key.split("/").some((segment) => segment === ".." || segment === ".")) return null;
  return key;
}

/** A short-lived signed download link for an object in the bucket. */
export async function signR2Key(
  key: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string> {
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn }
  );
}

/**
 * Swap a public link to our bucket for a signed one. Any other URL (for
 * example a Vercel Blob link) is returned unchanged. Never throws: if signing
 * fails, the original link is returned and the failure is logged.
 */
export async function signR2Url(
  url: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string> {
  const key = r2KeyFromPublicUrl(url);
  if (!key) return url;
  try {
    return await signR2Key(key, expiresIn);
  } catch (error) {
    console.error("Failed to sign R2 URL:", error);
    return url;
  }
}

/**
 * Sign every link to our bucket that appears inside a piece of text, for
 * example the markdown image link saved with a generated diagram.
 */
export async function signR2UrlsInText(
  text: string | null,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const base = publicBase();
  if (!text || !base) return text;

  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A markdown link may contain spaces in the file name, so take everything up
  // to its closing parenthesis; a bare link ends at whitespace or a bracket.
  const pattern = new RegExp(
    `\\]\\((${escaped}/(?:uploads|generated)/[^)\\n]+)\\)|(${escaped}/(?:uploads|generated)/[^\\s)\\]"'<>]+)`,
    "g"
  );

  // Sentence punctuation right after a bare link is not part of the link
  const splitBare = (raw: string): [string, string] => {
    const trailing = raw.match(/[.,;:!?]+$/)?.[0] ?? "";
    return [raw.slice(0, raw.length - trailing.length), trailing];
  };

  const urls = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    urls.add(match[1] !== undefined ? match[1] : splitBare(match[2])[0]);
  }
  if (urls.size === 0) return text;

  const signed = new Map<string, string>();
  for (const url of urls) signed.set(url, await signR2Url(url, expiresIn));

  return text.replace(pattern, (_full, markdownUrl?: string, bareUrl?: string) => {
    if (markdownUrl !== undefined) return `](${signed.get(markdownUrl)})`;
    const [url, trailing] = splitBare(bareUrl as string);
    return `${signed.get(url)}${trailing}`;
  });
}
