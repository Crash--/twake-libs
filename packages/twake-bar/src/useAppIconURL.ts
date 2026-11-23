import { useEffect, useState } from 'react'

import { useSdk } from './SdkProvider'

/** The icon URL of a platform app, null until it is known or when it fails */
export function useAppIconURL(slug: string): string | null {
  const sdk = useSdk()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    const run = async (): Promise<void> => {
      try {
        const url = await sdk.getAppIconURL(slug)
        if (isCurrent) setSrc(url)
      } catch {
        // The caller keeps its placeholder
      }
    }
    void run()
    return (): void => {
      isCurrent = false
    }
  }, [sdk, slug])

  return src
}
