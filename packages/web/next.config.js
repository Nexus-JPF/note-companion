const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Required for pnpm monorepo: ensures files outside app directory are traced
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Don't bundle these (native binaries); load from node_modules at runtime
  serverExternalPackages: ['ffmpeg-static', '@ffprobe-installer/ffprobe', 'postgres'],
  // Include ffmpeg/ffprobe binaries in the transcribe API route bundle (Vercel).
  // The repo uses node-linker=hoisted, so these packages live in the root node_modules
  // (not packages/web/node_modules); globs resolve from the project dir (packages/web).
  // The packages locate their binaries via a dynamic path, so the tracer can't find them.
  // The key is the normalized route ("(newai)" route group stripped), see lib/audio/tracing-config.test.ts.
  outputFileTracingIncludes: {
    '/api/transcribe': [
      '../../node_modules/ffmpeg-static/ffmpeg',
      '../../node_modules/@ffprobe-installer/ffprobe/**',
      '../../node_modules/@ffprobe-installer/linux-x64/**',
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  }
};

module.exports = nextConfig;
