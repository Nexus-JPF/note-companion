import { requestUrl } from "obsidian";

export type ObsidianFetchInit = {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | ArrayBuffer | FormData | Blob | null;
  signal?: AbortSignal;
  /** Pass false to receive 4xx/5xx as a normal Response (requestUrl throws by default). */
  throw?: boolean;
};

function normalizeHeaders(
  headers?: Record<string, string> | Headers
): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  return { ...headers };
}

async function normalizeBody(
  body?: string | ArrayBuffer | FormData | Blob | null,
  headers: Record<string, string> = {}
): Promise<{
  body?: string | ArrayBuffer;
  contentType?: string;
  headers: Record<string, string>;
}> {
  if (body == null) {
    return { headers };
  }
  if (typeof body === "string" || body instanceof ArrayBuffer) {
    return { body, headers };
  }
  if (body instanceof Blob) {
    return { body: await body.arrayBuffer(), headers };
  }
  if (body instanceof FormData) {
    const boundary = `----ObsidianFetch${Date.now()}`;
    const chunks: Uint8Array[] = [];
    const encoder = new TextEncoder();

    const entries: [string, FormDataEntryValue][] = [];
    body.forEach((value, key) => {
      entries.push([key, value]);
    });

    for (const [key, value] of entries) {
      if (value instanceof Blob) {
        const fileName = value instanceof File ? value.name : "blob";
        const partHeader =
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${key}"; filename="${fileName}"\r\n` +
          `Content-Type: ${value.type || "application/octet-stream"}\r\n\r\n`;
        chunks.push(encoder.encode(partHeader));
        chunks.push(new Uint8Array(await value.arrayBuffer()));
        chunks.push(encoder.encode("\r\n"));
      } else {
        const part =
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
          `${value}\r\n`;
        chunks.push(encoder.encode(part));
      }
    }
    chunks.push(encoder.encode(`--${boundary}--\r\n`));

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const normalizedHeaders = { ...headers };
    delete normalizedHeaders["Content-Type"];
    delete normalizedHeaders["content-type"];

    return {
      body: combined.buffer,
      contentType: `multipart/form-data; boundary=${boundary}`,
      headers: normalizedHeaders,
    };
  }

  return { body: String(body), headers };
}

function createBodyStream(text: string): ReadableStream<Uint8Array> {
  const encoded = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });
}

function resolveUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * Wraps Obsidian's requestUrl to match the fetch API signature.
 * Use instead of global fetch in the Obsidian Electron environment.
 */
export async function obsidianFetch(
  input: string | URL | Request,
  init?: ObsidianFetchInit
): Promise<Response> {
  const urlString = resolveUrl(input);
  const method =
    init?.method || (input instanceof Request ? input.method : "GET");
  const headers = normalizeHeaders(
    init?.headers || (input instanceof Request ? input.headers : undefined)
  );
  const bodyInput =
    init?.body ?? (input instanceof Request ? undefined : undefined);

  const {
    body,
    contentType,
    headers: requestHeaders,
  } = await normalizeBody(bodyInput, headers);

  const fetchPromise = requestUrl({
    url: urlString,
    method,
    headers: requestHeaders,
    body,
    contentType,
    throw: init?.throw,
  }).then(response => {
    const responseText = response.text;

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: "",
      body: createBodyStream(responseText),
      text: async () => responseText,
      json: async () => {
        try {
          return typeof response.json === "string"
            ? (JSON.parse(response.json) as unknown)
            : (response.json as unknown);
        } catch {
          throw new Error("Invalid JSON response");
        }
      },
      headers: new Headers(response.headers || {}),
    } as Response;
  });

  if (init?.signal) {
    if (init.signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return Promise.race([
      fetchPromise,
      new Promise<Response>((_, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }),
    ]);
  }

  return fetchPromise;
}
