import React from 'react'

import { HelpOutlined, Icon } from '@linagora/twake-icons'
import {
  IconButton,
  ListItemText,
  MenuItem,
  MenuList
} from '@linagora/twake-mui'
import type { Sdk } from '@linagora/twake-sdk'
import { useI18n } from 'twake-i18n'

import { BarMenu } from './BarMenu'
import { useBarLocales } from './useBarLocales'
import { useSdkData } from './useSdkData'

interface HelpItemBase {
  label: string
  'data-testid'?: string
}

/**
 * An entry of the help of the host: a web page, opened in a new tab,
 * another link (`mailto:`, `tel:`), opened in the same tab, or an action
 */
export type TwakeBarHelpItem = HelpItemBase &
  ({ href: string; onClick?: never } | { onClick: () => void; href?: never })

// An object: `useSdkData` takes a null as still loading
const loadHelpLink = async (sdk: Sdk): Promise<{ href: string | null }> => {
  const context = await sdk.getContext()
  return {
    href:
      typeof context.help_link === 'string' && context.help_link !== ''
        ? context.help_link
        : null
  }
}

const HelpIcon = (): React.ReactElement => (
  <Icon icon={HelpOutlined} size="18" />
)

const newTab = { target: '_blank', rel: 'noopener noreferrer' } as const

const WEB_PAGE = /^\s*https?:/i

// Only web pages get a new tab: a `mailto:` or `tel:` link opened in one
// leaves an empty tab in some browsers
const linkProps = (
  href: string
): { component: 'a'; href: string; target?: '_blank'; rel?: string } =>
  WEB_PAGE.test(href)
    ? { component: 'a', href, ...newTab }
    : { component: 'a', href }

/**
 * The help of the bar, one "?": the help page of the platform and the
 * entries of the host. One entry opens at once, several in a menu.
 */
export const HelpMenu = ({
  helpLink,
  items = []
}: {
  helpLink: string | null
  items?: TwakeBarHelpItem[]
}): React.ReactElement | null => {
  useBarLocales()
  const { t } = useI18n()

  if (helpLink !== null && items.length === 0) {
    return (
      <IconButton {...linkProps(helpLink)} aria-label={t('twakeBar.help')}>
        <HelpIcon />
      </IconButton>
    )
  }
  if (helpLink === null && items.length === 1) {
    const [item] = items
    return (
      <IconButton
        {...(item.href === undefined
          ? { onClick: item.onClick }
          : linkProps(item.href))}
        aria-label={item.label}
        data-testid={item['data-testid']}
      >
        <HelpIcon />
      </IconButton>
    )
  }
  if (helpLink === null && items.length === 0) return null

  return (
    <BarMenu
      trigger={<HelpIcon />}
      label={t('twakeBar.help')}
      data-testid="twake-bar-help-button"
    >
      {close => (
        <MenuList>
          {helpLink === null ? null : (
            <MenuItem {...linkProps(helpLink)} onClick={close}>
              <ListItemText primary={t('twakeBar.helpCenter')} />
            </MenuItem>
          )}
          {items.map((item, index) => (
            <MenuItem
              key={`${index}-${item.label}`}
              {...(item.href === undefined ? {} : linkProps(item.href))}
              onClick={() => {
                close()
                item.onClick?.()
              }}
              data-testid={item['data-testid']}
            >
              <ListItemText primary={item.label} />
            </MenuItem>
          ))}
        </MenuList>
      )}
    </BarMenu>
  )
}

/** The help of the platform (`help_link` of its context) with the host's */
export const HelpLink = ({
  items
}: {
  items?: TwakeBarHelpItem[]
}): React.ReactElement | null => {
  const { data, isLoading } = useSdkData(loadHelpLink)

  // Not the host's entries alone first: they would turn into a menu
  if (isLoading) return null
  return <HelpMenu helpLink={data?.href ?? null} items={items} />
}
