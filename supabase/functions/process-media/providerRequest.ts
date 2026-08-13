export const TRANSCRIPTION_PROVIDER_UNAVAILABLE = 'TRANSCRIPTION_PROVIDER_UNAVAILABLE';
export const TRANSCRIPTION_PROVIDER_REQUEST_FAILED = 'TRANSCRIPTION_PROVIDER_REQUEST_FAILED';

export const PROVIDER_MAX_ATTEMPTS = 3;
export const PROVIDER_ATTEMPT_TIMEOUT_MS = 35_000;
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 8_000;
const MAX_PROVIDER_DETAIL_CHARS = 500;

const RETRYABLE_PROVIDER_STATUSES = new Set([429, 500, 502, 503, 504]);

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type RetryOptions = {
  maxAttempts?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

type ProviderRequestErrorOptions = {
  status: number;
  retryable: boolean;
  detail?: string;
  timedOut?: boolean;
};

export class ProviderRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly detail: string;

  constructor(options: ProviderRequestErrorOptions) {
    const message = options.timedOut
      ? 'Transcription provider request timed out.'
      : `Transcription provider request failed with HTTP ${options.status}.`;
    super(message);
    this.name = 'ProviderRequestError';
    this.status = options.status;
    this.retryable = options.retryable;
    this.code = options.retryable
      ? TRANSCRIPTION_PROVIDER_UNAVAILABLE
      : TRANSCRIPTION_PROVIDER_REQUEST_FAILED;
    this.detail = String(options.detail || '').slice(0, MAX_PROVIDER_DETAIL_CHARS);
  }
}

export function isRetryableProviderStatus(status: number): boolean {
  return RETRYABLE_PROVIDER_STATUSES.has(status);
}

function parseRetryAfterMs(response: Response): number | null {
  const value = response.headers.get('retry-after')?.trim();
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, retryAt - Date.now());
}

function getBackoffDelayMs(attempt: number, random: () => number): number {
  const baseDelay = Math.min(
    MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1)
  );
  const jitter = Math.floor(baseDelay * 0.5 * Math.max(0, Math.min(1, random())));
  return Math.min(MAX_RETRY_DELAY_MS, baseDelay + jitter);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchProviderWithRetry(
  url: string,
  requestFactory: () => RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? PROVIDER_MAX_ATTEMPTS));
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? PROVIDER_ATTEMPT_TIMEOUT_MS));
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response | null = null;
    let responseBody = '';
    let fetchError: unknown = null;

    try {
      const upstreamResponse = await fetchImpl(url, {
        ...requestFactory(),
        signal: controller.signal,
      });
      responseBody = await upstreamResponse.text();
      response = new Response(responseBody, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: upstreamResponse.headers,
      });
    } catch (error) {
      fetchError = error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response) {
      if (response.ok) return response;

      const retryable = isRetryableProviderStatus(response.status);
      const detail = responseBody.slice(0, MAX_PROVIDER_DETAIL_CHARS);
      if (!retryable || attempt >= maxAttempts) {
        throw new ProviderRequestError({
          status: response.status,
          retryable,
          detail,
        });
      }

      const retryAfterMs = response.status === 429 ? parseRetryAfterMs(response) : null;
      if (retryAfterMs !== null && retryAfterMs > MAX_RETRY_DELAY_MS) {
        throw new ProviderRequestError({
          status: response.status,
          retryable: true,
          detail,
        });
      }

      const delayMs = retryAfterMs ?? getBackoffDelayMs(attempt, random);
      await sleep(delayMs);
      continue;
    }

    const timedOut = controller.signal.aborted;
    if (attempt >= maxAttempts) {
      const detail = fetchError instanceof Error ? fetchError.message : String(fetchError || '');
      throw new ProviderRequestError({
        status: 504,
        retryable: true,
        detail,
        timedOut,
      });
    }

    await sleep(getBackoffDelayMs(attempt, random));
  }

  throw new ProviderRequestError({
    status: 504,
    retryable: true,
    detail: 'Provider retry loop exited unexpectedly.',
  });
}
