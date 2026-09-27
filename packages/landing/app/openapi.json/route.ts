import { NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/lib/openapi/spec';

export async function GET() {
  const spec = buildOpenApiSpec();
  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
