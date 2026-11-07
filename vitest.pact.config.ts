import { defineConfig } from 'vitest/config'

// Pact contract generation (`npm run pact:publish`), kept apart from the unit tests: Node
// environment (real fetch to Pact's mock server) and only the *.pact.ts files.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.pact.ts'],
    restoreMocks: true,
  },
})
