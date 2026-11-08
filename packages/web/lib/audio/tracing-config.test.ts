import path from 'node:path';
import picomatch from 'next/dist/compiled/picomatch';
import glob from 'next/dist/compiled/glob';
import { normalizeAppPath } from 'next/dist/shared/lib/router/utils/app-paths';

// Regression: ffmpeg/ffprobe were never traced into the transcribe route on
// Vercel (m4a uploads then 400'd with AUDIO_UNREADABLE) because the include
// key contained the "(newai)" route group and the globs pointed at
// packages/web/node_modules, but the monorepo hoists to the root node_modules.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { outputFileTracingIncludes } = require('../../next.config.js');
const webDir = path.join(__dirname, '../..');

describe('outputFileTracingIncludes for /api/transcribe', () => {
  const route = normalizeAppPath('app/api/(newai)/transcribe/route');
  const keys = Object.keys(outputFileTracingIncludes).filter((k) =>
    picomatch(k, { dot: true, contains: true })(route)
  );

  it('has a key that matches the transcribe route as Next normalizes it', () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it('resolves the ffmpeg and ffprobe binaries from the project dir', () => {
    const globs: string[] = keys.flatMap((k) => outputFileTracingIncludes[k]);
    const resolve = (needle: string) =>
      globs
        .filter((g) => g.includes(needle))
        .flatMap((g) => glob.sync(g, { cwd: webDir, nodir: true, dot: true }));
    expect(resolve('ffmpeg-static').length).toBeGreaterThan(0);
    expect(resolve('@ffprobe-installer/ffprobe').length).toBeGreaterThan(0);
  });
});
