/**
 * Web Crypto algorithm identifiers used in multiple primitives.
 * Centralized so a typo can't silently make two modules disagree.
 */
export const HMAC_SHA256_PARAMS = { name: 'HMAC', hash: 'SHA-256' } as const
