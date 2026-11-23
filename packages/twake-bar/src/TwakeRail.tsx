import React, { useEffect } from 'react'

import { IconButton, Skeleton, Tooltip, styled } from '@linagora/twake-mui'
import type { App, Sdk } from '@linagora/twake-sdk'
import { useI18n } from 'twake-i18n'

import { AppsMenu } from './AppsMenu'
import { BarMenuPlacement } from './BarMenu'
import { HelpLink } from './HelpLink'
import { useSdkStatus } from './SdkProvider'
import { UserMenu } from './UserMenu'
import { getAppDisplayName } from './helpers'
import { useAppIconURL } from './useAppIconURL'
import { useBarLocales } from './useBarLocales'
import { useSdkData } from './useSdkData'

export const TWAKE_RAIL_WIDTH = '4rem'

/** The apps of the rail, by registry slug, in the order of the mockups */
export const TWAKE_RAIL_APPS = [
  'space',
  'drive',
  'chat',
  'mail',
  'calendar',
  'tasks'
] as const

export interface TwakeRailProps {
  /** Slug of the app the rail is shown in */
  current: string
  /** Slugs of the apps to list, in order; one the platform lacks is skipped */
  apps?: readonly string[]
  /**
   * Slugs of the apps Chrome and Edge prerender when the pointer rests on
   * their link, none by default. List only the apps whose HTML sends
   * `Supports-Loading-Mode: credentialed-prerender` and whose sign-in waits
   * for the user (`waitForActivation` of `@linagora/twake-oidc`).
   */
  prerender?: readonly string[]
  showEmailDomainChip?: boolean
  /** Called by the log out item: the host owns the logout */
  onLogOut: () => void
}

interface RailApp {
  app: App
  href: string
}

const loadRailApps = async (sdk: Sdk): Promise<Map<string, RailApp>> => {
  const apps = await sdk.getApps()
  const linked = await Promise.all(
    apps.map(async app => ({ app, href: await sdk.getAppURL(app.slug) }))
  )
  return new Map(
    linked.flatMap(({ app, href }) => (href ? [[app.slug, { app, href }]] : []))
  )
}

const Root = styled('nav')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1),
  boxSizing: 'border-box',
  width: TWAKE_RAIL_WIDTH,
  height: '100%',
  padding: theme.spacing(1.5, 0),
  color: theme.vars.palette.text.secondary
}))

const List = styled('ul')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  margin: 0,
  padding: 0,
  listStyle: 'none'
}))

const Grow = styled('div')({ flexGrow: 1 })

const AppLink = styled(IconButton)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: theme.shape.borderRadius,
  '&[aria-current="page"]': {
    backgroundColor: theme.vars.palette.action.selected
  }
})) as typeof IconButton

const RailIcon = ({ slug }: { slug: string }): React.ReactElement => {
  const src = useAppIconURL(slug)

  return src ? (
    <img src={src} alt="" width={24} height={24} />
  ) : (
    <Skeleton variant="rounded" width={24} height={24} />
  )
}

/** Prerenders these URLs when the pointer rests on a link to them (Speculation Rules) */
const useSpeculationRules = (hrefs: string[]): void => {
  const urls = hrefs.join(' ')

  useEffect(() => {
    if (!urls || !HTMLScriptElement.supports?.('speculationrules')) return
    const script = document.createElement('script')
    script.type = 'speculationrules'
    script.textContent = JSON.stringify({
      prerender: [{ urls: urls.split(' '), eagerness: 'moderate' }]
    })
    document.head.append(script)
    return (): void => script.remove()
  }, [urls])
}

/**
 * The vertical navigation between the apps of the platform: one link per app,
 * opened in the same tab, then the apps menu, help and account menus. The
 * host lays it out at the left of its page on desktop and keeps the TwakeBar
 * on small screens.
 */
export const TwakeRail = ({
  current,
  apps = TWAKE_RAIL_APPS,
  prerender = [],
  showEmailDomainChip,
  onLogOut
}: TwakeRailProps): React.ReactElement => {
  useBarLocales()
  const { t, lang } = useI18n()
  const status = useSdkStatus()
  const { data: platformApps, isLoading } = useSdkData(loadRailApps)
  const listed = apps.flatMap(slug => platformApps?.get(slug) ?? [])
  useSpeculationRules(
    listed
      .filter(({ app }) => app.slug !== current && prerender.includes(app.slug))
      .map(({ href }) => href)
  )

  return (
    <Root aria-label={t('twakeBar.rail')} data-testid="twake-rail">
      <BarMenuPlacement.Provider value="beside">
        {isLoading ? (
          <Skeleton
            variant="rounded"
            width={40}
            height={40}
            data-testid="twake-rail-loading"
          />
        ) : (
          // The list style is off: role="list" keeps it a list for VoiceOver
          <List role="list">
            {listed.map(({ app, href }) => {
              const name = getAppDisplayName(app, lang)
              return (
                <li key={app.slug}>
                  <Tooltip title={name} placement="right">
                    <AppLink
                      component="a"
                      href={href}
                      aria-label={name}
                      aria-current={app.slug === current ? 'page' : undefined}
                    >
                      <RailIcon slug={app.slug} />
                    </AppLink>
                  </Tooltip>
                </li>
              )
            })}
          </List>
        )}
        {status === 'ready' && <AppsMenu />}
        <Grow />
        {status === 'waiting' && (
          <Skeleton variant="circular" width={32} height={32} />
        )}
        {status === 'ready' && (
          <>
            <HelpLink />
            <UserMenu
              onLogOut={onLogOut}
              showEmailDomainChip={showEmailDomainChip}
            />
          </>
        )}
      </BarMenuPlacement.Provider>
    </Root>
  )
}
