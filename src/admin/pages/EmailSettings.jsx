import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { PageTitle, Badge, Spinner, Switch, useToast, useLoader, fmtDate } from '../ui'

const PRESETS = {
    gmail: { host: 'smtp.gmail.com', port: 587, secure: false, note: 'Use a Google App Password (Google Account → Security → 2-Step Verification → App passwords), not your normal password.' },
    outlook: { host: 'smtp.office365.com', port: 587, secure: false, note: 'Microsoft 365 / Outlook. SMTP AUTH must be enabled for the mailbox.' },
    custom: { note: 'Any SMTP provider (Brevo, SendGrid, Zoho, Mailgun…). Port 465 usually needs “SSL/TLS” switched on.' },
}

/** One SMTP account (main, or the separate mailbox for account emails). */
function SmtpCard({ profile, title, intro, value, main, onSaved, testTo, setTestTo, logsReload }) {
    const toast = useToast()
    const [smtp, setSmtp] = useState(value)
    const [pass, setPass] = useState('')
    const [busy, setBusy] = useState('')
    const key = profile === 'auth' ? 'smtp_auth' : 'smtp'
    const preset = smtp.host === 'smtp.gmail.com' ? 'gmail' : smtp.host === 'smtp.office365.com' ? 'outlook' : 'custom'
    const configured = !!(smtp.host && smtp.user && smtp.hasPassword)

    const save = async (extra = {}) => {
        setBusy('save')
        try {
            await api.put(`/admin/settings/${key}`, { value: { ...smtp, pass, ...extra } })
            const next = { ...smtp, hasPassword: smtp.hasPassword || !!pass || !!extra.copyMainPassword }
            setSmtp(next); setPass(''); onSaved(next)
            toast(`${title} saved (password stored encrypted)`)
        } catch (e) { toast(e.message, 'error') } finally { setBusy('') }
    }
    const copyMain = () => {
        const next = { ...smtp, host: main.host, port: main.port, secure: main.secure, user: main.user, fromEmail: main.fromEmail, hasPassword: main.hasPassword }
        setSmtp(next)
        api.put(`/admin/settings/${key}`, { value: { ...next, copyMainPassword: true } })
            .then(() => { onSaved(next); toast('Copied the main SMTP account (including its password) — change it any time') })
            .catch(e => toast(e.message, 'error'))
    }
    const test = async () => {
        setBusy('test')
        try { await api.post('/admin/email-test', { to: testTo, profile }); toast(`Test email sent to ${testTo}`) }
        catch (e) { toast(e.message, 'error') } finally { setBusy(''); logsReload() }
    }

    return (
        <section className="adm-panel">
            <div className="adm-row between"><h3>{title}</h3>{profile === 'auth' && <Badge tone={configured ? 'ok' : 'warn'}>{configured ? 'Separate account' : 'Using main SMTP'}</Badge>}</div>
            <p className="adm-hint">{intro}</p>
            {profile === 'auth' && <button className="adm-btn small" onClick={copyMain} disabled={!main?.host}>Copy main SMTP settings</button>}
            <div className="adm-seg" style={{ marginTop: 10 }}>
                {Object.keys(PRESETS).map(p => (
                    <button key={p} className={preset === p ? 'on' : ''} onClick={() => p !== 'custom' && setSmtp(s => ({ ...s, ...PRESETS[p], note: undefined }))}>{p === 'gmail' ? 'Gmail' : p === 'outlook' ? 'Outlook' : 'Custom'}</button>
                ))}
            </div>
            <p className="adm-hint">{PRESETS[preset].note}</p>
            <div className="adm-grid-2">
                <label className="adm-field"><span>Host</span><input className="adm-input" value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} /></label>
                <label className="adm-field"><span>Port</span><input className="adm-input" type="number" value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: Number(e.target.value) }))} /></label>
            </div>
            <Switch checked={smtp.secure} onChange={v => setSmtp(s => ({ ...s, secure: v }))} label="SSL/TLS (port 465)" />
            <label className="adm-field"><span>Username</span><input className="adm-input" value={smtp.user} onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))} autoComplete="off" /></label>
            <label className="adm-field"><span>Password / app password {smtp.hasPassword && <Badge tone="ok">saved</Badge>}</span>
                <input className="adm-input" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder={smtp.hasPassword ? '•••••••• (leave empty to keep)' : 'Enter SMTP password'} autoComplete="new-password" />
            </label>
            <div className="adm-grid-2">
                <label className="adm-field"><span>From name</span><input className="adm-input" value={smtp.fromName} onChange={e => setSmtp(s => ({ ...s, fromName: e.target.value }))} /></label>
                <label className="adm-field"><span>From email</span><input className="adm-input" value={smtp.fromEmail} onChange={e => setSmtp(s => ({ ...s, fromEmail: e.target.value }))} placeholder="defaults to username" /></label>
            </div>
            <div className="adm-row end">
                {profile === 'auth' && configured && <button className="adm-btn ghost" disabled={!!busy} onClick={() => { setSmtp(s => ({ ...s, host: '', user: '', hasPassword: false })); save({ host: '', user: '', clearPassword: true }) }}>Stop using a separate account</button>}
                <button className="adm-btn primary" disabled={!!busy} onClick={() => save()}>Save</button>
            </div>
            <hr />
            <div className="adm-row">
                <input className="adm-input" value={testTo} onChange={e => setTestTo(e.target.value)} />
                <button className="adm-btn" disabled={busy === 'test'} onClick={test}>{busy === 'test' ? 'Sending…' : 'Send test email'}</button>
            </div>
        </section>
    )
}

export default function EmailSettings() {
    const { user } = useAuth()
    const toast = useToast()
    const [smtp, setSmtp] = useState(null)
    const [smtpAuth, setSmtpAuth] = useState(null)
    const [notif, setNotif] = useState(null)
    const [testTo, setTestTo] = useState(user.email)
    const [busy, setBusy] = useState('')
    const logs = useLoader(() => api.get('/admin/email-logs').then(r => r.items), [])

    useEffect(() => {
        api.get('/admin/settings').then(r => { setSmtp(r.settings.smtp); setSmtpAuth(r.settings.smtp_auth); setNotif(r.settings.notifications) }).catch(e => toast(e.message, 'error'))
    }, [toast])

    const saveNotif = async () => {
        setBusy('notif')
        try { await api.put('/admin/settings/notifications', { value: notif }); toast('Notification settings saved') }
        catch (e) { toast(e.message, 'error') } finally { setBusy('') }
    }

    if (!smtp || !smtpAuth || !notif) return <Spinner />
    const N = (k, label) => <Switch checked={notif[k]} onChange={v => setNotif(n => ({ ...n, [k]: v }))} label={label} />

    return (
        <>
            <PageTitle title="Email & SMTP" subtitle="Where notifications go, and the two mail accounts that send them: the main SMTP and a separate one for password-reset codes." />
            <div className="adm-grid-2 top">
                <section className="adm-panel">
                    <h3>Notification recipients</h3>
                    <label className="adm-field"><span>New orders → send to</span>
                        <input className="adm-input" value={notif.orderRecipients} onChange={e => setNotif(n => ({ ...n, orderRecipients: e.target.value }))} placeholder="treasurer@example.com, chair@example.com" />
                    </label>
                    <label className="adm-field"><span>New queries & suggestions → send to</span>
                        <input className="adm-input" value={notif.queryRecipients} onChange={e => setNotif(n => ({ ...n, queryRecipients: e.target.value }))} placeholder="ieeeits@vit.ac.in" />
                    </label>
                    <p className="adm-hint">Separate multiple addresses with commas.</p>
                    <div className="adm-stack">
                        {N('notifyOrders', 'Email on every new order')}
                        {N('notifyQueries', 'Email on every new contact query')}
                        {N('notifySuggestions', 'Email on every new suggestion')}
                        {N('notifySubscribers', 'Email on every new subscriber')}
                        {N('sendUserConfirmation', 'Send a confirmation email to the person who ordered / asked')}
                    </div>
                    <div className="adm-row end"><button className="adm-btn primary" disabled={busy === 'notif'} onClick={saveNotif}>Save recipients</button></div>
                </section>

                <SmtpCard profile="main" title="Main SMTP" value={smtp} main={smtp} onSaved={setSmtp} testTo={testTo} setTestTo={setTestTo} logsReload={logs.reload}
                    intro="Sends order and query notifications, confirmations, recruitment results, event emails and certificates (the Email Outbox)." />
            </div>
            <div className="adm-grid-2 top">
                <SmtpCard profile="auth" title="Account emails SMTP" value={smtpAuth} main={smtp} onSaved={setSmtpAuth} testTo={testTo} setTestTo={setTestTo} logsReload={logs.reload}
                    intro="Sends password-reset codes and links only. A separate mailbox keeps these working even when a big mail-out has used the main account's daily limit. If left empty, the main SMTP is used." />
            </div>

            <section className="adm-panel">
                <div className="adm-row between"><h3>Email log</h3><button className="adm-btn small ghost" onClick={logs.reload}>Refresh</button></div>
                {logs.loading ? <Spinner /> : (
                    <div className="adm-table-wrap">
                        <table className="adm-table compact">
                            <thead><tr><th>When</th><th>Type</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
                            <tbody>
                                {(logs.data || []).map(l => (
                                    <tr key={l.id}>
                                        <td className="nowrap">{fmtDate(l.created_at)}</td><td>{l.kind}</td><td className="clip">{l.recipient}</td><td className="clip">{l.subject}</td>
                                        <td><Badge tone={l.status === 'sent' ? 'ok' : l.status === 'failed' ? 'danger' : 'warn'}>{l.status}</Badge>{l.error && <small className="adm-err"> {l.error}</small>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    )
}
