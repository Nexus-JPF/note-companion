import { jsonApiError } from '@/lib/agent/api-error';
import { getSiteBaseUrl } from '@/lib/agent/markdown-response';

function notFoundResponse() {
  const base = getSiteBaseUrl();
  return jsonApiError(
    'not_found',
    'API route not found',
    `See ${base}/openapi.json for Note Companion API operations (server: https://app.notecompanion.ai).`,
    404
  );
}

export async function GET() {
  return notFoundResponse();
}

export async function POST() {
  return notFoundResponse();
}

export async function PUT() {
  return notFoundResponse();
}

export async function PATCH() {
  return notFoundResponse();
}

export async function DELETE() {
  return notFoundResponse();
}
