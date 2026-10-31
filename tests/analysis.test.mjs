import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAudio, validateInput, normalizeAnalysis } from "../lib/analysis.mjs";

const input = { audio: "UklGR" + "A".repeat(103), language: "en", model: "gemini-3.8-flash", previous: { sections: [] } };
const result = { transcript: "Our purpose is to study travel.", title: "移動の研究", currentSection: "objective", sections: [{ id: "objective", summary: "移動について調べます。", detail: "発表の目的を説明しています。", evidence: ["Our purpose"] }], questions: ["どの移動を対象にしていますか？"], terms: [] };
test("request only forwards bounded context and rejects unsupported data", () => {
  assert.throws(() => validateInput({ ...input, model: "../../bad" }));
  assert.throws(() => validateInput({ ...input, audio: "data:audio/wav;base64,x" }));
  assert.throws(() => validateInput({ ...input, audio: "A".repeat(2_800_001) }));
  const safe = validateInput({ ...input, apiKey: "never-forward-this", previous: { apiKey: "never-forward-this", recentTranscript: "a".repeat(9000), sections: [{ id: "invented", summary: "wrong" }] } });
  assert.equal(safe.previous.recentTranscript.length, 8000);
  assert.equal(safe.previous.sections.length, 0);
  assert.ok(!JSON.stringify(safe).includes("never-forward-this"));
});
test("audio is sent as independent WAV with header credentials and schema", async () => {
  let observed;
  const actual = await analyzeAudio(input, "private-test-key", async (url, options) => {
    observed = { url, options, body: JSON.parse(options.body) };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] }, finishReason: "STOP" }] });
  });
  assert.equal(actual.transcript, result.transcript);
  assert.equal(actual.sections[0].id, "objective");
  assert.equal(observed.options.headers["x-goog-api-key"], "private-test-key");
  assert.ok(!observed.url.includes("private-test-key"));
  assert.ok(!observed.options.body.includes("private-test-key"));
  assert.equal(observed.body.contents[0].parts[1].inlineData.mimeType, "audio/wav");
  assert.equal(observed.body.contents[0].parts[1].inlineData.data, input.audio);
  assert.ok(observed.body.generationConfig.responseJsonSchema);
});
test("provider failures surface useful errors, never fabricated summaries", async () => {
  await assert.rejects(analyzeAudio(input, "test", async () => new Response("quota", { status: 429 })), e => e.status === 429 && /上限/.test(e.message));
  await assert.rejects(analyzeAudio(input, "test", async () => Response.json({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } }] })), /完了/);
  await assert.rejects(analyzeAudio(input, "test", async () => Response.json({ candidates: [{ content: { parts: [{ text: "not json" }] } }] })), /応答形式/);
});
test("normalization excludes invented categories and duplicate sections", () => {
  const normalized = normalizeAnalysis({ ...result, sections: [result.sections[0], result.sections[0], { id: "invented", summary: "bad" }] });
  assert.equal(normalized.sections.length, 1);
  assert.deepEqual(normalized.questions, result.questions);
  assert.throws(() => normalizeAnalysis({ transcript: null, sections: [] }));
});
