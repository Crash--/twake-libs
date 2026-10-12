import { describe, expect, it } from 'vitest'

import { resolveChatSpaUrl } from './chatSpaUrl'

const SIMPLE_TEMPLATE = 'http://chat.e2e.local/#/chat/@{target}'
const SERVER_TEMPLATE =
  'https://{workplaceFqdn.localpart}-chat.{workplaceFqdn.domain}/#/chat/@{target}:{workplaceFqdn.domain}'
const workplaceFqdn = 'alice.twake.app'

describe('resolveChatSpaUrl', () => {
  it('resolves a plain URL template', () => {
    expect(resolveChatSpaUrl('https://chat.example.com', {})).toBe(
      'https://chat.example.com'
    )
  })

  it('returns null for an empty template', () => {
    expect(resolveChatSpaUrl('', {})).toBeNull()
  })

  it('prefixes a bare localpart with the template', () => {
    expect(resolveChatSpaUrl(SIMPLE_TEMPLATE, { target: 'neo' })).toBe(
      'http://chat.e2e.local/#/chat/@neo'
    )
    expect(
      resolveChatSpaUrl(SERVER_TEMPLATE, { target: 'neo', workplaceFqdn })
    ).toBe('https://alice-chat.twake.app/#/chat/@neo:twake.app')
  })

  it('does not duplicate the "@" of a full Matrix ID', () => {
    expect(
      resolveChatSpaUrl(SIMPLE_TEMPLATE, { target: '@trinity:matrix.org' })
    ).toBe('http://chat.e2e.local/#/chat/@trinity:matrix.org')
  })

  it('does not append the template server to a full Matrix ID', () => {
    expect(
      resolveChatSpaUrl(SERVER_TEMPLATE, {
        target: '@trinity:matrix.org',
        workplaceFqdn
      })
    ).toBe('https://alice-chat.twake.app/#/chat/@trinity:matrix.org')
  })

  it('replaces a literal template server for a full Matrix ID', () => {
    expect(
      resolveChatSpaUrl(
        'https://chat.example.com/#/chat/@{target}:example.com?via=x',
        { target: '@trinity:matrix.org' }
      )
    ).toBe('https://chat.example.com/#/chat/@trinity:matrix.org?via=x')
  })

  it('strips a leading "@" from a localpart without server', () => {
    expect(
      resolveChatSpaUrl(SERVER_TEMPLATE, { target: '@neo', workplaceFqdn })
    ).toBe('https://alice-chat.twake.app/#/chat/@neo:twake.app')
  })

  it('keeps the full Matrix ID when the template has no "@" prefix', () => {
    expect(
      resolveChatSpaUrl('https://chat.example.com/#/chat/{target}', {
        target: '@trinity:matrix.org'
      })
    ).toBe('https://chat.example.com/#/chat/@trinity:matrix.org')
  })
})
