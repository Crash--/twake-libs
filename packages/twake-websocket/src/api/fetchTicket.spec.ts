import { describe, it, expect, vi } from 'vitest'

import { fetchWebSocketTicket } from './fetchTicket.js'
import { WebSocketTicket } from './types.js'

const mockTicket: WebSocketTicket = {
  clientAddress: '127.0.0.1',
  value: 'test-ticket',
  generatedOn: '2025-01-01T00:00:00Z',
  validUntil: '2025-01-01T01:00:00Z',
  username: 'testuser'
}

interface MockApi {
  post: ReturnType<typeof vi.fn>
}

function createMockApi(response: {
  ok: boolean
  json: () => Promise<unknown>
}): MockApi {
  return {
    post: vi.fn().mockResolvedValue(response)
  }
}

describe('fetchWebSocketTicket', () => {
  it('returns ticket on successful response', async () => {
    const api = createMockApi({
      ok: true,
      json: () => Promise.resolve(mockTicket)
    })

    const ticket = await fetchWebSocketTicket(
      api as unknown as Parameters<typeof fetchWebSocketTicket>[0],
      '/ws/ticket'
    )

    expect(ticket).toEqual(mockTicket)
    expect(api.post).toHaveBeenCalledWith('/ws/ticket')
  })

  it('uses default ticketUrl', async () => {
    const api = createMockApi({
      ok: true,
      json: () => Promise.resolve(mockTicket)
    })

    await fetchWebSocketTicket(
      api as unknown as Parameters<typeof fetchWebSocketTicket>[0]
    )

    expect(api.post).toHaveBeenCalledWith('ws/ticket')
  })

  it('throws when response is not ok', async () => {
    const api = createMockApi({
      ok: false,
      json: () => Promise.resolve({})
    })

    await expect(
      fetchWebSocketTicket(
        api as unknown as Parameters<typeof fetchWebSocketTicket>[0]
      )
    ).rejects.toThrow('Failed to fetch WebSocket ticket')
  })
})
