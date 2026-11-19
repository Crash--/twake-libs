import { render, type RenderResult } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, vi } from 'vitest'

import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import type { App, Instance, Sdk, SdkStatus } from '@linagora/twake-sdk'
import { I18n } from 'twake-i18n'

import { SdkProvider } from './SdkProvider'

export const PLATFORM_URL = 'https://alice.twake.example'

export const makeApp = (overrides: Partial<App> & { slug: string }): App => ({
  id: `io.cozy.apps/${overrides.slug}`,
  name: overrides.slug,
  state: 'ready',
  links: { related: `https://alice-${overrides.slug}.twake.example/` },
  ...overrides
})

export const INSTANCE: Instance = {
  public_name: 'Alice',
  email: 'alice@example.com',
  diskUsage: 25e9,
  diskQuota: 100e9
}

export interface FakeSdk extends Sdk {
  setStatus(status: SdkStatus): void
}

/** An SDK answering from the given data, `ready` by default */
export function makeSdk({
  status = 'ready',
  apps = [],
  instance = INSTANCE,
  context = {},
  flags = {},
  shortcuts = []
}: {
  status?: SdkStatus
  apps?: App[]
  instance?: Instance
  context?: Record<string, unknown>
  flags?: Record<string, unknown>
  shortcuts?: Awaited<ReturnType<Sdk['getShortcuts']>>
} = {}): FakeSdk {
  let current = status
  const listeners = new Set<(status: SdkStatus) => void>()
  const getApps = vi.fn(() => Promise.resolve(apps))
  const getFlags = vi.fn(() => Promise.resolve(flags))
  return {
    platformURL: PLATFORM_URL,
    get status(): SdkStatus {
      return current
    },
    setStatus(next): void {
      current = next
      listeners.forEach(listener => listener(next))
    },
    onStatusChange(listener): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    login: vi.fn(() => Promise.resolve()),
    logout: vi.fn(),
    fetch: vi.fn(),
    fetchJSON: vi.fn(),
    getApps,
    getAllApps: getApps,
    getInstance: vi.fn(() => Promise.resolve(instance)),
    getContext: vi.fn(() => Promise.resolve(context)),
    getFlags,
    getShortcuts: vi.fn(() => Promise.resolve(shortcuts)),
    getAppIconURL: vi.fn((slug: string) => Promise.resolve(`blob:${slug}`)),
    getAppURL(slug, path = ''): Promise<string | null> {
      const app = apps.find(candidate => candidate.slug === slug)
      const base = app?.links.related
      return Promise.resolve(base ? `${base}${path.replace(/^\/+/, '')}` : null)
    },
    createIntent: vi.fn()
  }
}

/** Without `sdk`, renders off the platform: no SdkProvider */
export const renderWithSdk = (
  ui: React.ReactElement,
  sdk?: Sdk
): RenderResult =>
  render(
    <TwakeMuiThemeProvider>
      <I18n lang="en" dictRequire={(): Record<string, unknown> => ({})}>
        {sdk ? <SdkProvider client={sdk}>{ui}</SdkProvider> : ui}
      </I18n>
    </TwakeMuiThemeProvider>
  )

/** Makes MUI breakpoints see a phone: `down(...)` media queries match */
export const useMobileViewport = (): void => {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- restored as is after each test
  const desktop = window.matchMedia
  beforeEach(() => {
    window.matchMedia = (query: string): MediaQueryList => ({
      ...desktop(query),
      matches: query.includes('max-width')
    })
  })
  afterEach(() => {
    window.matchMedia = desktop
  })
}
