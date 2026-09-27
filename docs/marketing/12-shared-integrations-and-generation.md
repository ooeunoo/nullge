# Shared integrations and approval-gated marketing

Implemented 2026-09-25 in Nullge (not in individual product admins).

## Operator flow

1. `/settings`: workspace OpenAI/Higgsfield keys, shared X/Instagram/Threads OAuth applications, generation unit prices.
2. `/projects/:slug/channels`: product-specific SNS account. X uses OAuth 2.0 PKCE; Instagram Login and Threads use authorization-code OAuth with server-side long-lived token exchange. Existing manual Meta user-token input remains available under the advanced section. A verified identity is not proof that all publishing permissions or paid API access are granted.
3. `/projects/:slug/marketing/new`: select text/image/5-second video and optionally enter a prompt. With an empty prompt, product facts/audience/tone and recent product content guide topic selection. Defaults: Korean, Threads format for text and Instagram format for media. Advanced settings retain channel/language overrides and optional JPEG/PNG mood references. No SNS connection is required for generation.
4. A persisted 10-minute quote is shown automatically as inputs settle. Clicking **콘텐츠 생성** explicitly confirms that quote and queues generation; there is no separate estimate button. Identical unconfirmed quotes are reused for the same operator/product/inputs/revisions. No provider is called by an estimate, refresh or page visit. Prices are estimates from configured unit rates, not enforceable provider billing caps. OpenAI gpt-4o-mini defaults use documented standard input/output rates (USD 0.15/0.60 per million, checked 2026-09-25). Media rates are unset until verified by the operator.
5. Worker selects one of three planned candidates against product content history, creates optional Higgsfield media, stores media in PostgreSQL (25 MB maximum), then creates a `review` post. The creator shows progress and opens the finished post. It never approves or publishes generated posts automatically.
6. Operator reviews product profile, copy and media, approves, then separately confirms the exact SNS account and stored content. Publishing is a distinct explicit queue action. No scheduling, recurring generation, or automatic publishing.

## Protection boundaries

- API owner session + origin protection; strict proxy allowlist; validated bodies. Public assets alone use time-limited workspace/asset-bound signatures.
- AES-256-GCM credentials, independent Nullge key shared by API/worker, authenticated workspace/purpose context. Settings GET exposes booleans only. Explicit key removal overrides environment fallback.
- Product-scoped channel tokens; optimistic revisions. OAuth state is workspace/operator/product/provider-bound, expiring and single-use; X also uses PKCE. Changed app credentials invalidate pending auth and only that provider’s connections. Saving identical credentials preserves connections. Canceled/failed reauthorization preserves the existing account.
- Quotes bind actor, product/profile revision and common settings revision. Confirmation idempotent. Twenty confirmations per rolling 24 hours; fifty fresh quotes/hour.
- Non-idempotent provider requests are never automatically retried. Lost responses/crashed submissions become `uncertain`. Polling uses saved request IDs.
- Publication queue is unique per post. Queued/published/failed/uncertain posts cannot be edited or resubmitted. Profile/channel changes are blocked during active publication. New content requires a new reviewed post.
- Original profile revision retained on generated content. Test posts containing `실제 게시 금지` or `실제 발행 금지` cannot publish.
- AI-media disclosure appended. Exact logo/UI overlays are not generated. Reference image bytes are removed after planning completion/failure or quote expiry.
- Download uses configured exact CDN hostnames, public DNS address checks, redirect re-validation, byte cap and type sniffing; arbitrary user URLs are not fetched.

## Deployment/configuration

- Additive migration `MarketingWorkspace1790366400000`; no prior product/post data removal.
- Deploy API (migration), then worker, then console. Public site does not need redeployment.
- `MARKETING_SECRET_KEY`: generate independent 32-byte hex key once; keep identical on API and worker. Rotation requires re-encrypting stored credentials.
- Optional environment fallbacks: `OPENAI_API_KEY`, `OPENAI_MODEL`, `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET`, `X_CLIENT_ID`, `X_CLIENT_SECRET`, `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `THREADS_CLIENT_ID`, `THREADS_CLIENT_SECRET`. Settings page overrides these. Never configure secrets on the browser service.
- `HIGGSFIELD_MEDIA_HOSTS`: exact trusted output CDN hosts; empty fails closed. Add observed official CDN hosts before enabling paid media generation. Do not allow generic arbitrary hosts.
- Callback URLs must exactly match the registered developer-app redirects (no trailing slash):
  - X: `https://console.nullge.com/api/channels/x/callback`
  - Instagram: `https://console.nullge.com/api/channels/instagram/callback`
  - Threads: `https://console.nullge.com/api/channels/threads/callback`
- Add the Nullge X callback to the existing app without deleting its other callbacks or regenerating credentials. Use the existing confidential Web App; changing callback configuration alone does not require replacing the migrated token.
- Meta: use the Instagram Login App ID/Secret and Threads-specific App ID/Secret, not an unrelated parent Facebook app’s credentials. Add each callback in the corresponding use-case/product settings. Development-mode accounts must accept tester invitations. Instagram requires a professional account.
- Requested Meta scopes: Instagram `instagram_business_basic,instagram_business_content_publish`; Threads `threads_basic,threads_content_publish`. Operators complete login and consent themselves. Connecting an account does not approve a post.
- New Meta OAuth tokens are exchanged for long-lived tokens with provider-reported expiration. On use/verification, tokens more than 24 hours old with less than seven days left are refreshed under a DB lock. Expired tokens require reauthorization. Legacy manually entered tokens have unknown lifetime and require manual renewal.
- `scripts/import-mellow-openai.mjs` reuses the authorized existing key through Railway stdin without printing/persisting values. It never runs a generation or connects an SNS account.
- `scripts/import-mellow-marketing.mjs` imports the legacy encrypted common keys and product channel tokens through an explicitly approved temporary Railway SSH identity. It re-encrypts with Nullge's independent key, refuses active automation/conflicting target connections, and records an idempotent audit marker. It never publishes or generates.

## Production migration verification (2026-09-25)

- Mellow OpenAI key/model reused on Nullge API/worker; model access check succeeded without a paid generation.
- Mellow settings revision 7 imported: Higgsfield key/secret and X OAuth client ID/secret are now common settings. No secrets were logged or saved to migration files.
- Product-scoped X `@mellow_call` imported, expired token successfully refreshed, and live account identity verified from Nullge. Instagram/Threads were not connected in the source, so no accounts were invented.
- Source automation was already off and remains off. Legacy settings remain as rollback data; rotated X refresh tokens are now maintained by Nullge.
- Independent encryption enabled. Temporary Railway SSH key `nullge-migration-20260925` revoked and its two generated local key files deleted after verification.
- Five products and the one pre-existing no-publish test draft preserved. No generation or publication jobs executed.
- Automated tests: 30 passed, including parallel token refresh, secret isolation, approval/cost gates and no duplicate paid submissions. Typecheck and build passed.
- API deployment: `771d71be-19a3-43b0-83d9-b76583cf1182`; worker: `d8f2ca9e-0309-48ed-ba38-0d380735d8cd` (both successful).
- Console deployment: `327f1fd3-a843-4a1e-8399-b3603ee2983e` successful. `https://console.nullge.com/settings` returns HTTPS 200; anonymous integrations API returns 401. Authenticated production UI shows all migrated keys as configured (never their values), successful non-generation OpenAI verification, and mellow's connected X identity.
- Production UI text-only quote test succeeded at an estimated USD 0.0017 for a Korean mellow mood prompt. Confirmation was not clicked; no billable request was made. The unconfirmed quote expires after ten minutes.
- Reauthorizing X with the new console still requires registering the displayed Nullge callback in the existing X developer app. The existing migrated refresh-token flow was verified without new OAuth consent.
- Image/video rates and trusted output CDN hosts remain unset; media quotes fail before any paid request. Public Higgsfield pricing showed varying “from” prices, not a verified account-specific 1080p/5-second quote. Source had no prior provider requests from which to verify output hosts.

## Known limitations / verification gates

- Content memory covers recent records saved in this console, not external SNS history. Model-guided topic selection plus local text/descriptor similarity reduces repetition; it does not guarantee semantic uniqueness. Older content outside the bounded window and media without stored visual descriptors need operator review.
- Initial implementation used mocked providers only. One user-approved live text generation subsequently succeeded on 2026-09-26 (record below). Live media generation and real public posting remain untested and were not authorized.
- Higgsfield image uses Soul 2 (`higgsfield-ai/soul/v2/standard`), `batch_size:1`, `1080p`, `3:4`; the API platform lists it at US$0.0032 (720p) / US$0.0057 (1080p) per image, versus US$0.0938–0.1875 for the older Soul Standard (checked 2026-09-27). Video uses Kling 3.0 Standard (`kling-video/v3.0/std/text-to-video`, `duration:5`, `9:16`, `sound:off`), billed per second (US$0.084/s list, US$0.0462/s promo until 2026-10-01). Note: higgsfield.ai subscription credits do not apply to the API; the API has its own USD balance at open.higgsfield.ai.
- OAuth code paths for all three providers are implemented. Meta live setup still requires developer-app configuration, account login and consent; identity verification alone is not proof of every publishing permission. X token rotation uses the stored refresh token under a database lock; failed/invalid refresh requires reauthorization.
- Direct video publishing is Instagram only. X images capped at 5 MB. Instagram image publishing requires JPEG; PNG output must be converted/manual-posted. Media can be opened/downloaded for manual posting.
- Failed/uncertain submissions need operator/provider reconciliation; no reset/retry button that could duplicate charges/posts.
- DB media storage is intentionally bounded per asset, not a replacement for long-term object storage. Add a retention/backups policy before high-volume use.

## Sources checked

- OpenAI Docs skill: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [gpt-4o-mini pricing](https://developers.openai.com/api/docs/models/gpt-4o-mini).
- [Higgsfield API](https://higgsfield.ai/higgsfield-api), [Soul 2 schema](https://open.higgsfield.ai/models/higgsfield-ai/soul/v2/standard/api-reference), [Kling 3.0 schema](https://open.higgsfield.ai/models/kling-video/v3.0/std/text-to-video/api-reference).
- [X PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code), [create post](https://docs.x.com/x-api/posts/create-post), [media upload](https://docs.x.com/x-api/media/upload-media).
- Meta's official [Threads collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api); developer.facebook.com rate-limited the document fetch. Existing mellow's Meta request flow was reused.


## OAuth extension and live verification (2026-09-26)

- Preserved all pre-existing uncommitted work. No DB migration, credential rotation, paid generation or public posting was performed by this extension.
- Added encrypted shared Meta app settings, channel-specific authorize/callback routes, Console proxy allowlist entries, connect/re-authenticate buttons, cancellation notices and Meta token lifetime handling.
- Local validation: 45 tests pass (30 existing + 15 OAuth); typecheck and production build pass. OAuth tests cover provider/operator/workspace isolation, exact redirects, cancellation, replay/concurrency, expiration, stale settings/connections, refresh locking, secret redaction and legacy X callback compatibility. All provider requests in tests are mocked; test databases are disposable local databases. `pnpm build` then `node scripts/check-oauth-http.mjs` additionally passes real local API + Next proxy checks for three OAuth start/cancellation routes, anonymous 401, foreign-origin 403, unknown callback 404, no-referrer and zero content/jobs.
- Browser inspection found the Nullge operator, X developer and Meta developer sessions logged out. User login was requested. No OAuth consent was accepted on the user's behalf.
- Operating API deployment `906398d6-c317-4243-b78a-81027cb1d995`, Worker deployment `482f26c4-f846-436d-bb42-73a798ffbe9d`, and Console deployment `d723685f-93d1-4720-a612-884cb4725cb3` are successful. Public HTTPS verification: `/api/auth/options` returns 200; all three `/api/channels/{provider}/callback` paths return 401 without an owner session and include `Referrer-Policy: no-referrer` and `Cache-Control: private, no-store`.
- X callback registration and live mellow verification remain pending until login. The prior 2026-09-25 X `@mellow_call` verification above is historical evidence, not a new verification.
- Next live steps: confirm the existing X app and add the exact callback; register Meta app credentials/callbacks; have the user log into mellow's intended accounts and approve scopes; verify returned account names/IDs and expirations on `/projects/mellow/channels`; click account verification only. Do not confirm a generation quote or enqueue/publish any post.
- References: [Meta Threads sample](https://github.com/fbsamples/threads_api), [Meta Threads token exchange](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api?entity=request-34203612-8b7aa817-ac4b-4493-aedf-5e8817727f81), [Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/), [X callback matching and PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code). Meta developer documentation required login or returned HTTP 429 during this session; end-to-end Meta verification is still a live gate.

## One-click generation refactor (2026-09-26, local implementation)

- Preserved the existing OAuth/account work. No schema migration or channel connection changes. Generation API accepts `{ "format": "text" }`; prompt, language and channel are optional with server-side defaults. Arbitrary extra actions and text-only Instagram requests remain rejected.
- Automatic estimates debounce input changes, invalidate immediately on edits and discard late responses. The visible generation button confirms a valid quote once; it never auto-confirms after refresh. Form controls lock after submission; interrupted/error jobs link back to the job list. The manual editor and advanced reference/channel/language controls remain available.
- Memory queries are workspace/product scoped: latest 20 published posts, 20 other posts and 20 selected in-flight/uncertain jobs. No provider calls or remote history import occur when collecting memory. Prompt memory is capped at 48,000 UTF-8 bytes; the estimate reserves that allowance plus 3,600 output tokens so newly saved history cannot silently expand the estimate. Local candidate comparison uses all fetched records even if prompt memory is trimmed.
- One OpenAI Structured Outputs request returns three candidates with title, caption, media instructions, topic, angle, key message and visual concept. The existing configured model remains unchanged. Captions and descriptors are compared locally after planning, under the product lock, and the chosen idea is saved before any media request. Concurrent workers must choose a different candidate or stop. If all candidates repeat prior material, generation stops before Higgsfield; the planning call may still incur a charge. There is no paid automatic retry.
- Version 2 is recorded in each new quote snapshot. Already queued older requests retain the one-candidate, 1,800-output-token path and original estimate. Generated posts retain their original product profile revision and require human review.
- Validation: 53 tests passed (45 existing + 8 generation cases), typecheck and production build passed. Tests cover optional inputs, quote reuse/no provider execution, fresh history after quoting, product/workspace isolation, cross-format repetition, stopping before media, concurrent candidate reservation, history size limits, and legacy queued requests. Browser verification uses a disposable local database and a mocked provider: blank-prompt generation reaches the completed review screen, a second identical request selects a different candidate, and switching to an unconfigured image provider disables generation. Final browser fixture recorded two mocked planning calls, two review posts and zero publication jobs; no actual paid call was made. The temporary database and servers were cleaned up.
- This section records local implementation and verification, not a new production deployment. The earlier media pricing/CDN setup gates remain in effect.
- OpenAI schema checked against [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), including strict objects and fixed-size candidate arrays.


## Authorized live mellow text test (2026-09-26)

- The user explicitly requested one real mellow text generation after the prior no-paid-generation restriction was explained. Authorization applies to this text test; no media generation or SNS publication was requested.
- Deployed the tested generation refactor in compatibility order: Worker `5006d02f-0a19-48c6-917e-d3040dab561f`, API `c84bc4ec-8bcd-4c7c-a40d-a3c2511c2af7`, Console `3a461b0b-b99b-466b-8065-a7133444701f`; all returned SUCCESS. Runtime worker readiness and the Console auth-options endpoint were checked. No schema migration or credential/account changes were made.
- The in-app browser was logged out, but an existing Chrome operator session was valid. Used that session without a new login, OAuth consent, session fabrication or credential changes.
- Verified mellow profile revision 2, its repository-backed facts, the existing no-publish test draft, configured OpenAI key/model (`gpt-4o-mini`) and rates. Selected **글**, Korean/Threads defaults, empty prompt and no reference image. The UI displayed an estimated **USD 0.0103**; confirmed generation exactly once.
- The production worker completed the real OpenAI request and the UI opened [the generated review post](https://console.nullge.com/projects/mellow/marketing/f89060a3-562c-4233-bcc5-52e6a8aea374). Title: **매일 외국어 대화, Mellow와 함께 쉽고 자연스럽게!** The caption is 124 Unicode characters. The original no-publish draft was not edited. No media, approval or publish action was taken; no generation retry was performed. USD 0.0103 is the quote, not a verified billed amount.
- Quality observation: the raw output says “링크 클릭!” but omits the actual URL. It also remains a broad product introduction with themes similar to the prior draft; this single test demonstrates the generation/save flow, not a guarantee of semantic uniqueness. The generated original is preserved for review. Future planner improvements should require an actual verified URL for link CTAs and strengthen angle selection against manual drafts without descriptors.

Generated caption (preserved verbatim):

> 일상 속 영어, 일본어, 중국어, 스페인어 연습, 잊지 마세요! AI 캐릭터와의 음성 통화로 부담없이 대화해보세요. 대화 후 리포트로 표현도 복습하고, 자신감을 높여보세요. 링크 클릭! #외국어회화 #AI연습 #Mellow

## Shared settings UI simplification (2026-09-26)

- Removed explanatory copy from the shared settings page. OpenAI and Higgsfield keys use compact labeled rows with registration status; SNS app credentials and model/pricing fields are collapsed by default. Necessary validation errors, save results, units and callback URLs remain available.
- Preserved the existing settings API, encryption, optimistic revision checks and staged key removal. Saving is disabled until a value changes; OpenAI verification is disabled while its key/model has unsaved changes. Invalid fields inside a closed section reveal that section before browser validation focuses them.
- Instagram/Threads app credentials are not needed for content generation. They are shared workspace settings for the corresponding OAuth/account and publishing integration; each product still connects its own SNS account separately. No app credentials or product account connections were changed.
- Validation: Console production build passed. A disposable local browser fixture verified collapsed defaults, staged removal/cancellation, unchanged-key preservation and pricing persistence after reload. Desktop layout and a 390px viewport were checked, with no horizontal overflow. Fixture cleanup recorded zero provider calls, zero posts and zero publications. No real API verification, paid generation or SNS publishing was performed.
- Console-only production deployment `509fb197-06f0-4d26-92f5-c956a42f5714` returned SUCCESS. `/settings` and `/api/auth/options` returned HTTP 200. The available Chrome session showed the operator login screen, so authenticated interaction testing remained on the local disposable fixture; no new login was requested for this UI change. API and worker deployments were unchanged.

## Settings production verification follow-up (2026-09-26)

- Resumed the latest settings-page handoff. The stale Console tab initially showed the earlier content editor, but navigation confirmed its session had expired. Normal Google sign-in with the existing operator account restored access without entering credentials or granting new permissions.
- Authenticated `/settings` displays the deployed compact OpenAI/Higgsfield rows, configured statuses and masked placeholders. SNS apps and model/pricing sections start collapsed, expand correctly and were returned to their collapsed state. Save stays disabled without edits.
- The settings UI reports OpenAI, Higgsfield and X app credentials as registered; Instagram and Threads app credentials remain unregistered. All three displayed callback URLs match the documented Console routes. The model is `gpt-4o-mini`, configured input/output rates are USD 0.15/0.60 per million tokens, and media rates remain unset. This checks displayed configuration, not provider connectivity or billing rates.
- Visually checked the live desktop layout and a 390 × 844 mobile viewport. Mobile document width was exactly 390px with no horizontal overflow. Restored the default browser viewport afterward.
- Reran `pnpm test`: all 53 tests passed across five files using disposable local databases. `pnpm typecheck` passed for the workspace.
- No settings were edited or saved, and no provider verification, paid generation or publication was invoked. No application code change or deployment was needed. The prior local fixture remains the evidence for save, removal/cancellation and persistence behavior.

## Facebook support report and Buffer onboarding (2026-09-26)

- At the user's explicit request, submitted a Facebook “Report a problem” report about Meta for Developers registration being blocked for weeks at Contact info after email-code submission with the unfamiliar-device warning. Included reproduction steps and requested a review of security/registration state and official verification guidance. The UI confirmed “의견이 제출되었습니다.” No ticket number or resolution was shown.
- Declined optional full diagnostic logs and removed the unrelated automatically attached Facebook home screenshot. No email verification code, secret or user-supplied screenshot was included in the report.
- Opened Buffer's channel-management entry point; it redirected to the Buffer login page. Requested user login or free signup/email verification, consistent with the user's instruction to handle login and consent personally. No Buffer account or SNS channel is connected yet, and no paid plan, generated content or publication was created.
- Nullge's existing direct-provider connections are unchanged. Buffer channel setup and any Console integration remain pending the user login and authorization steps.

## Buffer API integration (2026-09-26)

- Added one encrypted workspace-level Buffer API key and product-specific Buffer channel mappings. A Buffer channel can be assigned independently to each Nullge product and SNS type; changing direct Meta/X app credentials does not remove Buffer mappings, while rotating or clearing the Buffer key invalidates all Buffer mappings.
- The Console lists usable Buffer Publish channels and records only the selected channel ID in each product connection. Disconnected, locked and unsupported channels are excluded. Secrets remain server-side and are never returned by the settings or connection APIs.
- Existing review and approval gates remain mandatory. Approved posts use Buffer's `shareNow` mode only after the operator explicitly requests publication. The worker records the remote post ID before polling, does not repeat an uncertain create request, and stops after 30 minutes for manual reconciliation.
- Added additive migration `BufferPublishing1790455200000`, which marks each connection as `direct` or `buffer` without modifying existing encrypted credentials or post data.
- Local validation: all 56 tests pass, including Buffer key redaction, channel listing/mapping, product isolation, preservation across direct OAuth setting changes, read-only verification, one mocked create request and polling without duplicate submission. Typecheck and production build pass. All Buffer responses were mocked; no live API key was created, no paid content was generated and no SNS post was published.
- Live Buffer API key creation and storage require the user's final confirmation because the key grants access to the Buffer account's organizations and channels. After that confirmation, connect and verify only the existing `mellow.call` Instagram channel; do not enqueue a post.
- Production deployment completed in schema-first order: API `b53cbac5-b821-4314-af05-e8752265e55a`, Worker `43d323d5-519c-4147-84e7-5f1befc5056f`, Console `b6181250-e9dd-48b7-922e-c2b958834d94`; all returned SUCCESS. API logs confirmed migrations and readiness, Worker readiness states automatic publishing is disabled, `/api/auth/options` returned 200, and the unauthenticated Buffer-channel endpoint returned 401.
- Buffer's API page currently requires email verification before key creation. A verification email was resent and Buffer confirmed delivery. The user must open the verification link because login and consent remain user-controlled; no API key exists yet.

## Buffer key registration follow-up (2026-09-26)

- The user completed email verification and explicitly approved key creation, encrypted storage in Nullge, and the mellow Instagram mapping. Buffer issued one personal key named `Nullge Marketing Console`, with the default 30-day expiration shown as 2026-10-26. Kept only `account:read`, `posts:read` and `posts:write`; deselected account-write, ideas, insights and engagement permissions.
- Saved the key through the authenticated Nullge settings UI. The UI confirmed `저장했습니다.` and Buffer `등록됨`. No key value was printed or written to a local file. Existing OpenAI/Higgsfield settings were retained.
- Product mapping and live API verification remain incomplete: Chrome automation lost its debugger connection after key storage; existing-tab recovery, a fresh tab and native Chrome access failed. The Railway SSH fallback also reported no registered SSH keys, and no new SSH access was created. Resume on `/projects/mellow/channels`, select the existing Buffer Instagram channel `mellow.call`, connect it to mellow, and use account verification only. Do not generate another key or enqueue any post.
- No paid generation, Buffer post creation or SNS publication was performed.

## Manual image upload (2026-09-26)

- Native Chrome interaction recovered the authenticated console session. The existing Buffer Instagram channel `mellow.call` was mapped to mellow and verified through Nullge. Connection and verification were confirmed at 13:54:45 and 13:55:01 KST, respectively. X and Threads connections were preserved.
- The user clarified that the Instagram test must originate in Nullge and explicitly requested uploading the existing mellow image into the service. A Buffer composer had an unsaved image/caption, but no schedule or publication action was submitted. Do not use that composer to complete the Nullge API test.
- Added PNG/JPEG attachment, preview and replacement to the manual content editor (5 MB maximum). Saving the post and its asset is atomic; invalid ownership/revision or publication locks roll back any new asset. Replacing media clears approval, while text-only edits retain the existing attachment.
- Additive migration `UploadedAssets1790460000000` allows assets without a generation job. Existing generated assets and posts remain intact. Uploads are decoded, constrained to 20 million pixels, stripped of metadata, fitted inside 2160 × 2160 without enlargement, and saved as JPEG for the publishing API. Only post create/update requests receive the larger 7 MB JSON allowance.
- The worker snapshots whether an asset came from a generation job and passes this to Buffer's Instagram AI-media flag; the existing branded upload is not labeled as an AI-generated image. Signed asset URLs, publication confirmation and duplicate-submission protection remain in place.
- Validation: 62 tests passed across seven files, workspace typecheck and production build passed. Tests cover upload persistence, malformed and oversized inputs, product/workspace isolation, approval invalidation, stale/concurrent edits, publication locks and one mocked Buffer API image submission. No paid generation or live publication was invoked by these tests.
- Production deployment succeeded: API `3c23bdf0-7f8c-4038-b48f-d9a91f5d0a87`, Worker `41a94323-73cd-4d44-b298-264230ef41d3`, Console `165b4f5d-53f7-4bc1-b079-4048c351c70c`. API logs confirmed migration application and readiness. The live manual editor displays the image input.
- Rechecked mellow profile revision 2 against its repository README, character catalog and brand asset README, then marked the existing profile reviewed without changing its fields. Created draft `9a92d122-f11f-46f3-87f1-24a874014633` with the prepared title/caption. Channel selection and attachment were not yet saved when Chrome control was interrupted; the intermediate draft is still X/text and must be changed to Instagram/image before any publication.
- Resume follow-up: recovered the existing authenticated Chrome session without another login. Saved the same draft with channel **Instagram** and confirmed the publish destination `@mellow.call`. Image upload remains pending: Chrome file-chooser automation returned `Not allowed`, and the native picker kept Open disabled for the selected valid PNG. Cancelled the picker without attaching any file. The browser upload guide requires enabling the ChatGPT extension's **Allow access to file URLs**; browser security policy blocks automated navigation to `chrome://extensions`, so no alternate settings surface was attempted. Requested the user to enable that setting themselves or attach the image in the console. No permissions were changed, no image was stored and no publication was requested in this follow-up.
