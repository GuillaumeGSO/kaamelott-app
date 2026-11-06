/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const API_PATHS = ['/quotes', '/favorites']

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
      restoreMocks: true,
    },
  }
})
