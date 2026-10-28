import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  cleanText,
  hasOnlyKeys,
  isObject,
  jsonResponse,
  readJson,
  safeErrorCode,
  validateJsonRequest,
} from "../_shared/http.ts";
import {
  authorize,
  rpc,
  sha256Bytea,
} from "../_shared/rpc.ts";
import {
  allowedOrigins,
  corsHeaders,
  elevenLabsRuntimeConfig,
  hmacSubjectHash,
  requestIp,
} from "../_shared/public-request.ts";

const MAX_BODY_BYTES = 4_096;
const ALLOWED_KEYS = new Set([
  "postcode",
  "municipality",
  "street",
  "house_number",
  "box_number",
  "language",
  "max_candidates",
  "website",
]);

type Candidate = {
  candidate_rank: number;
  resolution_status: string;
  dataset_version: string;
  region_code: string;
  postcode: string;
  best_address_id: string | null;
  best_street_id: string;
  best_municipality_id: string;
  street_name: string;
  municipality_name: string;
  house_number: string | null;
  box_number: string | null;
  formatted_address: string;
  latitude: number | null;
  longitude: number | null;
  match_score: number;
  candidate_count: number;
};

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const publicOriginAllowed = origin.length > 0 && allowedOrigins().has(origin);
  const cors = publicOriginAllowed ? corsHeaders(origin) : {};
  if (request.method === "OPTIONS") {
    return publicOriginAllowed
      ? new Response(null, { status: 204, headers: cors })
      : jsonResponse({ error: "origin_not_allowed" }, 403);
  }
  try {
    const invalid = validateJsonRequest(request, MAX_BODY_BYTES, cors);
    if (invalid) return invalid;
    const auth = await authorize(request, "resolve:address");
    const publicIp = auth ? null : requestIp(request);
    if ((!auth || !auth.voicebot_instance_id) && (!publicOriginAllowed || !publicIp)) {
      return jsonResponse({ error: "unauthorized" }, 401, cors);
    }
    const config = auth ? null : await elevenLabsRuntimeConfig();
    if (!auth && (!config?.rate_limit_pepper || config.rate_limit_pepper.length < 32)) {
      return jsonResponse({ error: "public_runtime_not_configured" }, 503, cors);
    }
    const rateAllowed = await rpc<boolean>("chrsm_demo_consume_rate_limit", {
      p_purpose: "address_lookup",
      p_subject_hash: auth
        ? await sha256Bytea(`address:${auth.client_id}`)
        : await hmacSubjectHash(`address:${publicIp}`, config!.rate_limit_pepper!),
      p_window_seconds: 3600,
      p_request_limit: auth ? 100 : 30,
    });
    if (!rateAllowed) {
      return jsonResponse({ error: "rate_limit_exceeded" }, 429, cors);
    }
    const payload = await readJson(request, MAX_BODY_BYTES);
    if (!isObject(payload) || !hasOnlyKeys(payload, ALLOWED_KEYS)) {
      return jsonResponse({ error: "invalid_payload" }, 400, cors);
    }
    if (payload.website !== undefined && payload.website !== "") {
      return jsonResponse({ error: "invalid_payload" }, 400, cors);
    }

    const postcode = cleanText(payload.postcode, 4);
    const municipality = cleanText(payload.municipality, 160);
    const street = cleanText(payload.street, 240);
    const houseNumber = cleanText(payload.house_number, 64);
    const boxNumber = cleanText(payload.box_number, 64);
    const language = cleanText(payload.language, 2) ?? "fr";
    const maxCandidates = Number(payload.max_candidates ?? 3);
    if (!street || (!postcode && !municipality)) {
      return jsonResponse({ error: "street_and_postcode_or_municipality_are_required" }, 400, cors);
    }
    if (postcode && !/^\d{4}$/.test(postcode)) {
      return jsonResponse({ error: "invalid_postcode" }, 400, cors);
    }
    if (!new Set(["fr", "nl", "de"]).has(language)) {
      return jsonResponse({ error: "invalid_language" }, 400, cors);
    }
    if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 5) {
      return jsonResponse({ error: "invalid_max_candidates" }, 400, cors);
    }

    const candidates = await rpc<Candidate[]>("flood_voicebot_resolve_address", {
      p_postcode: postcode,
      p_municipality: municipality,
      p_street: street,
      p_house_number: houseNumber,
      p_box_number: boxNumber,
      p_language: language,
      p_limit: maxCandidates,
    });
    if (candidates.length === 0) {
      return jsonResponse({
        status: "not_found",
        resolution_status: "not_found",
        candidates: [],
        candidate_count: 0,
        dataset_version: null,
        reason_code: "no_registry_match",
      }, 200, cors);
    }
    const best = candidates[0];
    const second = candidates[1];
    const exactUnique = best.match_score >= 0.999 &&
      (second === undefined || second.match_score < 0.999);
    const closeCompetitor = second !== undefined && !exactUnique &&
      Math.abs(best.match_score - second.match_score) < 0.08;
    const status = closeCompetitor || best.match_score < 0.72
      ? "ambiguous"
      : best.resolution_status;
    const canonical = { ...best, resolution_status: status };
    return jsonResponse({
      status: "ok",
      resolution_status: status,
      candidates: [canonical, ...candidates.slice(1)],
      candidate_count: best.candidate_count,
      dataset_version: best.dataset_version,
      reason_code: status === "ambiguous" ? "confirmation_required" : null,
    }, 200, cors);
  } catch (error) {
    return jsonResponse({ error: safeErrorCode(error) }, 500, cors);
  }
});
