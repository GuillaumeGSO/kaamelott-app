# Kaamelott App

Mobile-first web app for quotes from the French series [Kaamelott](https://fr.wikipedia.org/wiki/Kaamelott): a random quote, a quote from one character, or one from your favorites. You can like quotes with a pseudo and watch the scene on YouTube.

Built with Vite, React and TypeScript. It's the frontend of the API in [kamelott-lambda](https://github.com/GuillaumeGSO/kamelott-lambda).

## How it talks to the API

The app calls the API on its own origin (`/quotes/*`, `/characters`, `/favorites`). The API key is **never** in the browser:

- **In production**, CloudFront serves the site and forwards those paths to API Gateway, adding the `x-api-key` header. The key is the dedicated `kaamelott-web-<env>` key, stored in Secrets Manager as `kaamelott-web-api-key-<env>`.
- **In development**, the Vite dev server proxies the same paths and adds the key from the `KAAMELOTT_API_KEY` environment variable.

## Development

Prerequisites: Node.js 24+, and the AWS CLI with the `kaamelott` SSO profile (to read the staging key).

```bash
npm install

# Start against the staging API (the key stays in the dev server, never in the bundle)
KAAMELOTT_API_KEY=$(aws secretsmanager get-secret-value \
  --secret-id kaamelott-web-api-key-staging --profile kaamelott --region eu-west-3 \
  --query SecretString --output text) npm run dev
```

Set `KAAMELOTT_API_URL` to target another API stage (default: staging).

```bash
npm test        # Vitest + Testing Library
npm run lint    # oxlint
npm run build   # type-check and production build in dist/
```
