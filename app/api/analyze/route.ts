import { analyzeAudio, validateInput } from "../../../lib/analysis.mjs";
import { apiKey, errorResponse, jsonResponse, readJson, requestError } from "../../../lib/api-request.ts";

export async function POST(request: Request) {
  const rejected = requestError(request); if (rejected) return rejected;
  let key: string, body;
  try { key = apiKey(request); body = validateInput(await readJson(request)); }
  catch (error) { return errorResponse(error, 400); }
  try { return jsonResponse(await analyzeAudio(body, key)); }
  catch (error) { return errorResponse(error); }
}
