# kaamelott-app — notes for Claude

Mobile-first web frontend (Vite + React 19 + TypeScript 7) for the Kaamelott quotes API in the
sibling repo `../kaamelott-lambda` (GitHub: GuillaumeGSO/kaamelott-lambda). It replaces an Anvil app
("Kaamelott Citations") that isn't phone-friendly and can't carry ads.

Goal: PWA first, ready for Google AdSense, later wrapped as a native app (Capacitor + AdMob).
Character pictures are initials badges on purpose: no Wikipedia photos (copyright risk with ads).

The full approved plan (decisions, architecture, steps, verification) is in `docs/PLAN.md`.

## Architecture

```
browser ──► CloudFront (infra/, one distribution per env)
             ├─ /*  → private S3 bucket (OAC), SPA rewrite via CloudFront Function
             ├─ /quotes/all (cached 1 day) /quotes/likes (cached 5 min)
             └─ /quotes/* /favorites /favorites/*  (not cached)
                    → API Gateway (origin path /<stage>) + origin header x-api-key
```
- The API key never reaches the browser. It's the dedicated `kaamelott-web-<env>` key, whose
  value lives in Secrets Manager as `kaamelott-web-api-key-<env>` (created by kaamelott-lambda),
  with its own usage plan (staging 1,000/day, prod 5,000/day, 20 rps, burst 40).
- Cost: API Gateway REST is billed per call, so the app loads data once and works in the browser.
  At startup: `/quotes/all` (every quote, ~100 KB compressed) and `/quotes/likes` (counts), both
  cached by CloudFront (`CACHED_API_PATHS` in `infra/lib/web-stack.ts`), plus `GET /favorites?alias=`
  once per pseudo. `src/quoteDeck.ts` shuffles once and deals the next quote matching the filters
  (character, favorites). Only like/unlike calls the API afterwards. A visit is ~2 API calls.
  Don't go back to per-quote endpoints (`/quotes/random`, `/by-character`, `/by-favorites`,
  `/favorites/status`): they still exist for other clients, not for this app.
- Quotes reload: kaamelott-lambda's `load-quotes` publishes `QuotesReloaded` on the account's default
  EventBridge bus (`source: kaamelott.quotes`, `detail: {environment, count}`; schema in its README).
  `infra/lib/web-stack.ts` has a rule (filtered on its own environment: staging and prod share the bus)
  and a small Lambda that invalidates `/quotes/all`. The API doesn't know about the site: keep it that
  way (no site stack name or distribution id in kaamelott-lambda). Browsers still keep `/quotes/all` 1 h.
- Favorites without a pseudo = quotes liked by anyone (like count > 0), as in the original app.
- Dev server: `vite.config.ts` proxies the same paths and adds `KAAMELOTT_API_KEY` (see README).
- Don't use CloudFront custom error responses for SPA routing: they would also turn the API's
  404s ("no favorites found") into index.html. The CloudFront Function handles it instead.

## Design (Parchemin)

Chosen with the user on a Claude Design canvas: https://claude.ai/artifact/3qLd1T6gawMww9so1RsPSY
(the green "Décisions retenues" sticky lists the decisions). Day = parchment, serif, oxblood;
night = warm near-black, brick red.
- All colors are tokens in `src/index.css`. Night tokens are written twice on purpose: under
  `prefers-color-scheme: dark` (unless `data-theme="light"`) and under `[data-theme="dark"]`.
- Day/night: `src/theme.ts` ("auto" follows the phone; "light"/"dark" set `data-theme` on `<html>`,
  stored as `kaamelott.theme`). An inline script in `index.html` applies it before first paint: allow
  it if a Content Security Policy is ever added.
- Header has one button, opening `src/components/Preferences.tsx`: a native `<dialog>` bottom sheet
  with character search (most quoted first), pseudo, favorites switch and Apparence (Auto/Jour/Nuit).
  Closing it fetches a new quote only if the character or favorites filter changed.
- Character badges use a fixed 6-color palette per theme (`--badge-0..5`), never random hues and never
  the accent: other hues clash with the parchment.
- The footer credits Wikiquote (source of the quotes, CC BY-SA 4.0: source link + license link are
  required). Keep it on every screen, including a future native app.
- No photos of the actors or stills from the show (copyright, actors' image rights, ads = commercial use).
- Pictures come only from official YouTube uploads: a quote's clip (official Kaamelott channel) shows
  its thumbnail (`i.ytimg.com/vi/<id>/mqdefault.jpg`, player loaded on tap). Film quotes have no clip:
  `TRAILERS` in `src/components/QuoteCard.tsx` maps a film to its trailer, from @KaamelottOfficiel only
  (the user's rule): Premier Volet has only a teaser there. No change needed in kaamelott-lambda.
- Fonts (Cormorant Garamond, Source Sans 3) are self-hosted with `@fontsource`, latin subset: no
  request to Google Fonts (privacy, ad consent).

## AWS

- Account `kaamelott` 022153972216, region eu-west-3, local profile `kaamelott`
  (SSO session `org`; run `aws sso login --sso-session org` when the token expires).
- API Gateway: REST APIs `kaamelott-api-<env>`, stage `<env>`. No API URL is committed (code,
  docs, `.env.example`): `infra/bin/app.ts` looks the API up by name at synth time (needs AWS
  credentials), and the dev server reads `KAAMELOTT_API_URL` from the gitignored `.env`.
- The account is CDK-bootstrapped. The GitHub OIDC provider already exists.
- Prod API still has the old quotes (`actor` instead of `actorName`, no YouTube fields) until the
  user promotes them. Don't deploy the frontend to prod before that, and don't promote prod
  quotes without the user's go-ahead.

## Status (2026-11-08)

Done:
1. kaamelott-lambda PR #4 merged: web API key + secret + usage plan (200 with key, 403 without).
2. This repo, initial commit pushed: API client (`src/api/client.ts`), quote queue
   (since replaced by `src/quoteDeck.ts`, see 5b), UI (`src/App.tsx`, `src/components/`), 23 tests (Vitest).
   Checked in Chrome at phone width against staging: quotes, filters, like/unlike,
   favorites, "Rien trouvé".
3. `infra/` CDK stack (`infra/lib/web-stack.ts`).
3b. Parchemin redesign (see Design), PR #1 merged. 29 tests; checked in Chrome at phone width
   against staging, both themes. GitHub `main` was force-pushed (2026-11-06) to the clean local
   history: no published commit contains the API URL any more.
4. First staging deploy from local (2026-11-06): stack `kaamelott-app-staging`, SiteUrl
   https://dyo7vpnvn9omi.cloudfront.net. Redeploy: `npm run build`, then in `infra/`:
   `AWS_PROFILE=kaamelott npx cdk deploy --context env=staging` (not `--profile`: it isn't
   passed on to the CDK app, which needs credentials to look up the API). Checked: page and SPA
   routes load, `/characters` 200 without a key, no `x-api-key` in `dist/`, a 404 from
   `/quotes/by-favorites?character=Zzznobody` stays JSON.
5. CI (PR #2 merged): `.github/workflows/test.yml` (every push: lint, test, build, infra
   typecheck) and `deploy-staging.yml` (manual, `environment: staging`, OIDC). First GitHub deploy
   green on 2026-11-06, site rechecked. IAM role `kaamelott-app-github-deploy-staging` may assume
   the `cdk-hnb659fds-{deploy,file-publishing,lookup}-role-022153972216-eu-west-3` roles and
   `apigateway:GET` on `/restapis` (`infra/bin/app.ts` looks the API up with the role's own
   credentials, not the lookup role). The backend role `kaamelott-github-deploy-staging` got the
   same trust fix; its GitHub deploy was rerun on 2026-11-06 and is green.
5b. Cost cut (2026-11-06): quotes loaded once, edge-cached (see Architecture). Merged in both
   repos (kaamelott-lambda `/quotes/all`, `/quotes/likes`, `GET /favorites`, web quota, since lowered:
   see Architecture; this repo PR #3) and deployed to staging. Curl-checked (CloudFront Miss
   then Hit, quotes 382 KB → 97 KB Brotli), then checked in Chrome on 2026-11-08. Before prod: deploy the
   backend first (the new site needs the new endpoints; the old site works with either backend).
5c. Pact contract tests (see README), merged in both repos (2026-11-07). The API's Pact verify
   is green on `main` against the site's `main` contract (its first push run failed as expected:
   the API was merged before the site, so there was no contract on the site's `main` yet).
5d. Quick wins from the project review (`../kaamelott-project-review.md`), 2026-11-08, merged and
   deployed to staging only:
   - kaamelott-lambda #12: CloudWatch alarms (API 5XX, 80% of the web quota) emailed through SNS.
     The address is the `ALARM_EMAIL` repo secret (never committed); test with `set-alarm-state`.
     Budgets and cost anomaly alerts live in the management account (Organization level).
   - kaamelott-lambda #13: every Lambda on arm64. Node 26: the user tracks its GA themselves.
   - kaamelott-lambda #14 + this repo #6: reloaded quotes are served (no Lambda cache, consistent
     read, retried writes) and `QuotesReloaded` invalidates the site's `/quotes/all` (see
     Architecture). Checked end to end: event seen in EventBridge, fresh quotes in Chrome. A Copilot
     autofix on #6 also filters the rule on `account` and `region`.

Next steps:
5e. Remaining quick wins, on staging: a README "Design decisions and limits" section, then a
   Playwright smoke test, then a per-IP rate limit (AWS WAF on CloudFront; to design: pay-as-you-go
   ~$6/month per env vs a CloudFront flat-rate plan, and a CloudFront web ACL lives in us-east-1).
   Prod is deployed only once all of this is done on staging (the user's
   call): backend first, locally with `export ALARM_EMAIL=...`, then confirm the new subscription.
6. PWA (`vite-plugin-pwa`: manifest, icons, service worker caching the app shell only, never API
   calls), an `<AdSlot>` placeholder component (`VITE_ADSENSE_CLIENT`, empty = no ads, no ad script
   before consent), and a `/confidentialite` privacy page.
7. Later, needs the user: a domain (AdSense requires one), AdSense application and consent
   message, then prod, then Capacitor + AdMob.

## Gotchas

- TypeScript is 7 (native): ts-node doesn't work, so the CDK app runs with `tsx` (`infra/cdk.json`).
  Typecheck infra with `./node_modules/.bin/tsc -p infra` from the repo root.
- `infra/` is its own npm package (CDK deps kept out of the app). Run `npm install` in both.
- Ask before every deploy, staging included (local `cdk deploy` or a GitHub deploy run).
- Pact (README, Contract tests): changing an API call means updating `src/api/client.pact.ts`,
  running `npm run pact:publish` and committing `pacts/` (CI fails otherwise). kaamelott-lambda
  verifies it (`npm run pact:verify`): from the site's `main`, plus a same-named site branch. Both
  Deploy staging workflows run the check first; a real Pact Broker / `can-i-deploy` is out of scope.
- App tests mock `Math.random` to 0.9999 (`src/App.test.tsx`): the deck then keeps the API order.
- The user's shell is zsh: don't name a loop variable `path` (it's tied to `$PATH`).
- The Chrome window can't be resized (full screen). To test at phone width, load the app in a
  390px-wide iframe on the same origin.
- Like/unlike tests against staging write real favorites: use a test pseudo and remove the like.
- jsdom has `<dialog>` but no `showModal`/`close`: `src/test/setup.ts` adds minimal versions.
- The user may already have a dev server on port 5173: use another port, don't kill theirs.
- GitHub OIDC tokens use immutable subjects on both repos: `sub` is
  `repo:GuillaumeGSO@35000004/<repo>@<repo id>:environment:<env>` (prefix from
  `gh api repos/GuillaumeGSO/<repo>/actions/oidc/customization/sub`), not `repo:GuillaumeGSO/<repo>:...`.
  IAM trust policies list both forms. Auto mode blocks IAM changes: give the user the commands.
- In zsh, `$1:e` is a modifier (extension): write `${1}:environment` in heredocs.
- Commit messages end with the Co-Authored-By line; the user approves commits and pushes.
