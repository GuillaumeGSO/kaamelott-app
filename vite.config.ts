import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { configDefaults } from 'vitest/config'

// The API paths the app calls, as forwarded by CloudFront (infra/lib/web-stack.ts).
const API_PATHS = ['/quotes/all', '/quotes/likes', '/favorites']

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Read without the VITE_ prefix filter: these values stay in the dev server and are
  // never exposed to the bundle (only VITE_* variables are). Set them in .env (see .env.example).
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'serve' && mode !== 'test') {
    const missing = ['KAAMELOTT_API_URL', 'KAAMELOTT_API_KEY'].filter(name => !env[name])
    if (missing.length > 0) {
      throw new Error(
        `Missing ${missing.join(' and ')} for the dev server proxy. ` +
          'Copy .env.example to .env and fill it in (the file says where to find each value).',
      )
    }
  }
  const target = env.KAAMELOTT_API_URL

  return {
    plugins: [react()],
    server: {
      // Mirrors the CloudFront setup: same-origin API paths, key added server-side.
      proxy: Object.fromEntries(
        API_PATHS.map(path => [
          path,
          {
            target,
            changeOrigin: true, // the target's /staging path is prepended to the request path
            headers: env.KAAMELOTT_API_KEY ? { 'x-api-key': env.KAAMELOTT_API_KEY } : {},
          },
        ]),
      ),
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      exclude: [...configDefaults.exclude, 'e2e/**'], // Playwright smoke tests (npm run smoke)
      restoreMocks: true,
    },
  }
})
