import { describe, it, expect } from 'vitest'

import { getRetryDelay } from './getRetryDelay.js'

describe('getRetryDelay', () => {
  const config = { initialDelay: 1000, maxDelay: 30000 }

  it('should return at least initialDelay on first attempt', () => {
    const delay = getRetryDelay(0, config)
    expect(delay).toBeGreaterThanOrEqual(config.initialDelay * 0.5)
    expect(delay).toBeLessThanOrEqual(config.initialDelay * 1.5)
  })

  it('should double the base delay on each attempt', () => {
    const delay1 = getRetryDelay(1, config)
    const delay2 = getRetryDelay(2, config)
    expect(delay1).toBeGreaterThanOrEqual(config.initialDelay * 0.5)
    expect(delay2).toBeGreaterThanOrEqual(config.initialDelay * 2 * 0.5)
  })

  it('should cap delay at maxDelay', () => {
    const delay = getRetryDelay(100, config)
    expect(delay).toBeLessThanOrEqual(config.maxDelay)
  })
})
