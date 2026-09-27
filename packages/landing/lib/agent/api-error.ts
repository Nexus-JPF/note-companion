import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'not_found'
  | 'method_not_allowed'
  | 'unauthorized'
  | 'internal_error';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    resolution: string;
  };
}

export function jsonApiError(
  code: ApiErrorCode,
  message: string,
  resolution: string,
  status: number
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        resolution,
      },
    },
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );
}
