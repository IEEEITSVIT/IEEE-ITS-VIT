import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import { Reveal } from '../components/Reveal'

export default function Suggestions() {
    const { user } = useAuth()
    const [message, setMessage] = useState('')
    const [st, setSt] = useState({ busy: false, ok: false, err: '' })
    const submit = async e => {
        e.preventDefault()
        setSt({ busy: true, ok: false, err: '' })
        try { await api.post('/queries', { kind: 'suggestion', message }); setMessage(''); setSt({ busy: false, ok: true, err: '' }) }
        catch (err) { setSt({ busy: false, ok: false, err: err.message }) }
    }
    return (
        <>
            <Seo />
            <PageHeader page="suggestions" />
            <section className="section" style={{ borderTop: 0 }}>
                <div className="wrap" style={{ maxWidth: 820 }}>
                    {!user ? (
                        <p className="notice">Sign in to share suggestions — it helps us credit great ideas and follow up. <Link to="/login?next=/suggestions" className="accent">Sign in →</Link></p>
                    ) : (
                        <Reveal as="form" className="form boxed" onSubmit={submit}>
                            <p className="muted" style={{ margin: 0 }}>From <b style={{ color: 'var(--text)' }}>{user.name}</b> · {user.email}</p>
                            <label className="field"><span>Your suggestion</span><textarea value={message} onChange={e => setMessage(e.target.value)} required placeholder="A workshop idea, a website improvement, anything." /></label>
                            <button className="btn solid" disabled={st.busy || !message.trim()} style={{ alignSelf: 'flex-start' }}>{st.busy ? 'Sending…' : 'Submit suggestion'} <span className="arr">→</span></button>
                            {st.ok && <p className="notice ok" role="status">Thank you — your suggestion has been shared with the team.</p>}
                            {st.err && <p className="notice err" role="alert">{st.err}</p>}
                        </Reveal>
                    )}
                </div>
            </section>
        </>
    )
}
