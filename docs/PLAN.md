# kaamelott-app — mobile-friendly Kaamelott quotes frontend with Google ads

> Plan approved on 2026-11-05. Progress is marked in **Order of work** (✅ done, ⏳ in progress). Implementation notes and gotchas are in `CLAUDE.md`.

## Context
Today's frontend is an Anvil app ("Kaamelott Citations", app YOJZWX7ZCPQGTC6I). It isn't phone-friendly and can't carry Google ads. The goal is a new public repo, **GuillaumeGSO/kaamelott-app**, holding a web frontend that is mobile-first and installable (PWA) and ready for Google AdSense. It's hosted in the `kaamelott` AWS account (022153972216, eu-west-3) and calls the existing API from `kaamelott-lambda`. It should be web first and wrappable as a native app (Capacitor + AdMob) later.

Decisions taken: PWA first, native later · domain decided later (needed before applying to AdSense) · **CloudFront adds the API key server-side** · blason/initials instead of Wikipedia photos · Vite + React + TypeScript.

### What the Anvil app does (feature parity target)
Read from the Anvil source (Form1, LambdaModule, QuotesModule, PreFetchModule):
- On load: `GET /characters` fills a dropdown "Name (count)"; shows a first quote.
- **"Encore une !"**: shows a random quote, or a random one for the selected character, or a random one from favorites (`/quotes/by-favorites?alias=&character=`) when "filtrer les favoris" is checked.
- **Pseudo (alias)** field; heart button toggles a like (`POST /favorites`), shows the like count, and fetches liked state via `GET /favorites/status`. "Entre un pseudo pour liker" if empty; "Rien trouvé" when nothing matches.
- Shows character, actor, film, season, episode, plus an embedded YouTube video that seeks to `youtubeStartSeconds`.
- Speed: a server-side cache of about 50 prefetched quotes (batches of 20). That cache explains the stale pre-migration texts seen in the Anvil app.
- Character pictures: Wikipedia thumbnails. They're dropped here because of copyright risk on an ad-funded site.

## Architecture
```
phone browser ──► CloudFront (one distribution, staging)
                   ├─ /*                         → S3 (private, OAC): built SPA
                   └─ /quotes/* /characters /favorites*
                                                 → API Gateway staging (origin path /staging)
                                                   + origin custom header x-api-key (never sent to browser)
```
- Same origin for the site and the API: no CORS, no key in the JS bundle.
- **The key:** a dedicated "web" API key for the site, separate from the Anvil key, so it can be revoked on its own.

## Part A — small change in `kaamelott-lambda` (backend repo)
In `lib/kaamelott-stack.ts`:
- Add a Secrets Manager secret `kaamelott-web-api-key-<env>` with a generated 40-character value, no punctuation.
- Add an `ApiKey` `kaamelott-web-<env>` whose value is that secret, plus a dedicated `UsagePlan` `kaamelott-web-usage-plan-<env>`. Starting point: quota 50,000/day, throttle rate 20 req/s, burst 40. The existing key and plan stay unchanged for Anvil.
- Output the secret name.
- Deploy to staging via the existing "Deploy staging" workflow. Prod comes later, together with the prod promotion.
- Tests: none exist for the CDK stack (Jest only covers `lambdas/`), so check with `cdk synth` and the deploy.

## Part B — new repo `kaamelott-app`
Local path: **`/Users/guillaume/Repositories/kaamelott-app`**, next to `kaamelott-lambda` (the path is currently free). Remote: `github.com/GuillaumeGSO/kaamelott-app` (public), created with `gh repo create GuillaumeGSO/kaamelott-app --public --source . --push` after the first commit.

Layout:
```
kaamelott-app/
  src/            React app (Vite + TS)
  src/api/        typed API client (fetch, relative URLs)
  public/         manifest icons, blason
  infra/          CDK app (TypeScript): S3 + CloudFront stack, env=staging|prod
  .github/workflows/test.yml, deploy-staging.yml
```

**App (src/):**
- `api/client.ts`: `getCharacters`, `getRandomQuotes(batchSize)`, `getQuoteByCharacter`, `getQuoteByFavorites(alias?, character?)`, `getFavoriteStatus`, `postFavorite`. The `Quote` type matches the API (`actorName`, `youtubeVideoId|null`, `youtubeStartSeconds|null`, `likes`).
- **Quote queue:** keeps up to 20 random quotes from `batchSize=20` and refills when 5 or fewer are left, so "Encore une !" is instant. This replaces Anvil's server-side cache. Character and favorites modes call the API for each quote.
- **Screens:** one mobile-first page. The quote card shows the text, character, actor, film/season/episode, a like heart with its count, a "Voir l'extrait" button that loads a `youtube-nocookie.com/embed/<id>?start=<s>` iframe on tap only (light page, nothing loaded from YouTube before then), and the blason or a character initial. Filters (character select, pseudo, favorites toggle) sit in a collapsible top bar. The pseudo is remembered in `localStorage`.
  *Since redesigned ("Parchemin", 2026-11-06): the filters, the pseudo and a day/night choice moved to a bottom sheet opened from a single header button; see Design in `CLAUDE.md`.*
- **Ads:** an `<AdSlot>` component that renders a placeholder until AdSense is configured (publisher ID via the `VITE_ADSENSE_CLIENT` build var, empty means no ads). No ad script loads before consent. A `/confidentialite` page (privacy policy) is required by AdSense. The consent banner is the CMP built into AdSense, enabled once the account exists.
- **PWA:** `vite-plugin-pwa` with a manifest (name, icons, theme color) and a service worker caching only the app shell, never API responses.
- **Tests:** Vitest + Testing Library for the API client (mocked fetch), the quote queue logic and the main interactions (next quote, like without pseudo, empty favorites).

**Infra (infra/, CDK, deployed to account 022153972216, eu-west-3):**
- A private S3 bucket and a CloudFront distribution with Origin Access Control. Default behavior goes to S3, with the SPA fallback (403/404 → `/index.html`).
- API behaviors (`/quotes/*`, `/characters`, `/favorites`, `/favorites/*`) go to the `kaamelott-api-staging` REST API host, origin path `/staging`, with `CachingDisabled` and `AllViewerExceptHostHeader`. All methods are allowed (POST is needed). The custom header `x-api-key` comes from `{{resolve:secretsmanager:kaamelott-web-api-key-staging}}`. The API host is looked up by name (`kaamelott-api-<env>`) at synth time, so no URL is committed.
- `BucketDeployment` uploads `dist/` and invalidates `/*`.
- Domain later: an optional `domainName` context, plus an ACM certificate in us-east-1 and a Route 53 alias. Not built now.

**CI:**
- `test.yml`: on every push, run `npm ci`, lint, `npm test`, `npm run build` (Node 24). Same pattern as `kaamelott-lambda/.github/workflows/test.yml`.
- `deploy-staging.yml`: manual, `environment: staging`, OIDC. Builds the app, then `cdk deploy`. Same pattern as `kaamelott-lambda/.github/workflows/deploy-staging.yml`.
- **IAM:** needs a new role `kaamelott-app-github-deploy-staging`, trusted only for `repo:GuillaumeGSO/kaamelott-app:environment:staging`. It can assume the CDK bootstrap roles (the account is already bootstrapped) and read the web key secret for the CloudFormation dynamic reference. The GitHub OIDC provider already exists. Auto mode blocks permission grants, so **you run the role creation command**, which I'll prepare as before.

## Order of work
1. ✅ Part A in `kaamelott-lambda` (branch, PR, deploy staging). Check that a request with the web key returns 200. *Done: PR #4 (branch `web-api-key`), deployed to staging, 200 with the key and 403 without. **Not merged yet.***
2. ✅ Scaffold in `/Users/guillaume/Repositories/kaamelott-app` (Vite + React + TS, API client, quote queue, tests), `git init`, first commit, then `gh repo create` (public) and push.
3. ✅ Build the UI (feature parity), with initials badges (no blason: it's not ours either) and responsive layout; checked at phone width against staging.
   ⏳ Parchemin redesign (day and night themes, preferences sheet), chosen on a Claude Design canvas. *On branch `parchemin-design`, being tested by you; not committed yet.*
4. ⏳ Infra stack (*written in `infra/`, typechecks and synthesizes; not deployed yet*), then the first deploy from local with `AWS_PROFILE=kaamelott`. Check the CloudFront URL on a phone.
5. CI workflows, plus the IAM role (you run it), then a deploy-staging run from GitHub.
6. PWA manifest and service worker, `<AdSlot>` placeholders, privacy page.
7. **Later, needs you:** buy or choose a domain, wire it up, apply to AdSense, enable the consent message. Then prod (frontend `env=prod` → prod API, after the prod quote promotion). Then the Capacitor native app with AdMob.

## Verification
- `npm test` and `npm run build` pass locally and in GitHub Actions.
- `curl https://<cloudfront>/characters` returns 200 **without** any key; the response headers and the JS bundle contain no `x-api-key` (grep `dist/`).
- **In Chrome at phone size** (Claude in Chrome): first quote shows, "Encore une !" is instant (queue), the character filter works (search included), day/night follows the phone and the Apparence choice, setting a pseudo and liking toggles the heart and the count, the favorites filter returns the liked quote, and "Voir l'extrait" opens YouTube at the right second.
- **Lighthouse (mobile):** PWA installable, performance acceptable.
- Usage plan metrics in API Gateway show traffic on `kaamelott-web-staging`, not on the Anvil key.
