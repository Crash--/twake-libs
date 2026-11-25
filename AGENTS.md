# AGENTS.md - Twake Libs Monorepo

## Quick Commands

```bash
# Install dependencies
npm ci

# Build all packages
npm run build

# Lint all packages
npm run lint

# Lint specific package
npx rs lint packages/twake-utils/src

# Format all files
npm run fmt

# Test dry-run release (safe, no publish)
npm run release:dry
```

## Critical Rules

**⚠️ NEVER run `npm run release` locally** - it publishes to npm for real. Releases only happen via GitHub Actions on merge to main.

**⚠️ Always use Node 24** - specified in `.nvmrc`. Other versions will fail.

## Decisions

- Decisions: each package keeps its own `docs/decisions.md` (`packages/*/docs/decisions.md`), mandatory, none at the repo root. Search the log of the package you change before asking a question or proposing a change; record every decision in the log of the package it touches (the main one when it touches several, the others in its Scope line), in the commit that applies it (skill `twake-decisions`).

## Architecture

- **Monorepo**: npm workspaces with independent versioning
- **Packages location**: `packages/*`
- **Package naming**: All packages use `@linagora/` scope
- **Build output**: Each package outputs to `dist/` (TypeScript compilation)

## Release Flow (Automated)

```text
PR merged to main
    ↓
CI runs `multi-semantic-release`
    ↓
MSR detects changed packages since their last tag
    ↓
For each changed package:
    - Bumps version (conventional commits)
    - Updates CHANGELOG.md
    - Publishes to npm
    - Creates git tag (e.g. @linagora/twake-utils@2.0.1)
    - Creates separate GitHub release
```

## Adding New Packages

1. Create package in `packages/<name>/`
2. Required in `package.json`:
   - `"name": "@linagora/<name>"`
   - `"publishConfig": { "access": "public", "provenance": true }`
   - `"files": ["dist", "CHANGELOG.md", "README.md"]`
3. No per-package release config needed — the root `.releaserc.json` applies to all workspaces
4. Create `packages/<name>/docs/decisions.md` with the same header as the other packages
5. Before the first release, a maintainer must add the npm trusted publisher for the package: see `PUBLISHING.md`. Without it, CI fails on that package with `ENONPMTOKEN`

## CI/CD Notes

- **Runs on**: PRs and push to main
- **Order**: install → lint → test → build → release (main only)
- **npm auth**: OIDC trusted publishing, no npm token. The `release` job runs in the `npm` GitHub environment (main only). A new package needs a one-time npm setup, see `PUBLISHING.md`
- **Uses**: `secrets.GITHUB_TOKEN` (auto-provided, no setup needed)

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning:

- `feat:` → minor version bump
- `fix:` → patch version bump
- `feat!:` or `BREAKING CHANGE:` → major version bump
