import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'

/* Query form shared by the Contact page and the band above the footer.
   Submissions are stored in D1 and emailed to the recipients set in Admin → Email & SMTP. */
export default function ContactForm({ compact, buttonLabel = 'Send query', successText }) {
    const { user } = useAuth()
    const [f, setF] = useState({ name: '', email: '', subject: '', message: '', website: '' })
    const [st, setSt] = useState({ busy: false, ok: false, err: '' })
    const set = k => e => setF(x => ({ ...x, [k]: e.target.value }))

    const submit = async e => {
        e.preventDefault()
        setSt({ busy: true, ok: false, err: '' })
        try {
            await api.post('/queries', { kind: 'contact', ...f })
            setF({ name: '', email: '', subject: '', message: '', website: '' })
            setSt({ busy: false, ok: true, err: '' })
        } catch (err) { setSt({ busy: false, ok: false, err: err.message }) }
    }

    return (
        <form className="form" onSubmit={submit}>
            {user ? <p className="muted" style={{ margin: 0 }}>Sending as <b style={{ color: 'var(--text)' }}>{user.name}</b> · {user.email}</p> : (
                <div className="row-2">
                    <label className="field"><span>Name</span><input value={f.name} onChange={set('name')} required maxLength={120} autoComplete="name" /></label>
                    <label className="field"><span>Email</span><input type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></label>
                </div>
            )}
            {!compact && <label className="field"><span>Subject</span><input value={f.subject} onChange={set('subject')} maxLength={200} /></label>}
            <label className="field"><span>Message</span><textarea value={f.message} onChange={set('message')} required minLength={3} maxLength={5000} style={compact ? { minHeight: 110 } : undefined} /></label>
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set('website')} />
            <button className="btn solid" disabled={st.busy} style={{ alignSelf: 'flex-start' }}>{st.busy ? 'Sending…' : buttonLabel} <span className="arr">→</span></button>
            {st.ok && <p className="notice ok" role="status">{successText || 'Message received — the team has been notified and will reply by email.'}</p>}
            {st.err && <p className="notice err" role="alert">{st.err}</p>}
        </form>
    )
}
