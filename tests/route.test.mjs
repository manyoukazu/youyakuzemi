import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/analyze/route.ts";
const request = (headers, body = "{}") => new Request("https://example.test/api/analyze", { method: "POST", headers, body });
test("API rejects missing keys and requests from another origin", async () => {
  assert.equal((await POST(request({ "content-type": "application/json" }))).status, 401);
  assert.equal((await POST(request({ origin: "https://other.test", "x-api-key": "test", "content-type": "application/json" }))).status, 403);
});
test("API rejects invalid JSON, missing audio and oversized streaming bodies", async () => {
  const headers = { "x-api-key": "test", "content-type": "application/json" };
  assert.equal((await POST(request(headers, "not-json"))).status, 400);
  assert.equal((await POST(request(headers))).status, 400);
  const large = await POST(request(headers, "x".repeat(3_000_001)));
  assert.equal(large.status, 413);
  assert.equal(large.headers.get("Cache-Control"), "no-store");
});
