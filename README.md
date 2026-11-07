# Kaamelott App

Mobile-first web app for quotes from the French series [Kaamelott](https://fr.wikipedia.org/wiki/Kaamelott): a random quote, a quote from one character, or one from your favorites. You can like quotes with a pseudo and watch the scene on YouTube. Day and night themes follow your phone, or your own choice.

Quotes come from [Wikiquote](https://fr.wikiquote.org/wiki/Kaamelott) (CC BY-SA 4.0); the app credits it on every page.

Built with Vite, React and TypeScript. It's the frontend of the API in [kaamelott-lambda](https://github.com/GuillaumeGSO/kaamelott-lambda).

## How it talks to the API

The app calls the API on its own origin (`/quotes/*`, `/favorites`). The API key is **never** in the browser:

- **In production**, CloudFront serves the site and forwards those paths to API Gateway, adding the `x-api-key` header. The key is the dedicated `kaamelott-web-<env>` key, stored in Secrets Manager as `kaamelott-web-api-key-<env>`.
- **In development**, the Vite dev server proxies the same paths and adds the key from the `KAAMELOTT_API_KEY` environment variable.

To keep API calls (and the bill) low, the app loads every quote once (`/quotes/all`, about 100 KB compressed) and the like counts (`/quotes/likes`). It then picks random quotes and applies the character and favorites filters in the browser. CloudFront caches both responses (1 day and 5 minutes), so most visits never reach the API. A pseudo's likes come from one `GET /favorites?alias=` call. After that, only liking or unliking calls the API.

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
