import { rpc } from "./rpc.ts";

export type ElevenLabsRuntimeConfig = {
  elevenlabs_api_key: string | null;
  elevenlabs_agent_id: string | null;
  rate_limit_pepper: string | null;
};

const DEMO_ORIGINS = [
  "https://banana-navy.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export function allowedOrigins(): Set<string> {
  const configured = Deno.env.get("CHRSM_ALLOWED_ORIGINS")?.trim();
  return new Set(
    (configured || DEMO_ORIGINS.join(","))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function corsHeaders(origin: string): HeadersInit {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

export function requestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip")?.trim() || forwarded ||
    request.headers.get("x-real-ip")?.trim() || null;
}

export async function hmacSubjectHash(
  subject: string,
  pepper: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(subject)),
  );
  return `\\x${Array.from(digest).map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")}`;
}

export async function elevenLabsRuntimeConfig(): Promise<ElevenLabsRuntimeConfig | null> {
  const rows = await rpc<ElevenLabsRuntimeConfig[]>(
    "chrsm_demo_get_elevenlabs_runtime_config",
    {},
  );
  return rows.length === 1 ? rows[0] : null;
}
