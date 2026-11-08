export type ApiErrorBody = {
  error?: string;
};

export async function readResponseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function readRequestUrlJson<T>(response: {
  json: unknown;
}): T {
  return response.json as T;
}

export function getApiError(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("error" in data)) {
    return undefined;
  }
  const error = (data as ApiErrorBody).error;
  return typeof error === "string" ? error : undefined;
}

/**
 * Best-effort error text for a non-2xx response: the API's `error`/`details`,
 * else `HTTP <status>` (also when the body is not JSON, e.g. a gateway page).
 */
export async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown; details?: unknown };
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.details === "string") return data.details;
  } catch {
    // fall through to the status
  }
  return `HTTP ${response.status}`;
}

export function parseJsonString<T>(json: string): T {
  return JSON.parse(json) as T;
}

export function parseRequestBodyJson<T>(
  body: BodyInit | null | undefined
): T {
  if (typeof body !== "string") {
    throw new Error("Expected request body to be a JSON string");
  }
  return parseJsonString<T>(body);
}

export type TokenLimitError = Error & {
  status: 429;
  isTokenLimitError?: boolean;
};

export function isTokenLimitError(error: unknown): error is TokenLimitError {
  return (
    error instanceof Error &&
    "status" in error &&
    (error as { status?: unknown }).status === 429
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}

export function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
