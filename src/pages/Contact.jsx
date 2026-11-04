import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSite } from '../context/SiteContext'
import { api } from '../lib/api'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import { Reveal } from '../components/Reveal'

/* Public query form — stored in D1 and emailed to the recipients set in Admin → Email & SMTP. */
export default function Contact() {
    const { user } = useAuth()
    const { settings } = useSite()
    const site = settings.site || {}
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
        <>
            <Seo />
            <PageHeader page="contact" />
            <section className="section" style={{ borderTop: 0 }}>
                <div className="wrap split wide-left">
                    <Reveal as="form" className="form boxed" onSubmit={submit}>
                        {user ? <p className="muted" style={{ margin: 0 }}>Sending as <b style={{ color: 'var(--text)' }}>{user.name}</b> · {user.email}</p> : (
                            <div className="row-2">
                                <label className="field"><span>Name</span><input value={f.name} onChange={set('name')} required maxLength={120} autoComplete="name" /></label>
                                <label className="field"><span>Email</span><input type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></label>
                            </div>
                        )}
                        <label className="field"><span>Subject</span><input value={f.subject} onChange={set('subject')} maxLength={200} /></label>
                        <label className="field"><span>Message</span><textarea value={f.message} onChange={set('message')} required minLength={3} maxLength={5000} /></label>
                        <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set('website')} />
                        <button className="btn solid" disabled={st.busy} style={{ alignSelf: 'flex-start' }}>{st.busy ? 'Sending…' : 'Send query'} <span className="arr">→</span></button>
                        {st.ok && <p className="notice ok" role="status">Message received — the team has been notified and will reply by email.</p>}
                        {st.err && <p className="notice err" role="alert">{st.err}</p>}
                    </Reveal>
                    <Reveal delay={0.1} className="facts">
                        {site.email && <div><span>Email</span><b><a href={`mailto:${site.email}`}>{site.email}</a></b></div>}
                        {site.phone && <div><span>Phone</span><b><a href={`tel:${site.phone.replace(/\s/g, '')}`}>{site.phone}</a></b></div>}
                        {site.address && <div><span>Address</span><b>{site.address}</b></div>}
                    </Reveal>
                </div>
            </section>
        </>
    )
}
