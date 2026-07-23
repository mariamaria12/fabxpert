/*
 * Framework-agnostic HTTP client for the FabXpert API.
 * Must stay free of React, Next.js, and env-var reads — the consuming app
 * calls configureApiClient(baseUrl) once at startup with its own config.
 */

export class ApiError extends Error {
  /** HTTP status code; 0 means a network-level failure (no HTTP response at all). */
  readonly status: number;
  /** Zod field errors returned by the API validation pipe, when present. */
  readonly validationErrors?: { path: string; message: string }[];

  constructor(
    status: number,
    message: string,
    validationErrors?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

let baseUrl: string | null = null;

export function configureApiClient(url: string): void {
  baseUrl = url.replace(/\/+$/, '');
}

/** Returns the configured API base URL (for EventSource and other non-fetch clients). */
export function getApiClientBaseUrl(): string {
  if (baseUrl === null) {
    throw new Error(
      'API client is not configured. Call configureApiClient(baseUrl) once at app startup.',
    );
  }
  return baseUrl;
}

/**
 * Internal request helper — use the typed functions (e.g. api/auth.ts) instead
 * of calling this directly from apps.
 */
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (baseUrl === null) {
    throw new Error(
      'API client is not configured. Call configureApiClient(baseUrl) once at app startup.',
    );
  }

  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Cache-Control', 'no-store');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Network request failed');
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let validationErrors: { path: string; message: string }[] | undefined;
    try {
      const body: unknown = await response.json();
      if (body !== null && typeof body === 'object' && 'message' in body) {
        const bodyMessage = (body as { message: unknown }).message;
        if (typeof bodyMessage === 'string') {
          message = bodyMessage;
        } else if (Array.isArray(bodyMessage)) {
          message = bodyMessage.join(', ');
        }
      }
      if (
        body !== null &&
        typeof body === 'object' &&
        'errors' in body &&
        Array.isArray((body as { errors: unknown }).errors)
      ) {
        validationErrors = (body as { errors: { path: string; message: string }[] }).errors;
      }
    } catch {
      // Body wasn't parseable JSON — keep the generic message.
    }
    throw new ApiError(response.status, message, validationErrors);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (text === '') {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

function parseContentDispositionFilename(header: string | null): string | undefined {
  if (!header) {
    return undefined;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].trim());
  }

  const asciiMatch = /filename="?([^";]+)"?/i.exec(header);
  return asciiMatch?.[1]?.trim();
}

export type BlobDownload = {
  blob: Blob;
  filename?: string;
};

/**
 * Binary download helper — preserves auth cookies; use for export endpoints.
 */
export async function requestBlob(
  path: string,
  options: RequestInit = {},
): Promise<BlobDownload> {
  if (baseUrl === null) {
    throw new Error(
      'API client is not configured. Call configureApiClient(baseUrl) once at app startup.',
    );
  }

  let response: Response;
  try {
    const headers = new Headers(options.headers);
    headers.set('Cache-Control', 'no-store');
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Network request failed');
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (body !== null && typeof body === 'object' && 'message' in body) {
        const bodyMessage = (body as { message: unknown }).message;
        if (typeof bodyMessage === 'string') {
          message = bodyMessage;
        } else if (Array.isArray(bodyMessage)) {
          message = bodyMessage.join(', ');
        }
      }
    } catch {
      // Body wasn't parseable JSON — keep the generic message.
    }
    throw new ApiError(response.status, message);
  }

  return {
    blob: await response.blob(),
    filename: parseContentDispositionFilename(response.headers.get('Content-Disposition')),
  };
}
