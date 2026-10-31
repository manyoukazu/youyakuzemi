# ヨウヤクゼミ

学会・ゼミの発表を聴きながら、話の流れをやさしい日本語で把握するWebアプリです。

## 起動

Node.js 22.13以降を使用します。Windows PowerShellでは `npm` の代わりに `npm.cmd` を使うと実行ポリシーの影響を避けられます。

```powershell
npm.cmd run install:ci
npm.cmd run dev
```

表示された localhost のURLをChrome / Edgeで開きます。収音にはHTTPSまたはlocalhostと、マイク／タブ共有の許可が必要です。

## 使い方

1. 「デモを体験」で、APIキーなしで要約カードの更新を確認できます。デモは固定サンプルであり、マイクやAIを使用しません。
2. 「AIの接続設定」でGemini・OpenAI（ChatGPT）を選び、各社のAPIキーを入力します。「一覧を取得」でAPIが返す全モデルをページ末尾まで取得し、選択できます。モデルIDの直接入力も可能です。画像生成など、要約に対応しないモデルは利用できません。APIの利用権限・料金が適用されます。
3. 会場では「マイク」、オンラインでは「タブの音声」を選択します。タブの共有時は「タブの音声も共有」をオンにしてください。
4. 「収音を開始」を押すと、15／20／30秒分の音声がたまるたびに、文字起こしと要約が更新されます。更新には音声の収集時間に加えてAPI処理時間がかかります。
5. 背景・目的・関連研究・手法・実験・結論に自動分類し、ここまでの全体要約を更新します。カードから詳細説明と元の言語の表現を確認できます。まだ話されていない項目は埋めません。
6. 一時停止・再開・終了ができます。終了時にも最後の短い音声を処理します。APIエラーでは自動で一時停止し、同じ音声を保持して「再試行」できます。
7. ノートはこのブラウザに最大12件保存されます。Markdown／テキスト／JSONで書き出せます。質問のヒント、用語の説明、自分のメモも保存・書き出しに含まれます。

## AIサービスとモデルの選択

- Gemini：選んだモデルで音声を直接要約できます。音声を受け取れないモデルでは、文字起こしを別のGemini／OpenAIモデルに任せる設定も可能です。
- OpenAI（ChatGPT）：OpenAIの文字起こしモデルで音声を文字にし、選択したモデルで要約します。同じOpenAI APIキーを再利用できます。モデルに合わせてResponses API／Chat Completions APIを選べます。
- モデル一覧は固定の2モデルに制限せず、各サービスのModels APIが返す全件を表示します。取得に失敗した場合は一部だけを完全な一覧として表示しません。取得後でも任意のモデルIDを入力できます。
- 一覧に載ることと、音声の理解・文章の要約に使えることは別です。音声出力・画像生成・埋め込み・Realtime専用など、対象APIに対応しないモデルは使用できません。ChatGPTのチャット契約とAPIの利用権限は別です。
- APIキーは設定画面の「設定を保存」でページのメモリ内に保持します。更新・再読込すると消えます。設定画面の×ボタンは廃止し、「閉じる」またはEscで戻ります。

## データと制約

- APIキーはページのメモリ内だけに保持し、localStorage・ノート・ソース・URL・ログに書きません。再読込時は再入力が必要です。
- 音声は独立した16kHz・モノラルPCM WAVとして、選択した音声処理サービスへサーバー経由で送信します。別のサービスで要約する場合は、文字起こしだけを要約サービスへ送信します。キーは用途別のリクエストヘッダーで送り、URLやプロンプトには含めません。アプリのサーバーには保存しません。各社での取扱いは利用するAPI契約に従います。
- 原音声はブラウザの処理待ちキューにだけ保持します。再読込・ページを閉じる操作では未処理音声が失われます。収音中／未処理音声がある場合、離脱確認を表示します。
- キューが8件以上になると収音を一時停止します。既存ノートを切り替える操作は、収音と要約が終わるまで制限します。
- ブラウザのデータ削除でノートも削除されます。大切な記録は書き出してください。端末間の同期はありません。
- セクションの分類、文字起こし、要約はAIによる推定です。精度は音質、発表内容、APIモデルによって変わります。話者の分離やスライド解析は行いません。
- タブ音声の共有可否はOS・ブラウザ・共有対象に依存します。デスクトップ版Chrome / Edgeを想定しています。モバイルではマイク収音を使用してください。
- 実際の各社APIへの接続・認識精度は、利用者の有効なAPIキーでの確認が必要です。

## 実装と検証

React 19・TypeScript・Vinext・Cloudflare Workersで構成しています。Sitesの非公開ホスティングを利用し、元のCloudflareモックのURLは変更していません。

| ファイル | 役割 |
| --- | --- |
| `app/page.tsx` | 聴講画面、処理待ちキュー、エラー回復、ノートの保存 |
| `lib/audio.ts` | 音声ソース、16kHz WAV生成、停止時の残り音声の処理 |
| `public/recorder-worklet.js` | AudioWorkletで途切れずにPCMを収集 |
| `app/api/analyze/route.ts` | 同一オリジン確認、入力サイズ制限、AI呼び出し |
| `lib/analysis.mjs` | 指示文、構造化出力、入力とAI応答の検証 |
| `lib/session.ts` | ノートの型、セクション定義、書き出し |
| `lib/demo.ts` | 明示的なデモ専用の固定サンプル |

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

APIテストは各社への送信内容、モデル一覧のページ送り、文字起こしと要約の分離、用途ごとのキーの分離、入力制限、異常応答、API上限エラーを検証します。実装時には既存Chromeで、デモ、詳細表示、メモ保存、再読込、書き出し、履歴、390px幅での表示と、合成音声による実際のAudioWorklet収音を確認しました。AI応答をテスト用に差し替え、一時停止時の残り音声、失敗した音声の同一データでの再試行、再開、終了時の処理、秘密情報を保存しないことを検証しています。

## 参照した要件・仕様

- [共有議事録](https://docs.google.com/document/d/1EW7VreBfBySWUG6U3IvVlWdSWzOB37uIsQCtA_lmCHk/edit)：セクションごとの平易な要約、話題の可視化、詳細説明、収音を区切る手間の解消。
- [元のモック](https://youyakuzemi.love-linux-7701.workers.dev/)：ロゴ、ブランド色、7項目の構成。
- [Gemini 音声の理解](https://ai.google.dev/gemini-api/docs/audio)、[構造化出力](https://ai.google.dev/gemini-api/docs/structured-output)、[モデル一覧](https://ai.google.dev/gemini-api/docs/models)。
- [OpenAIのモデル一覧](https://developers.openai.com/api/reference/resources/models/methods/list)、[文字起こし](https://developers.openai.com/api/docs/guides/speech-to-text)、[テキスト生成](https://developers.openai.com/api/docs/guides/text)。
- [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)。

---

## ホスティング基盤の補足

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git and `tar` (including Windows `tar.exe`) are required for publishing; portable publication does not require Bash

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

Publish archives outside the source checkout or under its ignored `outputs/` directory. Local `.env*`, `.dev.vars*`, TypeScript build state, and tool runtime directories are ignored; keep the hosting manifest, migrations, and authored scripts in source control.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For managed Linux browser QA, follow the Sites skill's managed preview reference. The daemon runs the project's Vite dev script with `--host 0.0.0.0 --port 4173 --strictPort`; use the CLI's returned URL. The ignored local profile survives the daemon's cleared environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `worker/index.ts` is the production Worker entrypoint and preserves request-scoped connector bindings
- `scripts/vite/` contains the maintained Vite integrations and the vendored Sites plugin license
- `scripts/connector-preview/` contains the local connector preview Worker and session helpers
- the remaining `scripts/` files select execution profiles and run installation, development, and builds; the plugin's helpers orchestrate the Sites lifecycle
- `dist/` contains generated deployment output; `.vinext/`, `.wrangler/`, and `.sites-runtime/` contain ignored local tool state
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
