import { resolveUriTemplate, UriTemplateContext } from './uriTemplateUtils.js'

// Characters that would end the address or start new query parameters.
// An attendee address carrying them could add hidden parameters to the URL.
const QUERY_SEPARATORS = /[?&=#]/

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validate and sanitize attendee email addresses.
 *
 * @param addresses - Raw attendee addresses from user input
 * @returns Array of valid, sanitized email addresses
 */
function sanitizeAttendees(addresses: string[]): string[] {
  return addresses
    .map(address => address.trim())
    .filter(address => !QUERY_SEPARATORS.test(address))
    .filter(address => EMAIL_REGEX.test(address))
}

/**
 * Resolve a calendar SPA URL template.
 *
 * The template supports RFC 6570-style expressions.
 * See {@link resolveUriTemplate} for supported placeholders.
 *
 * @param template - The URL template (e.g. 'https://calendar.{workplaceFqdn}')
 * @param context - Optional context for template resolution
 * @returns the resolved URL, or null when template is empty
 */
export function resolveCalendarSpaUrl(
  template: string,
  context: UriTemplateContext = {}
): string | null {
  if (!template) return null

  return resolveUriTemplate(template, context)
}

/**
 * Build the full calendar event creation URL for given attendees.
 *
 * @param calendarSpaUrl - The resolved calendar SPA base URL
 * @param attendees - The attendee email addresses list
 * @returns The full event creation URL, or null if no attendee is valid
 */
export function buildCalendarEventUrl(
  calendarSpaUrl: string,
  attendees: string[]
): string | null {
  const validAttendees = sanitizeAttendees(attendees)
  if (validAttendees.length === 0) return null

  const encoded = validAttendees.map(a => encodeURIComponent(a)).join(',')
  return `${calendarSpaUrl}/newEvent?attendee=${encoded}`
}

/**
 * Generate a complete calendar event creation URL from a template.
 *
 * Combines template resolution and event URL building into a single call.
 *
 * @param template - The URL template (e.g. 'https://calendar.{workplaceFqdn}')
 * @param attendees - The attendee email addresses list
 * @param context - Optional context for template resolution
 * @returns The full event creation URL, or null if template is empty or no attendee is valid
 */
export function generateCalendarEventUrl(
  template: string,
  attendees: string[],
  context: UriTemplateContext = {}
): string | null {
  const calendarSpaUrl = resolveCalendarSpaUrl(template, context)
  if (!calendarSpaUrl) return null

  return buildCalendarEventUrl(calendarSpaUrl, attendees)
}
