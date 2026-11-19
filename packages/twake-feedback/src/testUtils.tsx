import { render, type RenderResult } from '@testing-library/react'
import React from 'react'

import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { I18n } from 'twake-i18n'

export const renderWithProviders = (
  ui: React.ReactElement,
  lang = 'en'
): RenderResult =>
  render(
    <TwakeMuiThemeProvider>
      <I18n lang={lang} dictRequire={(): Record<string, unknown> => ({})}>
        {ui}
      </I18n>
    </TwakeMuiThemeProvider>
  )
