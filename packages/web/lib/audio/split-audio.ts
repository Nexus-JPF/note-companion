/**
 * Splits an audio file into chunks under the Whisper API size limit (25MB)
 * using time-based heuristic. Uses ffprobe for duration and ffmpeg for splitting.
 * Two-stage fallback: stream copy first; if that fails, re-encode once then split.
 */

import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';
import { promises as fsPromises } from 'node:fs';

const execFileAsync = promisify(execFile);

const MAX_CHUNK_BYTES = 24 * 1024 * 1024; // 24MB headroom under 25MB
const OVERLAP_SECONDS = 2;
const CHUNK_SIZE_FACTOR = 0.92; // safety margin

/**
 * Resolve ffprobe binary path.
 * - Use FFPROBE_PATH env if set (e.g. local /opt/homebrew/bin/ffprobe).
 * - Else use bundled binary from @ffprobe-installer/ffprobe (Vercel).
 * - Else fallback to 'ffprobe' in PATH.
 */
function getFfprobePath(): string {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  try {
    // Bundled binary on Vercel; optional so we use require()
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const ffprobe = require('@ffprobe-installer/ffprobe');
    return ffprobe.path;
  } catch {
    return 'ffprobe';
  }
}

/**
 * Resolve ffmpeg binary path.
 * - Use FFMPEG_PATH env if set (e.g. local /opt/homebrew/bin/ffmpeg).
 * - Else use bundled binary from ffmpeg-static (Vercel).
 * - Else fallback to 'ffmpeg' in PATH.
 */
function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    // Bundled binary on Vercel; optional so we use require()
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const path = require('ffmpeg-static');
    return typeof path === 'string' ? path : (path as { default?: string })?.default ?? 'ffmpeg';
  } catch {
    return 'ffmpeg';
  }
}

/** True when the ffmpeg/ffprobe binary itself could not be started (missing or not executable). */
export function isBinaryUnavailable(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'ENOENT' || code === 'EACCES' || code === 'EPERM';
}

/**
 * Normalizes M4A/MP4 files for the Whisper API by re-encoding to MP3.
 * iOS and some recorders produce M4A with moov at the end or non-AAC codecs, which Whisper can reject.
 * Re-encoding to MP3 guarantees a format Whisper always accepts.
 * Returns a path to use for Whisper and whether the caller must unlink that path when done.
 */
export async function normalizeAudioForWhisper(
  inputPath: string,
  extension: string
): Promise<{ path: string; cleanup: boolean }> {
  const ext = extension.toLowerCase();
  if (ext !== 'm4a' && ext !== 'mp4') {
    return { path: inputPath, cleanup: false };
  }
  const outPath = join(
    dirname(inputPath),
    `whisper_${Date.now()}.mp3`
  );
  try {
    await execFileAsync(getFfmpegPath(), [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-b:a',
      '64k',
      outPath,
    ]);
    return { path: outPath, cleanup: true };
  } catch (err) {
    console.warn('[normalizeAudioForWhisper] ffmpeg re-encode failed:', err);
    // Binary missing/not executable is our infrastructure problem, not a bad file
    if (isBinaryUnavailable(err)) {
      throw new Error('FFMPEG_UNAVAILABLE');
    }
    // Don't fall back: the file is likely corrupted/fragmented and Whisper would reject it too
    const e = new Error('AUDIO_UNREADABLE');
    if (err instanceof Error) (e as Error & { cause?: unknown }).cause = err;
    throw e;
  }
}

export interface SplitAudioOptions {
  /** Override overlap between consecutive chunks in seconds (default 2). */
  overlapSeconds?: number;
  /** Output directory for chunk files (default: os.tmpdir()). */
  outputDir?: string;
}

export interface SplitAudioResult {
  chunkPaths: string[];
  overlapSeconds: number;
}

/**
 * Gets duration in seconds of an audio/video file using ffprobe.
 */
async function getDurationSeconds(inputPath: string): Promise<number> {
  const { stdout } = await execFileAsync(getFfprobePath(), [
    '-v',
    'quiet',
    '-show_format',
    '-print_format',
    'json',
    inputPath,
  ]);
  const data = JSON.parse(stdout) as { format?: { duration?: string } };
  const durationStr = data?.format?.duration;
  if (durationStr == null) {
    throw new Error('ffprobe did not return duration');
  }
  const duration = parseFloat(durationStr);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid duration from ffprobe: ${durationStr}`);
  }
  return duration;
}

/**
 * Runs ffmpeg to extract a segment with stream copy.
 * Returns the path to the created chunk file.
 */
async function extractSegmentCopy(
  inputPath: string,
  startSeconds: number,
  durationSeconds: number,
  outputPath: string,
  extension: string
): Promise<void> {
  await execFileAsync(getFfmpegPath(), [
    '-y',
    '-ss',
    String(startSeconds),
    '-t',
    String(durationSeconds),
    '-i',
    inputPath,
    '-c',
    'copy',
    outputPath,
  ]);
}

/**
 * Re-encodes the entire file to a stable format (MP3 64k) for reliable splitting.
 * Returns path to the re-encoded file.
 */
async function reencodeToStable(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await execFileAsync(getFfmpegPath(), [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-acodec',
    'libmp3lame',
    '-b:a',
    '64k',
    outputPath,
  ]);
}

/**
 * Splits an audio file into chunks under maxChunkBytes using a time-based heuristic.
 * Uses ffprobe for real duration, then splits with ffmpeg (-c copy). If stream copy
 * fails (e.g. format doesn't support precise seeking), re-encodes once to MP3 then splits.
 *
 * @param inputPath - Path to the audio file (in /tmp or similar).
 * @param extension - File extension (e.g. 'mp3', 'm4a', 'webm').
 * @param inputBytes - Size of the input file in bytes.
 * @param opts - Optional overlap and output directory.
 * @returns Chunk file paths (in order) and overlap used.
 */
export async function splitAudioFileBySizeHeuristic(
  inputPath: string,
  extension: string,
  inputBytes: number,
  opts: SplitAudioOptions = {}
): Promise<SplitAudioResult> {
  const overlapSeconds = opts.overlapSeconds ?? OVERLAP_SECONDS;
  const outputDir = opts.outputDir ?? tmpdir();
  const baseName = `chunk_${Date.now()}`;

  const durationSeconds = await getDurationSeconds(inputPath);
  if (durationSeconds <= 0) {
    throw new Error('Invalid or zero duration');
  }

  const bytesPerSec = inputBytes / durationSeconds;
  const chunkSeconds =
    Math.floor((MAX_CHUNK_BYTES / bytesPerSec) * CHUNK_SIZE_FACTOR) -
    overlapSeconds;

  if (chunkSeconds <= 0) {
    // File is so dense that one chunk would exceed 24MB; use a single chunk and let Whisper reject or use minimum segment length
    const minChunkSeconds = 10;
    const singleChunkPath = join(outputDir, `${baseName}_0.${extension}`);
    await extractSegmentCopy(
      inputPath,
      0,
      durationSeconds,
      singleChunkPath,
      extension
    ).catch(async () => {
      const reencodedPath = join(outputDir, `reencoded_${Date.now()}.mp3`);
      await reencodeToStable(inputPath, reencodedPath);
      await extractSegmentCopy(
        reencodedPath,
        0,
        durationSeconds,
        singleChunkPath,
        'mp3'
      );
      await fsPromises.unlink(reencodedPath).catch(() => {});
    });
    return { chunkPaths: [singleChunkPath], overlapSeconds };
  }

  const chunkPaths: string[] = [];
  let startSeconds = 0;
  let index = 0;
  let usedReencode = false;
  let reencodedPath: string | null = null;
  let workPath: string = inputPath;

  const tryExtractSegment = async (
    start: number,
    duration: number,
    outPath: string,
    ext: string
  ): Promise<boolean> => {
    try {
      await extractSegmentCopy(
        workPath,
        start,
        duration,
        outPath,
        ext
      );
      return true;
    } catch {
      return false;
    }
  };

  while (startSeconds < durationSeconds) {
    const segmentDuration = Math.min(
      chunkSeconds,
      durationSeconds - startSeconds
    );
    const ext = usedReencode ? 'mp3' : extension;
    const outPath = join(outputDir, `${baseName}_${index}.${ext}`);

    let ok = await tryExtractSegment(
      startSeconds,
      segmentDuration,
      outPath,
      ext
    );

    let segmentOutPath = outPath;
    if (!ok && !usedReencode) {
      // Stage 2: re-encode once, then split from re-encoded file
      reencodedPath = join(outputDir, `reencoded_${Date.now()}.mp3`);
      await reencodeToStable(inputPath, reencodedPath);
      workPath = reencodedPath;
      usedReencode = true;
      segmentOutPath = join(outputDir, `${baseName}_${index}.mp3`);
      ok = await tryExtractSegment(
        startSeconds,
        segmentDuration,
        segmentOutPath,
        'mp3'
      );
      if (!ok) {
        await fsPromises.unlink(reencodedPath).catch(() => {});
        throw new Error('Failed to split audio after re-encode');
      }
    } else if (!ok) {
      if (reencodedPath) await fsPromises.unlink(reencodedPath).catch(() => {});
      throw new Error('Failed to extract segment');
    }

    chunkPaths.push(segmentOutPath);
    startSeconds += segmentDuration;
    index++;
  }

  if (reencodedPath) {
    await fsPromises.unlink(reencodedPath).catch(() => {});
  }

  return { chunkPaths, overlapSeconds };
}
