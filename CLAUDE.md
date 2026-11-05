# kaamelott-app — notes for Claude

Mobile-first web frontend (Vite + React 19 + TypeScript 7) for the Kaamelott quotes API in the
sibling repo `../kamelott-lambda` (GitHub: GuillaumeGSO/kamelott-lambda). It replaces an Anvil app
("Kamelott Citations") that isn't phone-friendly and can't carry ads.

Goal: PWA first, ready for Google AdSense, later wrapped as a native app (Capacitor + AdMob).
Character pictures are initials badges on purpose: no Wikipedia photos (copyright risk with ads).

The full approved plan (decisions, architecture, steps, verification) is in `docs/PLAN.md`.

## Architecture

```
browser ──► CloudFront (infra/, one distribution per env)
             ├─ /*  → private S3 bucket (OAC), SPA rewrite via CloudFront Function
             └─ /quotes/* /characters /favorites /favorites/*
                    → API Gateway (origin path /<stage>) + origin header x-api-key
```
- The API key never reaches the browser. It's the dedicated `kaamelott-web-<env>` key, whose
  value lives in Secrets Manager as `kaamelott-web-api-key-<env>` (created by kamelott-lambda),
  with its own usage plan (50k/day, 20 rps, burst 40).
- Dev server: `vite.config.ts` proxies the same paths and adds `KAAMELOTT_API_KEY` (see README).
- Don't use CloudFront custom error responses for SPA routing: they would also turn the API's
  404s ("no favorites found") into index.html. The CloudFront Function handles it instead.

## AWS

- Account `kaamelott` 022153972216, region eu-west-3, local profile `kaamelott`
  (SSO session `org`; run `aws sso login --sso-session org` when the token expires).
- API Gateway: staging `<api-id>…/staging`, prod `<api-id>…/prod` (see `infra/bin/app.ts`).
- The account is CDK-bootstrapped. The GitHub OIDC provider already exists.
- Prod API still has the old quotes (`actor` instead of `actorName`, no YouTube fields) until the
  user promotes them. Don't deploy the frontend to prod before that, and don't promote prod
  quotes without the user's go-ahead.

## Status (2026-11-05)

Done:
1. kamelott-lambda branch `web-api-key`, **PR #4 open**: web API key + secret + usage plan.
   Already deployed to staging from that branch; works (200 with key, 403 without).
   Still needs merging into main.
2. This repo, initial commit pushed: API client (`src/api/client.ts`), quote queue
   (`src/quoteQueue.ts`), UI (`src/App.tsx`, `src/components/`), 23 tests (Vitest).
   Checked in Chrome at phone width against staging: quotes, filters, like/unlike,
   favorites, "Rien trouvé".
3. `infra/` CDK stack written (`infra/lib/web-stack.ts`), typechecks and synthesizes. **Not deployed yet.**

Next steps:
4. First deploy from local: `npm run build`, then in `infra/`:
   `npx cdk deploy --context env=staging --profile kaamelott`. Check the SiteUrl output:
   page loads, `curl <url>/characters` returns 200 without a key, `grep -r x-api-key dist/` is empty,
   and a 404 from `/quotes/by-favorites` stays JSON (not HTML).
5. CI: `.github/workflows/test.yml` (on every push: `npm ci`, lint, test, build) and
   `deploy-staging.yml` (manual, `environment: staging`, OIDC). Copy the patterns from
   `../kamelott-lambda/.github/workflows/`. Needs an IAM role `kaamelott-app-github-deploy-staging`
   trusted for `repo:GuillaumeGSO/kaamelott-app:environment:staging`, allowed to assume the
   `cdk-hnb659fds-{deploy,file-publishing,lookup}-role-022153972216-eu-west-3` roles.
   Auto mode blocks IAM permission grants: give the user the command to run.
6. PWA (`vite-plugin-pwa`: manifest, icons, service worker caching the app shell only, never API
   calls), an `<AdSlot>` placeholder component (`VITE_ADSENSE_CLIENT`, empty = no ads, no ad script
   before consent), and a `/confidentialite` privacy page.
7. Later, needs the user: a domain (AdSense requires one), AdSense application and consent
   message, then prod, then Capacitor + AdMob.

## Gotchas

- TypeScript is 7 (native): ts-node doesn't work, so the CDK app runs with `tsx` (`infra/cdk.json`).
  Typecheck infra with `./node_modules/.bin/tsc -p infra` from the repo root.
- `infra/` is its own npm package (CDK deps kept out of the app). Run `npm install` in both.
- The user's shell is zsh: don't name a loop variable `path` (it's tied to `$PATH`).
- The Chrome window can't be resized (full screen). To test at phone width, load the app in a
  390px-wide iframe on the same origin.
- Like/unlike tests against staging write real favorites: use a test pseudo and remove the like.
- Commit messages end with the Co-Authored-By line; the user approves commits and pushes.
