export const PROVIDERS = ["gemini", "openai"];
export const LABELS = { gemini: "Gemini", openai: "OpenAI" };
export function validProvider(value) {
  if (!PROVIDERS.includes(value)) throw new Error("AIサービスの設定が不正です。");
  return value;
}
export function modelId(value) {
  const id = typeof value === "string" ? value.trim().replace(/^models\//, "") : "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(id)) throw new Error("モデルIDを確認してください。");
  return id;
}
export function authHeaders(provider, key, json = true) {
  validProvider(provider);
  const headers = json ? { "Content-Type": "application/json" } : {};
  if (provider === "gemini") headers["x-goog-api-key"] = key;
  else headers.Authorization = `Bearer ${key}`;
  return headers;
}
export async function providerJson(provider, url, options, fetcher = fetch) {
  let response;
  try { response = await fetcher(url, options); }
  catch { throw Object.assign(new Error(`${LABELS[provider]}との接続が中断またはタイムアウトしました。再試行できます。`), { status: 504 }); }
  if (!response.ok) {
    let unsupportedEndpoint = false;
    if (provider === "openai" && [400, 404].includes(response.status)) {
      try {
        const failure = (await response.json()).error || {};
        const message = typeof failure.message === "string" ? failure.message : "";
        unsupportedEndpoint = ["unsupported_model", "model_not_supported", "unsupported_endpoint"].includes(failure.code)
          || /(?:not supported|does not support|unsupported|not available).{0,100}(?:responses|endpoint)|(?:responses|endpoint).{0,100}(?:not supported|does not support|unsupported|not available)/i.test(message);
      } catch { /* Provider bodies are never forwarded or logged. */ }
    }
    const descriptions = {
      400: "選択したモデルが、音声入力・文章の要約に対応しているか確認してください。",
      401: "APIキーを確認してください。",
      403: "APIキーとモデルの利用権限を確認してください。",
      404: "モデルIDと利用権限を確認してください。",
      429: "APIの利用上限に達しました。少し待って再試行してください。"
    };
    throw Object.assign(new Error(`${LABELS[provider]}: ${descriptions[response.status] || "AIサービスが一時的に応答できません。再試行してください。"}`), { unsupportedEndpoint, status: response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 401 : 502 });
  }
  try { return await response.json(); } catch { throw new Error(`${LABELS[provider]}の応答を読み取れませんでした。`); }
}
export async function listModels(provider, key, fetcher = fetch) {
  validProvider(provider);
  const found = new Map(), visited = new Set();
  let cursor = ""; const signal = AbortSignal.timeout(35_000);
  for (let page = 0; page < 200; page++) {
    let url;
    if (provider === "gemini") {
      url = new URL("https://generativelanguage.googleapis.com/v1beta/models"); url.searchParams.set("pageSize", "1000");
      if (cursor) url.searchParams.set("pageToken", cursor);
    } else {
      url = new URL("https://api.openai.com/v1/models");
      if (cursor) url.searchParams.set("after", cursor);
    }
    const data = await providerJson(provider, url.toString(), { headers: authHeaders(provider, key, false), signal }, fetcher);
    const items = provider === "gemini" ? data.models : data.data;
    if (!Array.isArray(items)) throw new Error("モデル一覧の応答形式を読み取れませんでした。");
    for (const item of items) {
      const id = (provider === "gemini" ? item.name : item.id)?.replace(/^models\//, "");
      if (typeof id !== "string" || !id) continue;
      found.set(id, { id, name: item.displayName || item.display_name || id });
    }
    const next = provider === "gemini" ? data.nextPageToken : data.has_more ? data.last_id || items.at(-1)?.id : "";
    if (!next) return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
    if (visited.has(next)) throw new Error("モデル一覧のページが重複しました。再取得してください。");
    visited.add(next); cursor = next;
  }
  throw new Error("モデル一覧が多すぎるため、完全に取得できませんでした。モデルIDを直接入力できます。");
}
export function geminiText(data) {
  if (data.candidates?.[0]?.finishReason === "MAX_TOKENS") throw new Error("AIの応答を完了できませんでした。同じ音声で再試行できます。");
  const text = data.candidates?.[0]?.content?.parts?.filter(p => typeof p.text === "string" && !p.thought).map(p => p.text).join("");
  if (typeof text !== "string") throw new Error("AIの応答を読み取れませんでした。同じ音声で再試行できます。");
  return text;
}
export const OPENAI_TRANSCRIPTION_MODEL = "gpt-transcribe";
export async function transcribeAudio(input, key, fetcher, signal) {
  const binary = atob(input.audio), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const body = new FormData();
  body.set("file", new Blob([bytes], { type: "audio/wav" }), "speech.wav");
  body.set("model", OPENAI_TRANSCRIPTION_MODEL);
  const data = await providerJson("openai", "https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: authHeaders("openai", key, false), body, signal
  }, fetcher);
  if (typeof data.text !== "string") throw new Error("文字起こしの応答を読み取れませんでした。");
  return data.text.trim().slice(0, 16000);
}
export async function openaiSummary(model, prompt, key, fetcher, signal) {
  let data, chat = false;
  try {
    data = await providerJson("openai", "https://api.openai.com/v1/responses", {
      method: "POST", headers: authHeaders("openai", key), signal,
      body: JSON.stringify({ model, input: prompt, max_output_tokens: 12000, store: false })
    }, fetcher);
  } catch (error) {
    // Retry only when OpenAI explicitly reports that this endpoint cannot use the model.
    if (!error.unsupportedEndpoint) throw error;
    chat = true;
    data = await providerJson("openai", "https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: authHeaders("openai", key), signal,
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_completion_tokens: 12000, store: false })
    }, fetcher);
  }
  if (data.status === "incomplete" || data.choices?.[0]?.finish_reason === "length") throw new Error("AIの応答を完了できませんでした。同じ音声で再試行できます。");
  return chat ? data.choices?.[0]?.message?.content
    : data.output?.filter(item => item.type === "message").flatMap(item => item.content || []).filter(part => part.type === "output_text").map(part => part.text).join("");
}
