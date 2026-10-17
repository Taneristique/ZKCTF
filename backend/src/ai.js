/**
 * Small LLM helper for CTF story intros + lesson drafts.
 * Prefer Anthropic Messages API (ANTHROPIC_API_KEY); fall back to OpenRouter.
 * Never invents puzzle data — callers validate outputs.
 */

function anthropicModel() {
  const raw = (process.env.ANTHROPIC_MODEL || process.env.OPENROUTER_MODEL || "claude-sonnet-4").trim();
  // openrouter style → native: anthropic/claude-sonnet-4 → claude-sonnet-4
  return raw.replace(/^anthropic\//, "");
}

function openrouterModel() {
  const raw = (process.env.OPENROUTER_MODEL || process.env.ANTHROPIC_MODEL || "anthropic/claude-sonnet-4").trim();
  return raw.includes("/") ? raw : `anthropic/${raw}`;
}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
}

export function aiProvider() {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (process.env.OPENROUTER_API_KEY?.trim()) return "openrouter";
  return null;
}

export function aiModelLabel() {
  const p = aiProvider();
  if (p === "anthropic") return anthropicModel();
  if (p === "openrouter") return openrouterModel();
  return null;
}

/** Chat-completions-style: messages = [{ role, content }, …] → assistant text. */
export async function chat(messages, { maxTokens = 1024 } = {}) {
  const anth = process.env.ANTHROPIC_API_KEY?.trim();
  if (anth) return chatAnthropic(messages, maxTokens, anth);
  const or = process.env.OPENROUTER_API_KEY?.trim();
  if (or) return chatOpenRouter(messages, maxTokens, or);
  throw new Error("Set ANTHROPIC_API_KEY (preferred) or OPENROUTER_API_KEY.");
}

async function chatAnthropic(messages, maxTokens, apiKey) {
  // Anthropic: system is top-level; only user/assistant in messages.
  let system;
  const turns = [];
  for (const m of messages) {
    if (m.role === "system") {
      system = system ? `${system}\n\n${m.content}` : m.content;
      continue;
    }
    turns.push({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") });
  }
  if (!turns.length) throw new Error("anthropic: no user messages");

  const body = {
    model: anthropicModel(),
    max_tokens: maxTokens,
    messages: turns,
  };
  if (system) body.system = system;

  const headers = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  // Multi-workspace / identity-linked keys require this (console → Settings → Workspaces).
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  if (workspace) headers["anthropic-workspace-id"] = workspace;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const tip = res.status === 401 ? " (check ANTHROPIC_API_KEY — console.anthropic.com)" : "";
    throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}${tip}`);
  }
  const data = await res.json();
  const parts = data?.content ?? [];
  return parts
    .filter((p) => p?.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

async function chatOpenRouter(messages, maxTokens, apiKey) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "https://zkctf.com",
      "X-Title": "ZKCTF",
    },
    body: JSON.stringify({
      model: openrouterModel(),
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!res.ok) {
    const tip = res.status === 401 ? " (OpenRouter key from openrouter.ai/keys)" : "";
    throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 300)}${tip}`);
  }
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "").trim();
}
