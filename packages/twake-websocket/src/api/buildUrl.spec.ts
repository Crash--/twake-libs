import { describe, it, expect } from 'vitest'

import { buildWebSocketUrl } from './buildUrl.js'

describe('buildWebSocketUrl', () => {
  it('converts http to ws', () => {
    const url = buildWebSocketUrl('http://localhost:5000', 'abc123')
    expect(url).toBe('ws://localhost:5000/ws?ticket=abc123')
  })

  it('converts https to wss', () => {
    const url = buildWebSocketUrl('https://example.com', 'my-ticket')
    expect(url).toBe('wss://example.com/ws?ticket=my-ticket')
  })

  it('leaves ws:// unchanged', () => {
    const url = buildWebSocketUrl('ws://localhost:5000', 'ticket')
    expect(url).toBe('ws://localhost:5000/ws?ticket=ticket')
  })

  it('leaves wss:// unchanged', () => {
    const url = buildWebSocketUrl('wss://example.com', 'ticket')
    expect(url).toBe('wss://example.com/ws?ticket=ticket')
  })

  it('URL-encodes the ticket value', () => {
    const url = buildWebSocketUrl(
      'http://localhost:5000',
      'ticket with spaces & stuff'
    )
    expect(url).toBe(
      'ws://localhost:5000/ws?ticket=ticket%20with%20spaces%20%26%20stuff'
    )
  })
})
