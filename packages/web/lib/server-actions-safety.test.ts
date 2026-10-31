import fs from 'node:fs';
import path from 'node:path';

/**
 * Every export of a "use server" file is a Server Action: an HTTP endpoint the
 * browser can call with any arguments. A function there that takes a user id
 * can therefore be called for ANY user. Server Actions must read the user from
 * the session (Clerk auth()) instead; functions that act for a given id belong
 * in a server-only module (see lib/account-server.ts, lib/files-server.ts).
 */

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'lib', 'components'];

// Exports that take a user id but verify it against the session first.
const ALLOWED = new Set([
  // Throws unless auth().userId === userId (used by app/upgrade-from-mobile).
  'app/dashboard/pricing/actions.ts#_createStripeCheckoutSession',
]);

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield full;
  }
}

function isUseServerFile(source: string): boolean {
  // The directive must be the first statement (comments may precede it)
  const withoutComments = source.replace(/^(\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*/, '');
  return /^\s*['"]use server['"]/.test(withoutComments);
}

describe('Server Actions never take a caller-supplied user id', () => {
  const offenders: string[] = [];
  let scanned = 0;

  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const source = fs.readFileSync(file, 'utf8');
      if (!isUseServerFile(source)) continue;
      scanned += 1;
      const rel = path.relative(ROOT, file);
      const exportRe = /export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async)\s*\(([^)]*)\)/g;
      let match: RegExpExecArray | null;
      while ((match = exportRe.exec(source))) {
        const name = match[1] || match[2];
        const params = match[3];
        if (/user_?id|owner/i.test(params) && !ALLOWED.has(`${rel}#${name}`)) {
          offenders.push(`${rel}: ${name}(${params.replace(/\s+/g, ' ').trim()})`);
        }
      }
    }
  }

  it('finds the "use server" files it is meant to check', () => {
    expect(scanned).toBeGreaterThanOrEqual(3);
  });

  it('has no exported action with a user id parameter', () => {
    expect(offenders).toEqual([]);
  });
});
