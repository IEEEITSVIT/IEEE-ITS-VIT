/**
 * IEEE ITS API
 *
 *  Public    GET  /api/public/bootstrap        published site content
 *            GET  /api/sitemap.xml · /api/robots.txt
 *            POST /api/queries · /api/subscribe
 *  Auth      POST /api/auth/register · login · logout · password   GET /api/auth/me   PUT /api/auth/profile
 *  Member    POST /api/orders   GET /api/orders/mine
 *  Admin     /api/admin/*  (editor: content, events, moments, media, orders, queries · admin: everything)
 */
import { getDb, parseJson, usingD1 } from './db.js'
import { HttpError, fail, send, readBody, clientIp, str, isEmail, safeUrl, emailList } from './http.js'
import {
    currentUser, publicUser, hashPassword, verifyPassword, passwordProblem, sessionCookie, clearSessionCookie,
    memberTypeFor, assertNotThrottled, recordFailure, clearFailures, encrypt,
    generateOtp, hashOtp, otpMatches, OTP_TTL_MS, OTP_MAX_ATTEMPTS,
} from './auth.js'
import { ensureReady } from './seed.js'
import { notifyOrder, notifyQuery, notifySubscriber, sendMail, smtpConfig, sendPasswordResetCode } from './mailer.js'
import { uploadAuth, deleteFile, imagekitConfigured } from './imagekit.js'
import { DEFAULT_SETTINGS, DEFAULT_PRIVATE_SETTINGS, PUBLIC_SETTING_KEYS } from '../shared/defaults.js'
import { cleanLayout, cleanImageStyle } from '../shared/layout.js'
import { installRecruitment } from './recruit.js'
import { installPortals } from './portals.js'
import { quotaStatus, setDailyLimit, drainCampaigns, createCampaign } from './campaigns.js'
import { CONTENT_TYPES, EVENT_FIELDS, MOMENT_FIELDS, SETTINGS_FORMS, PRIVATE_SETTINGS, slugify, eventStatus, getPath, setPath } from '../shared/cms.js'

/* ───────────── helpers ───────────── */
const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

const ROLE_RANK = { member: 1, editor: 2, admin: 3 }
const requireRole = (user, role) => {
    if (!user) fail(401, 'Please sign in.')
    if ((ROLE_RANK[user.role] || 0) < ROLE_RANK[role]) fail(403, 'You do not have permission for this action.')
}

async function audit(user, action, entity, entityId = '', details = '') {
    await getDb().run('INSERT INTO audit_logs (user_id, user_email, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [user?.id, user?.email || '', action, entity, String(entityId), String(details).slice(0, 1000)])
}

/** Strip scripts/handlers from admin-authored HTML (the client also sanitises with DOMPurify). */
const cleanHtml = html => String(html || '')
    .replace(/<\s*(script|style|iframe|object|embed|form)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["']?)\s*(javascript|vbscript|data):[^"'\s>]*/gi, '$1=$2#')

/** The site uses no emoji: pictographs, flags and their joiners are removed from text on save. */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{E0020}-\u{E007F}]|\u{FE0F}|\u{200D}|\u{20E3}/gu
export const stripEmoji = v => (typeof v === 'string' ? v.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/gm, '') : v)

/** Coerce a value according to its CMS field definition. */
function cleanField(field, value) {
    if (['text', 'textarea', 'html', 'strings', 'rows', undefined].includes(field.type)) value = Array.isArray(value)
        ? value.map(v => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripEmoji(x)])) : stripEmoji(v)))
        : stripEmoji(value)
    switch (field.type) {
        case 'url': return safeUrl(value)
        case 'image': return safeUrl(value)
        case 'images': return (Array.isArray(value) ? value : []).map(safeUrl).filter(Boolean).slice(0, 200)
        case 'number': return value === '' || value == null ? null : Number(value) || 0
        case 'toggle': return !!value
        case 'html': return cleanHtml(value).slice(0, 200_000)
        case 'textarea': return str(value, 20_000)
        case 'strings': return (Array.isArray(value) ? value : String(value || '').split('\n')).map(v => cleanHtml(str(v, 2000))).filter(Boolean)
        case 'colors': return (Array.isArray(value) ? value : []).map(c => str(c, 30)).filter(c => /^#[0-9a-f]{3,8}$|^[a-z]+$|^rgba?\(/i.test(c))
        case 'select': return field.options?.includes(value) ? value : field.options?.[0] || ''
        case 'rows': return (Array.isArray(value) ? value : []).slice(0, 100).map(row => Object.fromEntries(
            (field.fields || []).map(sf => [sf.name, sf.type === 'url' ? safeUrl(row?.[sf.name]) : str(row?.[sf.name], 1000)])))
        case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : null
        case 'event': return value ? Number(value) || null : null
        case 'color': return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : null
        case 'seo-pages': return value && typeof value === 'object' ? value : {}
        default: return str(value, 2000)
    }
}

function cleanByFields(fields, input) {
    let out = {}
    for (const f of fields) {
        const v = cleanField(f, getPath(input, f.name))
        if (f.required && (v === '' || v == null || (Array.isArray(v) && !v.length))) fail(400, `${f.label} is required.`)
        out = setPath(out, f.name, v)
    }
    return out
}

const isLive = (row, now) => row.status === 'published' && (!row.starts_at || row.starts_at <= now) && (!row.ends_at || row.ends_at >= now)

const contentRow = r => ({ id: r.id, ...parseJson(r.data, {}), _status: r.status, _sort: r.sort_order, _starts_at: r.starts_at, _ends_at: r.ends_at, _updated_at: r.updated_at })

const eventRow = r => ({ ...r, extra: parseJson(r.extra, {}), featured: !!r.featured, show_in_timeline: !!r.show_in_timeline, state: eventStatus(r) })

async function loadSettings(keys) {
    const rows = await getDb().all(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`, keys)
    const stored = Object.fromEntries(rows.map(r => [r.key, parseJson(r.value, {})]))
    const defaults = { ...DEFAULT_SETTINGS, ...DEFAULT_PRIVATE_SETTINGS }
    return Object.fromEntries(keys.map(k => [k, deepMerge(defaults[k], stored[k])]))
}

function deepMerge(base, over) {
    if (over === undefined) return base
    if (Array.isArray(over) || typeof over !== 'object' || over === null || typeof base !== 'object' || Array.isArray(base) || !base) return over
    const out = { ...base }
    for (const [k, v] of Object.entries(over)) out[k] = deepMerge(base[k], v)
    return out
}

async function loadEvents({ includeDrafts = false } = {}) {
    const rows = await getDb().all(`SELECT * FROM events ${includeDrafts ? '' : "WHERE status = 'published'"} ORDER BY start_date ASC, id ASC`)
    return rows.map(eventRow)
}

async function loadMoments({ includeDrafts = false, events }) {
    const rows = await getDb().all(`SELECT * FROM moments ${includeDrafts ? '' : "WHERE status = 'published'"} ORDER BY sort_order ASC, id ASC`)
    const byId = Object.fromEntries(events.map(e => [e.id, e]))
    return rows.map(r => {
        const ev = byId[r.event_id]
        return {
            ...r, photos: parseJson(r.photos, []), show_on_home: !!r.show_on_home,
            event: ev ? { id: ev.id, slug: ev.slug, title: ev.title, start_date: ev.start_date } : null,
            effective_date: ev?.start_date || r.album_date || '',
        }
    }).sort((a, b) => (b.effective_date || '').localeCompare(a.effective_date || '') || a.sort_order - b.sort_order)
}

/* ───────────── ImageKit cleanup ─────────────
 * When content stops using an uploaded image (item deleted or photo replaced), the file is
 * removed from ImageKit — but only if nothing else on the site still uses it. */
const IK_URL = /https:\/\/ik\.imagekit\.io\/[^"'\s\\)<>]+/g
const imageUrls = (...values) => new Set(values.flatMap(v => String(typeof v === 'string' ? v : JSON.stringify(v ?? '')).match(IK_URL) || []))
const dropped = (before, after) => [...before].filter(u => !after.has(u))

async function imageUsage(url) {
    const db = getDb()
    const [content, events, moments, settings] = await Promise.all([
        db.all('SELECT type, data FROM content WHERE instr(data, ?) > 0', [url]),
        db.all('SELECT title FROM events WHERE instr(poster_url, ?) > 0 OR instr(extra, ?) > 0 OR instr(body_html, ?) > 0', [url, url, url]),
        db.all('SELECT title FROM moments WHERE instr(photos, ?) > 0', [url]),
        db.all("SELECT key FROM settings WHERE key != 'image_styles' AND instr(value, ?) > 0", [url]),
    ])
    return [
        ...content.map(r => { const t = CONTENT_TYPES[r.type]; const d = parseJson(r.data, {}); return `${t?.label || r.type}: ${d[t?.title] || 'item'}` }),
        ...events.map(r => `Event: ${r.title}`),
        ...moments.map(r => `Album: ${r.title}`),
        ...settings.map(r => `Settings: ${SETTINGS_FORMS[r.key]?.label || r.key}`),
    ]
}

async function releaseImages(user, urls) {
    const db = getDb()
    for (const url of urls) {
        try {
            const m = await db.first('SELECT * FROM media WHERE url = ?', [url])
            if (!m) continue // not uploaded through this site — leave it alone
            if ((await imageUsage(url)).length) continue
            await deleteFile(m.file_id)
            await db.run('DELETE FROM media WHERE id = ?', [m.id])
            await forgetImageStyle(url)
            await audit(user, 'delete', 'media', m.id, `Removed from ImageKit (no longer used): ${m.name || url}`)
        } catch (e) {
            console.error('[media] cleanup failed for', url, e.message)
        }
    }
}

/** Drop the crop settings of an image that no longer exists. */
async function forgetImageStyle(url) {
    const row = await getDb().first("SELECT value FROM settings WHERE key = 'image_styles'")
    const styles = parseJson(row?.value, {})
    if (!styles[url]) return
    delete styles[url]
    await getDb().run("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'image_styles'", [JSON.stringify(styles)])
}

/* ───────────── route table ───────────── */
const routes = []
const route = (method, pattern, handler) => {
    const keys = []
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '/?$')
    routes.push({ method, re, keys, handler })
}

/* ── public ── */
route('GET', '/api/health', async () => ({ ok: true, database: usingD1() ? 'cloudflare-d1' : 'local-sqlite', imagekit: imagekitConfigured() }))

route('GET', '/api/public/bootstrap', async ({ res }) => {
    const db = getDb()
    const now = nowIso()
    const [settings, contentRows, events] = await Promise.all([
        loadSettings(PUBLIC_SETTING_KEYS),
        db.all('SELECT * FROM content ORDER BY type, sort_order ASC, id ASC'),
        loadEvents(),
    ])
    const moments = await loadMoments({ events })
    const content = Object.fromEntries(Object.keys(CONTENT_TYPES).map(t => [t, []]))
    for (const r of contentRows) if (content[r.type] && isLive(r, now)) content[r.type].push(contentRow(r))
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=300')
    return { settings, content, events, moments, generatedAt: new Date().toISOString() }
})

/* Sitemap URLs must be on the host the sitemap is fetched from (Search Console rejects others),
   so use the requesting host and fall back to the admin-set site URL. */
const siteBase = (site, req) => {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
    const proto = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https'
    return (host ? `${proto}://${host}` : site.url || '').replace(/\/$/, '')
}

route('GET', '/api/sitemap.xml', async ({ req, res }) => {
    const [{ site }, events, blogs] = await Promise.all([
        loadSettings(['site']), loadEvents(), getDb().all("SELECT data, updated_at FROM content WHERE type = 'blogs' AND status = 'published'"),
    ])
    const base = siteBase(site, req)
    const pages = ['/', '/timeline', '/moments', '/blogs', '/vlogs', '/faculty', '/merch', '/games', '/faq', '/join', '/contact', '/suggestions', '/web-team']
    const urls = [
        ...pages.map(p => ({ loc: base + p, priority: p === '/' ? '1.0' : '0.7' })),
        ...events.map(e => ({ loc: `${base}/events/${e.slug}`, lastmod: e.updated_at?.slice(0, 10), priority: e.state === 'upcoming' ? '0.9' : '0.5' })),
        ...blogs.map(b => { const d = parseJson(b.data, {}); return { loc: `${base}/blogs/${d.slug || slugify(d.title)}`, lastmod: b.updated_at?.slice(0, 10), priority: '0.6' } }),
    ]
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u =>
        `  <url><loc>${u.loc.replace(/&/g, '&amp;')}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`
    send(res, 200, xml, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' })
})

route('GET', '/api/robots.txt', async ({ req, res }) => {
    const { site } = await loadSettings(['site'])
    const base = siteBase(site, req)
    send(res, 200, `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`, { 'Cache-Control': 'public, s-maxage=3600' })
})

route('POST', '/api/queries', async ({ req, body, user }) => {
    if (body.website) return { ok: true } // honeypot
    const kind = ['query', 'suggestion', 'contact'].includes(body.kind) ? body.kind : 'query'
    if (kind === 'suggestion' && !user) fail(401, 'Please sign in to share suggestions.')
    const ipKey = [`query:${clientIp(req)}`]
    await assertNotThrottled(ipKey)
    const q = {
        kind, user_id: user?.id || null,
        name: str(user?.name || body.name, 120), email: str(user?.email || body.email, 200).toLowerCase(),
        subject: str(body.subject, 200), message: str(body.message, 5000),
    }
    if (!isEmail(q.email)) fail(400, 'Please enter a valid email address.')
    if (q.message.length < 3) fail(400, 'Please enter a message.')
    await recordFailure(ipKey) // counts submissions per IP per 15 minutes
    const r = await getDb().run('INSERT INTO queries (user_id, kind, name, email, subject, message) VALUES (?, ?, ?, ?, ?, ?)',
        [q.user_id, q.kind, q.name, q.email, q.subject, q.message])
    const saved = await getDb().first('SELECT * FROM queries WHERE id = ?', [r.lastId])
    await notifyQuery(saved).catch(e => console.error('[mail]', e.message))
    return { ok: true, id: r.lastId }
})

route('POST', '/api/subscribe', async ({ body }) => {
    const email = str(body.email, 200).toLowerCase()
    const list = body.list === 'vlogs' ? 'vlogs' : 'newsletter'
    if (!isEmail(email)) fail(400, 'Please enter a valid email address.')
    const r = await getDb().run('INSERT OR IGNORE INTO subscribers (email, list) VALUES (?, ?)', [email, list])
    if (r.changes) await notifySubscriber(email, list)?.catch?.(() => {})
    return { ok: true, already: !r.changes }
})

/* ── auth ── */
route('POST', '/api/auth/register', async ({ req, res, body }) => {
    const name = str(body.name, 120)
    const email = str(body.email, 200).toLowerCase()
    if (name.length < 2) fail(400, 'Please enter your full name.')
    if (!isEmail(email)) fail(400, 'Please enter a valid email address.')
    const problem = passwordProblem(body.password)
    if (problem) fail(400, problem)
    await assertNotThrottled([`ip:${clientIp(req)}`])
    const db = getDb()
    if (await db.first('SELECT id FROM users WHERE email = ?', [email])) fail(409, 'An account with this email already exists. Please sign in.')
    const r = await db.run(
        'INSERT INTO users (name, email, password_hash, mobile, reg_no, member_type, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, email, await hashPassword(body.password), str(body.mobile, 15).replace(/\D/g, '').slice(0, 10), str(body.regNo, 12).toUpperCase(), memberTypeFor(email), nowIso()]
    )
    const user = await db.first('SELECT * FROM users WHERE id = ?', [r.lastId])
    await db.run("INSERT INTO activity_logs (user_id, email, type) VALUES (?, ?, 'REGISTER')", [user.id, email])
    res.setHeader('Set-Cookie', sessionCookie(req, user))
    return { user: publicUser(user) }
})

route('POST', '/api/auth/login', async ({ req, res, body }) => {
    const email = str(body.email, 200).toLowerCase()
    const keys = [`ip:${clientIp(req)}`, `email:${email}`]
    await assertNotThrottled(keys)
    const db = getDb()
    const user = await db.first('SELECT * FROM users WHERE email = ?', [email])
    const ok = user && await verifyPassword(String(body.password || ''), user.password_hash)
    if (!ok) { await recordFailure(keys); fail(401, 'Incorrect email or password.') }
    if (!user.active) fail(403, 'This account has been disabled. Please contact the chapter.')
    await clearFailures([`email:${email}`])
    await db.run('UPDATE users SET last_login_at = ? WHERE id = ?', [nowIso(), user.id])
    await db.run("INSERT INTO activity_logs (user_id, email, type) VALUES (?, ?, 'LOGIN')", [user.id, email])
    res.setHeader('Set-Cookie', sessionCookie(req, user))
    return { user: publicUser(user) }
})

route('POST', '/api/auth/logout', async ({ req, res }) => {
    res.setHeader('Set-Cookie', clearSessionCookie(req))
    return { ok: true }
})

route('GET', '/api/auth/me', async ({ user, res }) => {
    res.setHeader('Cache-Control', 'no-store')
    return { user: publicUser(user) }
})

route('PUT', '/api/auth/profile', async ({ user, body }) => {
    requireRole(user, 'member')
    const name = str(body.name, 120) || user.name
    const mobile = str(body.mobile, 15).replace(/\D/g, '').slice(0, 10)
    const regNo = str(body.regNo, 12).toUpperCase()
    if (mobile && mobile.length !== 10) fail(400, 'Mobile number must be 10 digits.')
    await getDb().run("UPDATE users SET name = ?, mobile = ?, reg_no = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?",
        [name, mobile, regNo, safeUrl(body.picture ?? user.avatar_url), user.id])
    return { user: publicUser(await getDb().first('SELECT * FROM users WHERE id = ?', [user.id])) }
})

/* Forgot password: email a 6-digit code. The response never reveals whether the account exists. */
route('POST', '/api/auth/forgot', async ({ req, body }) => {
    const email = str(body.email, 200).toLowerCase()
    if (!isEmail(email)) fail(400, 'Please enter a valid email address.')
    const smtp = await smtpConfig()
    if (!smtp.host || !smtp.user || !smtp.pass) fail(503, 'Password reset by email is not available right now. Please contact the chapter.')
    const keys = [`reset-ip:${clientIp(req)}`, `reset-email:${email}`]
    await assertNotThrottled(keys)
    await recordFailure(keys) // counts requests per IP and per email (15-minute window)
    const db = getDb()
    const user = await db.first('SELECT * FROM users WHERE email = ? AND active = 1', [email])
    if (user) {
        const code = generateOtp()
        await db.run('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0', [user.id])
        await db.run('INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES (?, ?, ?)', [user.id, hashOtp(code, user.id), Date.now() + OTP_TTL_MS])
        const sent = await sendPasswordResetCode(user, code)
        if (!sent.ok) console.error('[reset] email failed:', sent.error)
    }
    return { ok: true, message: 'If an account exists for that email, a 6-digit code is on its way.' }
})

route('POST', '/api/auth/reset', async ({ req, res, body }) => {
    const email = str(body.email, 200).toLowerCase()
    const code = str(body.code, 10).replace(/\s/g, '')
    if (!/^\d{6}$/.test(code)) fail(400, 'Enter the 6-digit code from the email.')
    const problem = passwordProblem(body.password)
    if (problem) fail(400, problem)
    const ipKey = [`reset-verify-ip:${clientIp(req)}`]
    await assertNotThrottled(ipKey)
    const db = getDb()
    const user = await db.first('SELECT * FROM users WHERE email = ? AND active = 1', [email])
    const reset = user && await db.first('SELECT * FROM password_resets WHERE user_id = ? AND used = 0 ORDER BY id DESC LIMIT 1', [user.id])
    const invalid = async () => { await recordFailure(ipKey); fail(400, 'That code is invalid or has expired. Request a new one.') }
    if (!reset || reset.expires_at < Date.now() || reset.attempts >= OTP_MAX_ATTEMPTS) return invalid()
    if (!otpMatches(code, user.id, reset.code_hash)) {
        await db.run('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', [reset.id])
        return invalid()
    }
    await db.run('UPDATE password_resets SET used = 1 WHERE user_id = ?', [user.id])
    await db.run("UPDATE users SET password_hash = ?, token_version = token_version + 1, last_login_at = ?, updated_at = datetime('now') WHERE id = ?",
        [await hashPassword(body.password), nowIso(), user.id])
    await clearFailures([`email:${email}`, `reset-email:${email}`])
    await db.run("INSERT INTO activity_logs (user_id, email, type) VALUES (?, ?, 'PASSWORD_RESET')", [user.id, email])
    const fresh = await db.first('SELECT * FROM users WHERE id = ?', [user.id])
    res.setHeader('Set-Cookie', sessionCookie(req, fresh))
    return { user: publicUser(fresh) }
})

route('POST', '/api/auth/password', async ({ req, res, user, body }) => {
    requireRole(user, 'member')
    if (!await verifyPassword(String(body.current || ''), user.password_hash)) fail(400, 'Current password is incorrect.')
    const problem = passwordProblem(body.next)
    if (problem) fail(400, problem)
    await getDb().run("UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?",
        [await hashPassword(body.next), user.id])
    const fresh = await getDb().first('SELECT * FROM users WHERE id = ?', [user.id])
    res.setHeader('Set-Cookie', sessionCookie(req, fresh))
    return { ok: true }
})

/* ── member: orders ── */
route('POST', '/api/orders', async ({ user, body }) => {
    requireRole(user, 'member')
    const db = getDb()
    const [{ merch: cfg }, itemRow] = await Promise.all([
        loadSettings(['merch']),
        db.first("SELECT * FROM content WHERE type = 'merch' AND id = ? AND status = 'published'", [Number(body.itemId)]),
    ])
    if (!itemRow) fail(404, 'This product is no longer available.')
    const item = parseJson(itemRow.data, {})
    if (item.comingSoon) fail(400, 'This product is not open for booking yet.')
    const size = str(body.size, 10)
    if (!cfg.sizes.includes(size)) fail(400, 'Please choose a size.')
    const qty = Math.max(1, Math.min(Number(cfg.maxQty) || 5, Math.floor(Number(body.qty) || 1)))
    if (cfg.requireMobile && !user.mobile) fail(400, 'MOBILE_REQUIRED')
    const colors = item.colors || []
    const color = colors.includes(body.color) ? body.color : colors[0] || ''
    const price = Number(item.price) || 0
    const r = await db.run(
        'INSERT INTO orders (user_id, name, email, mobile, reg_no, item_id, item, size, color, qty, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [user.id, user.name, user.email, user.mobile, user.reg_no, itemRow.id, item.name, size, color, qty, price, price * qty]
    )
    const order = await db.first('SELECT * FROM orders WHERE id = ?', [r.lastId])
    await notifyOrder(order).catch(e => console.error('[mail]', e.message))
    return { order }
})

route('GET', '/api/orders/mine', async ({ user, res }) => {
    requireRole(user, 'member')
    res.setHeader('Cache-Control', 'no-store')
    return { orders: await getDb().all('SELECT * FROM orders WHERE user_id = ? OR email = ? ORDER BY id DESC', [user.id, user.email]) }
})

/* ── admin: dashboard ── */
route('GET', '/api/admin/stats', async ({ user }) => {
    requireRole(user, 'editor')
    const db = getDb()
    const one = sql => db.first(sql).then(r => r?.n || 0)
    const [users, orders, newOrders, queries, newQueries, subscribers, events] = await Promise.all([
        one('SELECT COUNT(*) n FROM users'), one('SELECT COUNT(*) n FROM orders'), one("SELECT COUNT(*) n FROM orders WHERE status = 'Booked'"),
        one('SELECT COUNT(*) n FROM queries'), one("SELECT COUNT(*) n FROM queries WHERE status = 'New'"),
        one('SELECT COUNT(*) n FROM subscribers'), loadEvents({ includeDrafts: true }),
    ])
    const [recentOrders, recentQueries, recentAudit, emailFailures] = await Promise.all([
        db.all('SELECT * FROM orders ORDER BY id DESC LIMIT 5'), db.all('SELECT * FROM queries ORDER BY id DESC LIMIT 5'),
        db.all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 8'), one("SELECT COUNT(*) n FROM email_logs WHERE status != 'sent' AND created_at > datetime('now', '-7 days')"),
    ])
    const smtp = await smtpConfig()
    return {
        counts: { users, orders, newOrders, queries, newQueries, subscribers, events: events.length, upcoming: events.filter(e => e.state !== 'past').length },
        upcoming: events.filter(e => e.state !== 'past').slice(0, 5),
        recentOrders, recentQueries, recentAudit, emailFailures,
        integrations: { database: usingD1() ? 'Cloudflare D1' : 'Local SQLite (dev)', imagekit: imagekitConfigured(), smtp: !!(smtp.host && smtp.user && smtp.pass) },
    }
})

/* ── admin: generic content ── */
const typeDef = type => CONTENT_TYPES[type] || fail(404, 'Unknown content type')

route('GET', '/api/admin/content/:type', async ({ user, params }) => {
    requireRole(user, 'editor'); typeDef(params.type)
    const rows = await getDb().all('SELECT * FROM content WHERE type = ? ORDER BY sort_order ASC, id ASC', [params.type])
    return { items: rows.map(contentRow) }
})

function contentMeta(body) {
    return {
        status: body.status === 'draft' ? 'draft' : 'published',
        starts_at: body.starts_at ? str(body.starts_at, 25).replace('T', ' ') : null,
        ends_at: body.ends_at ? str(body.ends_at, 25).replace('T', ' ') : null,
    }
}

function prepareContent(type, data) {
    const def = typeDef(type)
    const clean = cleanByFields(def.fields, data || {})
    if (type === 'blogs') clean.slug = slugify(clean.slug || clean.title)
    return clean
}

route('POST', '/api/admin/content/:type', async ({ user, params, body }) => {
    requireRole(user, 'editor')
    const data = prepareContent(params.type, body.data)
    const meta = contentMeta(body)
    const db = getDb()
    const max = await db.first('SELECT COALESCE(MAX(sort_order), -1) AS m FROM content WHERE type = ?', [params.type])
    const r = await db.run('INSERT INTO content (type, data, sort_order, status, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)',
        [params.type, JSON.stringify(data), max.m + 1, meta.status, meta.starts_at, meta.ends_at])
    await audit(user, 'create', params.type, r.lastId, data[CONTENT_TYPES[params.type].title] || '')
    return { item: contentRow(await db.first('SELECT * FROM content WHERE id = ?', [r.lastId])) }
})

route('PUT', '/api/admin/content/:type/:id', async ({ user, params, body }) => {
    requireRole(user, 'editor')
    const data = prepareContent(params.type, body.data)
    const meta = contentMeta(body)
    const db = getDb()
    const before = await db.first('SELECT data FROM content WHERE id = ? AND type = ?', [Number(params.id), params.type])
    if (!before) fail(404, 'Item not found')
    await db.run("UPDATE content SET data = ?, status = ?, starts_at = ?, ends_at = ?, updated_at = datetime('now') WHERE id = ? AND type = ?",
        [JSON.stringify(data), meta.status, meta.starts_at, meta.ends_at, Number(params.id), params.type])
    await audit(user, 'update', params.type, params.id, data[CONTENT_TYPES[params.type].title] || '')
    await releaseImages(user, dropped(imageUrls(before.data), imageUrls(data)))
    return { item: contentRow(await db.first('SELECT * FROM content WHERE id = ?', [Number(params.id)])) }
})

route('DELETE', '/api/admin/content/:type/:id', async ({ user, params }) => {
    requireRole(user, 'editor'); typeDef(params.type)
    const before = await getDb().first('SELECT data FROM content WHERE id = ? AND type = ?', [Number(params.id), params.type])
    if (!before) fail(404, 'Item not found')
    await getDb().run('DELETE FROM content WHERE id = ? AND type = ?', [Number(params.id), params.type])
    await audit(user, 'delete', params.type, params.id)
    await releaseImages(user, imageUrls(before.data))
    return { ok: true }
})

route('POST', '/api/admin/content/:type/reorder', async ({ user, params, body }) => {
    requireRole(user, 'editor'); typeDef(params.type)
    const ids = (body.ids || []).map(Number).filter(Boolean)
    for (let i = 0; i < ids.length; i++) await getDb().run('UPDATE content SET sort_order = ? WHERE id = ? AND type = ?', [i, ids[i], params.type])
    await audit(user, 'reorder', params.type, '', ids.join(','))
    return { ok: true }
})

/* ── admin: events ── */
async function uniqueSlug(table, base, id) {
    let slug = slugify(base), n = 1
    while (await getDb().first(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`, [slug, id || 0])) slug = `${slugify(base)}-${++n}`
    return slug
}

function prepareEvent(body) {
    const e = cleanByFields(EVENT_FIELDS, body)
    if (e.end_date && e.end_date < e.start_date) fail(400, 'End date cannot be before the start date.')
    return { ...e, status: body.status === 'draft' ? 'draft' : 'published' }
}

const EVENT_COLS = ['slug', 'title', 'tag', 'summary', 'body_html', 'start_date', 'end_date', 'date_label', 'time_text', 'venue', 'poster_url', 'registration_url', 'cta_label', 'extra', 'featured', 'show_in_timeline', 'status']

route('GET', '/api/admin/events', async ({ user }) => {
    requireRole(user, 'editor')
    return { items: (await loadEvents({ includeDrafts: true })).reverse() }
})

route('POST', '/api/admin/events', async ({ user, body }) => {
    requireRole(user, 'editor')
    const e = prepareEvent(body)
    e.slug = await uniqueSlug('events', e.slug || e.title)
    const r = await getDb().run(`INSERT INTO events (${EVENT_COLS.join(',')}) VALUES (${EVENT_COLS.map(() => '?').join(',')})`, EVENT_COLS.map(c => e[c]))
    await audit(user, 'create', 'event', r.lastId, e.title)
    return { item: eventRow(await getDb().first('SELECT * FROM events WHERE id = ?', [r.lastId])) }
})

route('PUT', '/api/admin/events/:id', async ({ user, params, body }) => {
    requireRole(user, 'editor')
    const id = Number(params.id)
    const e = prepareEvent(body)
    e.slug = await uniqueSlug('events', e.slug || e.title, id)
    const before = await getDb().first('SELECT poster_url, extra, body_html FROM events WHERE id = ?', [id])
    if (!before) fail(404, 'Event not found')
    await getDb().run(`UPDATE events SET ${EVENT_COLS.map(c => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`, [...EVENT_COLS.map(c => e[c]), id])
    await audit(user, 'update', 'event', id, e.title)
    await releaseImages(user, dropped(imageUrls(before.poster_url, before.extra, before.body_html), imageUrls(e.poster_url, e.extra, e.body_html)))
    return { item: eventRow(await getDb().first('SELECT * FROM events WHERE id = ?', [id])) }
})

route('DELETE', '/api/admin/events/:id', async ({ user, params }) => {
    requireRole(user, 'editor')
    const id = Number(params.id)
    const before = await getDb().first('SELECT poster_url, extra, body_html FROM events WHERE id = ?', [id])
    if (!before) fail(404, 'Event not found')
    await getDb().run('UPDATE moments SET event_id = NULL WHERE event_id = ?', [id])
    await getDb().run('DELETE FROM events WHERE id = ?', [id])
    await audit(user, 'delete', 'event', id)
    await releaseImages(user, imageUrls(before.poster_url, before.extra, before.body_html))
    return { ok: true }
})

/* ── admin: moments ── */
const MOMENT_COLS = ['title', 'event_id', 'album_date', 'photos', 'show_on_home', 'status']
const prepareMoment = body => ({ ...cleanByFields(MOMENT_FIELDS, body), status: body.status === 'draft' ? 'draft' : 'published' })

route('GET', '/api/admin/moments', async ({ user }) => {
    requireRole(user, 'editor')
    const events = await loadEvents({ includeDrafts: true })
    return { items: await loadMoments({ includeDrafts: true, events }) }
})

route('POST', '/api/admin/moments', async ({ user, body }) => {
    requireRole(user, 'editor')
    const m = prepareMoment(body)
    const max = await getDb().first('SELECT COALESCE(MAX(sort_order), -1) AS m FROM moments')
    const r = await getDb().run(`INSERT INTO moments (${MOMENT_COLS.join(',')}, sort_order) VALUES (${MOMENT_COLS.map(() => '?').join(',')}, ?)`, [...MOMENT_COLS.map(c => m[c]), max.m + 1])
    await audit(user, 'create', 'moment', r.lastId, m.title)
    return { id: r.lastId }
})

route('PUT', '/api/admin/moments/:id', async ({ user, params, body }) => {
    requireRole(user, 'editor')
    const m = prepareMoment(body)
    const before = await getDb().first('SELECT photos FROM moments WHERE id = ?', [Number(params.id)])
    if (!before) fail(404, 'Album not found')
    await getDb().run(`UPDATE moments SET ${MOMENT_COLS.map(c => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`, [...MOMENT_COLS.map(c => m[c]), Number(params.id)])
    await audit(user, 'update', 'moment', params.id, m.title)
    await releaseImages(user, dropped(imageUrls(before.photos), imageUrls(m.photos)))
    return { ok: true }
})

route('DELETE', '/api/admin/moments/:id', async ({ user, params }) => {
    requireRole(user, 'editor')
    const before = await getDb().first('SELECT photos FROM moments WHERE id = ?', [Number(params.id)])
    if (!before) fail(404, 'Album not found')
    await getDb().run('DELETE FROM moments WHERE id = ?', [Number(params.id)])
    await audit(user, 'delete', 'moment', params.id)
    await releaseImages(user, imageUrls(before.photos))
    return { ok: true }
})

route('POST', '/api/admin/moments/reorder', async ({ user, body }) => {
    requireRole(user, 'editor')
    const ids = (body.ids || []).map(Number).filter(Boolean)
    for (let i = 0; i < ids.length; i++) await getDb().run('UPDATE moments SET sort_order = ? WHERE id = ?', [i, ids[i]])
    return { ok: true }
})

/* ── admin: settings ── */
route('GET', '/api/admin/settings', async ({ user }) => {
    requireRole(user, 'editor')
    const keys = user.role === 'admin' ? [...PUBLIC_SETTING_KEYS, ...PRIVATE_SETTINGS] : PUBLIC_SETTING_KEYS
    const s = await loadSettings(keys)
    if (s.smtp) { s.smtp = { ...s.smtp, hasPassword: !!s.smtp.passEnc || !!process.env.SMTP_PASS }; delete s.smtp.passEnc }
    return { settings: s }
})

route('PUT', '/api/admin/settings/:key', async ({ user, params, body }) => {
    const { key } = params
    if (PRIVATE_SETTINGS.includes(key)) requireRole(user, 'admin')
    else if (PUBLIC_SETTING_KEYS.includes(key)) requireRole(user, 'editor')
    else fail(404, 'Unknown setting')
    let value = body.value && typeof body.value === 'object' ? body.value : fail(400, 'Invalid value')
    const db = getDb()
    if (SETTINGS_FORMS[key]) {
        const current = (await loadSettings([key]))[key]
        let cleaned = { ...current }
        for (const f of SETTINGS_FORMS[key].fields) cleaned = setPath(cleaned, f.name, cleanField(f, getPath(value, f.name)))
        value = cleaned
    } else if (key === 'layout') {
        value = cleanLayout(value)
    } else if (key === 'image_styles') {
        // The admin sends only the images it changed; null removes an image's crop.
        const current = (await loadSettings(['image_styles'])).image_styles || {}
        value = { ...current }
        for (const [url, style] of Object.entries(body.value).slice(0, 200)) {
            const u = safeUrl(url)
            if (!u) continue
            const clean = cleanImageStyle(style)
            if (clean) value[u] = clean
            else delete value[u]
        }
    } else if (key === 'notifications') {
        value = {
            orderRecipients: emailList(value.orderRecipients).join(', '), queryRecipients: emailList(value.queryRecipients).join(', '),
            notifyOrders: !!value.notifyOrders, notifyQueries: !!value.notifyQueries, notifySuggestions: !!value.notifySuggestions,
            notifySubscribers: !!value.notifySubscribers, sendUserConfirmation: !!value.sendUserConfirmation,
        }
    } else if (key === 'smtp') {
        const current = (await loadSettings(['smtp'])).smtp
        value = {
            host: str(value.host, 200), port: Number(value.port) || 587, secure: !!value.secure, user: str(value.user, 200),
            fromName: str(value.fromName, 100), fromEmail: isEmail(value.fromEmail) ? str(value.fromEmail, 200) : '',
            passEnc: value.pass ? encrypt(String(value.pass)) : value.clearPassword ? '' : current.passEnc || '',
        }
    }
    const json = JSON.stringify(value)
    if (json.length > 500_000) fail(413, 'Setting is too large')
    const before = await db.first('SELECT value FROM settings WHERE key = ?', [key])
    await db.run("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", [key, json])
    await audit(user, 'update', 'settings', key)
    if (key !== 'image_styles') await releaseImages(user, dropped(imageUrls(before?.value), imageUrls(json)))
    return { ok: true, value }
})

/* ── admin: media ── */
route('GET', '/api/admin/media/auth', async ({ user, res }) => {
    requireRole(user, 'editor')
    res.setHeader('Cache-Control', 'no-store')
    return uploadAuth()
})

route('GET', '/api/admin/media', async ({ user }) => {
    requireRole(user, 'editor')
    return { items: await getDb().all('SELECT * FROM media ORDER BY id DESC LIMIT 500'), imagekit: imagekitConfigured() }
})

route('POST', '/api/admin/media', async ({ user, body }) => {
    requireRole(user, 'editor')
    const url = safeUrl(body.url)
    if (!/^https?:\/\//.test(url)) fail(400, 'A full image URL is required.')
    const r = await getDb().run('INSERT INTO media (url, file_id, name, folder, mime, size, width, height, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [url, str(body.fileId, 100), str(body.name, 200), str(body.folder, 200), str(body.mime, 60), Number(body.size) || 0, Number(body.width) || 0, Number(body.height) || 0, user.id])
    await audit(user, 'upload', 'media', r.lastId, body.name || url)
    return { item: await getDb().first('SELECT * FROM media WHERE id = ?', [r.lastId]) }
})

route('DELETE', '/api/admin/media/:id', async ({ user, params }) => {
    requireRole(user, 'editor')
    const m = await getDb().first('SELECT * FROM media WHERE id = ?', [Number(params.id)])
    if (!m) fail(404, 'File not found')
    const usedIn = await imageUsage(m.url)
    if (usedIn.length) fail(409, `This image is still used in ${usedIn.length} place${usedIn.length > 1 ? 's' : ''}: ${usedIn.slice(0, 5).join('; ')}${usedIn.length > 5 ? '; …' : ''}. Remove it there first — it will then be deleted from ImageKit automatically.`)
    await deleteFile(m.file_id)
    await getDb().run('DELETE FROM media WHERE id = ?', [m.id])
    await audit(user, 'delete', 'media', m.id, m.name)
    return { ok: true }
})

/* ── admin: orders, queries, subscribers ── */
route('GET', '/api/admin/orders', async ({ user }) => {
    requireRole(user, 'editor')
    return { items: await getDb().all('SELECT * FROM orders ORDER BY id DESC LIMIT 2000') }
})

route('PATCH', '/api/admin/orders/:id', async ({ user, params, body }) => {
    requireRole(user, 'editor')
    await getDb().run("UPDATE orders SET status = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?", [str(body.status, 40) || 'Booked', str(body.admin_note, 2000), Number(params.id)])
    await audit(user, 'update', 'order', params.id, body.status)
    return { ok: true }
})

route('DELETE', '/api/admin/orders/:id', async ({ user, params }) => {
    requireRole(user, 'admin')
    await getDb().run('DELETE FROM orders WHERE id = ?', [Number(params.id)])
    await audit(user, 'delete', 'order', params.id)
    return { ok: true }
})

route('GET', '/api/admin/queries', async ({ user }) => {
    requireRole(user, 'editor')
    return { items: await getDb().all('SELECT * FROM queries ORDER BY id DESC LIMIT 2000') }
})

route('PATCH', '/api/admin/queries/:id', async ({ user, params, body }) => {
    requireRole(user, 'editor')
    await getDb().run("UPDATE queries SET status = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?", [str(body.status, 40) || 'New', str(body.admin_note, 2000), Number(params.id)])
    await audit(user, 'update', 'query', params.id, body.status)
    return { ok: true }
})

route('DELETE', '/api/admin/queries/:id', async ({ user, params }) => {
    requireRole(user, 'admin')
    await getDb().run('DELETE FROM queries WHERE id = ?', [Number(params.id)])
    await audit(user, 'delete', 'query', params.id)
    return { ok: true }
})

route('GET', '/api/admin/subscribers', async ({ user }) => {
    requireRole(user, 'editor')
    return { items: await getDb().all('SELECT * FROM subscribers ORDER BY id DESC') }
})

route('DELETE', '/api/admin/subscribers/:id', async ({ user, params }) => {
    requireRole(user, 'admin')
    await getDb().run('DELETE FROM subscribers WHERE id = ?', [Number(params.id)])
    await audit(user, 'delete', 'subscriber', params.id)
    return { ok: true }
})

/* ── admin: users ── */
const adminUser = u => ({ ...publicUser(u), active: !!u.active, lastLoginAt: u.last_login_at })

route('GET', '/api/admin/users', async ({ user }) => {
    requireRole(user, 'admin')
    return { items: (await getDb().all('SELECT * FROM users ORDER BY id DESC')).map(adminUser) }
})

route('POST', '/api/admin/users', async ({ user, body }) => {
    requireRole(user, 'admin')
    const email = str(body.email, 200).toLowerCase()
    if (!isEmail(email)) fail(400, 'Valid email required.')
    const problem = passwordProblem(body.password)
    if (problem) fail(400, problem)
    const role = ROLE_RANK[body.role] ? body.role : 'member'
    if (await getDb().first('SELECT id FROM users WHERE email = ?', [email])) fail(409, 'A user with this email already exists.')
    const r = await getDb().run('INSERT INTO users (name, email, password_hash, role, member_type) VALUES (?, ?, ?, ?, ?)',
        [str(body.name, 120) || email, email, await hashPassword(body.password), role, memberTypeFor(email)])
    await audit(user, 'create', 'user', r.lastId, `${email} (${role})`)
    return { item: adminUser(await getDb().first('SELECT * FROM users WHERE id = ?', [r.lastId])) }
})

route('PATCH', '/api/admin/users/:id', async ({ user, params, body }) => {
    requireRole(user, 'admin')
    const db = getDb()
    const target = await db.first('SELECT * FROM users WHERE id = ?', [Number(params.id)])
    if (!target) fail(404, 'User not found')
    const role = ROLE_RANK[body.role] ? body.role : target.role
    const active = body.active === undefined ? !!target.active : !!body.active
    if (target.role === 'admin' && (role !== 'admin' || !active)) {
        const admins = await db.first("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND active = 1")
        if (admins.n <= 1) fail(400, 'You cannot remove the last active admin.')
    }
    let bump = role !== target.role || active !== !!target.active ? 1 : 0
    let hash = target.password_hash
    if (body.newPassword) {
        const problem = passwordProblem(body.newPassword)
        if (problem) fail(400, problem)
        hash = await hashPassword(body.newPassword)
        bump = 1
    }
    await db.run("UPDATE users SET name = ?, role = ?, active = ?, password_hash = ?, token_version = token_version + ?, updated_at = datetime('now') WHERE id = ?",
        [str(body.name, 120) || target.name, role, active ? 1 : 0, hash, bump, target.id])
    await audit(user, 'update', 'user', target.id, `${target.email}: role=${role} active=${active}${body.newPassword ? ' password-reset' : ''}`)
    return { item: adminUser(await db.first('SELECT * FROM users WHERE id = ?', [target.id])) }
})

route('DELETE', '/api/admin/users/:id', async ({ user, params }) => {
    requireRole(user, 'admin')
    if (Number(params.id) === user.id) fail(400, 'You cannot delete your own account.')
    const target = await getDb().first('SELECT * FROM users WHERE id = ?', [Number(params.id)])
    if (!target) fail(404, 'User not found')
    if (target.role === 'admin') {
        const admins = await getDb().first("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND active = 1")
        if (admins.n <= 1) fail(400, 'You cannot delete the last admin.')
    }
    await getDb().run('DELETE FROM users WHERE id = ?', [target.id])
    await audit(user, 'delete', 'user', target.id, target.email)
    return { ok: true }
})

/* ── admin: email & logs ── */
route('POST', '/api/admin/email-test', async ({ user, body }) => {
    requireRole(user, 'admin')
    const to = emailList(body.to || user.email)
    const r = await sendMail({ kind: 'test', to, subject: 'IEEE ITS — SMTP test email', html: '<p>Your SMTP settings work.</p><p>— IEEE ITS Website Notification System</p>' })
    if (!r.ok) fail(400, `Email failed: ${r.error}`)
    return { ok: true }
})

route('GET', '/api/admin/email-logs', async ({ user }) => {
    requireRole(user, 'admin')
    return { items: await getDb().all('SELECT * FROM email_logs ORDER BY id DESC LIMIT 300') }
})

route('GET', '/api/admin/audit', async ({ user }) => {
    requireRole(user, 'admin')
    const db = getDb()
    const [audits, activity] = await Promise.all([
        db.all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500'),
        db.all('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 500'),
    ])
    return { items: audits, activity }
})

/* ───────────── dispatcher ───────────── */
/* ── bulk email outbox ── */
route('GET', '/api/admin/outbox', async ({ user }) => {
    requireRole(user, 'editor')
    const items = await getDb().all('SELECT id, kind, label, subject, total, cursor, sent, failed, status, created_by, created_at, updated_at FROM email_campaigns ORDER BY id DESC LIMIT 100')
    return { items, quota: await quotaStatus() }
})

route('POST', '/api/admin/outbox/process', async ({ user }) => {
    requireRole(user, 'editor')
    return { ...(await drainCampaigns(14_000)), quota: await quotaStatus() }
})

route('POST', '/api/admin/outbox/:id/cancel', async ({ user, params }) => {
    requireRole(user, 'editor')
    await getDb().run("UPDATE email_campaigns SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = 'queued'", [Number(params.id)])
    await audit(user, 'cancel', 'email-campaign', params.id)
    return { ok: true }
})

route('POST', '/api/admin/outbox/:id/retry', async ({ user, params }) => {
    requireRole(user, 'editor')
    const c = await getDb().first('SELECT * FROM email_campaigns WHERE id = ?', [Number(params.id)])
    if (!c) fail(404, 'Mail-out not found.')
    const failedEmails = new Set(parseJson(c.failures, []).map(f => f.email))
    const recipients = parseJson(c.recipients, []).filter(r => failedEmails.has(r.email))
    const queued = await createCampaign({ kind: c.kind, label: `Retry of #${c.id}`, subject: c.subject, body: c.body, recipients, user })
    await getDb().run("UPDATE email_campaigns SET failures = '[]' WHERE id = ?", [c.id])
    return { queued: [queued] }
})

route('PUT', '/api/admin/outbox/limits', async ({ user, body }) => {
    requireRole(user, 'admin')
    const dailyLimit = await setDailyLimit(body.dailyLimit)
    await audit(user, 'update', 'settings', 'mail_limits', `daily limit ${dailyLimit}`)
    return { quota: await quotaStatus() }
})

/* Daily Vercel cron (vercel.json) keeps long mail-outs moving when nobody has the Outbox open. */
route('GET', '/api/cron/outbox', async ({ req }) => {
    if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) fail(401, 'Unauthorized')
    return drainCampaigns(45_000)
})

installRecruitment({ route, requireRole, audit, loadSettings })
installPortals({ route, requireRole, audit, loadSettings, releaseImages, imageUrls })

export async function handle(req, res, pathOverride) {
    const url = new URL(req.url, 'http://local')
    let pathname = pathOverride || url.pathname
    if (!pathname.startsWith('/api')) pathname = `/api/${pathname.replace(/^\//, '')}`
    try {
        // CSRF: state-changing requests must carry our custom header (forces a CORS preflight cross-site).
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-requested-with'] !== 'its-web') {
            fail(403, 'Missing request header.')
        }
        const match = routes.find(r => r.method === req.method && r.re.test(pathname))
        if (!match) {
            const exists = routes.some(r => r.re.test(pathname))
            fail(exists ? 405 : 404, exists ? 'Method not allowed' : 'Not found')
        }
        await ensureReady()
        const m = pathname.match(match.re)
        const params = Object.fromEntries(match.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
        const [body, user] = await Promise.all([readBody(req), currentUser(req)])
        const result = await match.handler({ req, res, params, body, user, query: url.searchParams })
        if (!res.headersSent && result !== undefined) {
            if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store')
            send(res, 200, result)
        }
    } catch (e) {
        const status = e instanceof HttpError ? e.status : e.status || 500
        if (status >= 500) console.error('[api]', req.method, pathname, e)
        send(res, status, { error: status >= 500 && !(e instanceof HttpError) && !e.status ? 'Something went wrong on the server.' : e.message })
    }
}
