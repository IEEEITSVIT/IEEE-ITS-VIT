import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { fmtIst } from '../lib/xlsx'
import PageHeader from '../components/PageHeader'
import ProfileGate from '../components/ProfileGate'
import Seo from '../components/Seo'
import Section from '../components/Section'
import { Reveal } from '../components/Reveal'

const STATUS = {
    applied: ['Applied', ''], test_submitted: ['Test submitted', ''], interview: ['Shortlisted for interview', 'on'],
    under_review: ['Under review', ''], selected: ['Selected', 'on'], not_selected: ['Not selected this time', ''],
}
const past = iso => !!iso && Date.parse(iso) < Date.now()

export default function Recruitment() {
    const { user, loading: authLoading, logout } = useAuth()
    const [data, setData] = useState(null)
    const [err, setErr] = useState('')
    const [picked, setPicked] = useState([])
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState(null)

    const load = useCallback(() => api.get('/recruitment').then(setData).catch(e => setErr(e.message)), [])
    useEffect(() => { if (!authLoading) load() }, [authLoading, user?.mobile, user?.regNo, load])

    const apply = async () => {
        setBusy(true); setMsg(null)
        try { await api.post('/recruitment/apply', { domainIds: picked }); setPicked([]); setMsg({ ok: true, t: 'Application received. Good luck!' }); await load() }
        catch (e) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) }
    }
    const withdraw = async id => {
        if (!window.confirm('Withdraw this application?')) return
        try { await api.del(`/recruitment/apply/${id}`); await load() } catch (e) { setMsg({ ok: false, t: e.message }) }
    }

    if (err) return <><PageHeader title="Recruitments" overline="Join the team" subtitle={err} /></>
    if (!data) return <div className="wrap" style={{ padding: '120px 0' }}><div className="skeleton" style={{ height: 320 }} /></div>

    if (!data.open && !data.preview) {
        return (
            <>
                <Seo title="Recruitments" />
                <PageHeader title={data.title || 'Recruitments'} overline="Join the team" subtitle="Recruitments are closed right now. Follow our socials to hear when the next round opens." />
            </>
        )
    }

    const me = data.me
    const appOf = id => me?.applications.find(a => a.domainId === id)
    const canApply = me?.eligible && me?.profileComplete

    return (
        <>
            <Seo title={data.title} description={data.intro} />
            <PageHeader title={data.title} overline="Join the team" subtitle={data.intro} />
            <Section id="recruitment.main" className="section" style={{ borderTop: 0 }}>
                <div className="wrap form" style={{ gap: 24 }}>
                    {data.preview && <p className="notice">Preview: recruitments are closed, so only admins can see this page.</p>}
                    {!user && (
                        <div className="boxed form">
                            <span className="label">Sign in to apply</span>
                            <p className="muted" style={{ margin: 0 }}>Use your <b>@vitstudent.ac.in</b> email. Only VIT students can join the chapter.</p>
                            <div className="hero-cta" style={{ marginTop: 0 }}>
                                <Link className="btn solid" to="/login?mode=register&next=/recruitment">Create account <span className="arr">→</span></Link>
                                <Link className="btn" to="/login?next=/recruitment">Sign in</Link>
                            </div>
                        </div>
                    )}
                    {user && !me?.eligible && (
                        <p className="notice err">You are signed in as {user.email}. Only <b>@vitstudent.ac.in</b> accounts can apply — <button className="link-btn" onClick={logout}>sign out</button> and use your VIT student email.</p>
                    )}
                    {user && me?.eligible && !me.profileComplete && <ProfileGate text="Recruitment needs your registration number and mobile number so we can reach you about interviews." />}

                    <div className="grid g-2 rec-grid">
                        {data.domains.map((d, i) => {
                            const a = appOf(d.id)
                            const [label, tone] = a ? STATUS[a.status] || [a.status, ''] : []
                            const testOpen = d.test && !a?.testSubmittedAt && (a?.testStartedAt || !past(d.test.deadline))
                            return (
                                <Reveal key={d.id} delay={(i % 2) * 0.06} className={`boxed rec-card${picked.includes(d.id) ? ' picked' : ''}`}>
                                    <div className="rec-top">
                                        <h3 className="display h-sm">{d.title}</h3>
                                        {a ? <span className={`chip ${tone}`}>{label}</span> : !d.accepting && <span className="chip">Closed</span>}
                                    </div>
                                    {d.description && <p className="muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{d.description}</p>}
                                    <ul className="rec-facts">
                                        {d.apply_deadline && <li><span>Apply by</span>{fmtIst(d.apply_deadline)}</li>}
                                        {d.test && <li><span>Online test</span>{d.test.questions} questions · {d.test.minutes} min{d.test.deadline ? ` · due ${fmtIst(d.test.deadline)}` : ''}</li>}
                                        {d.exam && <li><span>Proctored exam</span>{d.exam.deadline ? `due ${fmtIst(d.exam.deadline)}` : 'link shared with applicants'}</li>}
                                    </ul>
                                    <div className="hero-cta" style={{ marginTop: 'auto' }}>
                                        {!a && d.accepting && canApply && (
                                            <label className="check">
                                                <input type="checkbox" checked={picked.includes(d.id)} onChange={e => setPicked(p => (e.target.checked ? [...p, d.id] : p.filter(x => x !== d.id)))} />
                                                <span>Select this domain</span>
                                            </label>
                                        )}
                                        {a && testOpen && <Link className="btn solid sm" to={`/recruitment/test/${d.id}`}>{a.testStartedAt ? 'Resume test' : 'Start test'} <span className="arr">→</span></Link>}
                                        {a && a.testSubmittedAt && <span className="muted small">Test submitted {fmtIst(a.testSubmittedAt)}</span>}
                                        {a?.examLink && <a className="btn sm" href={a.examLink} target="_blank" rel="noreferrer">Open proctored exam ↗</a>}
                                        {a && a.status === 'applied' && !a.testStartedAt && d.accepting && <button className="btn sm" onClick={() => withdraw(d.id)}>Withdraw</button>}
                                    </div>
                                </Reveal>
                            )
                        })}
                    </div>
                    {data.domains.length === 0 && <p className="muted">Domains will be announced soon.</p>}
                    {canApply && picked.length > 0 && (
                        <div className="rec-applybar">
                            <span>{picked.length} domain{picked.length > 1 ? 's' : ''} selected — you can be selected for more than one.</span>
                            <button className="btn solid" disabled={busy} onClick={apply}>{busy ? 'Applying…' : 'Apply now'} <span className="arr">→</span></button>
                        </div>
                    )}
                    {msg && <p className={`notice ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.t}</p>}
                </div>
            </Section>
        </>
    )
}
