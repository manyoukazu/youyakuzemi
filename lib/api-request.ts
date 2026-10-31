export function jsonResponse(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function requestError(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return jsonResponse({ error: "この操作はアプリの画面から実行してください。" }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return jsonResponse({ error: "JSON形式で送信してください。" }, 415);
  return null;
}
export function apiKey(request: Request, header = "x-api-key") {
  const key = request.headers.get(header)?.trim() || "";
  if (!key || key.length > 2048 || /[^\x21-\x7e]/.test(key)) throw Object.assign(new Error("AIの接続設定から、必要なAPIキーを入力してください。"), { status: 401 });
  return key;
}
export async function readJson(request: Request, limit = 3_000_000) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("入力データがありません。");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw Object.assign(new Error("入力が大きすぎます。更新間隔を短くしてください。"), { status: 413 }); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("JSON形式の入力を読み取れませんでした。"); }
}
export function errorResponse(e: unknown, status = 502) {
  const error = e as Error & { status?: number };
  return jsonResponse({ error: error.message || "処理を完了できませんでした。" }, error.status || status);
}
