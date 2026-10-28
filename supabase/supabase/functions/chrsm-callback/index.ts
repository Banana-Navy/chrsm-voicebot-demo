import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  cleanText,
  errorStatus,
  hasOnlyKeys,
  isObject,
  jsonResponse,
  readJson,
  safeErrorCode,
  validateJsonRequest,
} from "../_shared/http.ts";
import {
  buildCallbackEmail,
  type CallbackEmailItem,
} from "../_shared/callback-email.ts";
import { authorize, rpc, sha256Bytea } from "../_shared/rpc.ts";
import {
  allowedOrigins,
  corsHeaders,
  elevenLabsRuntimeConfig,
  hmacSubjectHash,
  requestIp,
} from "../_shared/public-request.ts";

const MAX_BODY_BYTES = 8_192;
const LANDING_SAVE_KEYS = new Set([
  "action",
  "first_name",
  "last_name",
  "phone",
  "email",
  "service",
  "callback_preference",
  "consent",
  "source",
  "website",
]);
const ELEVENLABS_SAVE_KEYS = new Set([
  "action",
  "language",
  "contact_first_name",
  "contact_last_name",
  "callback_phone",
  "contact_email",
  "requested_service",
  "preferred_callback_time",
  "callback_note",
  "topic",
  "consent",
  "source",
  "conversation_id",
]);
const DISPATCH_KEYS = new Set(["action", "limit"]);
const REQUEST_TYPES = new Set([
  "appointment_request",
  "reschedule_request",
  "cancellation_request",
  "general_callback",
]);
const APPOINTMENT_ACTIONS = new Set(["new", "reschedule", "cancel"]);
const TIME_WINDOWS = new Set(["morning", "afternoon", "any"]);
const ELEVENLABS_TOPICS = new Set([
  "appointment_request",
  "service_information",
  "administrative_question",
  "accessibility",
  "other",
]);

type GraphConfig = {
  graph_tenant_id: string | null;
  graph_client_id: string | null;
  graph_client_secret: string | null;
  graph_mailbox: string | null;
};

type NormalizedCallback = {
  conversationId: string;
  idempotencyKey: string;
  requestType: string;
  appointmentAction: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  service: string | null;
  preferredDay: string | null;
  timeWindow: string | null;
  language: string;
  consentVersion: string;
  consentAt: string;
  isTest: boolean;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function completeGraphConfig(
  config: GraphConfig,
): config is Record<keyof GraphConfig, string> {
  return Object.values(config).every((value) =>
    typeof value === "string" && value.length > 0
  );
}

async function graphConfig(): Promise<Record<keyof GraphConfig, string>> {
  const rows = await rpc<GraphConfig[]>(
    "flood_voicebot_get_graph_runtime_config",
    {},
  );
  if (rows.length !== 1 || !completeGraphConfig(rows[0])) {
    throw new Error("microsoft_graph_not_configured");
  }
  return rows[0];
}

async function graphAccessToken(
  config: Record<keyof GraphConfig, string>,
): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.graph_tenant_id)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.graph_client_id,
        client_secret: config.graph_client_secret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  if (!response.ok) throw new Error(`microsoft_graph_auth_${response.status}`);
  const result = await response.json() as {
    access_token?: string;
    expires_in?: number;
  };
  if (!result.access_token) throw new Error("microsoft_graph_token_missing");
  const expiresIn = Number.isFinite(result.expires_in)
    ? Math.max(120, Number(result.expires_in))
    : 3600;
  cachedToken = {
    value: result.access_token,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  };
  return result.access_token;
}

async function sendGraphMail(item: CallbackEmailItem): Promise<string> {
  const config = await graphConfig();
  const accessToken = await graphAccessToken(config);
  const email = buildCallbackEmail(item);
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.graph_mailbox)}/sendMail`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "client-request-id": item.outbox_id,
        "content-type": "application/json",
        "return-client-request-id": "true",
      },
      body: JSON.stringify({
        message: {
          subject: email.subject,
          importance: "normal",
          body: { contentType: "HTML", content: email.html },
          toRecipients: [{ emailAddress: { address: item.recipient } }],
          internetMessageHeaders: [
            { name: "X-CHRSM-Demo-Outbox-Id", value: item.outbox_id },
            { name: "X-CHRSM-Demo-Reference", value: item.reference_code },
            {
              name: "X-CHRSM-Demo-Idempotency-Key",
              value: item.idempotency_key,
            },
          ],
        },
        saveToSentItems: true,
      }),
    },
  );
  if (response.status !== 202) {
    throw new Error(`microsoft_graph_send_${response.status}`);
  }
  return `microsoft-graph:${response.headers.get("request-id") ?? item.outbox_id}`;
}

async function dispatch(limit: number) {
  const items = await rpc<CallbackEmailItem[]>(
    "chrsm_demo_claim_callback_emails",
    { p_limit: limit },
  );
  let sent = 0;
  let failed = 0;
  let lockConflicts = 0;
  for (const item of items) {
    try {
      const providerId = await sendGraphMail(item);
      const marked = await rpc<boolean>("chrsm_demo_mark_callback_email_sent", {
        p_outbox_id: item.outbox_id,
        p_lock_token: item.lock_token,
        p_provider_message_id: providerId,
      });
      if (!marked) throw new Error("outbox_lock_lost_after_send");
      sent += 1;
    } catch (error) {
      const marked = await rpc<boolean>(
        "chrsm_demo_mark_callback_email_failed",
        {
          p_outbox_id: item.outbox_id,
          p_lock_token: item.lock_token,
          p_error_code: safeErrorCode(error),
          p_retry_after_seconds: Math.min(
            3600,
            60 * 2 ** item.attempt_count,
          ),
        },
      );
      if (marked) failed += 1;
      else lockConflicts += 1;
    }
  }
  return {
    claimed: items.length,
    sent,
    failed,
    lock_conflicts: lockConflicts,
  };
}

function optionalText(
  value: unknown,
  maxLength: number,
): string | null {
  return value === null || value === undefined || value === ""
    ? null
    : cleanText(value, maxLength);
}

function normalizeLandingPayload(
  payload: Record<string, unknown>,
): NormalizedCallback | null {
  const firstName = cleanText(payload.first_name, 100);
  const lastName = cleanText(payload.last_name, 120);
  const rawPhone = cleanText(payload.phone, 32);
  const compactPhone = rawPhone?.replace(/[\s()./-]/g, "") ?? "";
  const phone = compactPhone.startsWith("0")
    ? `+32${compactPhone.slice(1)}`
    : compactPhone.startsWith("0032")
      ? `+32${compactPhone.slice(4)}`
      : compactPhone;
  const service = cleanText(payload.service, 160);
  const preference = cleanText(payload.callback_preference, 80)?.toLowerCase() ?? "";
  const timeWindow = preference.includes("matin")
    ? "morning"
    : preference.includes("après") || preference.includes("apres")
      ? "afternoon"
      : "any";
  if (
    !firstName || !lastName || !phone || !service ||
    payload.consent !== true || payload.source !== "landing"
  ) return null;
  const conversationId = `landing-${crypto.randomUUID()}`;
  return {
    conversationId,
    idempotencyKey: `callback:${conversationId}`,
    requestType: "appointment_request",
    appointmentAction: "new",
    firstName,
    lastName,
    phone,
    email: optionalText(payload.email, 320),
    service,
    preferredDay: null,
    timeWindow,
    language: "fr",
    consentVersion: "chrsm-demo-landing-v1",
    consentAt: new Date().toISOString(),
    isTest: true,
  };
}

function normalizeElevenLabsPayload(
  payload: Record<string, unknown>,
): NormalizedCallback | null {
  const conversationId = cleanText(payload.conversation_id, 255);
  const topic = cleanText(payload.topic, 40);
  const firstName = cleanText(payload.contact_first_name, 100);
  const lastName = cleanText(payload.contact_last_name, 120);
  const phone = cleanText(payload.callback_phone, 16);
  const language = cleanText(payload.language, 2) ?? "fr";
  const service = cleanText(payload.requested_service, 160);
  const preferredDay = cleanText(payload.preferred_callback_time, 160);
  const callbackNote = cleanText(payload.callback_note, 300);
  if (
    !conversationId || !topic || !ELEVENLABS_TOPICS.has(topic) || !firstName ||
    !lastName || !phone || !service || !preferredDay || !callbackNote ||
    payload.consent !== true || payload.source !== "voicebot_demo"
  ) return null;

  // callback_note is intentionally validated then discarded. Free text could
  // contain clinical data and is never persisted or included in the e-mail.
  return {
    conversationId,
    idempotencyKey: `callback:${conversationId}`,
    requestType: topic === "appointment_request"
      ? "appointment_request"
      : "general_callback",
    appointmentAction: topic === "appointment_request" ? "new" : null,
    firstName,
    lastName,
    phone,
    email: optionalText(payload.contact_email, 320),
    service,
    preferredDay,
    timeWindow: null,
    language,
    consentVersion: "chrsm-demo-callback-v1",
    consentAt: new Date().toISOString(),
    isTest: true,
  };
}

function validNormalized(value: NormalizedCallback): boolean {
  if (!/^\+[1-9][0-9]{7,14}$/.test(value.phone)) return false;
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
    return false;
  }
  if (!new Set(["fr", "nl", "de", "en"]).has(value.language)) return false;
  if (value.appointmentAction && !APPOINTMENT_ACTIONS.has(value.appointmentAction)) {
    return false;
  }
  if (value.timeWindow && !TIME_WINDOWS.has(value.timeWindow)) return false;
  return Number.isFinite(Date.parse(value.consentAt));
}

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
    const payload = await readJson(request, MAX_BODY_BYTES);
    if (!isObject(payload)) return jsonResponse({ error: "invalid_payload" }, 400, cors);
    const action = cleanText(payload.action, 24);

    if (action === "dispatch") {
      if (!hasOnlyKeys(payload, DISPATCH_KEYS)) {
        return jsonResponse({ error: "invalid_payload" }, 400, cors);
      }
      const auth = await authorize(
        request,
        "dispatch:callback-email",
        "x-notification-token",
      );
      if (!auth) return jsonResponse({ error: "unauthorized" }, 401, cors);
      const limit = Number(payload.limit ?? 10);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        return jsonResponse({ error: "invalid_limit" }, 400, cors);
      }
      return jsonResponse(await dispatch(limit), 200, cors);
    }

    const fromElevenLabs = action === "request_callback";
    const fromLanding = action === "save" ||
      (payload.source === "landing" && publicOriginAllowed);
    if (
      (!fromElevenLabs && !fromLanding) ||
      (fromElevenLabs && !hasOnlyKeys(payload, ELEVENLABS_SAVE_KEYS)) ||
      (fromLanding && !hasOnlyKeys(payload, LANDING_SAVE_KEYS))
    ) {
      return jsonResponse({ error: "invalid_payload" }, 400, cors);
    }
    if (payload.website !== undefined && payload.website !== "") {
      return jsonResponse({ error: "invalid_payload" }, 400, cors);
    }
    const auth = await authorize(request, "write:callback");
    const publicIp = auth ? null : requestIp(request);
    if (fromElevenLabs && (!auth || !auth.voicebot_instance_id)) {
      return jsonResponse({ error: "unauthorized" }, 401, cors);
    }
    if (fromLanding && !auth && (!publicOriginAllowed || !publicIp)) {
      return jsonResponse({ error: "unauthorized" }, 401, cors);
    }

    let voicebotInstanceId = auth?.voicebot_instance_id ?? null;
    let publicConfig = null;
    if (!auth) {
      publicConfig = await elevenLabsRuntimeConfig();
      if (
        !publicConfig?.elevenlabs_agent_id || !publicConfig.rate_limit_pepper ||
        publicConfig.rate_limit_pepper.length < 32
      ) {
        return jsonResponse({ error: "public_runtime_not_configured" }, 503, cors);
      }
      voicebotInstanceId = await rpc<string | null>(
        "chrsm_demo_get_active_instance_id",
        { p_provider_agent_id: publicConfig.elevenlabs_agent_id },
      );
    }
    if (!voicebotInstanceId) {
      return jsonResponse({ error: "voicebot_instance_not_configured" }, 503, cors);
    }

    const normalized = fromElevenLabs
      ? normalizeElevenLabsPayload(payload)
      : normalizeLandingPayload(payload);
    if (!normalized || !validNormalized(normalized)) {
      return jsonResponse({ error: "missing_or_invalid_required_fields" }, 400, cors);
    }

    const rateAllowed = await rpc<boolean>("chrsm_demo_consume_rate_limit", {
      p_purpose: "callback_request",
      p_subject_hash: auth
        ? await sha256Bytea(`callback:${auth.client_id}:${normalized.conversationId}`)
        : await hmacSubjectHash(`callback:${publicIp}`, publicConfig!.rate_limit_pepper!),
      p_window_seconds: 86400,
      p_request_limit: auth ? 10 : 5,
    });
    if (!rateAllowed) {
      return jsonResponse({ error: "rate_limit_exceeded" }, 429, cors);
    }

    const result = await rpc<Record<string, unknown>>(
      "chrsm_demo_record_callback",
      {
        p_voicebot_instance_id: voicebotInstanceId,
        p_payload: {
          conversation_id: normalized.conversationId,
          idempotency_key: normalized.idempotencyKey,
          request_type: normalized.requestType,
          appointment_action: normalized.appointmentAction,
          first_name: normalized.firstName,
          last_name: normalized.lastName,
          phone_e164: normalized.phone,
          email: normalized.email,
          service_requested: normalized.service,
          preferred_day: normalized.preferredDay,
          preferred_time_window: normalized.timeWindow,
          language: normalized.language,
          consent_callback: true,
          consent_version: normalized.consentVersion,
          consent_at: normalized.consentAt,
          demo_limitation_acknowledged: true,
          is_test: normalized.isTest,
        },
      },
    );
    if (fromElevenLabs) {
      return jsonResponse({
        status: "accepted",
        request_reference: result.reference,
        notification_status: "queued",
        idempotent_replay: result.created === false,
        reason_code: null,
      }, result.created === false ? 200 : 201, cors);
    }
    return jsonResponse({
      ...result,
      message: "Votre demande de rappel a été enregistrée. Aucun rendez-vous n’est confirmé.",
    }, result.created === false ? 200 : 201, cors);
  } catch (error) {
    const code = safeErrorCode(error);
    return jsonResponse({ error: code }, errorStatus(code), cors);
  }
});
