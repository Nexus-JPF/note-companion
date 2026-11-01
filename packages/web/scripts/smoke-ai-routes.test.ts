import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const SCRIPT = path.join(__dirname, 'smoke-ai-routes.mjs');
const KEY = 'test-key';

// Mock server: one behavior per route so each failure mode is exercised.
function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  req.resume();
  req.on('end', () => {
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.headers.authorization !== `Bearer ${KEY}`) {
      return json(401, { error: 'Unauthorized' });
    }
    switch (req.url) {
      case '/api/classify1':
        return json(200, { documentType: 'Meeting Note' });
      case '/api/tags/v2':
        return json(200, {}); // missing field
      case '/api/folders/v2':
        return json(500, { error: 'reasoning_effort not supported' });
      case '/api/title/v2':
        return json(200, { error: 'boom' }); // 200 with error body
      case '/api/format-stream':
        return void res.end('   '); // empty stream
      case '/api/enhance-meeting-note':
        return void res.end('- notes');
      case '/api/chat/v5':
        return void res.end('data: {"type":"text-delta","delta":"pong"}\n\n');
      default:
        return json(200, { concepts: [1], content: 'x' });
    }
  });
}

function runScript(env: Record<string, string>) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      env: { PATH: process.env.PATH ?? '', ...env } as NodeJS.ProcessEnv,
    });
    let out = '';
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

describe('smoke-ai-routes script', () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = http.createServer(handler);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('passes healthy routes and exits 0', async () => {
    const { code, out } = await runScript({
      SMOKE_BASE_URL: base,
      SMOKE_API_KEY: KEY,
      SMOKE_ONLY: 'classify1,enhance-meeting-note,chat/v5,chat/v5 (no search)',
    });
    expect(out).toMatch(/PASS\s+classify1/);
    expect(out).toMatch(/PASS\s+chat\/v5 \(no search\)/);
    expect(code).toBe(0);
  });

  it('fails each broken route with a reason and exits 1', async () => {
    const { code, out } = await runScript({
      SMOKE_BASE_URL: base,
      SMOKE_API_KEY: KEY,
      SMOKE_ONLY: 'tags/v2,folders/v2,title/v2,format-stream',
    });
    expect(out).toMatch(/FAIL\s+tags\/v2[\s\S]*missing tags/);
    expect(out).toMatch(/FAIL\s+folders\/v2[\s\S]*HTTP 500/);
    expect(out).toMatch(/FAIL\s+title\/v2[\s\S]*200 with error: boom/);
    expect(out).toMatch(/FAIL\s+format-stream[\s\S]*empty stream/);
    expect(code).toBe(1);
  });

  it('exits 2 without an API key', async () => {
    const { code, out } = await runScript({ SMOKE_BASE_URL: base });
    expect(out).toMatch(/SMOKE_API_KEY is required/);
    expect(code).toBe(2);
  });

  it('refuses to send the key to a disallowed host', async () => {
    for (const url of [
      'https://evil.example.com',
      'https://app.notecompanion.ai.evil.com',
      'http://app.notecompanion.ai',
    ]) {
      const { code, out } = await runScript({
        SMOKE_BASE_URL: url,
        SMOKE_API_KEY: KEY,
      });
      expect(out).toMatch(/Refusing to send the API key/);
      expect(code).toBe(2);
    }
  });
});
