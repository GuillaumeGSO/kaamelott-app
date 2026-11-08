# Kaamelott App

Mobile-first web app for quotes from the French series [Kaamelott](https://fr.wikipedia.org/wiki/Kaamelott): a random quote, a quote from one character, or one from your favorites. You can like quotes with a pseudo and watch the scene on YouTube. Day and night themes follow your phone, or your own choice.

Quotes come from [Wikiquote](https://fr.wikiquote.org/wiki/Kaamelott) (CC BY-SA 4.0); the app credits it on every page.

Built with Vite, React and TypeScript. It's the frontend of the API in [kaamelott-lambda](https://github.com/GuillaumeGSO/kaamelott-lambda).

## How it talks to the API

The app calls the API on its own origin (`/quotes/*`, `/favorites`). The API key is **never** in the browser:

- **In production**, CloudFront serves the site and forwards those paths to API Gateway, adding the `x-api-key` header. The key is the dedicated `kaamelott-web-<env>` key, stored in Secrets Manager as `kaamelott-web-api-key-<env>`.
- **In development**, the Vite dev server proxies the same paths and adds the key from the `KAAMELOTT_API_KEY` environment variable.

To keep API calls (and the bill) low, the app loads every quote once (`/quotes/all`, about 100 KB compressed) and the like counts (`/quotes/likes`). It then picks random quotes and applies the character and favorites filters in the browser. CloudFront caches both responses, so most visits never reach the API. A pseudo's likes come from one `GET /favorites?alias=` call. After that, only liking or unliking calls the API.

## Design decisions and limits

This is a first version (MVP): 1,028 quotes, no users yet. It's built to be cheap to run and simple to change, not for traffic it doesn't have. Each choice below says why it fits now, where it stops fitting, and the likely next step. None of those next steps is built ahead of time: they're the way forward once real usage shows which limit comes first.

### Load every quote once, filter in the browser

- **Why:** API Gateway REST is billed per call. One cached `/quotes/all` instead of one call per quote brings a visit down to about 2 API calls. Picking and filtering 1,000 quotes in the browser takes microseconds.
- **Limit:** the payload grows with the catalogue: 424 KB raw (~97 KB Brotli) today, ~4 MB at 10,000 quotes (slow first load on a phone). It fails hard at about 14,500 quotes: a Lambda's synchronous response can't exceed 6 MB, and it isn't compressed until CloudFront.
- **Next:** past 2,000–3,000 quotes, publish the quotes as a content-hashed static file in S3 (`quotes.<hash>.json`, cached forever). That takes Lambda, API Gateway, DynamoDB reads and the 6 MB limit out of the path. Beyond that: a small index plus quote chunks, kept on the device in IndexedDB.

### Caching, and how a reload gets through

| Layer | Keeps `/quotes/all` | Refreshed by |
|---|---|---|
| Lambda (`get-all-quotes`) | nothing | — (it reads DynamoDB with a consistent read every time) |
| CloudFront | 1 day, per edge region | `QuotesReloaded` → invalidation of `/quotes/all` |
| Browser | 1 hour (`max-age=3600`) | time only |

`/quotes/likes` is cached 5 minutes in CloudFront only: a visitor's own likes update locally.

When kaamelott-lambda reloads the quotes, it publishes `QuotesReloaded` on the account's default EventBridge bus (schema in its README). This stack has a rule, filtered on its own environment, and a small Lambda that invalidates `/quotes/all`. The API doesn't know the site exists: no distribution id or stack name on its side.

- **Why an event:** the first version invalidated from the API's deploy workflow, which tied the API to this site's stack and IAM. With the event, a second site or a native app just adds its own rule.
- **Limit:** a visitor can see the old quotes for up to an hour after a reload. Nothing alerts if the invalidation Lambda fails (Lambda retries it twice, then it's only in its logs): an alarm here would mean sharing the API's alarm topic.

### The API key stays at the edge

- **Why:** CloudFront adds `x-api-key` when it forwards the API paths. The key lives in Secrets Manager, and the site has its own usage plan (staging 1,000 calls a day, prod 5,000; 20 requests/s, burst 40). Nothing in the bundle to steal.
- **Limit:** the key protects the quota, not the data: anyone can call the site's own `/quotes/*` and `/favorites` paths. The quota is shared by every visitor, so one script making uncached calls (likes) can use it up and break the site for everyone until midnight UTC. An alarm emails at 80%.
- **Next, before prod** (the one limit not left for later): AWS WAF on CloudFront with a per-IP rate rule, so one caller can't use up everyone's quota.

### A pseudo instead of accounts

- **Why:** no sign-up, no personal data, the same behaviour as the original app.
- **Limit:** a pseudo is free text. Anyone can read anyone's favorites, like on someone else's behalf, or inflate like counts by switching pseudos. Like counts are a hint, not a metric.
- **Next:** real accounts (for example Cognito) only if likes start to matter.

### Smaller choices

- **SPA routing with a CloudFront Function**, not custom error responses: those would also turn the API's JSON 404s into `index.html`.
- **Pact without a broker:** the contract is a committed file, and kaamelott-lambda verifies it from this repo's `main`. Enough for two repos and one developer; a broker and `can-i-deploy` would come with more teams.
- **Initials badges and official YouTube thumbnails only:** no photos of the actors or stills from the show, because the site is meant to carry ads (copyright and image rights).

### Known gaps, fine for an MVP

- **Like counts read every like.** `/quotes/likes` scans the favorites table (one row per pseudo and liked quote) and counts in the Lambda. The response stays small, but the read grows with the number of likes: negligible below ~100,000, too slow around a million. The fix would be a counter per quote, updated with each like.
- **A reload never deletes a quote** that was removed from the source file.
- **No end-to-end test** (Playwright) and no front-end error tracking yet.
- **Not live in prod yet:** prod still has the old quote format.

## Development

Prerequisites: Node.js 24+, and the AWS CLI with the `kaamelott` SSO profile (to read the staging key).

```bash
npm install
cp .env.example .env   # then fill in KAAMELOTT_API_URL and KAAMELOTT_API_KEY (the file says how)
npm run dev
```

`.env` is gitignored and holds the API URL and key: neither is committed. Its variables have no `VITE_` prefix, so they stay in the dev server and never reach the bundle.

```bash
npm test        # Vitest + Testing Library
npm run lint    # oxlint
npm run build   # type-check and production build in dist/
```

## Contract tests (Pact)

The site and the API live in two repos. [Pact](https://docs.pact.io/) checks that they still agree. The site is the **consumer**: it writes a contract, the list of requests it sends and the response shapes it relies on. The API ([kaamelott-lambda](https://github.com/GuillaumeGSO/kaamelott-lambda)) is the **provider**: it verifies that contract against its real handlers. There's no Pact Broker: the contract is a committed file, read from GitHub.

- `src/api/client.pact.ts` runs the real client functions against Pact's mock server, one interaction per API call.
- `npm run pact:publish` runs it and writes `pacts/kaamelott-app-kaamelott-lambda.json`. It's kept out of `npm test`.
- **Commit `pacts/` whenever it changes.** The Tests workflow regenerates it and fails if the committed copy differs.
- kaamelott-lambda's **Pact verify** workflow checks the contract on this repo's `main`, and the one on a site branch with the same name as the API branch. Work on same-named branches in both repos to get them verified together.
- **Deploy staging** first checks that the API on `main` honours the contract about to be deployed (the equivalent of Pact's `can-i-deploy`).

To check a contract change locally against a local API checkout:

```bash
npm run pact:publish
cd ../kaamelott-lambda
PACT_URLS=../kaamelott-app/pacts/kaamelott-app-kaamelott-lambda.json npm run pact:verify
```

## Deploy

The site is a CDK stack in `infra/` (its own npm package): a private S3 bucket behind CloudFront, which also forwards the API paths with the key. One stack per environment, `kaamelott-app-<env>`.

### Staging from GitHub

Actions → **Deploy staging** → **Run workflow** runs lint, tests, the Pact check and the build, then `cdk deploy kaamelott-app-staging`. Every push also runs the **Tests** workflow (lint, tests, build, infra typecheck).

The workflow authenticates with GitHub OIDC (no stored AWS keys). It assumes the `kaamelott-app-github-deploy-staging` IAM role, which trusts only this repo's `staging` GitHub environment and may only use the CDK bootstrap roles and list the REST APIs (to find `kaamelott-api-<env>` by name).

### From your machine

```bash
npm run build
cd infra && npm install
AWS_PROFILE=kaamelott npx cdk deploy --context env=staging
```

Use `AWS_PROFILE`, not `--profile`: the CDK app looks the API up by name and `--profile` isn't passed on to it. Prod waits until its quotes are promoted (see `kaamelott-lambda`).
