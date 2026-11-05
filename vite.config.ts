/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const API_PATHS = ['/quotes', '/characters', '/favorites']

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Read without the VITE_ prefix filter: these values stay in the dev server and are
  // never exposed to the bundle (only VITE_* variables are).
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.KAAMELOTT_API_URL ?? 'https://<api-id>.execute-api.eu-west-3.amazonaws.com/staging'

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
