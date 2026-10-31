import { NextRequest, NextResponse } from 'next/server';
import { getFilesForUser } from '@/lib/files-server';
import {
  handleAuthorizationV2,
  AuthorizationError,
} from '@/lib/handleAuthorization';

type FilesResponse = {
  files: Array<{
    id: number;
    originalName: string;
    fileType: string;
    status: string;
    createdAt: Date;
    tokensUsed: number | null;
    error: string | null;
    textContent: string | null;
    blobUrl: string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);

    if (!userId) {
      console.error('Unauthorized files list attempt - no userId or token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const page = parseInt(
      request.nextUrl.searchParams.get('page') || '1',
      10
    );
    const limit = parseInt(
      request.nextUrl.searchParams.get('limit') || '10',
      10
    );

    const result = await getFilesForUser({ page, limit }, userId);

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Unauthorized' ? 401 : 500 }
      );
    }

    return NextResponse.json(result as FilesResponse);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message || 'Authorization failed' },
        { status: error.status || 403 }
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AuthorizationError' &&
      'status' in error &&
      'message' in error
    ) {
      return NextResponse.json(
        { error: (error.message as string) || 'Authorization failed' },
        { status: (error.status as number) || 403 }
      );
    }

    console.error('List files error:', error);
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    );
  }
}
