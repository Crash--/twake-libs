import React, { createContext, useContext, useSyncExternalStore } from 'react'

import type { Sdk, SdkStatus } from '@linagora/twake-sdk'

const SdkContext = createContext<Sdk | null>(null)

export interface SdkProviderProps {
  client: Sdk
  children?: React.ReactNode
}

export const SdkProvider = ({
  client,
  children
}: SdkProviderProps): React.ReactElement => (
  <SdkContext.Provider value={client}>{children}</SdkContext.Provider>
)

export const useSdk = (): Sdk => {
  const sdk = useContext(SdkContext)
  if (!sdk) {
    throw new Error('[twake-bar] useSdk must be used under a SdkProvider')
  }
  return sdk
}

/** `public` without a SdkProvider: the bar is off the platform */
export const useSdkStatus = (): SdkStatus => {
  const sdk = useContext(SdkContext)
  return useSyncExternalStore(
    listener => (sdk ? sdk.onStatusChange(listener) : (): void => undefined),
    () => sdk?.status ?? 'public'
  )
}
