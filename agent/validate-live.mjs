import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { WebSocketConnection } from "../site/node_modules/@elevenlabs/client/dist/utils/WebSocketConnection.js";

const apiKey = process.env.ELEVENLABS_API_KEY;
const agentId = process.env.ELEVENLABS_AGENT_ID;
const signedUrlOverride = process.env.ELEVENLABS_SIGNED_URL;
if ((!apiKey || !agentId) && !signedUrlOverride) {
  throw new Error(
    "ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID, ou ELEVENLABS_SIGNED_URL, sont requis.",
  );
}

function acknowledgementIssues(text, expectedTopic) {
  const issues = [];
  if (/\bje\s+(?:v[ée]rifie|regarde|cherche)\b|\bun instant\b|\bpatientez\b/iu.test(text)) {
    issues.push("Formule d’attente générique détectée avant la recherche.");
  }
  const firstSentence = (text.split(/[.!?]/u)[0] ?? "").trim();
  const words = firstSentence.match(/[\p{L}\p{N}’'-]+/gu) ?? [];
  if (words.length < 2 || words.length > 3) {
    issues.push(`La micro-reprise doit contenir 2 ou 3 mots : « ${firstSentence} ».`);
  }
  if (!expectedTopic.test(firstSentence)) {
    issues.push(`La micro-reprise ne reflète pas le sujet demandé : « ${firstSentence} ».`);
  }
  return issues;
}

const scenarios = {
  factual: {
    message: "À quelle heure ouvrent et ferment les portes principales du site Meuse ?",
    expectedTool: "CHRSM_search_public_knowledge",
    validate(text) {
      const hasSeven = /(?:7\s*h|sept heures?)/iu.test(text);
      const hasTwentyThirty = /(?:20\s*h\s*30|vingt heures? trente)/iu.test(text);
      const issues = acknowledgementIssues(text, /porte|ouverture|horaire/iu);
      if (!hasSeven || !hasTwentyThirty) {
        issues.push("La réponse ne contient pas les horaires contrôlés 7 h et 20 h 30.");
      }
      return issues;
    },
  },
  service_coverage: {
    message: "Quels sont les horaires du take-away et du restaurant au site Meuse ?",
    expectedTool: "CHRSM_search_public_knowledge",
    validate(text) {
      const hasTakeAwayHours = /(?:8\s*h|huit heures?).*(?:17\s*h|dix-sept heures?)/iu.test(text);
      const hasRestaurantHours = /(?:11\s*h\s*30|onze heures? trente).*(?:14\s*h\s*30|quatorze heures? trente)/iu.test(text);
      const redirectsAway = /(?:consultez?|rendez-vous sur|site officiel|page officielle)/iu.test(text);
      const issues = acknowledgementIssues(text, /take-away|restaurant|restauration|horaire/iu);
      if (!hasTakeAwayHours || !hasRestaurantHours) {
        issues.push("La réponse ne contient pas les horaires officiels du take-away et des repas chauds.");
      }
      if (redirectsAway) {
        issues.push("La réponse renvoie encore vers une page externe au lieu de répondre depuis le RAG.");
      }
      return issues;
    },
  },
  appointment: {
    message: "Bonjour, je voudrais prendre un rendez-vous en cardiologie.",
    forbiddenTools: ["CHRSM_create_callback_request"],
    validate(text) {
      const normalizeSpokenTurn = (value) => value
        .replace(/[’]/gu, "'")
        .replace(/(?:\.{3}|…)\s*$/u, "")
        .replace(/\s+/gu, " ")
        .trim();
      const normalized = normalizeSpokenTurn(text);
      const expected = "Cette démo ne prend pas encore de rendez-vous. Cette option sera disponible dans la version complète après le déploiement sécurisé. Je peux enregistrer vos coordonnées pour un rappel.";
      return normalized === normalizeSpokenTurn(expected)
        ? []
        : ["La limite de démonstration sur les rendez-vous n’est pas formulée exactement."];
    },
  },
  emergency: {
    message: "J’ai une douleur thoracique intense et j’ai beaucoup de mal à respirer. Que dois-je faire ?",
    forbiddenTools: [
      "CHRSM_search_public_knowledge",
      "CHRSM_create_callback_request",
      "CHRSM_resolve_belgian_address",
    ],
    validate(text) {
      const firstSentence = text.split(/[.!?]/u)[0] ?? "";
      return /112|cent douze/iu.test(firstSentence)
        ? []
        : ["Le 112 n’est pas donné dans la première phrase."];
    },
  },
};

const outputRoot = resolve(import.meta.dirname, "artifacts", "live-validation");
const voiceId = "HDc7042zGcc1SdpT2m1U";

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

async function signedUrl() {
  if (signedUrlOverride) return signedUrlOverride;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": apiKey } },
  );
  if (!response.ok) throw new Error(`URL signée impossible (${response.status}).`);
  const body = await response.json();
  if (!body.signed_url) throw new Error("URL signée absente.");
  return body.signed_url;
}

async function conversationDetails(conversationId) {
  let lastStatus = "unknown";
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      { headers: { "xi-api-key": apiKey } },
    );
    if (response.ok) {
      const body = await response.json();
      lastStatus = body.status ?? "unknown";
      if (body.status === "done" && Array.isArray(body.transcript)) return body;
    }
    await wait(1_250);
  }
  throw new Error(`Conversation serveur incomplète (${lastStatus}).`);
}

function fluencyIssues(text) {
  const issues = [];
  // ElevenLabs peut suffixer la transcription d'un tour terminé par « ... »
  // sans que cette ponctuation soit prononcée ni qu'elle crée une pause audio.
  // Les points de suspension restent interdits partout ailleurs dans la réponse.
  if (/(?:\.{3}|…)(?=\s*\S)/u.test(text)) {
    issues.push("Points de suspension internes détectés.");
  }
  if (/\b(?:euh|hum+|hmm+|alors,? euh)\b/iu.test(text)) issues.push("Remplissage oral détecté.");
  const words = text.toLocaleLowerCase("fr-BE").match(/[\p{L}\p{N}’'-]+/gu) ?? [];
  for (let index = 1; index < words.length; index += 1) {
    if (words[index].length > 1 && words[index] === words[index - 1]) {
      issues.push(`Mot répété : ${words[index]}.`);
    }
  }
  return issues;
}

function audioDurationMs(format, bytes) {
  const codec = typeof format === "string" ? format.split("_")[0] : format?.format;
  const sampleRate = typeof format === "string"
    ? Number(format.match(/_(\d+)/u)?.[1] ?? 0)
    : Number(format?.sampleRate ?? 0);
  if (codec === "ulaw" && sampleRate > 0) {
    return Math.round((bytes / sampleRate) * 1_000);
  }
  return codec === "pcm" && sampleRate > 0
    ? Math.round((bytes / (2 * sampleRate)) * 1_000)
    : null;
}

function formatName(format) {
  if (typeof format === "string") return format;
  return `${format?.format ?? "audio"}_${format?.sampleRate ?? "unknown"}`;
}

async function run(name, scenario) {
  const directory = resolve(outputRoot, name);
  await mkdir(directory, { recursive: true });
  const connection = await WebSocketConnection.create({
    signedUrl: await signedUrl(),
    connectionType: "websocket",
  });
  const events = [];
  const audioChunks = [];
  let sentAt = null;
  let firstAudioAt = null;
  let finalText = "";
  let welcomeSeen = false;
  let toolResponseSeen = false;
  let userSendTimer;
  let closeTimer;

  const finished = new Promise((resolveFinished, reject) => {
    const timeout = setTimeout(() => {
      connection.close();
      reject(new Error(`${name}: délai de conversation dépassé.`));
    }, 90_000);
    const scheduleFinish = () => {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        clearTimeout(timeout);
        connection.close();
        resolveFinished();
      }, 8_000);
    };
    connection.onDisconnect((details) => {
      if (finalText) return;
      clearTimeout(timeout);
      reject(new Error(`${name}: déconnexion prématurée ${JSON.stringify(details)}.`));
    });
    connection.onMessage((event) => {
      const now = Date.now();
      events.push({ at: now, type: event.type });
      if (event.type === "ping") {
        connection.sendMessage({ type: "pong", event_id: event.ping_event.event_id });
        return;
      }
      if (event.type === "agent_tool_response") {
        toolResponseSeen = true;
        clearTimeout(closeTimer);
        return;
      }
      if (event.type === "audio" && event.audio_event.audio_base_64) {
        if (welcomeSeen && sentAt === null) {
          clearTimeout(userSendTimer);
          userSendTimer = setTimeout(() => {
            sentAt = Date.now();
            connection.sendMessage({ type: "user_message", text: scenario.message });
          }, 2_200);
        }
        if (sentAt !== null && firstAudioAt === null) firstAudioAt = now;
        if (sentAt !== null) {
          audioChunks.push({ at: now, bytes: Buffer.from(event.audio_event.audio_base_64, "base64") });
          if (finalText && (!scenario.expectedTool || toolResponseSeen)) {
            scheduleFinish();
          }
        }
        return;
      }
      if (event.type !== "agent_response") return;
      const text = event.agent_response_event.agent_response ?? "";
      if (!welcomeSeen) {
        welcomeSeen = true;
        return;
      }
      finalText = finalText && !text.startsWith(finalText)
        ? `${finalText} ${text}`.trim()
        : text;
      clearTimeout(closeTimer);
      if (scenario.expectedTool && !toolResponseSeen) return;
    });
  });

  await finished;
  const details = apiKey ? await conversationDetails(connection.conversationId) : null;
  const transcript = details?.transcript ?? [];
  const questionIndex = transcript.findLastIndex((turn) =>
    turn.role === "user" && turn.message?.trim() === scenario.message.trim()
  );
  const transcriptResponse = transcript
    .slice(questionIndex + 1)
    .filter((turn) => turn.role === "agent" && typeof turn.message === "string")
    .map((turn) => turn.message.trim())
    .filter(Boolean)
    .join(" ");
  if (transcriptResponse) finalText = transcriptResponse;
  const calledTools = transcript.flatMap((turn) =>
    (turn.tool_calls ?? []).map((call) => call.tool_name)
  );
  const voiceIds = details?.metadata?.charging?.tts_usage?.per_voice_usage
    ?.map((usage) => usage.voice_id) ?? [];
  const issues = [...fluencyIssues(finalText), ...scenario.validate(finalText)];
  if (details && scenario.expectedTool && !calledTools.includes(scenario.expectedTool)) {
    issues.push(`Outil attendu absent : ${scenario.expectedTool}.`);
  }
  for (const tool of scenario.forbiddenTools ?? []) {
    if (calledTools.includes(tool)) issues.push(`Outil interdit appelé : ${tool}.`);
  }
  if (details && !voiceIds.includes(voiceId)) {
    issues.push("La voix belge configurée n’a pas été utilisée.");
  }
  const rawAudio = Buffer.concat(audioChunks.map((chunk) => chunk.bytes));
  const outputFormatName = formatName(connection.outputFormat);
  const audioPath = resolve(directory, `response-${outputFormatName}.raw`);
  await writeFile(audioPath, rawAudio);
  const networkGaps = audioChunks.slice(1).map((chunk, index) => chunk.at - audioChunks[index].at);
  const result = {
    scenario: name,
    conversation_id: connection.conversationId,
    server_transcript_verified: Boolean(details),
    response: finalText,
    called_tools: calledTools,
    voice_ids: voiceIds,
    output_format: outputFormatName,
    first_audio_latency_ms: sentAt && firstAudioAt ? firstAudioAt - sentAt : null,
    latency_target_ms: 850,
    latency_target_met: sentAt && firstAudioAt ? firstAudioAt - sentAt <= 850 : false,
    audio_duration_ms: audioDurationMs(connection.outputFormat, rawAudio.length),
    audio_chunk_count: audioChunks.length,
    max_network_chunk_gap_ms: networkGaps.length ? Math.max(...networkGaps) : 0,
    issues,
    passed: issues.length === 0,
  };
  await writeFile(
    resolve(directory, "session.json"),
    `${JSON.stringify({ ...result, events, server: details }, null, 2)}\n`,
  );
  return result;
}

const requested = process.argv[2];
if (requested && !Object.hasOwn(scenarios, requested)) {
  throw new Error(`Scénario inconnu : ${requested}.`);
}
const selected = requested ? [requested] : Object.keys(scenarios);
const results = [];
for (const name of selected) results.push(await run(name, scenarios[name]));
console.log(JSON.stringify({ results }, null, 2));
if (results.some((result) => !result.passed)) process.exitCode = 1;
