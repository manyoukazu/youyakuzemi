import { analyzeAudio, validateInput } from "../../../lib/analysis.mjs";

export async function POST(request: Request) {
  const json = (data: object, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "この操作はアプリの画面から実行してください。" }, 403);
  const key = request.headers.get("x-api-key")?.trim();
  if (!key || key.length > 256 || /[\r\n]/.test(key)) return json({ error: "設定からGemini APIキーを入力してください。" }, 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "JSON形式で送信してください。" }, 415);
  let body;
  try {
    // Bound the streamed body as well as Content-Length; never buffer an unbounded upload.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "音声データがありません。" }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 3_000_000) { await reader.cancel(); return json({ error: "音声が大きすぎます。更新間隔を短くしてください。" }, 413); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    body = validateInput(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (e) { return json({ error: e instanceof Error ? e.message : "入力が不正です。" }, 400); }
  try { return json(await analyzeAudio(body, key)); }
  catch (e) { const error = e as Error & { status?: number }; return json({ error: error.message || "要約できませんでした。" }, error.status || 502); }
}
