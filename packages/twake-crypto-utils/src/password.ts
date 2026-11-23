/**
 * Validate that a password meets minimum complexity rules:
 *
 * - at least 8 characters
 * - at least one digit
 * - at least one lowercase letter
 * - at least one uppercase letter
 *
 * Returns `true` on a valid password, `false` otherwise.
 */
export const validatePasswordComplexity = (password: string): boolean =>
  /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(password)

/**
 * Validate that a password reaches about 80 bits of entropy, following the
 * CNIL recommendation (délibération n° 2022-100) for a password used as the
 * only factor. Accepts either:
 *
 * - at least 12 characters with a digit, a lowercase letter, an uppercase
 *   letter and a special character
 * - at least 14 characters with a digit, a lowercase letter and an uppercase
 *   letter
 *
 * Any character outside `[a-zA-Z0-9]` counts as special.
 *
 * Returns `true` on a valid password, `false` otherwise.
 */
export const validateCnilPasswordComplexity = (password: string): boolean =>
  validatePasswordComplexity(password) &&
  (password.length >= 14 ||
    (password.length >= 12 && /[^a-zA-Z0-9]/.test(password)))
