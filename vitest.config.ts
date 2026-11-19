import { defineConfig } from 'vitest/config'

// One vitest run for the whole monorepo: each package is a project (its own
// vitest.config.ts when it has one), so the test files of all packages share
// one worker pool instead of running package after package.
export default defineConfig({
  test: {
    projects: ['packages/*']
  }
})
