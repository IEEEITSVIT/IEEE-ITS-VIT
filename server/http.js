/* Minimal request/response helpers shared by the Vercel function and the Vite dev middleware. */

export class HttpError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}

export const fail = (status, message) => { throw new HttpError(status, message) }

export function send(res, status, body, headers = {}) {
    if (res.headersSent) return
    const isString = typeof body === 'string'
    res.statusCode = status
    res.setHeader('Content-Type', isString ? (headers['Content-Type'] || 'text/plain; charset=utf-8') : 'application/json; charset=utf-8')
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
    res.end(isString ? body : JSON.stringify(body))
}

export async function readBody(req) {
    if (req.method === 'GET' || req.method === 'HEAD') return {}
    // Vercel's Node runtime may have already parsed the body.
    try {
        if (req.body !== undefined && req.body !== null) {
            if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {}
            if (Buffer.isBuffer(req.body)) return req.body.length ? JSON.parse(req.body.toString('utf8')) : {}
            return req.body
        }
    } catch { fail(400, 'Invalid JSON body') }
    const chunks = []
    let size = 0
    for await (const chunk of req) {
        size += chunk.length
        if (size > 2_000_000) fail(413, 'Request body too large')
        chunks.push(chunk)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    if (!raw) return {}
    try { return JSON.parse(raw) } catch { fail(400, 'Invalid JSON body') }
}

export function parseCookies(req) {
    const out = {}
    for (const part of (req.headers.cookie || '').split(';')) {
        const i = part.indexOf('=')
        if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
    }
    return out
}

export function cookie(name, value, { maxAge, secure } = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
    if (secure) parts.push('Secure')
    if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`)
    return parts.join('; ')
}

export const clientIp = req =>
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'

/* ───────────── Validation ───────────── */
export const str = (v, max = 500) => (v == null ? '' : String(v).trim().slice(0, max))

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const isEmail = v => EMAIL_RE.test(String(v || ''))

/** Accept relative paths, http(s), mailto and tel. Rejects javascript:, data: etc. */
export function safeUrl(v) {
    const s = str(v, 2000)
    if (!s) return ''
    if (s.startsWith('/') || s.startsWith('#')) return s
    if (/^(https?:|mailto:|tel:)/i.test(s)) return s
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`
    return ''
}

export const emailList = v => str(v, 2000).split(/[,;\s]+/).map(s => s.trim()).filter(isEmail)
