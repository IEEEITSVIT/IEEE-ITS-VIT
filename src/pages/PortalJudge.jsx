import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import Seo from '../components/Seo'
import PageHeader from '../components/PageHeader'

function TeamScore({ slug, round, criteria, fields, team, onSaved }) {
    const [scores, setScores] = useState(() => Object.fromEntries(criteria.map(c => [c.name, team.mine?.scores?.[c.name] ?? ''])))
    const [comment, setComment] = useState(team.mine?.comment || '')
    const [st, setSt] = useState({ busy: false, msg: null })
    const total = criteria.reduce((s, c) => s + (Number(scores[c.name]) || 0), 0)
    const save = async e => {
        e.preventDefault()
        setSt({ busy: true, msg: null })
        try { await api.post(`/portals/${slug}/evaluate/${team.id}`, { round, scores, comment }); onSaved(team.id); setSt({ busy: false, msg: { ok: true, t: 'Saved' } }) }
        catch (err) { setSt({ busy: false, msg: { ok: false, t: err.message } }) }
    }
    return (
        <form className={`boxed form judge-card${team.mine ? ' done' : ''}`} onSubmit={save}>
            <div className="rec-top"><h3 className="display h-sm" style={{ margin: 0 }}>{team.name}</h3><span className="chip">{team.size} member{team.size === 1 ? '' : 's'}</span></div>
            {team.submission ? (
                <ul className="judge-links">
                    {fields.map(f => team.submission[f.key] && <li key={f.key}><span>{f.label}</span><a href={team.submission[f.key]} target="_blank" rel="noreferrer">{team.submission[f.key]}</a></li>)}
                </ul>
            ) : <p className="muted small" style={{ margin: 0 }}>No submission for this round.</p>}
            <div className="judge-grid">
                {criteria.map(c => (
                    <label key={c.name} className="field"><span>{c.name} <small>/ {c.max}</small></span>
                        <input type="number" inputMode="decimal" min="0" max={c.max} step="0.5" value={scores[c.name]} onChange={e => setScores(s => ({ ...s, [c.name]: e.target.value }))} required />
                    </label>
                ))}
            </div>
            <label className="field"><span>Comment (shown to the team if scores are published)</span><input value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} /></label>
            <div className="rec-top">
                <b>Total {total} / {criteria.reduce((s, c) => s + c.max, 0)}</b>
                <button className="btn solid sm" disabled={st.busy}>{st.busy ? 'Saving…' : team.mine ? 'Update score' : 'Save score'}</button>
            </div>
            {st.msg && <p className={`notice ${st.msg.ok ? 'ok' : 'err'}`}>{st.msg.t}</p>}
        </form>
    )
}

/** Judging panel for evaluators assigned to an event (and for admins). */
export default function PortalJudge() {
    const { slug } = useParams()
    const [round, setRound] = useState(0)
    const [data, setData] = useState(null)
    const [err, setErr] = useState('')
    const [q, setQ] = useState('')
    const [filter, setFilter] = useState('all')

    const load = useCallback(() => api.get(`/portals/${slug}/evaluate${round ? `?round=${round}` : ''}`).then(d => { setData(d); setRound(d.round) }).catch(e => setErr(e.message)), [slug, round])
    useEffect(() => { load() }, [load])

    const teams = useMemo(() => (data?.teams || []).filter(t => (!q || t.name.toLowerCase().includes(q.toLowerCase())) && (filter === 'all' || (filter === 'todo' ? !t.mine : !!t.mine))), [data, q, filter])

    if (err) return <PageHeader title="Judging panel" overline="Events" subtitle={err}><Link className="btn" to={`/e/${slug}`} style={{ marginTop: 20 }}>Back to event</Link></PageHeader>
    if (!data) return <div className="wrap" style={{ padding: '120px 0' }}><div className="skeleton" style={{ height: 300 }} /></div>
    const done = data.teams.filter(t => t.mine).length

    return (
        <>
            <Seo title={`Judging · ${data.portal.title}`} noindex />
            <PageHeader title="Judging panel" overline={data.portal.title} subtitle={`${done} of ${data.teams.length} teams scored in ${data.portal.rounds[round - 1]?.name}. Your scores are averaged with the other evaluators'.`} />
            <section className="section" style={{ borderTop: 0 }}>
                <div className="wrap form" style={{ gap: 18 }}>
                    <div className="judge-bar">
                        {data.portal.rounds.length > 1 && (
                            <select className="input" value={round} onChange={e => { setData(null); setRound(Number(e.target.value)) }}>
                                {data.portal.rounds.map((r, i) => <option key={i} value={i + 1}>{r.name}</option>)}
                            </select>
                        )}
                        <select className="input" value={filter} onChange={e => setFilter(e.target.value)}>
                            <option value="all">All teams</option><option value="todo">Not scored yet</option><option value="done">Scored</option>
                        </select>
                        <input className="input" placeholder="Search team" value={q} onChange={e => setQ(e.target.value)} />
                        <Link className="btn sm" to={`/e/${slug}`}>Event page</Link>
                    </div>
                    <div className="grid g-2">
                        {teams.map(t => <TeamScore key={`${round}-${t.id}`} slug={slug} round={round} criteria={data.portal.criteria} fields={data.portal.fields} team={t}
                            onSaved={id => setData(d => ({ ...d, teams: d.teams.map(x => (x.id === id ? { ...x, mine: x.mine || { scores: {} } } : x)) }))} />)}
                    </div>
                    {teams.length === 0 && <p className="muted">No teams match.</p>}
                </div>
            </section>
        </>
    )
}
