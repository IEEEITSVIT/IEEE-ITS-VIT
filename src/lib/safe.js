import DOMPurify from 'dompurify'

/** Only allow relative, http(s), mailto and tel links from CMS data. */
export function safeHref(url) {
    const s = String(url || '').trim()
    if (!s) return ''
    if (s.startsWith('/') || s.startsWith('#')) return s
    if (/^(https?:|mailto:|tel:)/i.test(s)) return s
    return ''
}

export const isExternal = url => /^(https?:|mailto:|tel:)/i.test(String(url || ''))

export const sanitizeHtml = html => DOMPurify.sanitize(String(html || ''), { ADD_ATTR: ['target', 'rel'] })

/** Inline-only sanitising for short strings that may carry <strong>/<em>. */
export const sanitizeInline = html => DOMPurify.sanitize(String(html || ''), { ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'br', 'a', 'span'], ALLOWED_ATTR: ['href', 'target', 'rel'] })

/** ImageKit-aware image URL: resize/crop via transformations for ImageKit URLs, leaves others untouched. */
export function img(url, { w, h, q = 80, face } = {}) {
    if (!url) return ''
    if (!/ik\.imagekit\.io/.test(url) || !w) return url
    const sep = url.includes('?') ? '&' : '?'
    const tr = [`w-${w}`, h && `h-${h}`, h && 'c-maintain_ratio', face && 'fo-face', `q-${q}`, 'f-auto'].filter(Boolean).join(',')
    return `${url}${sep}tr=${tr}`
}

/** Button text from the CMS without a trailing arrow (buttons draw their own animated arrow). */
export const label = text => String(text ?? '').replace(/[\s→›»>]+$/u, '')
