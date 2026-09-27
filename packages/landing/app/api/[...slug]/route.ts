import { jsonApiError } from '@/lib/agent/api-error';

function notFoundResponse() {
  return jsonApiError(
    'not_found',
    'API route not found',
    'See /openapi.json on notecompanion.ai for Note Companion API operations (server: https://app.notecompanion.ai).',
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
