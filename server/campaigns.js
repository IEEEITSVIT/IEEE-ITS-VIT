/**
 * Bulk email that fits free SMTP limits (Gmail allows roughly 500 messages a day).
 *
 *  • A mail-out is one email_campaigns row holding every recipient and their merge fields.
 *  • processCampaigns() sends the next small batch, never more than the daily limit
 *    (settings.mail_limits.dailyLimit, default 400 — the rest is left for password codes etc.).
 *  • It is driven by the admin Outbox page while open and by a daily Vercel cron job,
 *    so a 1,500-person mail-out simply continues the next day.
 */
import { getDb, parseJson } from './db.js'
import { fail } from './http.js'
import { openTransport, fillTemplate, messageHtml } from './mailer.js'

export const DEFAULT_DAILY_LIMIT = 400
const BATCH = 20
const istDate = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)

async function readSetting(key, fallback) {
    const row = await getDb().first('SELECT value FROM settings WHERE key = ?', [key])
    return { ...fallback, ...parseJson(row?.value, {}) }
}
const writeSetting = (key, value) => getDb().run(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [key, JSON.stringify(value)])

export async function quotaStatus() {
    const { dailyLimit } = await readSetting('mail_limits', { dailyLimit: DEFAULT_DAILY_LIMIT })
    const q = await readSetting('mail_quota', { date: istDate(), count: 0 })
    const used = q.date === istDate() ? q.count : 0
    return { dailyLimit, used, remaining: Math.max(0, dailyLimit - used) }
}

export async function setDailyLimit(n) {
    const dailyLimit = Math.max(10, Math.min(2000, Math.round(Number(n) || DEFAULT_DAILY_LIMIT)))
    await writeSetting('mail_limits', { dailyLimit })
    return dailyLimit
}

/** Reserve up to `n` sends from today's allowance; returns how many may be sent. */
async function reserve(n) {
    const { used, dailyLimit } = await quotaStatus()
    const allowed = Math.max(0, Math.min(n, dailyLimit - used))
    if (allowed) await writeSetting('mail_quota', { date: istDate(), count: used + allowed })
    return allowed
}

/**
 * Queue a mail-out. recipients: [{ email, vars }] — vars fill {{placeholders}} in subject and body.
 * Duplicate addresses are merged (first one wins).
 */
export async function createCampaign({ kind, label, subject, body, recipients, user }) {
    const seen = new Set()
    const list = recipients.filter(r => r.email && !seen.has(r.email.toLowerCase()) && seen.add(r.email.toLowerCase()))
    if (!list.length) fail(400, 'Nobody matches this audience.')
    if (!String(subject || '').trim() || !String(body || '').trim()) fail(400, 'Subject and message are required.')
    const json = JSON.stringify(list)
    if (json.length > 1_800_000) fail(413, 'Too many recipients for one mail-out — split it by domain or round.')
    const r = await getDb().run('INSERT INTO email_campaigns (kind, label, subject, body, recipients, total, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [kind, String(label || '').slice(0, 200), String(subject).slice(0, 300), String(body).slice(0, 20_000), json, list.length, user?.email || ''])
    return { id: r.lastId, total: list.length }
}

/** Send the next batch of the oldest queued mail-out. Safe to call from several tabs at once. */
export async function processCampaigns() {
    const db = getDb()
    const camp = await db.first("SELECT id, kind, subject, body, total, cursor FROM email_campaigns WHERE status = 'queued' ORDER BY id LIMIT 1")
    if (!camp) return { idle: true, sent: 0 }
    if (camp.cursor >= camp.total) { await db.run("UPDATE email_campaigns SET status = 'done' WHERE id = ?", [camp.id]); return { sent: 0 } }
    const want = Math.min(BATCH, camp.total - camp.cursor)
    const allowed = await reserve(want)
    if (!allowed) return { sent: 0, quotaReached: true }
    // Claim the slice first so a second caller cannot send the same recipients.
    const claim = await db.run("UPDATE email_campaigns SET cursor = ?, updated_at = datetime('now') WHERE id = ? AND cursor = ?", [camp.cursor + allowed, camp.id, camp.cursor])
    if (!claim.changes) return { sent: 0, busy: true }
    const row = await db.first('SELECT recipients FROM email_campaigns WHERE id = ?', [camp.id])
    const slice = parseJson(row.recipients, []).slice(camp.cursor, camp.cursor + allowed)
    const mailer = await openTransport()
    if (!mailer) {
        await db.run('UPDATE email_campaigns SET cursor = ? WHERE id = ?', [camp.cursor, camp.id])
        fail(503, 'SMTP is not configured — set it up in Admin → Email & SMTP.')
    }
    let sent = 0
    const failures = []
    try {
        for (const r of slice) {
            try {
                const subject = fillTemplate(camp.subject, r.vars)
                const text = fillTemplate(camp.body, r.vars)
                await mailer.send({ to: r.email, subject, html: messageHtml(subject, text), text })
                sent++
            } catch (e) { failures.push({ email: r.email, error: String(e.message).slice(0, 200) }) }
        }
    } finally { mailer.close() }
    const prev = parseJson((await db.first('SELECT failures FROM email_campaigns WHERE id = ?', [camp.id]))?.failures, [])
    await db.run(`UPDATE email_campaigns SET sent = sent + ?, failed = failed + ?, failures = ?,
        status = CASE WHEN cursor >= total THEN 'done' ELSE status END, updated_at = datetime('now') WHERE id = ?`,
        [sent, failures.length, JSON.stringify([...prev, ...failures].slice(-500)), camp.id])
    await db.run('INSERT INTO email_logs (kind, recipient, subject, status, error) VALUES (?, ?, ?, ?, ?)',
        [camp.kind, `${slice.length} recipients (mail-out #${camp.id})`, camp.subject, failures.length ? 'failed' : 'sent', failures.length ? `${failures.length} failed` : ''])
    return { sent, failed: failures.length, campaign: camp.id }
}

/** Keep sending batches until the time budget, the queue or today's quota runs out. */
export async function drainCampaigns(budgetMs = 40_000) {
    const t0 = Date.now()
    let sent = 0, last = {}
    while (Date.now() - t0 < budgetMs) {
        last = await processCampaigns()
        sent += last.sent || 0
        if (last.idle || last.quotaReached || last.busy) break
    }
    return { ...last, sent }
}

/** One email with attachments (certificates), counted against the daily quota. */
export async function sendDirect({ to, subject, text, attachments }) {
    if (!(await reserve(1))) fail(429, "Today's email limit is used up. Sending continues tomorrow.")
    const mailer = await openTransport()
    if (!mailer) fail(503, 'SMTP is not configured — set it up in Admin → Email & SMTP.')
    try {
        await mailer.send({ to, subject, html: messageHtml(subject, text), text, attachments })
        await getDb().run("INSERT INTO email_logs (kind, recipient, subject, status) VALUES ('certificate', ?, ?, 'sent')", [to, subject])
    } catch (e) {
        await getDb().run("INSERT INTO email_logs (kind, recipient, subject, status, error) VALUES ('certificate', ?, ?, 'failed', ?)", [to, subject, String(e.message).slice(0, 300)])
        fail(502, `Could not send to ${to}: ${e.message}`)
    } finally { mailer.close() }
}
