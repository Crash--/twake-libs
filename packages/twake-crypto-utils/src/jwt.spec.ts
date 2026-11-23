import { describe, expect, it } from 'vitest'

import { decodeJwtPayload, getJwtStringProperty } from './jwt.js'

const buildToken = (payload: Record<string, unknown>): string => {
  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' })
  ).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.sig`
}

describe('decodeJwtPayload', () => {
  it('decodes a well-formed JWT payload', () => {
    const token = buildToken({ sub: 'user-1', email: 'u@example.com' })
    const payload = decodeJwtPayload(token)
    expect(payload).toEqual({ sub: 'user-1', email: 'u@example.com' })
  })

  it('returns null on malformed tokens', () => {
    expect(decodeJwtPayload('only.two')).toBeNull()
    expect(decodeJwtPayload('a.b.c.d')).toBeNull()
    expect(decodeJwtPayload('a..c')).toBeNull()
    expect(decodeJwtPayload('a.not-base64-json.c')).toBeNull()
  })
})

describe('getJwtStringProperty', () => {
  it('returns the value when the key holds a string', () => {
    expect(getJwtStringProperty({ sub: 'abc' }, 'sub')).toBe('abc')
  })

  it('returns undefined for missing keys', () => {
    expect(getJwtStringProperty({ sub: 'abc' }, 'missing')).toBeUndefined()
  })

  it('returns undefined for null payload', () => {
    expect(getJwtStringProperty(null, 'sub')).toBeUndefined()
  })

  it.each([
    ['number', { v: 1234 }],
    ['boolean', { v: true }],
    ['array', { v: ['a'] }],
    ['object', { v: { nested: 'x' } }],
    ['null', { v: null }],
    ['undefined', { v: undefined }]
  ])('returns undefined when the value is a %s', (_, payload) => {
    expect(getJwtStringProperty(payload, 'v')).toBeUndefined()
  })
})

describe('decodeJwtPayload - non-trivial payloads', () => {
  it('decodes a nested object', () => {
    const token = buildToken({
      user: { id: '1', email: 'u@example.com' },
      exp: 9999
    })
    expect(decodeJwtPayload(token)).toEqual({
      user: { id: '1', email: 'u@example.com' },
      exp: 9999
    })
  })

  it('decodes a payload with an array claim', () => {
    const token = buildToken({ roles: ['admin', 'user'] })
    expect(decodeJwtPayload(token)).toEqual({ roles: ['admin', 'user'] })
  })

  it('decodes UTF-8 string claims correctly', () => {
    const token = buildToken({ name: 'éàü中文😀' })
    expect(decodeJwtPayload(token)).toEqual({ name: 'éàü中文😀' })
  })
})
