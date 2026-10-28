export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function validateJsonRequest(
  request: Request,
  maxBytes: number,
  extraHeaders: HeadersInit = {},
): Response | null {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, extraHeaders);
  }
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return jsonResponse({ error: "content_type_must_be_json" }, 415, extraHeaders);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return jsonResponse({ error: "payload_too_large" }, 413, extraHeaders);
  }
  return null;
}

export async function readJson(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength > maxBytes) throw new Error("payload_too_large");
  try {
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new Error("invalid_json");
  }
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) return null;
  return cleaned;
}

export function errorStatus(code: string): number {
  if (code === "payload_too_large") return 413;
  if (code === "invalid_json") return 400;
  if (/^22[0-9A-Z]{3}$/.test(code)) return 400;
  if (code === "42501") return 403;
  if (code === "23505") return 409;
  if (code === "55000") return 503;
  return 500;
}

export function safeErrorCode(error: unknown): string {
  return error instanceof Error ? error.message : "internal_error";
}
