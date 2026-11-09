import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { fmtIst, saveBlob } from '../lib/xlsx'
import PageHeader from '../components/PageHeader'
import ProfileGate from '../components/ProfileGate'
import Seo from '../components/Seo'
import Section from '../components/Section'
import Img from '../components/Img'

const past = iso => !!iso && Date.parse(iso) < Date.now()

function Submission({ portal, team, round, onSaved }) {
    const r = portal.rounds[round - 1]
    const saved = team.submission?.[round] || {}
    const [values, setValues] = useState(() => Object.fromEntries(portal.fields.map(f => [f.key, saved[f.key] || ''])))
    const [st, setSt] = useState({ busy: false, msg: null })
    const closed = past(r.deadline)
    const save = async e => {
        e.preventDefault()
        setSt({ busy: true, msg: null })
        try { const { team: t } = await api.post(`/portals/${portal.slug}/submit`, { round, values }); onSaved(t); setSt({ busy: false, msg: { ok: true, t: 'Submission saved.' } }) }
        catch (err) { setSt({ busy: false, msg: { ok: false, t: err.message } }) }
    }
    return (
        <form className="form boxed" onSubmit={save}>
            <div className="rec-top">
                <span className="label">{r.name} submission</span>
                {saved.at ? <span className="chip on">Submitted {fmtIst(saved.at)}</span> : <span className="chip">Not submitted</span>}
            </div>
            {r.deadline && <p className="muted small" style={{ margin: 0 }}>Deadline: {fmtIst(r.deadline)}{closed ? ' (closed)' : ''}</p>}
            {portal.fields.map(f => (
                <label key={f.key} className="field"><span>{f.label}{f.required ? ' *' : ''}</span>
                    <input value={values[f.key]} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} placeholder="https://" disabled={closed} required={f.required} />
                </label>
            ))}
            {!closed && <button className="btn solid" disabled={st.busy} style={{ alignSelf: 'flex-start' }}>{st.busy ? 'Saving…' : saved.at ? 'Update submission' : 'Submit'} <span className="arr">→</span></button>}
            {st.msg && <p className={`notice ${st.msg.ok ? 'ok' : 'err'}`}>{st.msg.t}</p>}
        </form>
    )
}

export default function EventPortal() {
    const { slug } = useParams()
    const { user, loading: authLoading } = useAuth()
    const [data, setData] = useState(null)
    const [err, setErr] = useState('')
    const [form, setForm] = useState({ teamName: '', code: '' })
    const [msg, setMsg] = useState(null)
    const [busy, setBusy] = useState(false)

    const load = useCallback(() => api.get(`/portals/${slug}`).then(setData).catch(e => setErr(e.message)), [slug])
    // Team names are unique within the event: check while the lead types.
    const [nameCheck, setNameCheck] = useState(null) // { name, available }
    useEffect(() => {
        const name = form.teamName.replace(/\s+/g, ' ').trim()
        if (name.length < 2) return
        const t = setTimeout(() => api.get(`/portals/${slug}/team-name?name=${encodeURIComponent(name)}`).then(setNameCheck).catch(() => {}), 450)
        return () => clearTimeout(t)
    }, [form.teamName, slug])
    const typed = form.teamName.replace(/\s+/g, ' ').trim()
    const nameStatus = typed.length < 2 || nameCheck?.name !== typed ? null : nameCheck.available
    useEffect(() => { if (!authLoading) load() }, [authLoading, user?.mobile, user?.regNo, load])

    const act = async (path, body, done) => {
        setBusy(true); setMsg(null)
        try { await api.post(`/portals/${slug}/${path}`, body); await load(); if (done) setMsg({ ok: true, t: done }) }
        catch (e) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) }
    }
    const certificate = async () => {
        setBusy(true); setMsg(null)
        try {
            const { template, data: d } = await api.get(`/portals/${slug}/certificate`)
            const { certificatePdf, safeFile } = await import('../lib/certificate')
            saveBlob(new Blob([await certificatePdf(template, d)], { type: 'application/pdf' }), `${safeFile(d.event)}-${safeFile(d.name)}.pdf`)
        } catch (e) { setMsg({ ok: false, t: e.message }) } finally { setBusy(false) }
    }

    if (err) return <PageHeader title="Event not found" overline="Events" subtitle={err} />
    if (!data) return <div className="wrap" style={{ padding: '120px 0' }}><div className="skeleton" style={{ height: 320 }} /></div>

    const { portal: p, registration, me, winners } = data
    const team = me?.team
    const isTeam = p.team.mode === 'team'
    const lead = me?.role === 'lead'
    const sizeOk = team && team.members.length >= p.team.min

    return (
        <>
            <Seo title={p.title} description={p.summary} />
            <PageHeader title={p.title} overline={`Events / ${isTeam ? `Teams of ${p.team.min}–${p.team.max}` : 'Solo event'}`} subtitle={p.summary} wide />
            <Section id="portal.main" className="section" style={{ borderTop: 0 }}>
                <div className="wrap split wide-left">
                    <div className="form" style={{ gap: 22 }}>
                        {p.banner && <Img src={p.banner} alt={p.title} ratio="16x9" width={1200} />}
                        {winners?.length > 0 && (
                            <div className="boxed form">
                                <span className="label">Winners</span>
                                <ol className="portal-winners">
                                    {winners.map(w => <li key={w.rank}><b>#{w.rank}</b><span>{w.team}<small>{w.members.join(', ')}</small></span></li>)}
                                </ol>
                            </div>
                        )}
                        {p.details && <div className="boxed" style={{ whiteSpace: 'pre-line' }}>{p.details}</div>}

                        {!user && (
                            <div className="boxed form">
                                <span className="label">Register</span>
                                <p className="muted" style={{ margin: 0 }}>{registration.open ? 'Sign in or create an account to register.' : registration.reason}</p>
                                {registration.open && <div className="hero-cta" style={{ marginTop: 0 }}>
                                    <Link className="btn solid" to={`/login?mode=register&next=/e/${slug}`}>Create account <span className="arr">→</span></Link>
                                    <Link className="btn" to={`/login?next=/e/${slug}`}>Sign in</Link>
                                </div>}
                            </div>
                        )}
                        {user && me?.blocked && /mobile|registration number/.test(me.blocked) && <ProfileGate needRegNo={p.vitOnly} text={me.blocked} />}
                        {user && me?.blocked && !/mobile|registration number/.test(me.blocked) && <p className="notice err">{me.blocked}</p>}

                        {user && !me?.blocked && !team && (registration.open ? (
                            isTeam ? (
                                <div className="grid g-2">
                                    <form className="form boxed" onSubmit={e => { e.preventDefault(); act('register', { teamName: form.teamName }, 'Team created — share the code with your team mates.') }}>
                                        <span className="label">Create a team</span>
                                        <p className="muted small" style={{ margin: 0 }}>You become the team lead and get a code to share.</p>
                                        <label className="field"><span>Team name</span><input value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))} required minLength={2} maxLength={60} aria-describedby="team-name-status" /></label>
                                        {nameStatus !== null && <p id="team-name-status" className={`name-status ${nameStatus ? 'ok' : 'err'}`} role="status">{nameStatus ? `"${typed}" is available` : `"${typed}" is already taken in this event`}</p>}
                                        <button className="btn solid" disabled={busy || nameStatus === false} style={{ alignSelf: 'flex-start' }}>Create team</button>
                                    </form>
                                    <form className="form boxed" onSubmit={e => { e.preventDefault(); act('join', { code: form.code }, 'You joined the team.') }}>
                                        <span className="label">Join a team</span>
                                        <p className="muted small" style={{ margin: 0 }}>Ask your team lead for the 6-character code.</p>
                                        <label className="field"><span>Team code</span><input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().slice(0, 6) }))} required minLength={6} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.2em' }} /></label>
                                        <button className="btn" disabled={busy} style={{ alignSelf: 'flex-start' }}>Join team</button>
                                    </form>
                                </div>
                            ) : (
                                <div className="boxed form">
                                    <span className="label">Register</span>
                                    <p className="muted" style={{ margin: 0 }}>Registering as <b>{me.profile.name}</b> ({me.profile.email}).</p>
                                    <button className="btn solid" disabled={busy} onClick={() => act('register', {}, 'You are registered!')} style={{ alignSelf: 'flex-start' }}>Register now <span className="arr">→</span></button>
                                </div>
                            )
                        ) : <p className="notice">{registration.reason}</p>)}

                        {team && (
                            <>
                                <div className="boxed form">
                                    <div className="rec-top">
                                        <span className="label">{isTeam ? 'Your team' : 'Your registration'}</span>
                                        {team.rank ? <span className="chip on">Placed #{team.rank}</span> : team.round > 1 && <span className="chip on">Qualified for {p.rounds[team.round - 1]?.name}</span>}
                                    </div>
                                    <h3 className="display h-sm" style={{ margin: 0 }}>{team.name}</h3>
                                    {isTeam && (
                                        <div className="portal-code">
                                            <span>Team code</span><b>{team.code}</b>
                                            <button className="btn sm" type="button" onClick={() => navigator.clipboard?.writeText(team.code).then(() => setMsg({ ok: true, t: 'Code copied.' }))}>Copy</button>
                                        </div>
                                    )}
                                    {isTeam && (
                                        <ul className="portal-members">
                                            {team.members.map(m => (
                                                <li key={m.id}>
                                                    <span>{m.name}{m.role === 'lead' && <small> · lead</small>}</span>
                                                    {registration.open && lead && m.role !== 'lead' && <button className="link-btn" onClick={() => window.confirm(`Remove ${m.name}?`) && act('leave', { memberId: m.id })}>Remove</button>}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {isTeam && !sizeOk && <p className="notice">Your team needs at least {p.team.min} members to submit ({team.members.length}/{p.team.max} now).</p>}
                                    {registration.open && <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => window.confirm(lead && team.members.length > 1 ? 'Remove your team mates first.' : 'Leave this event?') && act('leave', {}, 'You have left the event.')}>{lead && isTeam ? 'Leave / delete team' : 'Cancel registration'}</button>}
                                </div>

                                {p.rounds.map((r, i) => r.submissions && team.round >= i + 1 && (sizeOk || !isTeam) && (
                                    <Submission key={i} portal={p} team={team} round={i + 1} onSaved={t => setData(d => ({ ...d, me: { ...d.me, team: t } }))} />
                                ))}

                                {team.results.length > 0 && (
                                    <div className="boxed form">
                                        <span className="label">Your scores</span>
                                        {team.results.map(res => (
                                            <div key={res.round} className="portal-score">
                                                <div className="rec-top"><b>{res.name}</b>
                                                    {res.qualified === true && <span className="chip on">Qualified</span>}
                                                    {res.qualified === false && <span className="chip">Did not qualify</span>}
                                                </div>
                                                {res.score ? (
                                                    <table className="portal-table"><tbody>
                                                        {Object.entries(res.score.criteria).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.toFixed(1)} / {p.criteria.find(c => c.name === k)?.max}</td></tr>)}
                                                        <tr><td><b>Total</b></td><td><b>{res.score.total.toFixed(1)}</b> / {p.criteria.reduce((s, c) => s + c.max, 0)}</td></tr>
                                                    </tbody></table>
                                                ) : <p className="muted small" style={{ margin: 0 }}>Not scored.</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {p.certificatesReleased && (
                                    <div className="boxed form">
                                        <span className="label">Certificate</span>
                                        <p className="muted small" style={{ margin: 0 }}>Generated on your device — download it as many times as you like.</p>
                                        <button className="btn solid" disabled={busy} onClick={certificate} style={{ alignSelf: 'flex-start' }}>{busy ? 'Preparing…' : 'Download certificate'} <span className="arr">→</span></button>
                                    </div>
                                )}
                            </>
                        )}
                        {msg && <p className={`notice ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.t}</p>}
                    </div>

                    <aside className="boxed form portal-facts">
                        <span className="label">At a glance</span>
                        <ul className="rec-facts">
                            {p.dateText && <li><span>When</span>{p.dateText}</li>}
                            {p.venue && <li><span>Where</span>{p.venue}</li>}
                            <li><span>Format</span>{isTeam ? `Teams of ${p.team.min}–${p.team.max}` : 'Solo'}</li>
                            {p.regCloses && <li><span>Registration closes</span>{fmtIst(p.regCloses)}</li>}
                            {p.rounds.map((r, i) => <li key={i}><span>{r.name}</span>{r.deadline ? `Submit by ${fmtIst(r.deadline)}` : r.submissions ? 'Submission open' : 'Offline round'}</li>)}
                            {p.access === 'allowlist' && <li><span>Entry</span>Invited participants only</li>}
                            {p.vitOnly && <li><span>Eligibility</span>VIT students</li>}
                        </ul>
                        {me?.evaluator && <Link className="btn solid" to={`/e/${slug}/judge`}>Open judging panel <span className="arr">→</span></Link>}
                    </aside>
                </div>
            </Section>
        </>
    )
}
