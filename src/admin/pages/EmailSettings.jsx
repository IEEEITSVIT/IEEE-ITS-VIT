import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { PageTitle, Badge, Spinner, Switch, useToast, useLoader, fmtDate } from '../ui'

const PRESETS = {
    gmail: { host: 'smtp.gmail.com', port: 587, secure: false, note: 'Use a Google App Password (Google Account → Security → 2-Step Verification → App passwords), not your normal password.' },
    outlook: { host: 'smtp.office365.com', port: 587, secure: false, note: 'Microsoft 365 / Outlook. SMTP AUTH must be enabled for the mailbox.' },
    custom: { note: 'Any SMTP provider (Brevo, SendGrid, Zoho, Mailgun…). Port 465 usually needs “SSL/TLS” switched on.' },
}

export default function EmailSettings() {
    const { user } = useAuth()
    const toast = useToast()
    const [smtp, setSmtp] = useState(null)
    const [notif, setNotif] = useState(null)
    const [pass, setPass] = useState('')
    const [testTo, setTestTo] = useState(user.email)
    const [busy, setBusy] = useState('')
    const logs = useLoader(() => api.get('/admin/email-logs').then(r => r.items), [])

    useEffect(() => {
        api.get('/admin/settings').then(r => { setSmtp(r.settings.smtp); setNotif(r.settings.notifications) }).catch(e => toast(e.message, 'error'))
    }, [toast])

    const preset = smtp?.host === 'smtp.gmail.com' ? 'gmail' : smtp?.host === 'smtp.office365.com' ? 'outlook' : 'custom'

    const saveNotif = async () => {
        setBusy('notif')
        try { await api.put('/admin/settings/notifications', { value: notif }); toast('Notification settings saved') }
        catch (e) { toast(e.message, 'error') } finally { setBusy('') }
    }
    const saveSmtp = async () => {
        setBusy('smtp')
        try {
            await api.put('/admin/settings/smtp', { value: { ...smtp, pass } })
            setSmtp(s => ({ ...s, hasPassword: s.hasPassword || !!pass }))
            setPass('')
            toast('SMTP settings saved (password stored encrypted)')
        } catch (e) { toast(e.message, 'error') } finally { setBusy('') }
    }
    const test = async () => {
        setBusy('test')
        try { await api.post('/admin/email-test', { to: testTo }); toast(`Test email sent to ${testTo}`) }
        catch (e) { toast(e.message, 'error') } finally { setBusy(''); logs.reload() }
    }

    if (!smtp || !notif) return <Spinner />
    const N = (k, label) => <Switch checked={notif[k]} onChange={v => setNotif(n => ({ ...n, [k]: v }))} label={label} />

    return (
        <>
            <PageTitle title="Email & SMTP" subtitle="Where order and query notifications go, and how they are sent." />
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

                <section className="adm-panel">
                    <h3>SMTP server</h3>
                    <div className="adm-seg">
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
                    <div className="adm-row end"><button className="adm-btn primary" disabled={busy === 'smtp'} onClick={saveSmtp}>Save SMTP</button></div>
                    <hr />
                    <div className="adm-row">
                        <input className="adm-input" value={testTo} onChange={e => setTestTo(e.target.value)} />
                        <button className="adm-btn" disabled={busy === 'test'} onClick={test}>{busy === 'test' ? 'Sending…' : 'Send test email'}</button>
                    </div>
                </section>
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
