import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AGENT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = resolve(AGENT_DIRECTORY, "agent-config.template.json");
const OFFICIAL_API_HOSTS = new Set([
  "api.elevenlabs.io",
  "api.us.elevenlabs.io",
  "api.eu.residency.elevenlabs.io",
  "api.in.residency.elevenlabs.io",
  "api.sg.residency.elevenlabs.io",
]);

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`La valeur de ${name} est absente.`);
  }
  return value;
}

function validatedHttpsUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} n’est pas une URL valide.`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} doit être une URL HTTPS sans identifiant, requête ni fragment.`);
  }
  return url;
}

function validateConfig(config) {
  if (!isObject(config) || config.schema_version !== 1) {
    throw new Error("Configuration absente ou schema_version non pris en charge.");
  }

  const apiOrigin = validatedHttpsUrl(
    config.deployment?.api_origin,
    "deployment.api_origin",
  );
  if (!OFFICIAL_API_HOSTS.has(apiOrigin.hostname) || apiOrigin.pathname !== "/") {
    throw new Error("deployment.api_origin doit viser une racine API ElevenLabs officielle.");
  }
  if (
    config.deployment?.reference_agent_id !== null &&
    !/^agent_[a-z0-9]+$/i.test(config.deployment?.reference_agent_id ?? "")
  ) {
    throw new Error("deployment.reference_agent_id doit être null ou un identifiant agent valide.");
  }
  if (
    config.deployment?.target_agent_id !== null &&
    !/^agent_[a-z0-9]+$/i.test(config.deployment?.target_agent_id ?? "")
  ) {
    throw new Error("deployment.target_agent_id doit être null ou un identifiant agent valide.");
  }

  if (
    typeof config.agent?.name !== "string" ||
    typeof config.agent?.prompt_file !== "string" ||
    typeof config.agent?.first_message !== "string" ||
    config.agent?.disable_first_message_interruptions !== true ||
    config.agent?.language !== "fr" ||
    config.agent?.temperature !== 0 ||
    !Number.isInteger(config.agent?.max_tokens)
  ) {
    throw new Error("La section agent est invalide.");
  }
  if (
    typeof config.voice?.voice_id !== "string" ||
    config.voice?.locale !== "fr-BE" ||
    typeof config.voice?.model_id !== "string"
  ) {
    throw new Error("La section voice est invalide.");
  }
  if (
    config.platform?.private_agent !== true ||
    config.platform?.record_voice !== true ||
    !Number.isInteger(config.platform?.retention_days) ||
    config.platform.retention_days < 1 ||
    config.platform.retention_days > 90 ||
    config.platform?.delete_audio !== false ||
    config.platform?.delete_transcript_and_pii !== true ||
    config.platform?.user_memory !== false
  ) {
    throw new Error("La configuration d’enregistrement et de confidentialité est invalide.");
  }
  if (
    config.turn?.turn_model !== "turn_v3" ||
    !["normal", "patient", "eager"].includes(config.turn?.turn_eagerness) ||
    !Array.isArray(config.turn?.interruption_ignore_terms) ||
    config.turn.interruption_ignore_terms.length === 0 ||
    !Array.isArray(config.turn?.interruption_ignore_term_languages) ||
    config.turn?.merge_with_default_ignore_terms !== true ||
    config.turn?.transcribe_on_disabled_interruptions !== false
  ) {
    throw new Error("La configuration de prise de tour et d’interruption est invalide.");
  }

  const auth = config.tool_auth;
  if (
    !isObject(auth) ||
    !/^[A-Za-z0-9-]{1,80}$/.test(auth.header ?? "") ||
    !/^[A-Za-z0-9_]{1,64}$/.test(auth.environment_variable_label ?? "") ||
    typeof auth.secret_name !== "string" ||
    typeof auth.local_value_environment_variable !== "string"
  ) {
    throw new Error("La section tool_auth est invalide.");
  }

  if (!Array.isArray(config.tools) || config.tools.length !== 3) {
    throw new Error("Trois outils sont requis : RAG, rappel et adresse BeSt.");
  }
  const expectedTools = new Set([
    "CHRSM_search_public_knowledge",
    "CHRSM_create_callback_request",
    "CHRSM_resolve_belgian_address",
  ]);
  for (const tool of config.tools) {
    if (!expectedTools.delete(tool?.name)) {
      throw new Error(`Outil inattendu ou dupliqué : ${tool?.name ?? "sans nom"}.`);
    }
    if (
      tool.type !== "webhook" ||
      typeof tool.description !== "string" ||
      !Number.isInteger(tool.response_timeout_secs) ||
      tool.response_timeout_secs < 5 ||
      tool.response_timeout_secs > 15
    ) {
      throw new Error(`Contrat incomplet pour ${tool.name}.`);
    }
    validatedHttpsUrl(tool.url, `${tool.name}.url`);
    const schema = tool.request_body_schema;
    if (
      schema?.type !== "object" ||
      !Array.isArray(schema.required) ||
      !isObject(schema.properties) ||
      schema.required.some((field) => !Object.hasOwn(schema.properties, field))
    ) {
      throw new Error(`Schéma de requête invalide pour ${tool.name}.`);
    }
  }
  if (expectedTools.size !== 0) {
    throw new Error(`Outils manquants : ${[...expectedTools].join(", ")}.`);
  }
}

function toolConfiguration(tool, config) {
  return {
    type: "webhook",
    name: tool.name,
    description: tool.description,
    api_schema: {
      url: tool.url,
      method: "POST",
      request_headers: {
        [config.tool_auth.header]: {
          env_var_label: config.tool_auth.environment_variable_label,
        },
      },
      request_body_schema: tool.request_body_schema,
      response_filter: tool.response_filter,
      content_type: "application/json",
    },
    response_timeout_secs: tool.response_timeout_secs,
    execution_mode: "immediate",
    interruption_mode: tool.interruption_mode,
    pre_tool_speech: "off",
    force_pre_tool_speech: false,
    tool_error_handling_mode: tool.tool_error_handling_mode,
    follow_redirects: false,
  };
}

function buildConversation(base, config, prompt, toolIds) {
  const conversation = structuredClone(base?.conversation_config ?? {});
  const currentAgent = structuredClone(conversation.agent ?? {});
  const currentPrompt = structuredClone(currentAgent.prompt ?? {});
  const currentBuiltIns = isObject(currentPrompt.built_in_tools)
    ? currentPrompt.built_in_tools
    : {};
  const disabledBuiltIns = Object.fromEntries(
    Object.keys(currentBuiltIns).map((name) => [name, null]),
  );

  currentPrompt.prompt = prompt;
  currentPrompt.llm = config.agent.llm;
  currentPrompt.temperature = config.agent.temperature;
  currentPrompt.max_tokens = config.agent.max_tokens;
  currentPrompt.ignore_default_personality = true;
  currentPrompt.enable_reasoning_summary = false;
  currentPrompt.thinking_budget = null;
  currentPrompt.reasoning_effort = null;
  currentPrompt.backup_llm_config = {
    preference: "override",
    order: config.agent.backup_llms,
  };
  currentPrompt.tool_ids = toolIds;
  delete currentPrompt.tools;
  currentPrompt.mcp_server_ids = [];
  currentPrompt.native_mcp_server_ids = [];
  currentPrompt.knowledge_base = [];
  currentPrompt.rag = {
    ...(isObject(currentPrompt.rag) ? currentPrompt.rag : {}),
    enabled: false,
    optional_rag_enabled: false,
  };
  currentPrompt.built_in_tools = {
    ...disabledBuiltIns,
    end_call: {
      type: "system",
      name: "end_call",
      description:
        "CHRSM DEMO — Appelle end_call lorsque l’appelant dit clairement au revoir, demande de raccrocher ou confirme qu’il n’a plus besoin d’aide. Appelle-le aussi automatiquement après une demande de rappel acceptée et mise en file, avec le message exact : Votre demande est bien enregistrée et sera transmise à l’équipe concernée. Merci de votre appel. Prenez soin de vous. Au revoir. Dans les autres fins, utilise : Merci de votre appel. Prenez soin de vous. Au revoir. Une simple demande de rendez-vous, de rappel ou de transfert humain ne suffit jamais à terminer l’appel avant la fin complète du parcours autorisé. N’envoie aucun au revoir ordinaire avant l’outil.",
      pre_tool_speech: "off",
      force_pre_tool_speech: false,
      tool_call_sound: null,
      params: {
        system_tool_type: "end_call",
      },
    },
  };

  conversation.agent = {
    ...currentAgent,
    first_message: config.agent.first_message,
    language: config.agent.language,
    disable_first_message_interruptions: config.agent.disable_first_message_interruptions,
    prompt: currentPrompt,
  };
  conversation.language_presets = {};
  conversation.asr = {
    ...(isObject(conversation.asr) ? conversation.asr : {}),
    provider: config.asr.provider,
    quality: config.asr.quality,
    keywords: config.asr.keywords,
  };
  conversation.turn = {
    ...(isObject(conversation.turn) ? conversation.turn : {}),
    turn_model: config.turn.turn_model,
    turn_eagerness: config.turn.turn_eagerness,
    speculative_turn: config.turn.speculative_turn,
    turn_timeout: config.turn.turn_timeout,
    interruption_ignore_terms: config.turn.interruption_ignore_terms,
    interruption_ignore_term_languages: config.turn.interruption_ignore_term_languages,
    merge_with_default_ignore_terms: config.turn.merge_with_default_ignore_terms,
    transcribe_on_disabled_interruptions: config.turn.transcribe_on_disabled_interruptions,
    soft_timeout_config: {
      ...(isObject(conversation.turn?.soft_timeout_config)
        ? conversation.turn.soft_timeout_config
        : {}),
      timeout_seconds: config.turn.soft_timeout_seconds,
      use_llm_generated_message: false,
      randomize_fillers: false,
      max_soft_timeouts_per_generation: 1,
    },
  };
  conversation.tts = {
    ...(isObject(conversation.tts) ? conversation.tts : {}),
    model_id: config.voice.model_id,
    voice_id: config.voice.voice_id,
    speed: config.voice.speed,
    stability: config.voice.stability,
    similarity_boost: config.voice.similarity_boost,
    expressive_mode: config.voice.expressive_mode,
    suggested_audio_tags: [],
    supported_voices: [],
    text_normalisation_type: "system_prompt",
  };
  conversation.conversation = {
    ...(isObject(conversation.conversation) ? conversation.conversation : {}),
    max_duration_seconds: config.agent.max_duration_seconds,
    client_events: Array.from(new Set([
      ...(Array.isArray(conversation.conversation?.client_events)
        ? conversation.conversation.client_events
        : []),
      "audio",
      "interruption",
    ])),
    file_input: { enabled: false },
  };
  conversation.vad = {
    ...(isObject(conversation.vad) ? conversation.vad : {}),
    background_voice_detection: false,
  };
  return conversation;
}

function buildPlatform(base, config) {
  const platform = structuredClone(base?.platform_settings ?? {});
  platform.archived = false;
  platform.auth = {
    ...(isObject(platform.auth) ? platform.auth : {}),
    enable_auth: config.platform.private_agent,
    allowlist: [],
    require_origin_header: false,
    shareable_token: null,
  };
  platform.call_limits = {
    ...(isObject(platform.call_limits) ? platform.call_limits : {}),
    agent_concurrency_limit: config.platform.agent_concurrency_limit,
    daily_limit: config.platform.daily_limit,
    bursting_enabled: false,
  };
  platform.privacy = {
    ...(isObject(platform.privacy) ? platform.privacy : {}),
    record_voice: config.platform.record_voice,
    retention_days: config.platform.retention_days,
    delete_audio: config.platform.delete_audio,
    delete_transcript_and_pii: config.platform.delete_transcript_and_pii,
    apply_to_existing_conversations: false,
    zero_retention_mode: false,
    user_memory: { enabled: config.platform.user_memory, scale: "balanced" },
  };
  platform.data_collection = {};
  platform.data_collection_scopes = {};
  platform.analysis_items = {};
  platform.workspace_overrides = {};
  delete platform.webhook;
  return platform;
}

function localPlan(config, prompt, targetAgentId) {
  return {
    status: "local_validation_only",
    remote_calls: false,
    operation: targetAgentId ? "update" : "create",
    target_agent_id: targetAgentId,
    reference_agent_id: config.deployment.reference_agent_id,
    name: config.agent.name,
    language: config.agent.language,
    voice: {
      id: config.voice.voice_id,
      name: config.voice.name,
      locale: config.voice.locale,
      model: config.voice.model_id,
    },
    private_agent: config.platform.private_agent,
    privacy: {
      record_voice: config.platform.record_voice,
      retention_days: config.platform.retention_days,
      delete_audio: config.platform.delete_audio,
      delete_transcript_and_pii: config.platform.delete_transcript_and_pii,
      user_memory: config.platform.user_memory,
    },
    prompt_sha256: createHash("sha256").update(prompt).digest("hex"),
    tools: config.tools.map((tool) => ({ name: tool.name, url: tool.url })),
    apply_command: targetAgentId
      ? "ELEVENLABS_API_KEY=… CHRSM_TOOL_TOKEN=… node agent/sync-agent.mjs --agent-id agent_… --apply --confirm-update"
      : "ELEVENLABS_API_KEY=… CHRSM_TOOL_TOKEN=… node agent/sync-agent.mjs --apply --confirm-create",
  };
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log(`Usage:
  node agent/sync-agent.mjs
      Valide les fichiers et affiche un plan local. Aucun appel réseau.

  ELEVENLABS_API_KEY=… CHRSM_TOOL_TOKEN=… node agent/sync-agent.mjs --apply --confirm-create
      Crée un nouvel agent à partir de l’agent de référence.

  ELEVENLABS_API_KEY=… CHRSM_TOOL_TOKEN=… node agent/sync-agent.mjs --agent-id agent_… --apply --confirm-update
      Met à jour un agent existant.

Options:
  --config <fichier>   Modèle JSON à utiliser.
  --agent-id <id>      Cible d’une mise à jour, prioritaire sur le JSON.
  --apply              Autorise les écritures distantes.
  --confirm-create     Confirme explicitement une création.
  --confirm-update     Confirme explicitement une mise à jour.
  --help               Affiche cette aide.`);
    return;
  }

  const configPath = resolve(optionValue("--config") ?? DEFAULT_CONFIG_PATH);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  validateConfig(config);
  const promptPath = resolve(dirname(configPath), config.agent.prompt_file);
  const prompt = (await readFile(promptPath, "utf8")).trim();
  if (!prompt) throw new Error("Le prompt est vide.");

  const targetAgentId =
    optionValue("--agent-id") ?? config.deployment.target_agent_id ?? null;
  if (targetAgentId && !/^agent_[a-z0-9]+$/i.test(targetAgentId)) {
    throw new Error("--agent-id est invalide.");
  }
  const referenceAgentId = config.deployment.reference_agent_id ??
    process.env.ELEVENLABS_REFERENCE_AGENT_ID ?? null;

  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify(localPlan(config, prompt, targetAgentId), null, 2));
    return;
  }
  if (
    !targetAgentId &&
    !/^agent_[a-z0-9]+$/i.test(referenceAgentId ?? "")
  ) {
    throw new Error(
      "Une création requiert ELEVENLABS_REFERENCE_AGENT_ID ou deployment.reference_agent_id.",
    );
  }
  if (targetAgentId && !process.argv.includes("--confirm-update")) {
    throw new Error("Ajoutez --confirm-update pour autoriser cette mise à jour distante.");
  }
  if (!targetAgentId && !process.argv.includes("--confirm-create")) {
    throw new Error("Ajoutez --confirm-create pour autoriser cette création distante.");
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY est absente.");
  const token = process.env[config.tool_auth.local_value_environment_variable];
  if (typeof token !== "string" || token.length < 32 || token.length > 256) {
    throw new Error(
      `${config.tool_auth.local_value_environment_variable} est absent ou invalide.`,
    );
  }

  const apiOrigin = new URL(config.deployment.api_origin);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "xi-api-key": apiKey,
  };

  async function apiRequest(path, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(new URL(path, apiOrigin), {
        ...init,
        headers: { ...headers, ...(init.headers ?? {}) },
        redirect: "error",
        signal: controller.signal,
      });
      const text = await response.text();
      let body = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = null;
        }
      }
      if (!response.ok) {
        const detail = typeof body?.detail === "string"
          ? body.detail
          : typeof body?.detail?.message === "string"
            ? body.detail.message
            : typeof body?.detail?.status === "string"
              ? body.detail.status
          : typeof body?.message === "string"
            ? body.message
            : Array.isArray(body?.detail)
              ? body.detail
                .slice(0, 8)
                .map((item) => `${item?.loc?.join(".") ?? "champ"}: ${item?.msg ?? "invalide"}`)
                .join("; ")
              : "Détail de validation indisponible.";
        throw new Error(
          `ElevenLabs a refusé ${init.method ?? "GET"} ${path} (${response.status}) : ${detail}`,
        );
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async function ensureToolSecret() {
    const label = config.tool_auth.environment_variable_label;
    const envQuery = new URLSearchParams({ label, page_size: "100" });
    const envResult = await apiRequest(`/v1/convai/environment-variables?${envQuery}`);
    const variables = (envResult?.environment_variables ?? []).filter(
      (candidate) => candidate?.label === label,
    );
    if (variables.length > 1) {
      throw new Error(`Plusieurs variables ElevenLabs portent le label ${label}.`);
    }

    let variable = variables[0] ?? null;
    let secretId = variable?.values?.production?.secret_id ?? null;
    if (variable) {
      if (variable.type !== "secret" || typeof secretId !== "string") {
        throw new Error(`La variable ${label} existe mais n’est pas un secret compatible.`);
      }
      const existingSecret = await apiRequest(
        `/v1/convai/secrets/${encodeURIComponent(secretId)}`,
      );
      if (existingSecret?.name !== config.tool_auth.secret_name) {
        throw new Error(`La variable ${label} référence un autre secret ; arrêt prudent.`);
      }
      await apiRequest(`/v1/convai/secrets/${encodeURIComponent(secretId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          type: "update",
          name: config.tool_auth.secret_name,
          value: token,
        }),
      });
      return variable;
    }

    const secretQuery = new URLSearchParams({
      search: config.tool_auth.secret_name,
      page_size: "100",
    });
    const secretResult = await apiRequest(`/v1/convai/secrets?${secretQuery}`);
    const secrets = (secretResult?.secrets ?? []).filter(
      (candidate) => candidate?.name === config.tool_auth.secret_name,
    );
    if (secrets.length > 1) {
      throw new Error(`Plusieurs secrets portent le nom ${config.tool_auth.secret_name}.`);
    }
    if (secrets.length === 1) {
      secretId = secrets[0].secret_id;
      await apiRequest(`/v1/convai/secrets/${encodeURIComponent(secretId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          type: "update",
          name: config.tool_auth.secret_name,
          value: token,
        }),
      });
    } else {
      const createdSecret = await apiRequest("/v1/convai/secrets", {
        method: "POST",
        body: JSON.stringify({
          type: "new",
          name: config.tool_auth.secret_name,
          value: token,
        }),
      });
      secretId = createdSecret?.secret_id;
    }
    if (typeof secretId !== "string") {
      throw new Error("ElevenLabs n’a pas retourné l’identifiant du secret.");
    }
    variable = await apiRequest("/v1/convai/environment-variables", {
      method: "POST",
      body: JSON.stringify({
        type: "secret",
        label,
        values: { production: { secret_id: secretId } },
      }),
    });
    if (variable?.label !== label) {
      throw new Error("Vérification distante de la variable secrète échouée.");
    }
    return variable;
  }

  async function upsertTool(tool) {
    const expected = toolConfiguration(tool, config);
    const query = new URLSearchParams({ search: tool.name, page_size: "100" });
    const listResult = await apiRequest(`/v1/convai/tools?${query}`);
    const matches = (listResult?.tools ?? []).filter(
      (candidate) =>
        candidate?.tool_config?.name === tool.name &&
        candidate?.tool_config?.type === "webhook",
    );
    if (matches.length > 1) {
      throw new Error(`Plusieurs outils ElevenLabs portent le nom ${tool.name}.`);
    }
    const existing = matches[0] ?? null;
    const path = existing
      ? `/v1/convai/tools/${encodeURIComponent(existing.id)}`
      : "/v1/convai/tools";
    const upsertResult = await apiRequest(path, {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify({ tool_config: expected }),
    });
    const remote = upsertResult?.tool_config ? upsertResult : upsertResult?.tool;
    if (typeof remote?.id !== "string") {
      throw new Error(`ElevenLabs n’a pas retourné l’identifiant de ${tool.name}.`);
    }
    return remote;
  }

  await ensureToolSecret();
  const remoteTools = [];
  for (const tool of config.tools) {
    remoteTools.push(await upsertTool(tool));
  }
  const toolIds = remoteTools.map((tool) => tool.id);

  const baseAgentId = targetAgentId ?? referenceAgentId;
  const base = await apiRequest(`/v1/convai/agents/${encodeURIComponent(baseAgentId)}`);
  const conversationConfig = buildConversation(base, config, prompt, toolIds);
  const platformSettings = buildPlatform(base, config);

  const payload = {
    conversation_config: conversationConfig,
    platform_settings: platformSettings,
  };
  let deploymentResult;
  if (targetAgentId) {
    deploymentResult = await apiRequest(
      `/v1/convai/agents/${encodeURIComponent(targetAgentId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          version_description:
            "CHRSM Meuse demo — RAG public, rappel consenti, BeSt minimisé, voix Christophe fr-BE",
        }),
      },
    );
  } else {
    deploymentResult = await apiRequest("/v1/convai/agents/create", {
      method: "POST",
      body: JSON.stringify({
        name: config.agent.name,
        tags: config.agent.tags,
        ...payload,
      }),
    });
  }

  const deployedAgentId = deploymentResult?.agent_id ?? targetAgentId;
  if (typeof deployedAgentId !== "string") {
    throw new Error("ElevenLabs n’a pas retourné l’identifiant de l’agent.");
  }
  const deployed = await apiRequest(
    `/v1/convai/agents/${encodeURIComponent(deployedAgentId)}`,
  );
  const deployedToolIds = deployed?.conversation_config?.agent?.prompt?.tool_ids;
  if (
    !Array.isArray(deployedToolIds) ||
    toolIds.some((id) => !deployedToolIds.includes(id)) ||
    deployed?.conversation_config?.agent?.prompt?.prompt !== prompt ||
    deployed?.conversation_config?.tts?.voice_id !== config.voice.voice_id ||
    deployed?.conversation_config?.agent?.disable_first_message_interruptions !== true ||
    !deployed?.conversation_config?.conversation?.client_events?.includes("interruption") ||
    deployed?.conversation_config?.turn?.merge_with_default_ignore_terms !== true ||
    deployed?.platform_settings?.privacy?.record_voice !== config.platform.record_voice ||
    deployed?.platform_settings?.privacy?.retention_days !== config.platform.retention_days ||
    deployed?.platform_settings?.privacy?.delete_audio !== config.platform.delete_audio ||
    deployed?.platform_settings?.privacy?.delete_transcript_and_pii !== true ||
    deployed?.platform_settings?.auth?.enable_auth !== true
  ) {
    throw new Error("La vérification distante de l’agent est incomplète.");
  }

  console.log(
    JSON.stringify(
      {
        status: targetAgentId ? "updated" : "created",
        agent_id: deployedAgentId,
        version_id: deploymentResult?.version_id ?? deployed?.version_id ?? null,
        name: config.agent.name,
        language: config.agent.language,
        voice: { id: config.voice.voice_id, name: config.voice.name },
        private_agent: true,
        privacy: {
          record_voice: config.platform.record_voice,
          retention_days: config.platform.retention_days,
          delete_audio: config.platform.delete_audio,
          delete_transcript_and_pii: config.platform.delete_transcript_and_pii,
          user_memory: config.platform.user_memory,
        },
        tools: remoteTools.map((tool) => ({
          id: tool.id,
          name: tool.tool_config?.name,
        })),
        prompt_sha256: createHash("sha256").update(prompt).digest("hex"),
        note: "Aucun secret n’a été affiché. Une conversation distante réelle reste obligatoire avant publication.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Erreur inconnue.");
  process.exitCode = 1;
});
