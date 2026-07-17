export interface BoundedResponseReadOptions {
  status?: number;
  tooLargeCode?: string;
  invalidBodyCode?: string;
}

export class BoundedResponseReadError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "BoundedResponseReadError";
    this.status = status;
    this.code = code;
  }
}

function assertResponseLimit(maxBytes: number): void {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 10 * 1024 * 1024) {
    throw new BoundedResponseReadError(500, "invalid_response_limit");
  }
}

async function cancelResponseBody(response: Response, reason: string): Promise<void> {
  if (!response.body) return;
  await response.body.cancel(reason).catch(() => undefined);
}

async function readResponseBytes(
  response: Response,
  maxBytes: number,
  options: BoundedResponseReadOptions,
): Promise<Uint8Array> {
  assertResponseLimit(maxBytes);

  const status = options.status ?? 502;
  const tooLargeCode = options.tooLargeCode ?? "provider_response_too_large";
  const invalidBodyCode = options.invalidBodyCode ?? "invalid_provider_response";
  const declaredLengthHeader = response.headers.get("content-length");
  if (declaredLengthHeader !== null) {
    const normalizedLength = declaredLengthHeader.trim();
    const declaredLength = /^\d+$/.test(normalizedLength)
      ? Number(normalizedLength)
      : Number.NaN;
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      await cancelResponseBody(response, invalidBodyCode);
      throw new BoundedResponseReadError(status, invalidBodyCode);
    }
    if (declaredLength > maxBytes) {
      await cancelResponseBody(response, tooLargeCode);
      throw new BoundedResponseReadError(status, tooLargeCode);
    }
  }

  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel(tooLargeCode).catch(() => undefined);
        throw new BoundedResponseReadError(status, tooLargeCode);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof BoundedResponseReadError) throw error;
    await reader.cancel(invalidBodyCode).catch(() => undefined);
    throw new BoundedResponseReadError(status, invalidBodyCode);
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  options: BoundedResponseReadOptions = {},
): Promise<string> {
  const bytes = await readResponseBytes(response, maxBytes, options);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new BoundedResponseReadError(
      options.status ?? 502,
      options.invalidBodyCode ?? "invalid_provider_response",
    );
  }
}

export async function readBoundedResponseJson<T>(
  response: Response,
  maxBytes: number,
  options: BoundedResponseReadOptions = {},
): Promise<T> {
  const raw = await readBoundedResponseText(response, maxBytes, options);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new BoundedResponseReadError(
      options.status ?? 502,
      options.invalidBodyCode ?? "invalid_provider_response",
    );
  }
}
