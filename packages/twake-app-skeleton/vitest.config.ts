import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    server: {
      deps: {
        // Their ESM builds import without extensions: let vite resolve them
        inline: [/@linagora\/twake-mui/, /@linagora\/twake-icons/]
      }
    }
  }
})
