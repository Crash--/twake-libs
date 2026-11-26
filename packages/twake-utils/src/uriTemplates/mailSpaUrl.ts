import { resolveUriTemplate, UriTemplateContext } from './uriTemplateUtils.js'

/**
 * Resolve a mail SPA URL template.
 *
 * The template supports RFC 6570-style expressions.
 * See {@link resolveUriTemplate} for supported placeholders.
 *
 * @param template - The URL template (e.g. 'https://mail.{workplaceFqdn}')
 * @param context - Optional context for template resolution
 * @returns the resolved URL, or null when template is empty
 */
export function resolveMailSpaUrl(
  template: string,
  context: UriTemplateContext = {}
): string | null {
  if (!template) return null

  return resolveUriTemplate(template, context)
}

// Characters that would end the address list or start the headers of a
// mailto URI (RFC 6068): an attendee address carrying them could add a
// hidden Bcc or a body to the message composed by the user.
const MAILTO_SEPARATORS = /[?&,;#\s]/

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Builds a mailto URI out of attendee addresses, which come from the
 * invitation and are chosen by its sender. Addresses that are not plain
 * email addresses are left out, and each one is encoded on its own.
 *
 * @returns the mailto URI, or null when no address is valid.
 */
export function buildMailtoUri(addresses: string[]): string | null {
  const valid = addresses
    .map(address => address.replace(/^mailto:/i, '').trim())
    .filter(address => !MAILTO_SEPARATORS.test(address))
    .filter(address => EMAIL_REGEX.test(address))
    .map(address =>
      encodeURIComponent(address.toLowerCase()).replace(/%40/g, '@')
    )

  return valid.length > 0 ? `mailto:${valid.join(',')}` : null
}

/**
 * Build the full mail composer URL for a given recipient.
 *
 * @param mailSpaUrl - The resolved mail SPA base URL
 * @param recipient - The recipients email addresss list
 * @returns The full composer URL, or null if the recipient is invalid
 */
export function buildMailComposerUrl(
  mailSpaUrl: string,
  addresses: string[],
  subject?: string
): string | null {
  const mailto = buildMailtoUri(addresses)
  if (!mailto) return null

  const subjectParam =
    subject !== undefined ? `&subject=${encodeURIComponent(subject)}` : ''
  return `${mailSpaUrl}/mailto/?uri=${encodeURIComponent(mailto)}${subjectParam}`
}

/**
 * Generate a complete mail composer URL from a template.
 *
 * Combines template resolution and composer URL building into a single call.
 *
 * @param template - The URL template (e.g. 'https://mail.{workplaceFqdn}')
 * @param recipients - The recipients email address list
 * @param context - Optional context for template resolution
 * @param subject
 * @returns The full composer URL, or null if template is empty or recipient is invalid
 */
export function generateMailComposerUrl(
  template: string,
  recipients: string[],
  context: UriTemplateContext = {},
  subject?: string
): string | null {
  const mailSpaUrl = resolveMailSpaUrl(template, context)
  if (!mailSpaUrl) return null

  return buildMailComposerUrl(mailSpaUrl, recipients, subject)
}
