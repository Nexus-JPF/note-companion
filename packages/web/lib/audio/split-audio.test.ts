import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseFfmpegDuration,
  prepareForSplit,
  splitAudioFileBySizeHeuristic,
} from './split-audio';

describe('parseFfmpegDuration', () => {
  it('parses hh:mm:ss.xx', () => {
    expect(
      parseFfmpegDuration('  Duration: 00:30:00.02, start: 0.000000, bitrate: 133 kb/s')
    ).toBeCloseTo(1800.02, 2);
    expect(parseFfmpegDuration('Duration: 01:02:03.50,')).toBeCloseTo(3723.5, 2);
  });

  it('returns null for N/A (streamed WebM) and for missing or zero durations', () => {
    expect(parseFfmpegDuration('  Duration: N/A, start: -0.007000, bitrate: N/A')).toBeNull();
    expect(parseFfmpegDuration('no duration here')).toBeNull();
    expect(parseFfmpegDuration('Duration: 00:00:00.00,')).toBeNull();
  });
});

// Real-binary check: uses the ffmpeg bundled for Vercel, skipped where it cannot run.
function bundledFfmpeg(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('ffmpeg-static') as string | { default?: string };
    const bin = typeof path === 'string' ? path : path?.default;
    if (!bin) return null;
    fs.accessSync(bin, fs.constants.X_OK);
    return bin;
  } catch {
    return null;
  }
}

const ffmpeg = bundledFfmpeg();
const describeWithFfmpeg = ffmpeg ? describe : describe.skip;

describeWithFfmpeg('recordings without a duration header (MediaRecorder WebM)', () => {
  let dir: string;
  let streamedWebm: string;
  const previousFfmpegPath = process.env.FFMPEG_PATH;
  const previousFfprobePath = process.env.FFPROBE_PATH;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'split-audio-test-'));
    streamedWebm = join(dir, 'streamed.webm');
    // Streamed output cannot seek back to write the duration, like MediaRecorder
    const bytes = execFileSync(
      ffmpeg as string,
      ['-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
        '-c:a', 'libopus', '-b:a', '64k', '-f', 'webm', 'pipe:1'],
      { maxBuffer: 16 * 1024 * 1024 }
    );
    fs.writeFileSync(streamedWebm, bytes);
    process.env.FFMPEG_PATH = ffmpeg as string;
    // Force the ffprobe-unavailable path too
    process.env.FFPROBE_PATH = join(dir, 'no-such-ffprobe');
  });

  afterAll(() => {
    if (previousFfmpegPath === undefined) delete process.env.FFMPEG_PATH;
    else process.env.FFMPEG_PATH = previousFfmpegPath;
    if (previousFfprobePath === undefined) delete process.env.FFPROBE_PATH;
    else process.env.FFPROBE_PATH = previousFfprobePath;
    rmSync(dir, { recursive: true, force: true });
  });

  it('finds the real duration by remuxing, and cleans the temp copy up', async () => {
    const prepared = await prepareForSplit(streamedWebm, 'webm', dir);
    try {
      expect(prepared.cleanup).toBe(true);
      expect(prepared.path).not.toBe(streamedWebm);
      expect(prepared.durationSeconds).toBeGreaterThan(5.5);
      expect(prepared.durationSeconds).toBeLessThan(6.5);
    } finally {
      if (prepared.cleanup) fs.unlinkSync(prepared.path);
    }
  });

  it('splits it instead of failing with "did not return duration"', async () => {
    const before = fs.readdirSync(dir).filter(f => f.startsWith('remux_'));
    const result = await splitAudioFileBySizeHeuristic(
      streamedWebm,
      'webm',
      fs.statSync(streamedWebm).size,
      { outputDir: dir }
    );
    expect(result.chunkPaths.length).toBeGreaterThanOrEqual(1);
    for (const chunk of result.chunkPaths) {
      expect(fs.statSync(chunk).size).toBeGreaterThan(0);
    }
    // the temporary remux copy is gone
    expect(fs.readdirSync(dir).filter(f => f.startsWith('remux_'))).toEqual(before);
  });
});
