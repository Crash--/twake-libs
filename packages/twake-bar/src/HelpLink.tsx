import React from 'react'

import { HelpOutlined, Icon } from '@linagora/twake-icons'
import { IconButton } from '@linagora/twake-mui'
import type { Sdk } from '@linagora/twake-sdk'
import { useI18n } from 'twake-i18n'

import { useBarLocales } from './useBarLocales'
import { useSdkData } from './useSdkData'

const loadHelpLink = async (sdk: Sdk): Promise<string | null> => {
  const context = await sdk.getContext()
  return typeof context.help_link === 'string' ? context.help_link : null
}

export const HelpButton = ({ href }: { href: string }): React.ReactElement => {
  useBarLocales()
  const { t } = useI18n()

  return (
    <IconButton
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('twakeBar.help')}
    >
      <Icon icon={HelpOutlined} size="18" />
    </IconButton>
  )
}

export const HelpLink = (): React.ReactElement | null => {
  const { data: helpLink } = useSdkData(loadHelpLink)

  return helpLink ? <HelpButton href={helpLink} /> : null
}
