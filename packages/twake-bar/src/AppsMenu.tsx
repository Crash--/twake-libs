import React, { useEffect, useState } from 'react'

import { Icon, Mosaic } from '@linagora/twake-icons'
import { ButtonBase, Skeleton, Typography, styled } from '@linagora/twake-mui'
import type { App, Sdk, Shortcut } from '@linagora/twake-sdk'
import { useI18n } from 'twake-i18n'

import { BarMenu } from './BarMenu'
import { useSdk } from './SdkProvider'
import {
  getAppDisplayName,
  getEntrypoints,
  sortApps,
  type AppEntrypoint
} from './helpers'
import { useBarLocales } from './useBarLocales'
import { useSdkData } from './useSdkData'

/** An app of the menu off the platform, served by the host */
export interface BarFallbackApp {
  name: string
  href: string
  /** URL of the app icon */
  icon: string
}

const HOME_SLUG = 'home'
const SORT_FLAG = 'apps.sort'

interface LinkedApp extends App {
  href: string | null
}

interface LinkedEntrypoint extends AppEntrypoint {
  href: string | null
}

interface AppsMenuData {
  apps: LinkedApp[]
  entrypoints: LinkedEntrypoint[]
  shortcuts: Shortcut[]
}

const loadAppsMenu = async (sdk: Sdk): Promise<AppsMenuData> => {
  const [apps, flags, shortcuts] = await Promise.all([
    sdk.getApps(),
    sdk.getFlags(),
    sdk.getShortcuts()
  ])
  const sort = flags[SORT_FLAG]
  const sorted = Array.isArray(sort)
    ? sortApps(
        apps,
        sort.filter(slug => typeof slug === 'string')
      )
    : apps
  const [linkedApps, linkedEntrypoints] = await Promise.all([
    Promise.all(
      sorted
        .filter(app => app.slug !== HOME_SLUG)
        .map(async app => ({ ...app, href: await sdk.getAppURL(app.slug) }))
    ),
    Promise.all(
      getEntrypoints(apps, flags).map(async entrypoint => ({
        ...entrypoint,
        href: await sdk.getAppURL(
          entrypoint.slug,
          `#${entrypoint.hash.replace(/^#/, '')}`
        )
      }))
    )
  ])
  return { apps: linkedApps, entrypoints: linkedEntrypoints, shortcuts }
}

const Grid = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  width: '100%',
  [theme.breakpoints.up('md')]: {
    width: '15rem',
    margin: '6px 10px'
  }
}))

const GridItem = styled(ButtonBase)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  width: '33%',
  aspectRatio: '1',
  padding: '10px 8px',
  borderRadius: 10,
  textDecoration: 'none',
  color: 'inherit',
  '&:hover': { backgroundColor: theme.vars.palette.action.hover },
  [theme.breakpoints.up('md')]: {
    width: '5rem',
    height: '5rem'
  }
})) as typeof ButtonBase

const ItemIcon = styled('img')(({ theme }) => ({
  width: '60%',
  [theme.breakpoints.up('md')]: {
    width: '2.625rem',
    height: '2.625rem'
  }
}))

// App icons draw their own shape, shortcut and entrypoint ones get the
// 10px radius of cozy-bar
const RoundedIcon = styled(ItemIcon)({ borderRadius: 10 })

const ItemLabel = styled(Typography)({
  width: '100%',
  flexShrink: 0,
  fontSize: 12,
  lineHeight: '22.5px'
})

interface ItemProps {
  href: string | null
  title: string
  icon: React.ReactNode
  onClick?: () => void
}

const Item = ({
  href,
  title,
  icon,
  onClick
}: ItemProps): React.ReactElement => (
  <GridItem
    component="a"
    href={href ?? undefined}
    target="_blank"
    rel="noopener noreferrer"
    title={title}
    onClick={onClick}
  >
    {icon}
    <ItemLabel noWrap align="center">
      {title}
    </ItemLabel>
  </GridItem>
)

const AppIcon = ({ slug }: { slug: string }): React.ReactElement => {
  const sdk = useSdk()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    const run = async (): Promise<void> => {
      try {
        const url = await sdk.getAppIconURL(slug)
        if (isCurrent) setSrc(url)
      } catch {
        // The skeleton stays
      }
    }
    void run()
    return (): void => {
      isCurrent = false
    }
  }, [sdk, slug])

  return src ? (
    <ItemIcon src={src} alt="" />
  ) : (
    <Skeleton variant="rounded" width="2.625rem" height="2.625rem" />
  )
}

const Placeholders = (): React.ReactElement => (
  <Grid data-testid="twake-bar-apps-loading">
    {[0, 1, 2].map(index => (
      <GridItem key={index} disabled>
        <Skeleton variant="rounded" width={48} height={48} />
      </GridItem>
    ))}
  </Grid>
)

const AppsMenuContent = ({
  close
}: {
  close: () => void
}): React.ReactElement => {
  const { t, lang } = useI18n()
  const { data, isLoading } = useSdkData(loadAppsMenu)

  if (isLoading) return <Placeholders />
  if (!data || data.apps.length === 0) {
    return (
      <Typography color="error" sx={{ mx: 1 }}>
        {t('twakeBar.noApps')}
      </Typography>
    )
  }

  return (
    <Grid data-testid="twake-bar-apps">
      {data.apps.map((app, index) => (
        <Item
          key={`${app.slug}-${index}`}
          href={app.href}
          title={getAppDisplayName(app, lang)}
          icon={<AppIcon slug={app.slug} />}
          onClick={close}
        />
      ))}
      {data.shortcuts.map(shortcut => (
        <Item
          key={shortcut.id}
          href={shortcut.url}
          title={shortcut.name.replace(/\.url$/, '')}
          icon={
            shortcut.icon ? (
              <RoundedIcon src={shortcut.icon} alt="" />
            ) : (
              <Skeleton
                variant="rounded"
                width="2.625rem"
                height="2.625rem"
                animation={false}
              />
            )
          }
        />
      ))}
      {data.entrypoints.map((entrypoint, index) => (
        <Item
          key={`${entrypoint.slug}/${entrypoint.name}-${index}`}
          href={entrypoint.href}
          title={
            entrypoint.title[lang] ?? entrypoint.title.en ?? entrypoint.name
          }
          icon={
            <RoundedIcon
              src={`data:image/svg+xml;base64,${entrypoint.icon ?? ''}`}
              alt=""
            />
          }
        />
      ))}
    </Grid>
  )
}

const AppsMenuButton = ({
  children
}: {
  children: (close: () => void) => React.ReactNode
}): React.ReactElement => {
  useBarLocales()
  const { t } = useI18n()

  return (
    <BarMenu
      label={t('twakeBar.apps')}
      trigger={<Icon icon={Mosaic} size="18" />}
      data-testid="twake-bar-apps-button"
    >
      {children}
    </BarMenu>
  )
}

export const AppsMenu = (): React.ReactElement => (
  <AppsMenuButton>{close => <AppsMenuContent close={close} />}</AppsMenuButton>
)

/** The apps given by the host, off the platform */
export const FallbackAppsMenu = ({
  apps
}: {
  apps: BarFallbackApp[]
}): React.ReactElement => (
  <AppsMenuButton>
    {close => (
      <Grid data-testid="twake-bar-apps">
        {apps.map(app => (
          <Item
            key={app.href}
            href={app.href}
            title={app.name}
            icon={<ItemIcon src={app.icon} alt="" />}
            onClick={close}
          />
        ))}
      </Grid>
    )}
  </AppsMenuButton>
)
