import { resolveUriTemplate, UriTemplateContext } from './uriTemplateUtils'

const FULL_MATRIX_ID = /^@[^:]+:.+$/

// "@{target}" followed by an optional ":server" part (literal or expression)
const TEMPLATE_MATRIX_ID = /@\{\s*target\s*\}(?::[^/?#&]*)?/g

/**
 * Resolve a chat SPA URL template.
 *
 * The template supports RFC 6570-style expressions, including {target}.
 * See {@link resolveUriTemplate} for supported placeholders.
 *
 * Templates usually expect {target} to be a bare localpart and add the "@"
 * (and the server) themselves, e.g. '.../#/chat/@{target}:{workplaceFqdn.domain}'.
 * When target is a full Matrix ID ("@user:server"), the "@{target}:server" part
 * of the template is replaced by the full Matrix ID so that neither the "@" nor
 * the server get duplicated. A leading "@" without server is stripped.
 *
 * @param template - The URL template (e.g. 'https://chat.example.com/#/chat/@{target}')
 * @param context - Optional context for template resolution
 * @returns the resolved URL, or null when template is empty
 */
export function resolveChatSpaUrl(
  template: string,
  context: UriTemplateContext = {}
): string | null {
  if (!template) return null

  if (typeof context.target !== 'string') {
    return resolveUriTemplate(template, context)
  }

  const target = context.target.trim()

  if (FULL_MATRIX_ID.test(target)) {
    return resolveUriTemplate(
      template.replace(TEMPLATE_MATRIX_ID, '{target}'),
      {
        ...context,
        target
      }
    )
  }

  return resolveUriTemplate(template, {
    ...context,
    target: target.replace(/^@/, '')
  })
}
