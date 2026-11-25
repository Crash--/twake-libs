import { describe, expect, it } from 'vitest'

import {
  resolveCalendarSpaUrl,
  buildCalendarEventUrl,
  generateCalendarEventUrl
} from './calendarSpaUrl.js'

describe('resolveCalendarSpaUrl', () => {
  it('resolves a plain URL template', () => {
    const result = resolveCalendarSpaUrl('https://calendar.example.com', {})
    expect(result).toBe('https://calendar.example.com')
  })

  it('resolves a template with placeholders', () => {
    const result = resolveCalendarSpaUrl('https://calendar.{workplaceFqdn}', {
      workplaceFqdn: 'alice.twake.app'
    })
    expect(result).toBe('https://calendar.alice.twake.app')
  })

  it('returns null for an empty template', () => {
    expect(resolveCalendarSpaUrl('', {})).toBeNull()
  })
})

describe('buildCalendarEventUrl', () => {
  it('builds an event creation URL for an attendee', () => {
    const result = buildCalendarEventUrl('https://calendar.example.com', [
      'bob@example.com'
    ])
    expect(result).toBe(
      'https://calendar.example.com/newEvent?attendee=bob%40example.com'
    )
  })

  it('builds an event creation URL for multiple attendees', () => {
    const result = buildCalendarEventUrl('https://calendar.example.com', [
      'alice@example.com',
      'bob@example.com'
    ])
    expect(result).toBe(
      'https://calendar.example.com/newEvent?attendee=alice%40example.com,bob%40example.com'
    )
  })

  it('leaves out an address smuggling query parameters', () => {
    expect(
      buildCalendarEventUrl('https://calendar.example.com', [
        'hr@example.com?bcc=spy@evil.tld',
        'alice@example.com'
      ])
    ).toBe('https://calendar.example.com/newEvent?attendee=alice%40example.com')
  })

  it('leaves out an address with & in it', () => {
    expect(
      buildCalendarEventUrl('https://calendar.example.com', [
        'a@example.com&bcc=spy@evil.tld',
        'alice@example.com'
      ])
    ).toBe('https://calendar.example.com/newEvent?attendee=alice%40example.com')
  })

  it('leaves out an address with # in it', () => {
    expect(
      buildCalendarEventUrl('https://calendar.example.com', [
        'a@example.com#x',
        'alice@example.com'
      ])
    ).toBe('https://calendar.example.com/newEvent?attendee=alice%40example.com')
  })

  it('returns null when all addresses are invalid', () => {
    expect(
      buildCalendarEventUrl('https://calendar.example.com', [
        'not-an-email',
        'also@not@valid'
      ])
    ).toBeNull()
  })

  it('returns null for an empty attendee list', () => {
    expect(buildCalendarEventUrl('https://calendar.example.com', [])).toBeNull()
  })
})

describe('generateCalendarEventUrl', () => {
  it('generates a complete event URL from template', () => {
    const result = generateCalendarEventUrl(
      'https://calendar.{workplaceFqdn}',
      ['bob@example.com'],
      { workplaceFqdn: 'alice.twake.app' }
    )
    expect(result).toBe(
      'https://calendar.alice.twake.app/newEvent?attendee=bob%40example.com'
    )
  })

  it('returns null for an empty template', () => {
    const result = generateCalendarEventUrl('', ['bob@example.com'], {})
    expect(result).toBeNull()
  })

  it('returns null when all attendees are invalid', () => {
    const result = generateCalendarEventUrl(
      'https://calendar.{workplaceFqdn}',
      ['not-an-email'],
      { workplaceFqdn: 'alice.twake.app' }
    )
    expect(result).toBeNull()
  })
})
