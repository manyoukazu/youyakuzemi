import test from "node:test";
import assert from "node:assert/strict";
import { listModels } from "../lib/providers.mjs";
import { analyzeAudio, validateInput } from "../lib/analysis.mjs";
import { defaultAIConfig, connectionReady, requestHeaders, requestSettings } from "../lib/ai-config.ts";
import { POST as modelsPOST } from "../app/api/models/route.ts";
const audio = "UklGR" + "A".repeat(103);
const output = { transcript: "model tried changing transcript", title: "研究", currentSection: "objective", sections: [{ id: "objective", summary: "目的を調べます。", detail: "説明です。", evidence: [] }], terms: [], questions: [] };
const gemini = text => Response.json({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });

test("models accepts custom and future IDs, rejects path injection and invalid providers", () => {
  assert.equal(validateInput({ audio, language: "auto", provider: "gemini", model: "models/gemini-future-custom" }).model, "gemini-future-custom");
  assert.equal(validateInput({ audio, language: "auto", provider: "openai", model: "ft:gpt-custom:org:project:123", speechProvider: "openai", speechModel: "gpt-transcribe" }).model, "ft:gpt-custom:org:project:123");
  assert.throws(() => validateInput({ audio, language: "auto", provider: "anthropic", model: "claude-custom", speechProvider: "direct" }));
  assert.throws(() => validateInput({ audio, language: "auto", provider: "unknown", model: "custom" }));
});
test("Gemini model enumeration follows every page and keeps specialized models", async () => {
  const calls = [];
  const models = await listModels("gemini", "secret", async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers["x-goog-api-key"], "secret");
    assert.ok(!url.includes("secret"));
    return calls.length === 1 ? Response.json({ models: [{ name: "models/gemini-alpha" }, { name: "models/embedding-model" }], nextPageToken: "page-two" }) : Response.json({ models: [{ name: "models/gemini-later", displayName: "Later" }] });
  });
  assert.equal(models.length, 3); assert.ok(calls[1].url.includes("pageToken=page-two"));
  assert.ok(models.some(m => m.id === "embedding-model"));
});
test("Claude model enumeration follows cursors and OpenAI returns full ID list", async () => {
  let calls = 0;
  const claude = await listModels("anthropic", "claude-secret", async (url, options) => {
    calls++; assert.equal(options.headers.Authorization, "Bearer claude-secret");
    assert.equal(options.headers["anthropic-version"], "2026-10-21");
    if (calls === 2) assert.ok(url.includes("after_id=claude-a"));
    return Response.json({ data: [{ id: calls === 1 ? "claude-a" : "claude-b" }], has_more: calls === 1, last_id: "claude-a" });
  });
  assert.equal(claude.length, 2);
  const openai = await listModels("openai", "openai-secret", async (_, options) => { assert.equal(options.headers.Authorization, "Bearer openai-secret"); return Response.json({ data: [{ id: "gpt-custom" }, { id: "tts-specialized" }] }); });
  assert.equal(openai.length, 2);
});
test("pagination failure never presents a partial list as complete", async () => {
  let calls = 0;
  await assert.rejects(listModels("gemini", "key", async () => {
    calls++; return calls === 1 ? Response.json({ models: [{ name: "models/one" }], nextPageToken: "two" }) : new Response("", { status: 429 });
  }), /上限/);
  await assert.rejects(listModels("gemini", "key", async () => Response.json({ models: [], nextPageToken: "same" })), /重複/);
});
test("OpenAI transcribes WAV then sends only text to the selected Responses model", async () => {
  const calls = [];
  const result = await analyzeAudio({ audio, provider: "openai", model: "gpt-custom", language: "en", speechProvider: "openai", speechModel: "gpt-transcribe" }, "openai-key", async (url, options) => {
    calls.push({ url, options }); assert.equal(options.headers.Authorization, "Bearer openai-key");
    if (url.endsWith("/transcriptions")) { assert.ok(options.body instanceof FormData); assert.equal(options.body.get("model"), "gpt-transcribe"); assert.equal(options.body.get("file").type, "audio/wav"); return Response.json({ text: "Exact original transcript." }); }
    const body = JSON.parse(options.body); assert.equal(body.model, "gpt-custom"); assert.ok(!options.body.includes(audio)); assert.equal(body.store, false);
    return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }] });
  });
  assert.equal(calls.length, 2); assert.equal(result.transcript, "Exact original transcript.");
});
test("Claude uses a separate transcription key, never receives audio or either secret in its prompt", async () => {
  const result = await analyzeAudio({ audio, provider: "anthropic", model: "claude-custom", language: "auto", speechProvider: "gemini", speechModel: "gemini-custom" }, "claude-secret", async (url, options) => {
    if (url.includes("googleapis")) { assert.equal(options.headers["x-goog-api-key"], "speech-secret"); assert.ok(!options.body.includes("claude-secret")); return gemini("Original words."); }
    assert.equal(url, "https://api.anthropic.com/v1/messages"); assert.equal(options.headers.Authorization, "Bearer claude-secret");
    const body = JSON.parse(options.body); assert.equal(body.model, "claude-custom"); assert.ok(!options.body.includes(audio)); assert.ok(!options.body.includes("speech-secret")); assert.ok(!options.body.includes("claude-secret")); assert.ok(options.body.includes("Original words."));
    return Response.json({ content: [{ type: "text", text: JSON.stringify(output) }], stop_reason: "end_turn" });
  }, "speech-secret");
  assert.equal(result.transcript, "Original words.");
});
test("Gemini text-only summary model can use OpenAI transcription and Chat Completions remains selectable", async () => {
  const config = { audio, language: "auto", provider: "gemini", model: "gemini-text-custom", speechProvider: "openai", speechModel: "gpt-transcribe" };
  const result = await analyzeAudio(config, "gemini-key", async (url, options) => {
    if (url.includes("/transcriptions")) { assert.equal(options.headers.Authorization, "Bearer speech-key"); return Response.json({ text: "Transcript." }); }
    const body = JSON.parse(options.body); assert.equal(body.contents[0].parts.length, 1); assert.ok(!options.body.includes(audio)); return gemini(JSON.stringify(output));
  }, "speech-key");
  assert.equal(result.transcript, "Transcript.");
  await analyzeAudio({ ...config, provider: "openai", model: "gpt-chat-custom", openaiApi: "chat" }, "key", async (url, options) => {
    if (url.includes("/transcriptions")) return Response.json({ text: "Transcript." });
    assert.equal(url, "https://api.openai.com/v1/chat/completions"); assert.ok(JSON.parse(options.body).messages);
    return Response.json({ choices: [{ message: { content: JSON.stringify(output) }, finish_reason: "stop" }] });
  });
});
test("silence skips summary API and transcription failure does not send audio to summarizer", async () => {
  let calls = 0;
  const input = { audio, provider: "anthropic", model: "claude-custom", language: "auto", speechProvider: "openai", speechModel: "gpt-transcribe" };
  const result = await analyzeAudio(input, "key", async () => { calls++; return Response.json({ text: "" }); });
  assert.equal(result.transcript, ""); assert.equal(calls, 1);
  await assert.rejects(analyzeAudio(input, "key", async () => new Response("", {status: 401})), /APIキー/);
});
test("client settings serialize no API keys in payloads and require all selected credentials", () => {
  const c = defaultAIConfig(); c.keys.gemini = "secret-gemini";
  assert.equal(connectionReady(c), true); c.provider = "anthropic"; c.keys.anthropic = "secret-claude"; c.speechProvider = "gemini";
  assert.equal(connectionReady(c), true); assert.equal(requestHeaders(c)["x-speech-api-key"], "secret-gemini");
  assert.ok(!JSON.stringify(requestSettings(c)).includes("secret"));
  c.keys.gemini = ""; assert.equal(connectionReady(c), false);
});
test("model discovery route rejects untrusted origin, missing keys and bad providers", async () => {
  const request = (headers, body) => new Request("https://app.test/api/models", {method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(body)});
  assert.equal((await modelsPOST(request({}, {provider:"gemini"}))).status,401);
  assert.equal((await modelsPOST(request({"x-api-key":"test",origin:"https://other.test"},{provider:"gemini"}))).status,403);
  assert.equal((await modelsPOST(request({"x-api-key":"test"},{provider:"unknown"}))).status,400);
});
