type RpcError = {
  code?: string;
  message?: string;
};

function runtimeConfig() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("supabase_runtime_not_configured");
  }
  return { url, serviceRoleKey };
}

export async function rpc<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { url, serviceRoleKey } = runtimeConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as RpcError;
    throw new Error(error.code ?? `rpc_${response.status}`);
  }
  return (await response.json()) as T;
}

export type AuthContext = {
  client_id: string;
  voicebot_instance_id: string | null;
};

export async function authorize(
  request: Request,
  requiredScope: string,
  headerName = "x-voicebot-token",
): Promise<AuthContext | null> {
  const token = request.headers.get(headerName);
  if (!token || token.length < 32 || token.length > 256) return null;
  const matches = await rpc<AuthContext[]>("chrsm_demo_authorize", {
    p_api_key: token,
    p_required_scope: requiredScope,
  });
  return matches.length === 1 ? matches[0] : null;
}

export async function sha256Bytea(value: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return `\\x${Array.from(bytes).map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")}`;
}
