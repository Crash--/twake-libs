import { useEffect, useState } from 'react'

import type { Sdk } from '@linagora/twake-sdk'

import { useSdk, useSdkStatus } from './SdkProvider'

export interface SdkData<T> {
  data: T | null
  isLoading: boolean
}

/**
 * Loads platform data once the client is ready. `load` must be stable (a
 * module level function): it is part of the effect dependencies.
 */
export function useSdkData<T>(load: (sdk: Sdk) => Promise<T>): SdkData<T> {
  const sdk = useSdk()
  const status = useSdkStatus()
  const isReady = status === 'ready'
  const [data, setData] = useState<T | null>(null)
  const [hasFailed, setFailed] = useState(false)

  useEffect(() => {
    if (!isReady) return
    let isCurrent = true
    const run = async (): Promise<void> => {
      try {
        const loaded = await load(sdk)
        if (isCurrent) setData(loaded)
      } catch {
        if (isCurrent) setFailed(true)
      }
    }
    void run()
    return (): void => {
      isCurrent = false
    }
  }, [sdk, isReady, load])

  return { data, isLoading: isReady && data === null && !hasFailed }
}
