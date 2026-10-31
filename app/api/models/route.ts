import { listModels, validProvider } from "../../../lib/providers.mjs";
import { apiKey, errorResponse, jsonResponse, readJson, requestError } from "../../../lib/api-request.ts";

export async function POST(request: Request) {
  const rejected = requestError(request); if (rejected) return rejected;
  let key: string, provider: string;
  try { key = apiKey(request); provider = validProvider((await readJson(request, 8192)).provider); }
  catch (error) { return errorResponse(error, 400); }
  try { return jsonResponse({ models: await listModels(provider, key) }); }
  catch (error) { return errorResponse(error); }
}
