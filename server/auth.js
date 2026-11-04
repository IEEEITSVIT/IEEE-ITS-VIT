/**
 * Database-backed authentication.
 *  • Passwords: scrypt (N=16384, r=8, p=1) with a per-user random salt.
 *  • Sessions: HMAC-SHA256 signed, HttpOnly, SameSite=Lax cookie carrying
 *    { uid, tv, exp }. `tv` (token_version) lets an admin or a password change
 *    revoke every existing session for that user.
 *  • Login throttling stored in D1 so it works across serverless instances.
 */
import crypto from 'crypto'
import { getDb } from './db.js'
import { parseCookies, cookie, fail } from './http.js'

export const SESSION_COOKIE = 'its_session'
const SESSION_DAYS = 7

let warned = false
function secret() {
    const s = process.env.SESSION_SECRET
    if (s && s.length >= 32) return s
    if (process.env.VERCEL) fail(503, 'SESSION_SECRET (32+ chars) is not configured.')
    if (!warned) { console.warn('[auth] SESSION_SECRET not set — using an insecure development secret.'); warned = true }
    return 'dev-only-insecure-secret-change-me-0123456789'
}

/* ───────────── Passwords ───────────── */
const scrypt = (pw, salt) => new Promise((resolve, reject) =>
    crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(k))))

export async function hashPassword(pw) {
    const salt = crypto.randomBytes(16)
    const key = await scrypt(pw, salt)
    return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(pw, stored) {
    const [algo, saltB64, keyB64] = String(stored || '').split('$')
    if (algo !== 'scrypt' || !saltB64 || !keyB64) return false
    const expected = Buffer.from(keyB64, 'base64')
    const actual = await scrypt(pw, Buffer.from(saltB64, 'base64'))
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export function passwordProblem(pw) {
    if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.'
    if (pw.length > 128) return 'Password is too long.'
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain letters and numbers.'
    return null
}

/* ───────────── Session tokens ───────────── */
const b64url = buf => Buffer.from(buf).toString('base64url')
const sign = data => crypto.createHmac('sha256', secret()).update(data).digest('base64url')

export function createToken(user) {
    const payload = b64url(JSON.stringify({ uid: user.id, tv: user.token_version || 0, exp: Date.now() + SESSION_DAYS * 864e5 }))
    return `${payload}.${sign(payload)}`
}

function readToken(token) {
    const [payload, sig] = String(token || '').split('.')
    if (!payload || !sig) return null
    const expected = sign(payload)
    if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
        return data.exp > Date.now() ? data : null
    } catch { return null }
}

const isSecure = req => !!process.env.VERCEL || req.headers['x-forwarded-proto'] === 'https'

export const sessionCookie = (req, user) => cookie(SESSION_COOKIE, createToken(user), { maxAge: SESSION_DAYS * 86400, secure: isSecure(req) })
export const clearSessionCookie = req => cookie(SESSION_COOKIE, '', { maxAge: 0, secure: isSecure(req) })

export async function currentUser(req) {
    const data = readToken(parseCookies(req)[SESSION_COOKIE])
    if (!data) return null
    const user = await getDb().first('SELECT * FROM users WHERE id = ?', [data.uid])
    if (!user || !user.active || (user.token_version || 0) !== data.tv) return null
    return user
}

export const publicUser = u => u && ({
    id: u.id, name: u.name, email: u.email, role: u.role, mobile: u.mobile || '', regNo: u.reg_no || '',
    memberType: u.member_type || 'External Member', picture: u.avatar_url || '', createdAt: u.created_at,
})

export const memberTypeFor = email => /@(vit\.ac\.in|vitstudent\.ac\.in)$/i.test(email) ? 'VIT Student' : 'External Member'

/* ───────────── One-time codes (password reset) ───────────── */
export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5

export const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')

/** Codes are bound to the user and hashed with the server secret, so a leaked table row is useless. */
export const hashOtp = (code, userId) => crypto.createHmac('sha256', secret()).update(`reset:${userId}:${code}`).digest('hex')

export function otpMatches(code, userId, stored) {
    const a = Buffer.from(hashOtp(String(code), userId)), b = Buffer.from(String(stored))
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/* ───────────── Throttling ───────────── */
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 8

export async function assertNotThrottled(keys) {
    const db = getDb()
    const now = Date.now()
    for (const key of keys) {
        const row = await db.first('SELECT count, window_end FROM login_attempts WHERE key = ?', [key])
        if (row && row.window_end > now && row.count >= MAX_ATTEMPTS) {
            const mins = Math.ceil((row.window_end - now) / 60000)
            fail(429, `Too many attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`)
        }
    }
}

export async function recordFailure(keys) {
    const db = getDb()
    const now = Date.now()
    for (const key of keys) {
        await db.run(
            `INSERT INTO login_attempts (key, count, window_end) VALUES (?, 1, ?)
             ON CONFLICT(key) DO UPDATE SET
               count = CASE WHEN window_end < ? THEN 1 ELSE count + 1 END,
               window_end = CASE WHEN window_end < ? THEN ? ELSE window_end END`,
            [key, now + WINDOW_MS, now, now, now + WINDOW_MS]
        )
    }
}

export const clearFailures = keys => Promise.all(keys.map(k => getDb().run('DELETE FROM login_attempts WHERE key = ?', [k])))

/* ───────────── Symmetric encryption for stored secrets (SMTP password) ───────────── */
const encKey = () => crypto.createHash('sha256').update(`${process.env.ENCRYPTION_KEY || secret()}:smtp`).digest()

export function encrypt(text) {
    if (!text) return ''
    const iv = crypto.randomBytes(12)
    const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv)
    const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()])
    return `${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`
}

export function decrypt(blob) {
    try {
        const [iv, tag, data] = String(blob || '').split('.').map(s => Buffer.from(s, 'base64'))
        const d = crypto.createDecipheriv('aes-256-gcm', encKey(), iv)
        d.setAuthTag(tag)
        return Buffer.concat([d.update(data), d.final()]).toString('utf8')
    } catch { return '' }
}
