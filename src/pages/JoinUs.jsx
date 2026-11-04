import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import { Reveal } from '../components/Reveal'

export default function JoinUs() {
    const { user, logout, updateProfile } = useAuth()
    const [p, setP] = useState({ name: '', mobile: '', regNo: '' })
    const [st, setSt] = useState({ busy: false, ok: '', err: '' })
    const [pw, setPw] = useState({ current: '', next: '' })
    const [pwMsg, setPwMsg] = useState(null)

    useEffect(() => { if (user) setP({ name: user.name || '', mobile: user.mobile || '', regNo: user.regNo || '' }) }, [user])

    if (!user) {
        return (
            <>
                <Seo />
                <PageHeader page="join">
                    <div className="hero-cta">
                        <Link to="/login?mode=register" className="btn solid">Create account <span className="arr">→</span></Link>
                        <Link to="/login" className="btn">I have an account</Link>
                    </div>
                </PageHeader>
            </>
        )
    }

    const save = async e => {
        e.preventDefault()
        setSt({ busy: true, ok: '', err: '' })
        try { await updateProfile(p); setSt({ busy: false, ok: 'Profile saved.', err: '' }) }
        catch (err) { setSt({ busy: false, ok: '', err: err.message }) }
    }
    const changePw = async e => {
        e.preventDefault()
        try { await api.post('/auth/password', pw); setPw({ current: '', next: '' }); setPwMsg({ ok: true, t: 'Password updated.' }) }
        catch (err) { setPwMsg({ ok: false, t: err.message }) }
    }

    return (
        <>
            <Seo title="Your Profile" noindex />
            <PageHeader title={`Hi, ${user.name.split(' ')[0]}`} overline={user.memberType} subtitle={user.email} />
            <section className="section" style={{ borderTop: 0 }}>
                <div className="wrap split">
                    <Reveal as="form" className="form boxed" onSubmit={save}>
                        <span className="label">Profile</span>
                        <label className="field"><span>Full name</span><input value={p.name} onChange={e => setP(x => ({ ...x, name: e.target.value }))} required /></label>
                        <label className="field"><span>Email (fixed)</span><input value={user.email} disabled /></label>
                        <div className="row-2">
                            <label className="field"><span>Mobile</span><input type="tel" value={p.mobile} onChange={e => setP(x => ({ ...x, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10 digits" /></label>
                            <label className="field"><span>Registration no.</span><input value={p.regNo} onChange={e => setP(x => ({ ...x, regNo: e.target.value.toUpperCase().slice(0, 10) }))} placeholder="23BCE0001" /></label>
                        </div>
                        <div className="hero-cta" style={{ marginTop: 0 }}>
                            <button className="btn solid" disabled={st.busy}>{st.busy ? 'Saving…' : 'Save changes'}</button>
                            <button type="button" className="btn" onClick={logout}>Sign out</button>
                        </div>
                        {st.ok && <p className="notice ok">{st.ok}</p>}
                        {st.err && <p className="notice err">{st.err}</p>}
                    </Reveal>
                    <Reveal as="form" delay={0.1} className="form boxed" onSubmit={changePw}>
                        <span className="label">Security</span>
                        <label className="field"><span>Current password</span><input type="password" value={pw.current} onChange={e => setPw(x => ({ ...x, current: e.target.value }))} required autoComplete="current-password" /></label>
                        <label className="field"><span>New password</span><input type="password" value={pw.next} onChange={e => setPw(x => ({ ...x, next: e.target.value }))} required minLength={8} autoComplete="new-password" /></label>
                        <button className="btn" style={{ alignSelf: 'flex-start' }}>Update password</button>
                        {pwMsg && <p className={`notice ${pwMsg.ok ? 'ok' : 'err'}`}>{pwMsg.t}</p>}
                        <Link to="/merch?tab=orders" className="link-arrow" style={{ alignSelf: 'flex-start', marginTop: 8 }}>My bookings →</Link>
                    </Reveal>
                </div>
            </section>
        </>
    )
}
