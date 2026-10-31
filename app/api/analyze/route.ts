import { analyzeAudio, validateInput } from "../../../lib/analysis.mjs";
import { apiKey, errorResponse, jsonResponse, readJson, requestError } from "../../../lib/api-request.ts";

export async function POST(request: Request) {
  const rejected = requestError(request); if (rejected) return rejected;
  let key: string, speechKey: string, body;
  try {
    key = apiKey(request);
    body = validateInput(await readJson(request));
    speechKey = body.speechProvider === "direct" || body.speechProvider === body.provider ? key : apiKey(request, "x-speech-api-key");
  } catch (error) { return errorResponse(error, 400); }
  try { return jsonResponse(await analyzeAudio(body, key, fetch, speechKey)); }
  catch (error) { return errorResponse(error); }
}
