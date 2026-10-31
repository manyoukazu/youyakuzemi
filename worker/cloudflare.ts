import handler from "vinext/server/fetch-handler";

// Entry point for the user's own Cloudflare Workers account.
export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
};
