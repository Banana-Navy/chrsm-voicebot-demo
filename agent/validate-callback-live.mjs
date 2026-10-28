import { WebSocketConnection } from "../site/node_modules/@elevenlabs/client/dist/index.js";

const VALIDATOR = "chrsm_callback_live";
const CALLBACK_TOOL = "CHRSM_create_callback_request";
const END_CALL_TOOL = "end_call";
const EXPECTED_PHONE_E164 = "+32470123456";

const scriptedTurns = [
  {
    step: "appointment_request",
    text: "Bonjour, je voudrais prendre un rendez-vous en cardiologie.",
  },
  {
    step: "callback_acceptance",
    text: "Oui, je souhaite enregistrer une demande de rappel.",
  },
  { step: "first_name", text: "Mon prénom est Julie." },
  { step: "last_name", text: "Mon nom est Test." },
  {
    step: "phone_number",
    text: "Mon numéro est 047 012 34 56.",
  },
  {
    step: "phone_confirmation",
    text: "Oui, c'est exact.",
  },
  {
    step: "service_and_request",
    text: "Le service concerné est la cardiologie. Je souhaite connaître la procédure de rendez-vous.",
  },
  {
    step: "callback_preference",
    text: "De préférence en matinée.",
  },
  {
    step: "explicit_consent",
    text: "Oui, je confirme que vous pouvez transmettre mon nom, mon numéro et ma demande à l'équipe concernée pour me rappeler.",
  },
];

const wait = (milliseconds) =>
  new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

function safeJsonParse(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[’]/gu, "'")
    .toLocaleLowerCase("fr-BE")
    .replace(/\s+/gu, " ")
    .trim();
}

function allStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(allStrings);
  }
  return [];
}

function toolParams(call) {
  const direct = safeJsonParse(call?.params_as_json);
  const body = safeJsonParse(call?.tool_details?.body);
  return {
    ...(body && typeof body === "object" ? body : {}),
    ...(direct && typeof direct === "object" ? direct : {}),
  };
}

function transcriptToolCalls(transcript) {
  return transcript.flatMap((turn, transcriptIndex) =>
    (turn.tool_calls ?? []).map((call) => ({
      ...call,
      transcriptIndex,
      params: toolParams(call),
    })),
  );
}

function emailWasRequested(agentTurns) {
  const emailTerm = /\b(?:e[ -]?mail|courriel|adresse electronique)\b/iu;
  const requestVerb = /\b(?:donnez|indiquez|communiquez|precisez|confirmez|epeler|quelle?|votre|puis-je avoir|avez-vous)\b/iu;
  return agentTurns.filter((turn) => {
    const normalized = fold(turn.message);
    if (!emailTerm.test(normalized)) return false;
    return /[?？]/u.test(turn.message) || requestVerb.test(normalized);
  });
}

function hasEmailPayload(value) {
  if (!value || typeof value !== "object") return false;
  const keys = [];
  const collectKeys = (candidate) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(collectKeys);
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, child] of Object.entries(candidate)) {
      keys.push(key);
      collectKeys(child);
    }
  };
  collectKeys(value);
  const serializedValues = allStrings(value).join(" ");
  return keys.some((key) => /(?:e[ _-]?mail|courriel)/iu.test(key))
    || /\b(?:e[ -]?mail|courriel|adresse electronique)\b|\S+@\S+/iu.test(
      fold(serializedValues),
    );
}

function hasCompatiblePhoneGrouping(value) {
  const text = fold(value);
  const compactGroups = /\b047\s*[,;:/|.\-–—]\s*012\s*[,;:/|.\-–—]\s*34\s*[,;:/|.\-–—]\s*56\b/u;
  const spacedGroups = /\b047\s+012\s+34\s+56\b/u;
  const digitByDigit = /\b0\s+4\s+7\s*[,;:/|.\-–—]\s*0\s+1\s+2\s*[,;:/|.\-–—]\s*3\s+4\s*[,;:/|.\-–—]\s*5\s+6\b/u;
  const spokenGroups = /\bzero\s+quatre\s+sept\s*[,;:/|.\-–—]\s*zero\s+un\s+deux\s*[,;:/|.\-–—]\s*trois\s+quatre\s*[,;:/|.\-–—]\s*cinq\s+six\b/u;
  return compactGroups.test(text)
    || spacedGroups.test(text)
    || digitByDigit.test(text)
    || spokenGroups.test(text);
}

function findPhoneEcho(transcript) {
  const phoneIndex = transcript.findIndex((turn) =>
    turn.role === "user" && /047\s+012\s+34\s+56/u.test(turn.message ?? "")
  );
  if (phoneIndex < 0) return { phoneIndex, confirmationIndex: -1, text: "" };
  const confirmationIndex = transcript.findIndex((turn, index) =>
    index > phoneIndex
      && turn.role === "user"
      && /\b(?:exact|confirme|correct)\b/iu.test(turn.message ?? "")
  );
  const endIndex = confirmationIndex < 0 ? transcript.length : confirmationIndex;
  const text = transcript
    .slice(phoneIndex + 1, endIndex)
    .filter((turn) => turn.role === "agent" && typeof turn.message === "string")
    .map((turn) => turn.message.trim())
    .filter(Boolean)
    .join(" ");
  return { phoneIndex, confirmationIndex, text };
}

function completeSummaryTurns(agentTurns) {
  return agentTurns.filter((turn) => {
    const text = fold(turn.message);
    if (/\brecapitul/iu.test(text)) return true;
    const markers = [
      /\b(?:julie|test)\b/u,
      /(?:047\s*012\s*34\s*56|zero\s+quatre\s+sept)/u,
      /\bcardiologie\b/u,
      /\bmatin(?:ee)?\b/u,
      /\bprocedure de rendez-vous\b/u,
    ];
    return markers.filter((pattern) => pattern.test(text)).length >= 3;
  });
}

function callbackPhone(params) {
  const raw = params?.callback_phone;
  return typeof raw === "string" ? raw.replace(/[\s().-]/gu, "") : "";
}

function finalMessageEvidence(transcript, callbackIndex, endCallParams) {
  const transcriptText = transcript
    .slice(Math.max(callbackIndex + 1, 0))
    .filter((turn) => turn.role === "agent" && typeof turn.message === "string")
    .map((turn) => turn.message.trim())
    .filter(Boolean);
  return [...transcriptText, ...allStrings(endCallParams)].join(" ").trim();
}

async function signedUrl(apiKey, agentId) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": apiKey } },
  );
  if (!response.ok) {
    throw new Error(`URL signée impossible (${response.status}).`);
  }
  const body = await response.json();
  if (typeof body.signed_url !== "string" || !body.signed_url) {
    throw new Error("URL signée absente.");
  }
  return body.signed_url;
}

async function conversationDetails(apiKey, conversationId) {
  let lastStatus = "unknown";
  for (let attempt = 0; attempt < 60; attempt += 1) {
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

function evaluate(details, sentTurns, liveAgentTurns, finishReason) {
  const transcript = Array.isArray(details.transcript) ? details.transcript : [];
  const calls = transcriptToolCalls(transcript);
  const callbackCalls = calls.filter((call) => call.tool_name === CALLBACK_TOOL);
  const endCalls = calls.filter((call) => call.tool_name === END_CALL_TOOL);
  const agentTurns = transcript
    .filter((turn) => turn.role === "agent" && typeof turn.message === "string")
    .map((turn, index) => ({ index, message: turn.message.trim() }))
    .filter((turn) => turn.message);
  const callback = callbackCalls[0] ?? null;
  const endCall = endCalls[0] ?? null;
  const phoneEcho = findPhoneEcho(transcript);
  const emailRequests = emailWasRequested(agentTurns);
  const summaryTurns = completeSummaryTurns(agentTurns);
  const finalMessage = finalMessageEvidence(
    transcript,
    callback?.transcriptIndex ?? -1,
    endCall?.params ?? {},
  );
  const finalNormalized = fold(finalMessage);
  const issues = [];

  if (sentTurns.length !== scriptedTurns.length) {
    issues.push(
      `Conversation interrompue après ${sentTurns.length}/${scriptedTurns.length} tours utilisateur.`,
    );
  }
  if (finishReason === "timeout") {
    issues.push("La conversation n'a pas été terminée automatiquement dans le délai imparti.");
  }
  if (emailRequests.length > 0) {
    issues.push("Le voicebot a demandé ou tenté de collecter une adresse e-mail.");
  }
  if (calls.some((call) => hasEmailPayload(call.params))) {
    issues.push("Une donnée ou un champ e-mail a été transmis à l'outil de rappel.");
  }
  if (!phoneEcho.text) {
    issues.push("Aucune répétition du téléphone n'a été trouvée avant sa confirmation.");
  } else if (!hasCompatiblePhoneGrouping(phoneEcho.text)) {
    issues.push("Le téléphone n'a pas été répété en conservant les groupes 047 / 012 / 34 / 56.");
  }
  if (phoneEcho.confirmationIndex < 0) {
    issues.push("La confirmation explicite du téléphone n'a pas été retrouvée.");
  }
  if (summaryTurns.length > 0) {
    issues.push("Le voicebot a récité un résumé complet des données de rappel.");
  }
  if (callbackCalls.length !== 1) {
    issues.push(
      `L'outil ${CALLBACK_TOOL} doit être appelé exactement une fois (observé : ${callbackCalls.length}).`,
    );
  }
  if (callback && callbackPhone(callback.params) !== EXPECTED_PHONE_E164) {
    issues.push("Le numéro transmis à l'outil n'est pas la valeur E.164 attendue.");
  }
  if (callback && callback.params?.consent !== true) {
    issues.push("Le consentement explicite n'a pas été transmis comme booléen vrai.");
  }
  if (callback && !/\bcardiologie\b/iu.test(String(callback.params?.requested_service ?? ""))) {
    issues.push("Le service cardiologie n'a pas été transmis à l'outil de rappel.");
  }
  if (callback && !/\bmatin/iu.test(String(callback.params?.preferred_callback_time ?? ""))) {
    issues.push("La préférence de rappel en matinée n'a pas été transmise.");
  }
  if (endCalls.length !== 1) {
    issues.push(
      `L'outil ${END_CALL_TOOL} doit être appelé exactement une fois (observé : ${endCalls.length}).`,
    );
  }
  if (callback && endCall && endCall.transcriptIndex <= callback.transcriptIndex) {
    issues.push("end_call a été appelé avant l'enregistrement de la demande de rappel.");
  }
  if (!/\benregistr/iu.test(finalNormalized)) {
    issues.push("Le message final ne confirme pas que la demande est enregistrée.");
  }
  if (!/\btransmis/iu.test(finalNormalized)) {
    issues.push("Le message final ne confirme pas que la demande sera transmise aux équipes.");
  }
  if (!/\bmerci\b/iu.test(finalNormalized)) {
    issues.push("Le message final ne remercie pas l'appelant.");
  }
  if (!/\bau revoir\b/iu.test(finalNormalized)) {
    issues.push("Le message final ne termine pas poliment par un au revoir.");
  }
  if (
    /\b(?:autre chose|encore quelque chose|besoin d(?:'|e )autre|puis-je (?:encore )?vous aider)\b/iu
      .test(finalNormalized)
    || /[?？]/u.test(finalMessage)
  ) {
    issues.push("Le message final pose une question ou propose une aide supplémentaire.");
  }

  const checks = {
    no_email_requested: {
      passed: emailRequests.length === 0,
      offending_turns: emailRequests.map((turn) => turn.message),
    },
    no_email_transmitted: {
      passed: !calls.some((call) => hasEmailPayload(call.params)),
    },
    phone_grouping_preserved: {
      passed: Boolean(phoneEcho.text) && hasCompatiblePhoneGrouping(phoneEcho.text),
      observed_echo: phoneEcho.text || null,
      expected_groups: ["047", "012", "34", "56"],
    },
    no_complete_summary: {
      passed: summaryTurns.length === 0,
      offending_turns: summaryTurns.map((turn) => turn.message),
    },
    callback_tool_once: {
      passed: callbackCalls.length === 1,
      observed: callbackCalls.length,
    },
    end_call_once: {
      passed: endCalls.length === 1,
      observed: endCalls.length,
    },
    final_message: {
      passed: /\benregistr/iu.test(finalNormalized)
        && /\btransmis/iu.test(finalNormalized)
        && /\bmerci\b/iu.test(finalNormalized)
        && /\bau revoir\b/iu.test(finalNormalized)
        && !/[?？]/u.test(finalMessage)
        && !/\b(?:autre chose|encore quelque chose|puis-je (?:encore )?vous aider)\b/iu.test(
          finalNormalized,
        ),
      observed: finalMessage || null,
    },
  };

  return {
    validator: VALIDATOR,
    passed: issues.length === 0,
    conversation_id: details.conversation_id ?? null,
    finish_reason: finishReason,
    termination_reason: details.metadata?.termination_reason ?? null,
    sent_turns: sentTurns,
    assistant_turns: agentTurns.map((turn) => turn.message),
    observed_tools: calls.map((call) => call.tool_name),
    callback_parameters: callback?.params ?? null,
    checks,
    issues,
    live_agent_turn_count: liveAgentTurns.length,
  };
}

async function run() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    return {
      validator: VALIDATOR,
      passed: false,
      issues: ["ELEVENLABS_API_KEY et ELEVENLABS_AGENT_ID sont requis."],
    };
  }

  const connection = await WebSocketConnection.create({
    signedUrl: await signedUrl(apiKey, agentId),
    connectionType: "websocket",
    textOnly: true,
  });
  const sentTurns = [];
  const liveAgentTurns = [];
  const seenAgentEvents = new Set();
  let nextTurnIndex = 0;
  let sendTimer = null;
  let finishReason = "disconnect";

  const finished = new Promise((resolveFinished) => {
    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      finishReason = reason;
      clearTimeout(timeout);
      clearTimeout(sendTimer);
      resolveFinished();
    };
    const timeout = setTimeout(() => {
      finish("timeout");
      connection.close();
    }, 150_000);

    connection.onDisconnect(() => finish("disconnect"));
    connection.onMessage((event) => {
      if (event.type === "ping") {
        connection.sendMessage({
          type: "pong",
          event_id: event.ping_event.event_id,
        });
        return;
      }
      if (event.type !== "agent_response") return;
      const message = event.agent_response_event.agent_response?.trim() ?? "";
      if (!message) return;
      const eventKey = event.agent_response_event.event_id ?? `${liveAgentTurns.length}:${message}`;
      if (seenAgentEvents.has(eventKey)) return;
      seenAgentEvents.add(eventKey);
      liveAgentTurns.push(message);
      if (nextTurnIndex >= scriptedTurns.length || sendTimer) return;
      const scriptedTurn = scriptedTurns[nextTurnIndex];
      nextTurnIndex += 1;
      sendTimer = setTimeout(() => {
        sentTurns.push(scriptedTurn);
        connection.sendMessage({ type: "user_message", text: scriptedTurn.text });
        sendTimer = null;
      }, 200);
    });
  });

  await finished;
  const details = await conversationDetails(apiKey, connection.conversationId);
  return evaluate(details, sentTurns, liveAgentTurns, finishReason);
}

try {
  const result = await run();
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({
    validator: VALIDATOR,
    passed: false,
    issues: [error instanceof Error ? error.message : String(error)],
  }, null, 2));
  process.exitCode = 1;
}
