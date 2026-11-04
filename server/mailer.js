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

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

async function getSetting(key) {
    const row = await getDb().first('SELECT value FROM settings WHERE key = ?', [key])
    return { ...DEFAULT_PRIVATE_SETTINGS[key], ...parseJson(row?.value, {}) }
}

export async function smtpConfig() {
    const s = await getSetting('smtp')
    return {
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

export async function sendMail({ kind, to, subject, html, replyTo }) {
    const recipients = Array.isArray(to) ? to : emailList(to)
    if (!recipients.length) { await log(kind, '-', subject, 'skipped', 'No recipient configured'); return { ok: false, error: 'No recipient configured' } }
    const cfg = await smtpConfig()
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
            to: recipients.join(', '), subject, html, replyTo,
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
            html: layout('Booking Confirmed 🎉', `Hi ${esc(order.name)},<br/>Thanks for booking IEEE ITS merchandise. Here are your booking details:`, rows,
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
            html: layout('Message received ✉️', `Hi ${esc(q.name || 'there')},<br/>Thanks for reaching out — the IEEE ITS team will get back to you soon.`, rows, ''),
        }))
    }
    return Promise.all(tasks)
}

export async function sendPasswordResetCode(user, code) {
    const html = `
<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0b0c0e;padding:24px;color:#f2f0eb">
  <div style="max-width:480px;margin:0 auto;background:#131518;border:1px solid #262a30;border-radius:14px;overflow:hidden">
    <div style="background:#3d9bff;padding:16px 24px;font-weight:800;font-size:17px;color:#0b0c0e">Password reset code</div>
    <div style="padding:24px">
      <p style="margin:0 0 16px;color:#c8c8d0">Hi ${esc(user.name || 'there')},<br/>Use this code to reset your IEEE ITS VIT account password:</p>
      <div style="font-family:'JetBrains Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;padding:16px;border:1px solid #262a30;border-radius:10px;color:#ffffff">${esc(code)}</div>
      <p style="margin:16px 0 0;color:#8e939a;font-size:13px">The code expires in 10 minutes and can be used once. If you did not ask to reset your password, you can ignore this email — your password stays the same.</p>
    </div>
  </div>
</div>`
    return sendMail({ kind: 'password-reset', to: [user.email], subject: `${code} is your IEEE ITS password reset code`, html })
}

export async function notifySubscriber(email, list) {
    const n = await getSetting('notifications')
    if (!n.notifySubscribers) return
    return sendMail({
        kind: 'subscriber', to: n.queryRecipients, subject: `New ${list} subscriber – IEEE ITS`,
        html: layout('New Subscriber', 'A visitor subscribed on the website.', [['Email', email], ['List', list], ['Date', when()]], ''),
    })
}
