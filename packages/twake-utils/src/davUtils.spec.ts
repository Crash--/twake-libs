import { describe, expect, it } from 'vitest'

import { encodeDavSegment } from './davUtils.js'

describe('encodeDavSegment', () => {
  it.each([
    [
      '0b9ab7e8-6a4f-4b1d-9d7e-2f1c3a4b5c6d',
      '0b9ab7e8-6a4f-4b1d-9d7e-2f1c3a4b5c6d'
    ],
    [
      '040000008200E00074C5B7101A82E008@google.com',
      '040000008200E00074C5B7101A82E008@google.com'
    ],
    ['urn:uuid:1234', 'urn:uuid:1234'],
    ['a_b.c~d(e)', 'a_b.c~d(e)']
  ])('leaves an ordinary UID as the server writes it: %s', (uid, encoded) => {
    expect(encodeDavSegment(uid)).toBe(encoded)
  })

  it.each([
    ['a/b', 'a%2Fb'],
    ['a%2Fb', 'a%252Fb'],
    ['a?b#c', 'a%3Fb%23c'],
    ['a b', 'a%20b'],
    ["a!*'b", 'a%21%2A%27b'],
    ['é', '%C3%A9']
  ])('encodes %s', (uid, encoded) => {
    expect(encodeDavSegment(uid)).toBe(encoded)
  })
})
