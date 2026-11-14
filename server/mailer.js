/**
 * SMTP notifications.
 * SMTP host/user/from and recipient addresses are configured in /admin → Email & SMTP.
 * The SMTP password is stored AES-GCM encrypted in D1 (or supplied via SMTP_PASS).
 */
import nodemailer from 'nodemailer'
import { getDb, parseJson } from './db.js'
import { decrypt } from './auth.js'
import { emailList } from './http.js'
import { DEFAULT_PRIVATE_SETTINGS } from '../shared/defaults.js'

/** Plain-text copy of an HTML email (sent alongside it: HTML-only mail is more likely to be filtered as spam). */
export const htmlToText = html => String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => (label.replace(/<[^>]+>/g, '').trim() === href ? href : `${label.replace(/<[^>]+>/g, '').trim()}: ${href}`))
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|h\d|li)>/gi, '\n').replace(/<\/td>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim()

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

async function getSetting(key) {
    const row = await getDb().first('SELECT value FROM settings WHERE key = ?', [key])
    return { ...DEFAULT_PRIVATE_SETTINGS[key], ...parseJson(row?.value, {}) }
}

/**
 * Two SMTP profiles:
 *  • main — notifications, confirmations and bulk mail-outs (Admin → Email & SMTP → Main)
 *  • auth — account emails: password-reset codes and links (Admin → Email & SMTP → Account emails).
 *    Keeping it on its own mailbox means a big mail-out can never use up the daily quota reset codes need.
 *    When the auth profile is not configured, account emails fall back to the main profile.
 */
export async function smtpConfig(profile = 'main') {
    if (profile === 'auth') {
        const a = await getSetting('smtp_auth')
        const pass = process.env.SMTP_AUTH_PASS || decrypt(a.passEnc)
        const host = process.env.SMTP_AUTH_HOST || a.host
        const user = process.env.SMTP_AUTH_USER || a.user
        if (host && user && pass) {
            return {
                profile: 'auth', host, user, pass, port: Number(process.env.SMTP_AUTH_PORT || a.port || 587),
                secure: String(process.env.SMTP_AUTH_SECURE ?? a.secure) === 'true',
                fromName: a.fromName || 'IEEE ITS VIT', fromEmail: a.fromEmail || user,
            }
        }
    }
    const s = await getSetting('smtp')
    return {
        profile: 'main',
        host: process.env.SMTP_HOST || s.host,
        port: Number(process.env.SMTP_PORT || s.port || 587),
        secure: String(process.env.SMTP_SECURE ?? s.secure) === 'true',
        user: process.env.SMTP_USER || s.user,
        pass: process.env.SMTP_PASS || decrypt(s.passEnc),
        fromName: s.fromName || 'IEEE ITS VIT',
        fromEmail: s.fromEmail || process.env.SMTP_USER || s.user,
    }
}

async function log(kind, recipient, subject, status, error = '') {
    try {
        await getDb().run('INSERT INTO email_logs (kind, recipient, subject, status, error) VALUES (?, ?, ?, ?, ?)',
            [kind, recipient, subject, status, String(error).slice(0, 500)])
    } catch (e) { console.error('[mail] could not write log', e.message) }
}

export async function sendMail({ kind, to, subject, html, text, replyTo, profile = 'main' }) {
    const recipients = Array.isArray(to) ? to : emailList(to)
    if (!recipients.length) { await log(kind, '-', subject, 'skipped', 'No recipient configured'); return { ok: false, error: 'No recipient configured' } }
    const cfg = await smtpConfig(profile)
    if (!cfg.host || !cfg.user || !cfg.pass) {
        await log(kind, recipients.join(', '), subject, 'skipped', 'SMTP not configured')
        return { ok: false, error: 'SMTP is not configured (host, username and password are required).' }
    }
    try {
        const transport = nodemailer.createTransport({
            host: cfg.host, port: cfg.port, secure: cfg.secure,
            auth: { user: cfg.user, pass: cfg.pass },
            connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
        })
        await transport.sendMail({
            from: `"${cfg.fromName.replace(/"/g, '')}" <${cfg.fromEmail}>`,
            to: recipients.join(', '), subject, html, text: text || htmlToText(html), replyTo,
        })
        await log(kind, recipients.join(', '), subject, 'sent')
        return { ok: true }
    } catch (e) {
        await log(kind, recipients.join(', '), subject, 'failed', e.message)
        return { ok: false, error: e.message }
    }
}

/* ───────────── Templates ───────────── */
const layout = (title, intro, rows, footer) => `
<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0a0a0f;padding:24px;color:#e8e8f0">
  <div style="max-width:560px;margin:0 auto;background:#12121c;border:1px solid #23233a;border-radius:16px;overflow:hidden">
    <div style="background:#3d9bff;padding:18px 24px;font-weight:800;font-size:18px;color:#fff">${esc(title)}</div>
    <div style="padding:24px">
      <p style="margin:0 0 16px;color:#c8c8d8">${intro}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${rows.map(([k, v]) => `<tr><td style="padding:8px 0;color:#8a8aa0;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;color:#fff;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}
      </table>
      <p style="margin:20px 0 0;color:#8a8aa0;font-size:13px">${footer}</p>
    </div>
  </div>
  <p style="text-align:center;color:#55556a;font-size:12px;margin-top:16px">IEEE ITS Website Notification System</p>
</div>`

const when = iso => new Date(iso ? iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z') : Date.now())
    .toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })

export async function notifyOrder(order) {
    const n = await getSetting('notifications')
    const rows = [
        ['Order ID', `#${order.id}`], ['Student Name', order.name], ['Email', order.email], ['Mobile', order.mobile],
        ['Reg No', order.reg_no], ['Item', order.item], ['Size', order.size], ['Colour', order.color],
        ['Quantity', order.qty], ['Total', `₹${order.total}`], ['Date', when(order.created_at)],
    ]
    const tasks = []
    if (n.notifyOrders) {
        tasks.push(sendMail({
            kind: 'order', to: n.orderRecipients, replyTo: order.email,
            subject: `New Order Received – IEEE ITS (#${order.id})`,
            html: layout('New Order Received', 'Hello Admin,<br/>A new order has been submitted through the IEEE ITS website.', rows,
                'Please log in to the IEEE ITS admin dashboard to review and process this order.'),
        }))
    }
    if (n.sendUserConfirmation) {
        tasks.push(sendMail({
            kind: 'order-confirmation', to: [order.email],
            subject: `Your IEEE ITS booking #${order.id} is confirmed`,
            html: layout('Booking confirmed', `Hi ${esc(order.name)},<br/>Thanks for booking IEEE ITS merchandise. Here are your booking details:`, rows,
                'No payment is required now — the team will contact you about collection.'),
        }))
    }
    return Promise.all(tasks)
}

export async function notifyQuery(q) {
    const n = await getSetting('notifications')
    const enabled = q.kind === 'suggestion' ? n.notifySuggestions : n.notifyQueries
    const label = q.kind === 'suggestion' ? 'Suggestion' : 'Query'
    const rows = [['Name', q.name], ['Email', q.email], ['Subject', q.subject || '—'], ['Message', q.message], ['Date', when(q.created_at)]]
    const tasks = []
    if (enabled) {
        tasks.push(sendMail({
            kind: q.kind, to: n.queryRecipients, replyTo: q.email,
            subject: `New Website ${label} – IEEE ITS${q.subject ? `: ${q.subject.slice(0, 60)}` : ''}`,
            html: layout(`New Website ${label}`, `Hello Admin,<br/>A new ${label.toLowerCase()} has been submitted through the IEEE ITS website.`, rows,
                `Please review and respond to the ${label.toLowerCase()} through the admin dashboard.`),
        }))
    }
    if (n.sendUserConfirmation && q.kind !== 'suggestion') {
        tasks.push(sendMail({
            kind: `${q.kind}-confirmation`, to: [q.email], subject: 'We received your message – IEEE ITS VIT',
            html: layout('Message received', `Hi ${esc(q.name || 'there')},<br/>Thanks for reaching out — the IEEE ITS team will get back to you soon.`, rows, ''),
        }))
    }
    return Promise.all(tasks)
}

/** Reset email with the 6-digit code and a one-click link that opens the reset form with it filled in. */
export async function sendPasswordResetCode(user, code, link, { setup = false } = {}) {
    const heading = setup ? 'Set your password' : 'Reset your password'
    const lead = setup ? 'Your IEEE ITS VIT account is ready. Use this code to set your password and sign in for the first time:' : 'Use this code to reset your IEEE ITS VIT account password:'
    const html = `
<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0b0c0e;padding:24px;color:#f2f0eb">
  <div style="max-width:480px;margin:0 auto;background:#131518;border:1px solid #262a30;border-radius:14px;overflow:hidden">
    <div style="background:#3d9bff;padding:16px 24px;font-weight:800;font-size:17px;color:#0b0c0e">${heading}</div>
    <div style="padding:24px">
      <p style="margin:0 0 16px;color:#c8c8d0">Hi ${esc(user.name || 'there')},<br/>${lead}</p>
      <div style="font-family:'JetBrains Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;padding:16px;border:1px solid #262a30;border-radius:10px;color:#ffffff">${esc(code)}</div>
      ${link ? `<p style="text-align:center;margin:20px 0 4px"><a href="${esc(link)}" style="display:inline-block;background:#3d9bff;color:#0b0c0e;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px">${heading}</a></p>
      <p style="margin:0;color:#8e939a;font-size:12px;text-align:center">or open this link: <a href="${esc(link)}" style="color:#3d9bff">${esc(link)}</a></p>` : ''}
      <p style="margin:16px 0 0;color:#8e939a;font-size:13px">The code and link expire in 10 minutes and work once. ${setup ? 'If you were not expecting this, you can ignore this email.' : 'If you did not ask to reset your password, ignore this email — your password stays the same.'}</p>
    </div>
  </div>
</div>`
    return sendMail({ kind: setup ? 'password-setup' : 'password-reset', to: [user.email], subject: `${code} is your IEEE ITS ${setup ? 'code to set your password' : 'password reset code'}`, html, profile: 'auth' })
}

export async function notifySubscriber(email, list) {
    const n = await getSetting('notifications')
    if (!n.notifySubscribers) return
    return sendMail({
        kind: 'subscriber', to: n.queryRecipients, subject: `New ${list} subscriber – IEEE ITS`,
        html: layout('New Subscriber', 'A visitor subscribed on the website.', [['Email', email], ['List', list], ['Date', when()]], ''),
    })
}

/* ───────────── Bulk / templated mail ───────────── */
/** One pooled SMTP connection for sending a batch (much faster than a new connection per email). */
export async function openTransport() {
    const cfg = await smtpConfig()
    if (!cfg.host || !cfg.user || !cfg.pass) return null
    const transport = nodemailer.createTransport({
        pool: true, maxConnections: 1, host: cfg.host, port: cfg.port, secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
    })
    const from = `"${cfg.fromName.replace(/"/g, '')}" <${cfg.fromEmail}>`
    return {
        send: ({ to, subject, html, text, attachments }) => transport.sendMail({ from, to, subject, html, text: text || htmlToText(html), attachments }),
        close: () => transport.close(),
    }
}

/** Replace {{placeholders}}; unknown ones become empty. */
export const fillTemplate = (text, vars = {}) => String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] ?? ''))

/**
 * Turns an admin-written plain-text message into a simple, readable HTML email:
 * paragraphs from blank lines, line breaks kept, links made clickable.
 */
export function messageHtml(title, text) {
    const linked = esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0b63c5">$1</a>')
    const body = linked.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, '<br/>')}</p>`).join('')
    return `
<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f3f5f8;padding:24px;color:#14181f">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e3e7ee;border-radius:14px;overflow:hidden">
    <div style="padding:18px 24px;border-bottom:3px solid #3d9bff;font-weight:700;font-size:17px">${esc(title)}</div>
    <div style="padding:22px 24px;font-size:15px">${body}</div>
  </div>
  <p style="text-align:center;color:#7a8394;font-size:12px;margin-top:14px">IEEE ITS · VIT Vellore</p>
</div>`
}
