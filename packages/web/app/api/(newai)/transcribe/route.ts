import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fsPromises } from 'node:fs';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { extractUserId, verifyUnkeyApiKey } from '@/lib/unkey-client';
import {
  checkAudioTranscriptionQuota,
  incrementAudioTranscriptionUsage,
} from '@/drizzle/schema';
import { downloadFromR2, isOwnedUploadKey } from '@/lib/r2-client';
import {
  normalizeAudioForWhisper,
  splitAudioFileBySizeHeuristic,
} from '@/lib/audio/split-audio';

export const runtime = 'nodejs';
export const maxDuration = 800; // Maximum allowed for Vercel Pro plan (13.3 minutes) for longer audio/video files

/** Guardrail: max file size (250MB). Do not run chunking above this. */
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
/** Guardrail: max audio duration in minutes (180 min = 3 hours). */
const MAX_AUDIO_MINUTES = 180;
const WHISPER_MAX_MB = 25;
const WHISPER_CONCURRENCY = 2;

/**
 * Client-supplied extensions end up in temp file paths. Allow only plain
 * alphanumerics so something like "../../x" cannot escape the temp directory;
 * anything else falls back to webm.
 */
function safeExtension(extension: unknown, fallback = 'webm'): string {
  const value =
    typeof extension === 'string' ? extension.trim().toLowerCase() : '';
  return /^[a-z0-9]{1,8}$/.test(value) ? value : fallback;
}

/**
 * Gets the duration of an audio file in minutes
 * Estimates duration from file size since get-audio-duration doesn't work in serverless environments
 * @param filePath Path to the audio file
 * @returns Duration in minutes (rounded up)
 */
async function getAudioDurationInMinutes(filePath: string): Promise<number> {
  try {
    const stats = await fsPromises.stat(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    // Estimate duration based on file size and format
    // Different audio formats have different compression ratios:
    // - MP3 (128kbps): ~1MB per minute
    // - WAV (uncompressed): ~10MB per minute
    // - M4A/AAC (compressed): ~0.7MB per minute
    // - OGG (compressed): ~0.8MB per minute
    // - WebM (compressed): ~0.6MB per minute

    // Get file extension to determine format
    const extension = filePath.split('.').pop()?.toLowerCase() || 'mp3';

    let minutesPerMB: number;
    switch (extension) {
      case 'wav':
        minutesPerMB = 0.1; // ~10MB per minute
        break;
      case 'm4a':
      case 'aac':
        minutesPerMB = 1.4; // ~0.7MB per minute
        break;
      case 'ogg':
        minutesPerMB = 1.25; // ~0.8MB per minute
        break;
      case 'webm':
        minutesPerMB = 1.67; // ~0.6MB per minute
        break;
      case 'mp3':
      default:
        minutesPerMB = 1.0; // ~1MB per minute (128kbps)
        break;
    }

    // Calculate estimated duration and round up to be conservative with quota
    const estimatedMinutes = fileSizeInMB * minutesPerMB;
    return Math.ceil(estimatedMinutes);
  } catch (error) {
    console.error('Error calculating audio duration:', error);
    // Ultimate fallback: very conservative estimate (assume worst case)
    const stats = await fsPromises.stat(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    // Assume 0.5MB per minute (worst case, most compressed)
    return Math.ceil(fileSizeInMB * 2);
  }
}

/**
 * Formats transcript text by adding paragraph breaks at natural points
 * to make it more readable.
 *
 * Breaks at:
 * - Periods followed by capital letters (sentence boundaries)
 * - Question marks and exclamation marks
 * - Natural pauses (multiple spaces)
 */
function formatTranscript(text: string): string {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // First, normalize multiple spaces to single spaces
  let formatted = text.replace(/\s+/g, ' ').trim();

  // Split into sentences by looking for sentence-ending punctuation
  // followed by a space and a capital letter
  const sentenceEndings = /([.!?])\s+([A-Z])/g;

  // Replace sentence endings with punctuation + double newline + capital letter
  formatted = formatted.replace(sentenceEndings, '$1\n\n$2');

  // Also handle cases where sentence ends with punctuation followed by quotes
  formatted = formatted.replace(/([.!?])\s*(["'])\s+([A-Z])/g, '$1$2\n\n$3');

  // Handle question marks and exclamation marks similarly
  formatted = formatted.replace(/([!?])\s+([A-Z])/g, '$1\n\n$2');

  // Clean up any triple or more newlines (should only have double)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // Trim each paragraph
  formatted = formatted
    .split('\n\n')
    .map((para) => para.trim())
    .filter((para) => para.length > 0)
    .join('\n\n');

  return formatted;
}

/**
 * Transcribes multiple chunk files with limited concurrency.
 * Returns transcript texts in chunk index order (not completion order).
 */
async function transcribeChunksInOrder(
  openai: OpenAI,
  chunkPaths: string[],
  concurrency: number = WHISPER_CONCURRENCY
): Promise<string[]> {
  const results: string[] = new Array(chunkPaths.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < chunkPaths.length) {
      const i = nextIndex++;
      const path = chunkPaths[i];
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(path),
        model: 'whisper-1',
      });
      results[i] = transcription.text ?? '';
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, chunkPaths.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  let tempFilePath: string | null = null;

  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    const key = authHeader?.replace('Bearer ', '');

    if (!key) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { result, error } = await verifyUnkeyApiKey(key);

    if (error || !result || !result.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = extractUserId(result);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unable to identify user from API key' },
        { status: 401 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let extension: string;

    if (contentType.includes('multipart/form-data')) {
      // Handle direct file upload from plugin (smaller files < 4MB)
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File;

      if (!audioFile) {
        return NextResponse.json(
          { error: 'No audio file provided' },
          { status: 400 }
        );
      }

      extension = safeExtension(audioFile.name.split('.').pop());
      const arrayBuffer = await audioFile.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      tempFilePath = join(tmpdir(), `upload_${Date.now()}.${extension}`);
      await fsPromises.writeFile(tempFilePath, buffer);
    } else if (contentType.includes('application/json')) {
      const body = await request.json();

      // Handle pre-signed URL flow (larger files > 4MB). The file is already in R2:
      // read it by key with our own credentials, and only if it is the caller's.
      // Older clients also send `fileUrl`; it is accepted but never fetched.
      if (body.key || body.fileUrl) {
        // Keys are created under the same id (create-upload-url): the shared
        // default 'user' when user management is off (self-hosting)
        const uploadOwnerId =
          process.env.ENABLE_USER_MANAGEMENT === 'true' ? userId : 'user';
        if (!isOwnedUploadKey(body.key, uploadOwnerId)) {
          return NextResponse.json(
            { error: 'Invalid file key' },
            { status: 403 }
          );
        }
        return handlePresignedUrlTranscription(
          body.key,
          safeExtension(body.extension),
          userId
        );
      }

      // Handle base64 upload (from audio recorder)
      if (body.audio && body.extension) {
        extension = safeExtension(body.extension);
        const base64Data = body.audio.split(';base64,').pop();
        if (!base64Data) {
          return NextResponse.json(
            { error: 'Invalid base64 data' },
            { status: 400 }
          );
        }

        tempFilePath = join(tmpdir(), `upload_${Date.now()}.${extension}`);
        await fsPromises.writeFile(tempFilePath, base64Data, {
          encoding: 'base64',
        });
      } else {
        return NextResponse.json(
          { error: 'Missing audio data' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_WHISPER_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
    });

    const stats = await fsPromises.stat(tempFilePath);
    const fileBytes = stats.size;
    const fileSizeInMB = fileBytes / (1024 * 1024);
    const durationInMinutes = await getAudioDurationInMinutes(tempFilePath);

    // Guardrails: check immediately after file is in /tmp, before any splitting
    if (fileBytes > MAX_UPLOAD_BYTES || durationInMinutes > MAX_AUDIO_MINUTES) {
      if (tempFilePath) await fsPromises.unlink(tempFilePath);
      return NextResponse.json(
        {
          error:
            'This recording is too long to process in one request. Please split it into parts.',
        },
        { status: 400 }
      );
    }

    const { remaining: remainingMinutes, usageError } =
      await checkAudioTranscriptionQuota(userId);

    if (usageError) {
      if (tempFilePath) await fsPromises.unlink(tempFilePath);
      return NextResponse.json(
        {
          error: 'Failed to check audio transcription quota',
          details: 'Please try again later.',
        },
        { status: 500 }
      );
    }

    if (remainingMinutes < durationInMinutes) {
      if (tempFilePath) await fsPromises.unlink(tempFilePath);
      const { db, UserUsageTable } = await import('@/drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const userUsage = await db
        .select()
        .from(UserUsageTable)
        .where(eq(UserUsageTable.userId, userId))
        .limit(1);

      const currentUsage = userUsage[0]?.audioTranscriptionMinutes || 0;
      const maxUsage = userUsage[0]?.maxAudioTranscriptionMinutes || 0;

      return NextResponse.json(
        {
          error: 'Audio transcription quota exceeded',
          details: `You have used ${currentUsage}/${maxUsage} minutes this month. This file would add ${durationInMinutes} minutes. Please upgrade your plan or wait for the next billing cycle.`,
        },
        { status: 429 }
      );
    }

    let chunkPaths: string[] = [];
    let normalizedPathToCleanup: string | null = null;

    try {
      let formattedText: string;
      let transcriptLength: number;

      if (fileSizeInMB <= WHISPER_MAX_MB) {
        const normalized = await normalizeAudioForWhisper(tempFilePath, extension);
        if (normalized.cleanup) normalizedPathToCleanup = normalized.path;
        const pathToUse = normalized.path;
        console.log(
          `[Transcribe] Starting transcription for file: ${pathToUse}, size: ${fileSizeInMB.toFixed(2)}MB, duration: ${durationInMinutes} minutes`
        );
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(pathToUse),
          model: 'whisper-1',
        });
        transcriptLength = transcription.text.length;
        formattedText = formatTranscript(transcription.text);
        console.log(
          `[Transcribe] Transcription completed. Transcript length: ${transcriptLength} characters`
        );
      } else {
        try {
          const { chunkPaths: paths } = await splitAudioFileBySizeHeuristic(
            tempFilePath,
            extension,
            fileBytes,
            { outputDir: tmpdir() }
          );
          chunkPaths = paths;
          console.log(
            `[Transcribe] Chunked into ${chunkPaths.length} segments, transcribing with concurrency ${WHISPER_CONCURRENCY}`
          );
          const chunkTexts = await transcribeChunksInOrder(
            openai,
            chunkPaths,
            WHISPER_CONCURRENCY
          );
          const mergedText = chunkTexts.join('\n');
          transcriptLength = mergedText.length;
          formattedText = formatTranscript(mergedText);
          console.log(
            `[Transcribe] Chunked transcription completed. Merged length: ${transcriptLength} characters`
          );
        } catch (splitError) {
          console.error('[Transcribe] Chunking failed:', splitError);
          return NextResponse.json(
            {
              error:
                "We couldn't process this audio format for long recordings.",
            },
            { status: 400 }
          );
        }
      }

      try {
        await incrementAudioTranscriptionUsage(userId, durationInMinutes);
        console.log(
          `[Transcribe] Incremented audio transcription usage: +${durationInMinutes} minutes for user ${userId}`
        );
      } catch (usageError) {
        console.error(
          '[Transcribe] Failed to increment audio transcription usage:',
          usageError
        );
      }

      return NextResponse.json({
        text: formattedText,
        length: transcriptLength,
      });
    } finally {
      if (tempFilePath) {
        try {
          await fsPromises.unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
      if (normalizedPathToCleanup) {
        try {
          await fsPromises.unlink(normalizedPathToCleanup);
        } catch {
          // Ignore cleanup errors
        }
      }
      for (const p of chunkPaths) {
        try {
          await fsPromises.unlink(p);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  } catch (error) {
    console.error('Transcription error:', error);

    if (tempFilePath) {
      try {
        await fsPromises.unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    const message = error instanceof Error ? error.message : '';
    if (message === 'AUDIO_UNREADABLE') {
      return NextResponse.json(
        {
          error:
            'This recording could not be processed (corrupted or unsupported M4A). Try re-exporting as MP3 or WAV, or use a different recorder.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to process audio',
        details:
          'Audio transcription failed. Please check file format and size.',
      },
      { status: 500 }
    );
  }
}

async function handlePresignedUrlTranscription(
  r2Key: string,
  extension: string,
  userId: string
): Promise<NextResponse> {
  let tempFilePath: string | null = null;
  let chunkPaths: string[] = [];

  try {
    let downloaded: Buffer;
    try {
      downloaded = await downloadFromR2(r2Key);
    } catch (error) {
      console.error('Failed to download file from R2:', error);
      throw new Error('Failed to download file from R2');
    }
    // A plain Uint8Array view over the same bytes (no copy), the same type the
    // direct-upload path writes. A raw Buffer does not type-check with newer
    // @types/node, where Buffer is Buffer<ArrayBufferLike>.
    const buffer = new Uint8Array(
      downloaded.buffer as ArrayBuffer,
      downloaded.byteOffset,
      downloaded.byteLength
    );

    tempFilePath = join(tmpdir(), `r2_audio_${Date.now()}.${extension}`);
    await fsPromises.writeFile(tempFilePath, buffer);

    // M4A/MP4 must have valid container header (ftyp); catch corruption or wrong content from R2
    const ext = extension.toLowerCase();
    if (ext === 'm4a' || ext === 'mp4') {
      const fh = await fsPromises.open(tempFilePath, 'r');
      const buf = new Uint8Array(12);
      const { bytesRead } = await fh.read(buf, 0, 12, 0);
      await fh.close();
      const ftyp =
        bytesRead >= 8 &&
        buf[4] === 0x66 &&
        buf[5] === 0x74 &&
        buf[6] === 0x79 &&
        buf[7] === 0x70;
      if (!ftyp) {
        await fsPromises.unlink(tempFilePath);
        return NextResponse.json(
          {
            error:
              'The downloaded audio file appears corrupted or invalid. Try uploading again, or export the recording as MP3 or WAV and use that file.',
          },
          { status: 400 }
        );
      }
    }

    const stats = await fsPromises.stat(tempFilePath);
    const fileBytes = stats.size;
    const fileSizeInMB = fileBytes / (1024 * 1024);
    const durationInMinutes = await getAudioDurationInMinutes(tempFilePath);

    // Guardrails: check immediately after file is in /tmp
    if (fileBytes > MAX_UPLOAD_BYTES || durationInMinutes > MAX_AUDIO_MINUTES) {
      await fsPromises.unlink(tempFilePath);
      return NextResponse.json(
        {
          error:
            'This recording is too long to process in one request. Please split it into parts.',
        },
        { status: 400 }
      );
    }

    const { remaining: remainingMinutes, usageError } =
      await checkAudioTranscriptionQuota(userId);

    if (usageError) {
      if (tempFilePath) await fsPromises.unlink(tempFilePath);
      return NextResponse.json(
        {
          error: 'Failed to check audio transcription quota',
          details: 'Please try again later.',
        },
        { status: 500 }
      );
    }

    if (remainingMinutes < durationInMinutes) {
      if (tempFilePath) await fsPromises.unlink(tempFilePath);
      const { db, UserUsageTable } = await import('@/drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const userUsage = await db
        .select()
        .from(UserUsageTable)
        .where(eq(UserUsageTable.userId, userId))
        .limit(1);

      const currentUsage = userUsage[0]?.audioTranscriptionMinutes || 0;
      const maxUsage = userUsage[0]?.maxAudioTranscriptionMinutes || 0;

      return NextResponse.json(
        {
          error: 'Audio transcription quota exceeded',
          details: `You have used ${currentUsage}/${maxUsage} minutes this month. This file would add ${durationInMinutes} minutes. Please upgrade your plan or wait for the next billing cycle.`,
        },
        { status: 429 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_WHISPER_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
    });

    let normalizedPathToCleanup: string | null = null;

    try {
      let formattedText: string;
      let transcriptLength: number;

      if (fileSizeInMB <= WHISPER_MAX_MB) {
        const normalized = await normalizeAudioForWhisper(tempFilePath, extension);
        if (normalized.cleanup) normalizedPathToCleanup = normalized.path;
        const pathToUse = normalized.path;
        console.log(
          `[Transcribe R2] Starting transcription: ${pathToUse}, size: ${fileSizeInMB.toFixed(2)}MB, duration: ${durationInMinutes} minutes`
        );
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(pathToUse),
          model: 'whisper-1',
        });
        transcriptLength = transcription.text.length;
        formattedText = formatTranscript(transcription.text);
        console.log(
          `[Transcribe R2] Transcription completed. Transcript length: ${transcriptLength} characters`
        );
      } else {
        try {
          const { chunkPaths: paths } = await splitAudioFileBySizeHeuristic(
            tempFilePath,
            extension,
            fileBytes,
            { outputDir: tmpdir() }
          );
          chunkPaths = paths;
          console.log(
            `[Transcribe R2] Chunked into ${chunkPaths.length} segments, transcribing with concurrency ${WHISPER_CONCURRENCY}`
          );
          const chunkTexts = await transcribeChunksInOrder(
            openai,
            chunkPaths,
            WHISPER_CONCURRENCY
          );
          const mergedText = chunkTexts.join('\n');
          transcriptLength = mergedText.length;
          formattedText = formatTranscript(mergedText);
          console.log(
            `[Transcribe R2] Chunked transcription completed. Merged length: ${transcriptLength} characters`
          );
        } catch (splitError) {
          console.error('[Transcribe R2] Chunking failed:', splitError);
          return NextResponse.json(
            {
              error:
                "We couldn't process this audio format for long recordings.",
            },
            { status: 400 }
          );
        }
      }

      try {
        await incrementAudioTranscriptionUsage(userId, durationInMinutes);
        console.log(
          `[Transcribe R2] Incremented audio transcription usage: +${durationInMinutes} minutes for user ${userId}`
        );
      } catch (usageError) {
        console.error(
          '[Transcribe R2] Failed to increment audio transcription usage:',
          usageError
        );
      }

      return NextResponse.json({
        text: formattedText,
        length: transcriptLength,
      });
    } finally {
      if (tempFilePath) {
        try {
          await fsPromises.unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
      if (normalizedPathToCleanup) {
        try {
          await fsPromises.unlink(normalizedPathToCleanup);
        } catch {
          // Ignore cleanup errors
        }
      }
      for (const p of chunkPaths) {
        try {
          await fsPromises.unlink(p);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  } catch (error) {
    console.error('Pre-signed URL transcription error:', error);

    if (tempFilePath) {
      try {
        await fsPromises.unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    const message = error instanceof Error ? error.message : '';
    if (message === 'AUDIO_UNREADABLE') {
      return NextResponse.json(
        {
          error:
            'This recording could not be processed (corrupted or unsupported M4A). Try re-exporting as MP3 or WAV, or use a different recorder.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process audio from R2',
      },
      { status: 500 }
    );
  }
}
