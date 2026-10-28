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
import { containsLikelyPii } from "../_shared/pii.ts";
import { authorize, rpc } from "../_shared/rpc.ts";

const MAX_BODY_BYTES = 4_096;
const ALLOWED_KEYS = new Set([
  "query_fr",
  "semantic_query_en",
  "language",
  "category",
  "limit",
]);
const CATEGORY_MAP: Record<string, string | null> = {
  access: "acces",
  parking: "acces",
  visits: "visites",
  appointments: "rendez_vous",
  services: "services",
  documents: "documents",
  admission: "orientation",
  contacts: "contact",
  emergency: "urgence",
  other: null,
};

type PendingChunk = {
  chunk_id: number;
  embedding_input_en: string;
  embedding_input_sha256: string;
};

type SearchResult = {
  chunk_id: number;
  category: string;
  title_fr: string;
  answer_fr: string;
  facts_fr: string;
  source_title: string;
  source_url: string;
  source_verified_at: string;
  source_next_review_at: string;
  semantic_similarity?: number | null;
  lexical_score?: number | null;
  fused_score?: number | null;
  score?: number | null;
  retrieval_mode: string;
};

type EdgeAiSession = {
  run(
    prompt: string,
    options: { mean_pool?: boolean; normalize?: boolean },
  ): Promise<number[]>;
};

const supabaseRuntime = (globalThis as typeof globalThis & {
  Supabase: {
    ai: {
      Session: new (model: string) => EdgeAiSession;
    };
  };
}).Supabase;

const model = new supabaseRuntime.ai.Session("gte-small");

async function ensurePendingEmbeddings(): Promise<void> {
  const pending = await rpc<PendingChunk[]>(
    "chrsm_demo_list_unembedded_chunks",
    { p_limit: 3 },
  );
  // Supabase's built-in inference session is intentionally used serially.
  // Parallel model runs can exceed an Edge isolate's memory during a cold
  // start; production traffic only sees this path after source updates.
  for (const chunk of pending) {
    const embedding = await model.run(chunk.embedding_input_en, {
      mean_pool: true,
      normalize: true,
    });
    const stored = await rpc<boolean>("chrsm_demo_set_chunk_embedding", {
      p_chunk_id: chunk.chunk_id,
      p_expected_sha256: chunk.embedding_input_sha256,
      p_embedding: embedding,
    });
    if (!stored) throw new Error("embedding_write_conflict");
  }
}

Deno.serve(async (request: Request) => {
  try {
    const invalid = validateJsonRequest(request, MAX_BODY_BYTES);
    if (invalid) return invalid;
    const auth = await authorize(request, "search:knowledge");
    if (!auth || !auth.voicebot_instance_id) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const payload = await readJson(request, MAX_BODY_BYTES);
    if (!isObject(payload) || !hasOnlyKeys(payload, ALLOWED_KEYS)) {
      return jsonResponse({ error: "invalid_payload" }, 400);
    }
    const queryFr = cleanText(payload.query_fr, 500);
    const semanticQueryEn = cleanText(payload.semantic_query_en, 500);
    const language = cleanText(payload.language, 2) ?? "fr";
    const requestedCategory = payload.category === undefined || payload.category === null ||
        payload.category === ""
      ? null
      : cleanText(payload.category, 40);
    const category = requestedCategory ? CATEGORY_MAP[requestedCategory] : null;
    const limit = Number(payload.limit ?? 3);
    if (!queryFr || !semanticQueryEn) {
      return jsonResponse({ error: "query_fr_and_semantic_query_en_are_required" }, 400);
    }
    if (containsLikelyPii(queryFr) || containsLikelyPii(semanticQueryEn)) {
      return jsonResponse({ error: "pii_not_allowed_in_knowledge_search" }, 400);
    }
    if (language !== "fr") {
      return jsonResponse({ error: "invalid_language" }, 400);
    }
    if (requestedCategory && !(requestedCategory in CATEGORY_MAP)) {
      return jsonResponse({ error: "invalid_category" }, 400);
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
      return jsonResponse({ error: "invalid_limit" }, 400);
    }

    let results: SearchResult[];
    let degraded = false;
    try {
      await ensurePendingEmbeddings();
      const embedding = await model.run(semanticQueryEn, {
        mean_pool: true,
        normalize: true,
      });
      results = await rpc<SearchResult[]>("chrsm_demo_search_knowledge", {
        p_query_embedding: embedding,
        p_query_fr: queryFr,
        p_category: category,
        p_min_similarity: 0.45,
        p_limit: limit,
      });
    } catch {
      degraded = true;
      results = await rpc<SearchResult[]>("chrsm_demo_search_knowledge_lexical", {
        p_query_fr: queryFr,
        p_category: category,
        p_limit: limit,
      });
    }

    if (results.length === 0) {
      return jsonResponse({
        status: "no_match",
        confidence: 0,
        answer_context: null,
        passages: [],
        sources: [],
        reason_code: degraded
          ? "semantic_unavailable_no_lexical_match"
          : "no_verified_match",
      });
    }
    const topScore = results[0].semantic_similarity ?? results[0].score ??
      results[0].lexical_score ?? 0.55;
    const sources = Array.from(
      new Map(results.map((item) => [item.source_url, {
        title: item.source_title,
        url: item.source_url,
        verified_at: item.source_verified_at,
        next_review_at: item.source_next_review_at,
      }])).values(),
    );
    return jsonResponse({
      status: "ok",
      confidence: Math.max(0, Math.min(1, Number(topScore))),
      answer_context: results.map((item) => item.answer_fr).join("\n\n"),
      passages: results.map((item) => ({
        category: item.category,
        title: item.title_fr,
        content: item.facts_fr,
        url: item.source_url,
        verified_at: item.source_verified_at,
        next_review_at: item.source_next_review_at,
        retrieval_mode: item.retrieval_mode,
      })),
      sources,
      reason_code: degraded ? "lexical_fallback" : null,
    });
  } catch (error) {
    return jsonResponse({ error: safeErrorCode(error) }, 500);
  }
});
