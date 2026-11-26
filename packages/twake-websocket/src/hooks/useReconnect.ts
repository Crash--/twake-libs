import { Dispatch, MutableRefObject, SetStateAction, useCallback } from 'react'

import { getRetryDelay, RetryBackoffConfig } from '../utils/getRetryDelay.js'

export const RECONNECT_CONFIG: RetryBackoffConfig = {
  initialDelay: 1000, // 1 second
  maxDelay: 30000 // 30 seconds
}
export const MAX_RECONNECT_ATTEMPTS = 10

export function useWebSocketReconnect(
  reconnectTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  isEnabledRef: MutableRefObject<boolean>,
  reconnectAttemptsRef: MutableRefObject<number>,
  setShouldConnect: Dispatch<SetStateAction<boolean>>
): {
  scheduleReconnect: () => void
  clearReconnectTimeout: () => void
} {
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (!isEnabledRef.current) return

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      // eslint-disable-next-line no-console
      console.error(
        `Max WebSocket reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`
      )
      return
    }

    clearReconnectTimeout()

    const delay = getRetryDelay(reconnectAttemptsRef.current, RECONNECT_CONFIG)
    reconnectAttemptsRef.current += 1

    // eslint-disable-next-line no-console
    console.info(
      `Scheduling WebSocket reconnection in ${Math.round(delay)}ms ` +
        `(attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
    )

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isEnabledRef.current) {
        reconnectTimeoutRef.current = null
        return
      }
      // eslint-disable-next-line no-console
      console.info(
        `Attempting WebSocket reconnection (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
      )
      setShouldConnect(prev => !prev)
      clearReconnectTimeout()
    }, delay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearReconnectTimeout])

  return { scheduleReconnect, clearReconnectTimeout }
}
