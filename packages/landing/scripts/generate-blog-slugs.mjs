import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '../content/blog');
const outFile = path.join(__dirname, '../lib/agent/blog-slugs.generated.json');

const slugs = fs
  .readdirSync(postsDir)
  .filter((name) => name.endsWith('.md'))
  .map((name) => name.slice(0, -'.md'.length))
  .sort();

fs.writeFileSync(outFile, `${JSON.stringify(slugs, null, 2)}\n`);
