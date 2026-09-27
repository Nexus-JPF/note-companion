import { jsonApiError } from '@/lib/api-error-response';

function notFoundResponse() {
  return jsonApiError(
    'not_found',
    'API route not found',
    'See https://www.notecompanion.ai/openapi.json for documented Note Companion API operations.',
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
