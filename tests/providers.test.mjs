import test from "node:test";
import assert from "node:assert/strict";
import { listModels, OPENAI_TRANSCRIPTION_MODEL } from "../lib/providers.mjs";
import { analyzeAudio, validateInput } from "../lib/analysis.mjs";
import { defaultAIConfig, connectionReady, requestHeaders, requestSettings } from "../lib/ai-config.ts";
import { POST as modelsPOST } from "../app/api/models/route.ts";
import { POST as analyzePOST } from "../app/api/analyze/route.ts";
const audio = "UklGR" + "A".repeat(103);
const output = { transcript: "model tried changing transcript", title: "研究", currentSection: "objective", sections: [{ id: "objective", summary: "目的を調べます。", detail: "説明です。", evidence: [] }], terms: [], questions: [] };
const gemini = text => Response.json({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });
const responseOutput = () => Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }] });

test("custom model IDs remain supported and obsolete routing fields are never forwarded", () => {
  assert.equal(validateInput({ audio, language: "auto", provider: "gemini", model: "models/gemini-future-custom" }).model, "gemini-future-custom");
  const input = validateInput({ audio, language: "auto", provider: "openai", model: "ft:gpt-custom:org:project:123", speechProvider: "gemini", speechModel: "custom", openaiApi: "chat" });
  assert.equal(input.model, "ft:gpt-custom:org:project:123");
  assert.ok(!("speechProvider" in input)); assert.ok(!("speechModel" in input)); assert.ok(!("openaiApi" in input));
  assert.throws(() => validateInput({ audio, language: "auto", provider: "anthropic", model: "claude-custom" }));
  assert.throws(() => validateInput({ audio, language: "auto", provider: "unknown", model: "custom" }));
});
test("Gemini model enumeration follows every page and keeps specialized models", async () => {
  const calls = [];
  const models = await listModels("gemini", "secret", async (url, options) => {
    calls.push({ url, options }); assert.equal(options.headers["x-goog-api-key"], "secret"); assert.ok(!url.includes("secret"));
    return calls.length === 1 ? Response.json({ models: [{ name: "models/gemini-alpha" }, { name: "models/embedding-model" }], nextPageToken: "page-two" }) : Response.json({ models: [{ name: "models/gemini-later", displayName: "Later" }] });
  });
  assert.equal(models.length, 3); assert.ok(calls[1].url.includes("pageToken=page-two")); assert.ok(models.some(m => m.id === "embedding-model"));
});
test("OpenAI returns its complete model list and removed providers cannot be requested", async () => {
  const models = await listModels("openai", "secret", async (_, options) => {
    assert.equal(options.headers.Authorization, "Bearer secret");
    return Response.json({ data: [{ id: "gpt-custom" }, { id: "tts-specialized" }] });
  });
  assert.equal(models.length, 2);
  await assert.rejects(listModels("anthropic", "test", async () => assert.fail("No request for a removed provider")), /AIサービス/);
});
test("pagination failure never presents a partial list as complete", async () => {
  let calls = 0;
  await assert.rejects(listModels("gemini", "key", async () => ++calls === 1 ? Response.json({ models: [{ name: "models/one" }], nextPageToken: "two" }) : new Response("", { status: 429 })), /上限/);
  await assert.rejects(listModels("gemini", "key", async () => Response.json({ models: [], nextPageToken: "same" })), /重複/);
});
test("OpenAI automatically transcribes and summarizes using a single key", async () => {
  const calls = [];
  const result = await analyzeAudio({ audio, provider: "openai", model: "gpt-custom", language: "en" }, "only-key", async (url, options) => {
    calls.push(url); assert.equal(options.headers.Authorization, "Bearer only-key");
    if (url.endsWith("/transcriptions")) {
      assert.ok(options.body instanceof FormData); assert.equal(options.body.get("model"), OPENAI_TRANSCRIPTION_MODEL);
      assert.equal(options.body.get("file").type, "audio/wav"); return Response.json({ text: "Exact original transcript." });
    }
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body); assert.equal(body.model, "gpt-custom"); assert.ok(!options.body.includes(audio));
    assert.ok(!options.body.includes("only-key")); assert.equal(body.store, false); return responseOutput();
  });
  assert.equal(calls.length, 2); assert.equal(result.transcript, "Exact original transcript.");
});
test("Gemini processes audio directly with the selected model and no transcription configuration", async () => {
  let calls = 0;
  const result = await analyzeAudio({ audio, provider: "gemini", model: "gemini-custom", language: "auto" }, "only-key", async (url, options) => {
    calls++; assert.ok(url.startsWith("https://generativelanguage.googleapis.com/"));
    assert.equal(options.headers["x-goog-api-key"], "only-key");
    const body = JSON.parse(options.body); assert.equal(body.contents[0].parts[1].inlineData.data, audio);
    assert.ok(!options.body.includes("only-key")); return gemini(JSON.stringify(output));
  });
  assert.equal(calls, 1); assert.equal(result.sections[0].id, "objective");
});
test("a model unsupported by Responses automatically uses Chat Completions without retranscribing", async () => {
  const calls = [];
  const result = await analyzeAudio({ audio, language: "auto", provider: "openai", model: "gpt-chat-custom" }, "key", async (url, options) => {
    calls.push(url);
    if (url.endsWith("/transcriptions")) return Response.json({ text: "Transcript." });
    if (url.endsWith("/responses")) return Response.json({ error: { code: "unsupported_model", message: "This model is not supported in the Responses endpoint." } }, { status: 400 });
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    assert.equal(JSON.parse(options.body).model, "gpt-chat-custom");
    return Response.json({ choices: [{ message: { content: JSON.stringify(output) }, finish_reason: "stop" }] });
  });
  assert.equal(calls.length, 3); assert.equal(calls.filter(url => url.endsWith("/transcriptions")).length, 1);
  assert.equal(result.transcript, "Transcript.");
});
test("authentication and quota failures never trigger an extra summary request", async () => {
  for (const status of [401, 429]) {
    let calls = 0;
    await assert.rejects(analyzeAudio({ audio, language: "auto", provider: "openai", model: "gpt-custom" }, "key", async url => {
      calls++; return url.endsWith("/transcriptions") ? Response.json({ text: "Transcript." }) : Response.json({ error: { code: "unavailable", message: "not supported" } }, { status });
    }), status === 401 ? /APIキー/ : /上限/);
    assert.equal(calls, 2);
  }
});
test("silence skips summary processing and transcription failures remain retryable", async () => {
  let calls = 0;
  const input = { audio, provider: "openai", model: "gpt-custom", language: "auto" };
  const result = await analyzeAudio(input, "key", async () => { calls++; return Response.json({ text: "" }); });
  assert.equal(result.transcript, ""); assert.equal(calls, 1);
  await assert.rejects(analyzeAudio(input, "key", async () => new Response("", { status: 401 })), /APIキー/);
});
test("client configuration needs only the selected provider key and model", () => {
  const c = defaultAIConfig(); c.keys.gemini = "gemini-secret";
  assert.equal(connectionReady(c), true); c.provider = "openai"; assert.equal(connectionReady(c), false);
  c.keys.openai = "openai-secret"; c.keys.gemini = ""; assert.equal(connectionReady(c), true);
  assert.deepEqual(requestSettings(c), { provider: "openai", model: c.models.openai });
  assert.deepEqual(requestHeaders(c), { "Content-Type": "application/json", "x-api-key": "openai-secret" });
  assert.ok(!JSON.stringify(requestSettings(c)).includes("secret")); assert.ok(!("speechModels" in c)); assert.ok(!("openaiApi" in c));
});
test("analysis route uses the selected provider key even if obsolete speech headers are sent", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls++; assert.ok(url.startsWith("https://api.openai.com/")); assert.equal(options.headers.Authorization, "Bearer selected-key");
    assert.ok(!JSON.stringify(options.headers).includes("other-key"));
    return url.endsWith("/transcriptions") ? Response.json({ text: "Original." }) : responseOutput();
  });
  const request = new Request("https://app.test/api/analyze", { method: "POST", headers: {
    "content-type": "application/json", "x-api-key": "selected-key", "x-speech-api-key": "other-key"
  }, body: JSON.stringify({ audio, provider: "openai", model: "gpt-custom", language: "auto", speechProvider: "gemini", speechModel: "gemini-other" }) });
  const response = await analyzePOST(request); assert.equal(response.status, 200); assert.equal(calls, 2);
  assert.equal((await response.json()).transcript, "Original.");
});
test("model discovery rejects untrusted origin, missing keys and unsupported providers", async () => {
  const request = (headers, body) => new Request("https://app.test/api/models", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  assert.equal((await modelsPOST(request({}, { provider: "gemini" }))).status, 401);
  assert.equal((await modelsPOST(request({ "x-api-key": "test", origin: "https://other.test" }, { provider: "gemini" }))).status, 403);
  for (const provider of ["unknown", "anthropic"]) assert.equal((await modelsPOST(request({ "x-api-key": "test" }, { provider }))).status, 400);
});
