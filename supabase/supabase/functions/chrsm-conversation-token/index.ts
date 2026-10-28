import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  jsonResponse,
  safeErrorCode,
} from "../_shared/http.ts";
import { rpc } from "../_shared/rpc.ts";
import {
  allowedOrigins,
  corsHeaders,
  elevenLabsRuntimeConfig,
  hmacSubjectHash,
  requestIp,
} from "../_shared/public-request.ts";

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const origins = allowedOrigins();
  if (!origin || !origins.has(origin)) {
    return jsonResponse({ error: "origin_not_allowed" }, 403);
  }
  const cors = corsHeaders(origin);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  try {
    const config = await elevenLabsRuntimeConfig();
    const ip = requestIp(request);
    if (
      !ip || !config?.rate_limit_pepper || config.rate_limit_pepper.length < 32 ||
      !config.elevenlabs_api_key || !config.elevenlabs_agent_id
    ) {
      return jsonResponse({ error: "elevenlabs_runtime_not_configured" }, 503, cors);
    }
    const allowed = await rpc<boolean>("chrsm_demo_consume_rate_limit", {
      p_purpose: "conversation_token",
      p_subject_hash: await hmacSubjectHash(ip, config.rate_limit_pepper),
      p_window_seconds: 3600,
      p_request_limit: 8,
    });
    if (!allowed) {
      return jsonResponse({ error: "rate_limit_exceeded" }, 429, {
        ...cors,
        "retry-after": "3600",
      });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(config.elevenlabs_agent_id)}`,
      {
        headers: {
          "xi-api-key": config.elevenlabs_api_key,
          accept: "application/json",
        },
      },
    );
    if (!response.ok) {
      return jsonResponse({ error: `elevenlabs_token_${response.status}` }, 502, cors);
    }
    const result = await response.json() as {
      token?: string;
      conversation_id?: string;
    };
    if (!result.token) {
      return jsonResponse({ error: "elevenlabs_token_missing" }, 502, cors);
    }
    return jsonResponse({
      token: result.token,
      conversation_id: result.conversation_id ?? null,
    }, 200, cors);
  } catch (error) {
    const code = safeErrorCode(error);
    const status = code === "payload_too_large" ? 413 : code === "invalid_json" ? 400 : 500;
    return jsonResponse({ error: code }, status, cors);
  }
});
