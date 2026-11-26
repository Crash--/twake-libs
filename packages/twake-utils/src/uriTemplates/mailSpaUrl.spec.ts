import { describe, expect, it } from 'vitest'

import {
  resolveMailSpaUrl,
  buildMailtoUri,
  buildMailComposerUrl,
  generateMailComposerUrl
} from './mailSpaUrl.js'

describe('resolveMailSpaUrl', () => {
  it('resolves a plain URL template', () => {
    const result = resolveMailSpaUrl('https://mail.example.com', {})
    expect(result).toBe('https://mail.example.com')
  })

  it('resolves a template with placeholders', () => {
    const result = resolveMailSpaUrl('https://mail.{workplaceFqdn}', {
      workplaceFqdn: 'alice.twake.app'
    })
    expect(result).toBe('https://mail.alice.twake.app')
  })

  it('returns null for an empty template', () => {
    expect(resolveMailSpaUrl('', {})).toBeNull()
  })
})

describe('buildMailtoUri', () => {
  it('joins valid addresses', () => {
    expect(
      buildMailtoUri(['alice@example.com', 'mailto:bob@example.com'])
    ).toBe('mailto:alice@example.com,bob@example.com')
  })

  it('leaves out an address smuggling mailto headers', () => {
    expect(
      buildMailtoUri([
        'hr@example.com?bcc=spy@evil.tld&body=hello',
        'alice@example.com'
      ])
    ).toBe('mailto:alice@example.com')
  })

  it.each([
    'a@example.com,spy@evil.tld',
    'a@example.com;spy@evil.tld',
    'a@example.com&bcc=spy@evil.tld',
    'a@example.com#x',
    'a b@example.com',
    'not-an-address'
  ])('rejects %s', address => {
    expect(buildMailtoUri([address])).toBeNull()
  })

  it('encodes each address', () => {
    expect(buildMailtoUri(["o'neil+tag@example.com"])).toBe(
      "mailto:o'neil%2Btag@example.com"
    )
  })
})

describe('buildMailComposerUrl', () => {
  it('builds a composer URL for a recipient', () => {
    const result = buildMailComposerUrl('https://mail.example.com', [
      'bob@example.com'
    ])
    expect(result).toBe(
      'https://mail.example.com/mailto/?uri=mailto%3Abob%40example.com'
    )
  })
})

describe('generateMailComposerUrl', () => {
  it('generates a complete composer URL from template', () => {
    const result = generateMailComposerUrl(
      'https://mail.{workplaceFqdn}',
      ['bob@example.com'],
      { workplaceFqdn: 'alice.twake.app' }
    )
    expect(result).toBe(
      'https://mail.alice.twake.app/mailto/?uri=mailto%3Abob%40example.com'
    )
  })

  it('returns null for an empty template', () => {
    const result = generateMailComposerUrl('', ['bob@example.com'], {})
    expect(result).toBeNull()
  })
})
