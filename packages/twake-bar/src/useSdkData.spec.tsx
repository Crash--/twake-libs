import { act, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it } from 'vitest'

import type { Sdk } from '@linagora/twake-sdk'

import { makeSdk, renderWithSdk } from './testUtils'
import { useSdkData } from './useSdkData'

const loadName = async (sdk: Sdk): Promise<string> =>
  (await sdk.getInstance()).public_name ?? ''

const Name = (): React.ReactElement => {
  const { data, isLoading } = useSdkData(loadName)
  return <span>{isLoading ? 'loading' : (data ?? 'none')}</span>
}

describe('useSdkData', () => {
  it('loads once the client is ready', async () => {
    const sdk = makeSdk({ status: 'waiting' })
    renderWithSdk(<Name />, sdk)

    expect(screen.queryByText('none')).toBeInTheDocument()
    act(() => sdk.setStatus('ready'))

    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })
})
