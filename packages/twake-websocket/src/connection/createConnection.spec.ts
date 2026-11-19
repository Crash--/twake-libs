import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { WS_EVENTS } from '../protocols'
import { createWebSocketConnection } from './createConnection'

interface MockWebSocket {
  url: string
  readyState: number
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  _listeners: Record<string, ((...args: unknown[]) => void)[]>
}

function createMockWebSocket(
  webSocketInstances: MockWebSocket[]
): (url: string) => MockWebSocket {
  return function (url: string): MockWebSocket {
    const ws: MockWebSocket = {
      url,
      readyState: WebSocket.CONNECTING,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      _listeners: {}
    }

    ws.addEventListener.mockImplementation(
      (event: string, handler: (...args: unknown[]) => void): void => {
        ws._listeners[event] ??= []
        ws._listeners[event].push(handler)
      }
    )

    ws.removeEventListener.mockImplementation(
      (event: string, handler: (...args: unknown[]) => void): void => {
        ws._listeners[event] =
          ws._listeners[event]?.filter(h => h !== handler) ?? []
      }
    )

    webSocketInstances.push(ws)
    return ws
  }
}

function setupWebsocket(): {
  webSocketInstances: MockWebSocket[]
  cleanup: () => void
} {
  const originalWebSocket = global.WebSocket
  const webSocketInstances: MockWebSocket[] = []

  global.WebSocket = createMockWebSocket(
    webSocketInstances
  ) as unknown as typeof WebSocket

  const cleanup = (): void => {
    global.WebSocket = originalWebSocket
    webSocketInstances.length = 0
  }

  return { webSocketInstances, cleanup }
}

describe('createWebSocketConnection', () => {
  let cleanup: () => void
  let webSocketInstances: MockWebSocket[] = []

  const getWs = (): MockWebSocket => webSocketInstances[0]

  const triggerEvent = (
    ws: MockWebSocket,
    event: string,
    payload?: unknown
  ): void => {
    ws._listeners[event]?.[0]?.(payload)
  }

  const createAndOpenConnection = async (): Promise<{
    socket: WebSocket
    ws: MockWebSocket
    promise: Promise<WebSocket>
    mockCallbacks: {
      onMessage: ReturnType<typeof vi.fn>
      onClose: ReturnType<typeof vi.fn>
      onError: ReturnType<typeof vi.fn>
    }
  }> => {
    const mockCallbacks = {
      onMessage: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn()
    }
    const promise = createWebSocketConnection({
      url: 'wss://example.com/ws?ticket=test',
      callbacks: mockCallbacks
    })

    triggerEvent(getWs(), WS_EVENTS.CONNECTION_OPENED)
    const socket = await promise

    return { socket, ws: getWs(), promise, mockCallbacks }
  }

  beforeEach(() => {
    const setup = setupWebsocket()
    webSocketInstances = setup.webSocketInstances
    cleanup = setup.cleanup
  })

  afterEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('creates WebSocket with correct URL', async () => {
    await createAndOpenConnection()
    expect(getWs().url).toBe('wss://example.com/ws?ticket=test')
  })

  it('resolves with socket when connection opens', async () => {
    const { socket, ws } = await createAndOpenConnection()
    expect(socket).toBe(ws)
  })

  it('rejects when connection fails', async () => {
    const mockCallbacks = { onMessage: vi.fn() }
    const promise = createWebSocketConnection({
      url: 'wss://example.com/ws',
      callbacks: mockCallbacks
    })

    triggerEvent(getWs(), WS_EVENTS.ERROR, new Event('error'))

    await expect(promise).rejects.toThrow('WebSocket connection failed')
  })

  it('rejects on timeout', async () => {
    vi.useFakeTimers()
    const mockCallbacks = { onMessage: vi.fn() }
    const promise = createWebSocketConnection({
      url: 'wss://example.com/ws',
      callbacks: mockCallbacks,
      connectionTimeoutMs: 5000
    })

    expect(webSocketInstances.length).toBe(1)
    vi.advanceTimersByTime(5000)

    await expect(promise).rejects.toThrow('WebSocket connection timed out')
    vi.useRealTimers()
  })

  it('calls onMessage callback when message received', async () => {
    const { ws, mockCallbacks } = await createAndOpenConnection()

    const testMessage = { type: 'test', payload: 'data' }
    triggerEvent(ws, WS_EVENTS.MESSAGE, { data: JSON.stringify(testMessage) })

    expect(mockCallbacks.onMessage).toHaveBeenCalledWith(testMessage)
  })

  it('does not call onMessage when JSON parsing fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { ws, mockCallbacks } = await createAndOpenConnection()

    triggerEvent(ws, WS_EVENTS.MESSAGE, { data: 'invalid json' })

    expect(mockCallbacks.onMessage).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to parse WebSocket message:',
      expect.any(Error)
    )

    errorSpy.mockRestore()
  })

  it('calls onClose callback when connection closes', async () => {
    const { ws, mockCallbacks } = await createAndOpenConnection()

    const closeEvent = new CloseEvent('close', {
      code: 1000,
      reason: 'Normal closure'
    })
    triggerEvent(ws, WS_EVENTS.CONNECTION_CLOSED, closeEvent)

    expect(mockCallbacks.onClose).toHaveBeenCalledWith(closeEvent)
  })

  it('calls onError callback when error occurs', async () => {
    const { ws, mockCallbacks } = await createAndOpenConnection()

    const errorEvent = new Event('error')
    triggerEvent(ws, WS_EVENTS.ERROR, errorEvent)

    expect(mockCallbacks.onError).toHaveBeenCalledWith(errorEvent)
  })
})
