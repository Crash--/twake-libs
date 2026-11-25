import { describe, expect, it } from 'vitest'

import { resolveUriTemplate } from './uriTemplateUtils.js'

describe('resolveUriTemplate', () => {
  const fqdn = 'tmle.stg.lin-saas.com'

  it('should resolve {localpart}', () => {
    const template = 'https://visio-{localpart}.twake.app/#/bridge'
    const result = resolveUriTemplate(template, { localpart: 'alice' })
    expect(result).toBe('https://visio-alice.twake.app/#/bridge')
  })

  it('should resolve {workplaceFqdn}', () => {
    const template = 'https://mail-{workplaceFqdn}'
    const result = resolveUriTemplate(template, { workplaceFqdn: fqdn })
    expect(result).toBe('https://mail-tmle.stg.lin-saas.com')
  })

  it('should resolve {workplaceFqdn.localpart} and {workplaceFqdn.domain}', () => {
    const template =
      'https://{workplaceFqdn.localpart}-mail.{workplaceFqdn.domain}'
    const result = resolveUriTemplate(template, { workplaceFqdn: fqdn })
    expect(result).toBe('https://tmle-mail.stg.lin-saas.com')
  })

  it('should resolve {workplaceFqdn.domain} to empty for a single-label FQDN', () => {
    const template =
      'https://{workplaceFqdn.localpart}-mail.{workplaceFqdn.domain}'
    const result = resolveUriTemplate(template, { workplaceFqdn: 'localhost' })
    expect(result).toBe('https://localhost-mail.')
  })

  it('should leave unknown expressions untouched', () => {
    const template = 'https://{unknown}.example.com'
    expect(resolveUriTemplate(template, {})).toBe(template)
  })

  it('should resolve missing context values to empty string', () => {
    const template = 'https://{localpart}-mail.{workplaceFqdn}'
    expect(resolveUriTemplate(template, {})).toBe('https://-mail.')
  })

  it('should fall back to workplaceFqdnFallback when no FQDN is provided', () => {
    const template =
      'https://{workplaceFqdn.localpart}-mail.{workplaceFqdn.domain}'
    const result = resolveUriTemplate(template, {
      localpart: 'alice',
      workplaceFqdnFallback: '{localpart}.twake.linagora.com'
    })
    expect(result).toBe('https://alice-mail.twake.linagora.com')
  })

  it('should resolve {workplaceFqdn} from the fallback', () => {
    const result = resolveUriTemplate('https://mail-{workplaceFqdn}', {
      localpart: 'alice',
      workplaceFqdnFallback: '{localpart}.twake.linagora.com'
    })
    expect(result).toBe('https://mail-alice.twake.linagora.com')
  })

  it('should prefer the context FQDN over the fallback', () => {
    const result = resolveUriTemplate('https://mail-{workplaceFqdn}', {
      localpart: 'alice',
      workplaceFqdn: fqdn,
      workplaceFqdnFallback: '{localpart}.twake.linagora.com'
    })
    expect(result).toBe('https://mail-tmle.stg.lin-saas.com')
  })

  it('should support a fallback without {localpart}', () => {
    const result = resolveUriTemplate('https://mail-{workplaceFqdn}', {
      localpart: 'alice',
      workplaceFqdnFallback: 'twake.linagora.com'
    })
    expect(result).toBe('https://mail-twake.linagora.com')
  })
})
