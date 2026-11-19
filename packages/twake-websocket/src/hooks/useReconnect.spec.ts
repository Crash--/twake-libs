import { renderHook, act } from '@testing-library/react'
import { MutableRefObject } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getRetryDelay } from '../utils/getRetryDelay'
import {
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_CONFIG,
  useWebSocketReconnect
} from './useReconnect'

vi.mock('../utils/getRetryDelay')

const mockGetRetryDelay = vi.mocked(getRetryDelay)

describe('useWebSocketReconnect', () => {
  let reconnectTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>
  let isEnabledRef: MutableRefObject<boolean>
  let reconnectAttemptsRef: MutableRefObject<number>
  let setShouldConnect: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    reconnectTimeoutRef = { current: null }
    isEnabledRef = { current: true }
    reconnectAttemptsRef = { current: 0 }
    setShouldConnect = vi.fn()
    mockGetRetryDelay.mockReturnValue(1000)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('scheduleReconnect', () => {
    it('should schedule a reconnection with correct delay', () => {
      const { result } = renderHook(() =>
        useWebSocketReconnect(
          reconnectTimeoutRef,
          isEnabledRef,
          reconnectAttemptsRef,
          setShouldConnect
        )
      )

      act(() => {
        result.current.scheduleReconnect()
      })

      expect(mockGetRetryDelay).toHaveBeenCalledWith(0, RECONNECT_CONFIG)
      expect(reconnectTimeoutRef.current).not.toBeNull()
      expect(setShouldConnect).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(setShouldConnect).toHaveBeenCalledWith(expect.any(Function))
      expect(reconnectAttemptsRef.current).toBe(1)
    })

    it('should not schedule reconnection if not enabled', () => {
      isEnabledRef = { current: false }
      const { result } = renderHook(() =>
        useWebSocketReconnect(
          reconnectTimeoutRef,
          isEnabledRef,
          reconnectAttemptsRef,
          setShouldConnect
        )
      )

      act(() => {
        result.current.scheduleReconnect()
      })

      expect(reconnectTimeoutRef.current).toBeNull()
      expect(mockGetRetryDelay).not.toHaveBeenCalled()
    })

    it('should stop after MAX_RECONNECT_ATTEMPTS', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS

      const { result } = renderHook(() =>
        useWebSocketReconnect(
          reconnectTimeoutRef,
          isEnabledRef,
          reconnectAttemptsRef,
          setShouldConnect
        )
      )

      act(() => {
        result.current.scheduleReconnect()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Max WebSocket reconnection attempts (${MAX_RECONNECT_ATTEMPTS})`
        )
      )
      expect(reconnectTimeoutRef.current).toBeNull()

      consoleErrorSpy.mockRestore()
    })

    it('should increment attempt counter on each reconnection', () => {
      const { result } = renderHook(() =>
        useWebSocketReconnect(
          reconnectTimeoutRef,
          isEnabledRef,
          reconnectAttemptsRef,
          setShouldConnect
        )
      )

      expect(reconnectAttemptsRef.current).toBe(0)

      act(() => {
        result.current.scheduleReconnect()
        vi.advanceTimersByTime(1000)
      })

      expect(reconnectAttemptsRef.current).toBe(1)

      act(() => {
        result.current.scheduleReconnect()
        vi.advanceTimersByTime(1000)
      })

      expect(reconnectAttemptsRef.current).toBe(2)
    })
  })

  describe('clearReconnectTimeout', () => {
    it('should clear pending timeout', () => {
      const { result } = renderHook(() =>
        useWebSocketReconnect(
          reconnectTimeoutRef,
          isEnabledRef,
          reconnectAttemptsRef,
          setShouldConnect
        )
      )

      act(() => {
        result.current.scheduleReconnect()
      })

      expect(reconnectTimeoutRef.current).not.toBeNull()

      act(() => {
        result.current.clearReconnectTimeout()
      })

      expect(reconnectTimeoutRef.current).toBeNull()

      // Timeout should not fire
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(setShouldConnect).not.toHaveBeenCalled()
    })

    it('should handle multiple clears gracefully', () => {
      const { result } = renderHook(() =>
        useWebSocketReconnect(
          reconnectTimeoutRef,
          isEnabledRef,
          reconnectAttemptsRef,
          setShouldConnect
        )
      )

      act(() => {
        result.current.clearReconnectTimeout()
        result.current.clearReconnectTimeout()
        result.current.clearReconnectTimeout()
      })

      expect(reconnectTimeoutRef.current).toBeNull()
    })

    it('should clear timeout before scheduling new one', () => {
      const { result } = renderHook(() =>
        useWebSocketReconnect(
          reconnectTimeoutRef,
          isEnabledRef,
          reconnectAttemptsRef,
          setShouldConnect
        )
      )

      // Schedule first reconnection
      act(() => {
        result.current.scheduleReconnect()
      })

      const firstTimeout = reconnectTimeoutRef.current
      expect(firstTimeout).not.toBeNull()

      // Schedule second reconnection (should clear first)
      act(() => {
        result.current.scheduleReconnect()
      })

      const secondTimeout = reconnectTimeoutRef.current
      expect(secondTimeout).not.toBeNull()
      expect(secondTimeout).not.toBe(firstTimeout)

      // Only second timeout should fire
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(setShouldConnect).toHaveBeenCalledTimes(1)
    })
  })
})
