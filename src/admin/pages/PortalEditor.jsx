import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { downloadXlsx, fmtIst, saveBlob } from '../../lib/xlsx'
import { Field } from '../fields'
import { PageTitle, Badge, Empty, Spinner, Switch, useToast, useConfirm, DateTimeInput, queuedText } from '../ui'
import Icon from '../icons'

const TABS = [['setup', 'Setup'], ['people', 'Participants'], ['judging', 'Judging & results'], ['emails', 'Emails'], ['certificates', 'Certificates'], ['export', 'Export & clean-up']]
const CERT_KEYS = [['name', 'Participant name'], ['team', 'Team name'], ['event', 'Event title'], ['rank', 'Rank'], ['date', 'Date'], ['regNo', 'Registration no.'], ['custom', 'Custom text']]
const AUDIENCES = [['all', 'Everyone registered'], ['submitted', 'Teams that submitted'], ['not_submitted', 'Teams that have not submitted'], ['qualified', 'Qualified for a round'], ['not_qualified', 'Did not qualify for a round'], ['winners', 'Winners']]
const TEMPLATE_FOR = { all: 'all', submitted: 'all', not_submitted: 'all', qualified: 'qualified', not_qualified: 'notQualified', winners: 'winners' }

/** Average scores per team for a round, best first. */
function leaderboard(data, round, criteria) {
    return data.teams.filter(t => t.round >= round).map(t => {
        const rows = data.scores.filter(s => s.team_id === t.id && s.round === round)
        const n = rows.length
        return {
            team: t, n, submitted: !!t.submission?.[round],
            crit: Object.fromEntries(criteria.map(c => [c.name, n ? rows.reduce((s, r) => s + (Number(r.scores[c.name]) || 0), 0) / n : null])),
            total: n ? rows.reduce((s, r) => s + r.total, 0) / n : null,
        }
    }).sort((a, b) => (b.total ?? -1) - (a.total ?? -1))
}
const f1 = v => (v == null ? '—' : Number(v).toFixed(1))

/* ---------- small list editors ---------- */
function ListEditor({ items, onChange, render, blank, max, addLabel }) {
    return (
        <div className="adm-stack">
            {items.map((it, i) => (
                <div key={i} className="adm-row adm-listrow">
                    {render(it, patch => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x))))}
                    <button type="button" className="adm-icon-btn" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Remove"><Icon name="trash" size={15} /></button>
                </div>
            ))}
            {items.length < max && <button type="button" className="adm-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...items, blank(items.length)])}><Icon name="plus" size={14} /> {addLabel}</button>}
        </div>
    )
}

/* ---------- Setup ---------- */
function SetupTab({ portal, setPortal }) {
    const c = portal.config
    const set = patch => setPortal(p => ({ ...p, config: { ...p.config, ...patch } }))
    const listText = v => (Array.isArray(v) ? v.join('\n') : v || '')
    const count = v => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).filter(x => /@/.test(x)).length
    return (
        <div className="adm-grid-2 top">
            <section className="adm-panel adm-form">
                <h3>Basics</h3>
                <label className="adm-field"><span>Title</span><input className="adm-input" value={portal.title} onChange={e => setPortal(p => ({ ...p, title: e.target.value }))} /></label>
                <label className="adm-field"><span>Link</span><div className="adm-row"><code>/e/</code><input className="adm-input" value={portal.slug} onChange={e => setPortal(p => ({ ...p, slug: e.target.value }))} /></div></label>
                <label className="adm-field"><span>Status</span>
                    <select className="adm-input" value={portal.status} onChange={e => setPortal(p => ({ ...p, status: e.target.value }))}>
                        <option value="draft">Draft — only admins can see it</option><option value="open">Open — registrations and submissions</option>
                        <option value="closed">Closed — no new registrations</option><option value="archived">Archived — event finished</option>
                    </select>
                </label>
                <label className="adm-field"><span>Short summary</span><textarea className="adm-input" rows={2} value={c.summary} onChange={e => set({ summary: e.target.value })} /></label>
                <label className="adm-field"><span>Details, rules and prizes</span><textarea className="adm-input" rows={6} value={c.details} onChange={e => set({ details: e.target.value })} /></label>
                <div className="adm-grid-2">
                    <label className="adm-field"><span>When (shown as text)</span><input className="adm-input" value={c.dateText} onChange={e => set({ dateText: e.target.value })} placeholder="12–13 Dec 2026" /></label>
                    <label className="adm-field"><span>Venue</span><input className="adm-input" value={c.venue} onChange={e => set({ venue: e.target.value })} /></label>
                </div>
                <div className="adm-field"><span>Banner image</span><Field field={{ type: 'image' }} value={c.banner} onChange={v => set({ banner: v })} /></div>
            </section>
            <section className="adm-panel adm-form">
                <h3>Who can register</h3>
                <div className="adm-seg">
                    <button type="button" className={c.access === 'link' ? 'on' : ''} onClick={() => set({ access: 'link' })}>Anyone with the link</button>
                    <button type="button" className={c.access === 'allowlist' ? 'on' : ''} onClick={() => set({ access: 'allowlist' })}>Only listed emails</button>
                </div>
                {c.access === 'allowlist' && (
                    <label className="adm-field"><span>Allowed emails ({count(c.allowlist)}) — paste from your registration sheet</span>
                        <textarea className="adm-input mono" rows={6} value={listText(c.allowlist)} onChange={e => set({ allowlist: e.target.value })} placeholder="one email per line" />
                    </label>
                )}
                <Switch checked={c.vitOnly} onChange={v => set({ vitOnly: v })} label="VIT students only (@vitstudent.ac.in, registration number required)" />
                <div className="adm-grid-2">
                    <label className="adm-field"><span>Registration opens</span><DateTimeInput value={c.regOpens} onChange={v => set({ regOpens: v })} /></label>
                    <label className="adm-field"><span>Registration closes</span><DateTimeInput value={c.regCloses} onChange={v => set({ regCloses: v })} /></label>
                </div>
                <h3>Format</h3>
                <div className="adm-seg">
                    <button type="button" className={c.team.mode === 'solo' ? 'on' : ''} onClick={() => set({ team: { mode: 'solo', min: 1, max: 1 } })}>Solo</button>
                    <button type="button" className={c.team.mode === 'team' ? 'on' : ''} onClick={() => set({ team: { mode: 'team', min: Math.max(2, c.team.min), max: Math.max(4, c.team.max) } })}>Teams</button>
                </div>
                {c.team.mode === 'team' && (
                    <div className="adm-grid-2">
                        <label className="adm-field"><span>Minimum members</span><input className="adm-input" type="number" min="1" max="10" value={c.team.min} onChange={e => set({ team: { ...c.team, min: Number(e.target.value) } })} /></label>
                        <label className="adm-field"><span>Maximum members</span><input className="adm-input" type="number" min="1" max="10" value={c.team.max} onChange={e => set({ team: { ...c.team, max: Number(e.target.value) } })} /></label>
                    </div>
                )}
                <h3>Rounds</h3>
                <ListEditor items={c.rounds} max={5} addLabel="Add round" onChange={rounds => set({ rounds })} blank={i => ({ name: `Round ${i + 1}`, deadline: null, submissions: true })}
                    render={(r, up) => <>
                        <input className="adm-input" value={r.name} onChange={e => up({ name: e.target.value })} style={{ maxWidth: 160 }} />
                        <DateTimeInput value={r.deadline} onChange={v => up({ deadline: v })} title="Submission deadline" />
                        <Switch checked={r.submissions} onChange={v => up({ submissions: v })} label="Links" />
                    </>} />
                <h3>Submission links</h3>
                <ListEditor items={c.fields} max={6} addLabel="Add link field" onChange={fields => set({ fields })} blank={i => ({ key: `link${i + 1}`, label: `Link ${i + 1}`, required: false })}
                    render={(f, up) => <><input className="adm-input" value={f.label} onChange={e => up({ label: e.target.value, key: f.key })} /><Switch checked={f.required} onChange={v => up({ required: v })} label="Required" /></>} />
                <h3>Judging</h3>
                <ListEditor items={c.criteria} max={10} addLabel="Add criterion" onChange={criteria => set({ criteria })} blank={() => ({ name: '', max: 10 })}
                    render={(k, up) => <><input className="adm-input" value={k.name} placeholder="Criterion" onChange={e => up({ name: e.target.value })} /><input className="adm-input" type="number" min="1" value={k.max} onChange={e => up({ max: Number(e.target.value) })} style={{ maxWidth: 90 }} title="Maximum points" /></>} />
                <label className="adm-field"><span>Evaluators ({count(c.evaluators)}) — they sign in with these emails and get a judging panel</span>
                    <textarea className="adm-input mono" rows={3} value={listText(c.evaluators)} onChange={e => set({ evaluators: e.target.value })} placeholder="one email per line" />
                </label>
                <label className="adm-field" style={{ maxWidth: 200 }}><span>Number of winners</span><input className="adm-input" type="number" min="1" max="50" value={c.winnersCount} onChange={e => set({ winnersCount: Number(e.target.value) })} /></label>
            </section>
        </div>
    )
}

/* ---------- Participants ---------- */
function PeopleTab({ portal, data, reload }) {
    const toast = useToast()
    const confirm = useConfirm()
    const [q, setQ] = useState('')
    const members = useMemo(() => {
        const by = {}
        for (const m of data.members) (by[m.team_id] ||= []).push(m)
        return by
    }, [data])
    const teams = data.teams.filter(t => !q || `${t.name} ${t.code} ${(members[t.id] || []).map(m => `${m.name} ${m.email} ${m.reg_no}`).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    const incomplete = data.teams.filter(t => (members[t.id] || []).length < portal.config.team.min).length
    const del = async (path, label) => {
        if (!await confirm(`Remove ${label}?`)) return
        try { await api.del(`/admin/portals/${portal.id}/${path}`); toast('Removed'); reload() } catch (e) { toast(e.message, 'error') }
    }
    return (
        <>
            <div className="adm-stats">
                <div className="adm-stat"><span className="icon"><Icon name="users" size={20} /></span><div><strong>{data.members.length}</strong><span>participants</span></div></div>
                <div className="adm-stat"><span className="icon"><Icon name="grid" size={20} /></span><div><strong>{data.teams.length}</strong><span>{portal.config.team.mode === 'team' ? 'teams' : 'entries'}</span>{incomplete > 0 && <small>{incomplete} below minimum size</small>}</div></div>
                <div className="adm-stat"><span className="icon"><Icon name="check" size={20} /></span><div><strong>{data.teams.filter(t => t.submitted_at).length}</strong><span>submitted</span></div></div>
            </div>
            <input className="adm-input search" placeholder="Search team, code, name, email or reg no" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 12, width: '100%', maxWidth: 420 }} />
            {teams.length === 0 ? <Empty icon="users">No registrations yet.</Empty> : (
                <div className="adm-table-wrap">
                    <table className="adm-table">
                        <thead><tr><th>Team</th><th>Members</th><th>Round</th><th>Submitted</th><th /></tr></thead>
                        <tbody>
                            {teams.slice(0, 800).map(t => (
                                <tr key={t.id}>
                                    <td><strong>{t.name}</strong><small className="adm-block">code {t.code}{t.rank ? ` · rank ${t.rank}` : ''}</small></td>
                                    <td>{(members[t.id] || []).map(m => (
                                        <div key={m.id} className="adm-member">
                                            <span>{m.name}{m.role === 'lead' && <Badge tone="accent">lead</Badge>}<small className="adm-block">{m.email} · {m.reg_no || '—'} · {m.mobile || '—'}</small></span>
                                            <button className="adm-icon-btn" onClick={() => del(`members/${m.id}`, m.name)} aria-label={`Remove ${m.name}`}><Icon name="close" size={14} /></button>
                                        </div>
                                    ))}</td>
                                    <td>{portal.config.rounds[t.round - 1]?.name}</td>
                                    <td>{t.submitted_at ? fmtIst(t.submitted_at) : <Badge>No</Badge>}</td>
                                    <td><button className="adm-btn small ghost danger-text" onClick={() => del(`teams/${t.id}`, `team ${t.name}`)}><Icon name="trash" size={14} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    )
}

/* ---------- Judging & results ---------- */
function JudgingTab({ portal, data, reload, savePortal }) {
    const toast = useToast()
    const c = portal.config
    const [round, setRound] = useState(portal.current_round)
    const board = useMemo(() => leaderboard(data, round, c.criteria), [data, round, c.criteria])
    const last = round >= c.rounds.length
    const [picked, setPicked] = useState(() => new Set(board.filter(b => b.team.round > round).map(b => b.team.id)))
    const [topN, setTopN] = useState('')
    const [ranks, setRanks] = useState(() => Object.fromEntries(data.teams.filter(t => t.rank).map(t => [t.id, t.rank])))
    const changeRound = r => { setRound(r); setPicked(new Set(leaderboard(data, r, c.criteria).filter(b => b.team.round > r).map(b => b.team.id))) }

    const qualify = async () => {
        try { await api.post(`/admin/portals/${portal.id}/qualify`, { round, teamIds: [...picked] }); toast(`${picked.size} teams qualified for ${c.rounds[round]?.name}`); reload() } catch (e) { toast(e.message, 'error') }
    }
    const autoRanks = () => setRanks(Object.fromEntries(board.filter(b => b.total != null).slice(0, c.winnersCount).map((b, i) => [b.team.id, i + 1])))
    const saveRanks = async () => {
        try { await api.post(`/admin/portals/${portal.id}/ranks`, { ranks: Object.entries(ranks).filter(([, r]) => r).map(([teamId, rank]) => ({ teamId: Number(teamId), rank: Number(rank) })) }); toast('Winners saved'); reload() } catch (e) { toast(e.message, 'error') }
    }
    const scored = board.filter(b => b.n).length

    return (
        <>
            <div className="adm-panel adm-row wrap">
                <label className="adm-field" style={{ margin: 0 }}><span>Showing</span>
                    <select className="adm-input" value={round} onChange={e => changeRound(Number(e.target.value))}>{c.rounds.map((r, i) => <option key={i} value={i + 1}>{r.name}</option>)}</select>
                </label>
                <label className="adm-field" style={{ margin: 0 }}><span>Current round (judges score this one)</span>
                    <select className="adm-input" value={portal.current_round} onChange={e => savePortal({ current_round: Number(e.target.value) })}>{c.rounds.map((r, i) => <option key={i} value={i + 1}>{r.name}</option>)}</select>
                </label>
                <label className="adm-field" style={{ margin: 0 }}><span>Teams can see scores up to</span>
                    <select className="adm-input" value={portal.scores_published} onChange={e => savePortal({ scores_published: Number(e.target.value) })}>
                        <option value={0}>Not published</option>{c.rounds.map((r, i) => <option key={i} value={i + 1}>{r.name}</option>)}
                    </select>
                </label>
                <a className="adm-btn" href={`/e/${portal.slug}/judge`} target="_blank" rel="noreferrer">Judging panel <Icon name="external" size={14} /></a>
            </div>
            <p className="adm-hint">{scored} of {board.length} teams in {c.rounds[round - 1]?.name} have scores from {c.evaluators.length || 'no'} assigned evaluator{c.evaluators.length === 1 ? '' : 's'} (admins can score too). Scores are the average across evaluators.</p>
            {!last && (
                <div className="adm-bulkbar">
                    <span>{picked.size} selected to qualify for {c.rounds[round]?.name}</span>
                    <input className="adm-input" type="number" min="1" placeholder="Top N" value={topN} onChange={e => setTopN(e.target.value)} style={{ maxWidth: 90 }} />
                    <button className="adm-btn small" disabled={!topN} onClick={() => setPicked(new Set(board.slice(0, Number(topN)).map(b => b.team.id)))}>Pick top {topN || 'N'}</button>
                    <span className="adm-topbar-spacer" />
                    <button className="adm-btn small primary" onClick={qualify}>Save qualifiers</button>
                </div>
            )}
            {board.length === 0 ? <Empty icon="grid">No teams in this round.</Empty> : (
                <div className="adm-table-wrap">
                    <table className="adm-table">
                        <thead><tr>{!last && <th>Qualify</th>}<th>#</th><th>Team</th>{c.criteria.map(k => <th key={k.name}>{k.name}</th>)}<th>Average</th><th>Judges</th><th>Submitted</th>{last && <th>Winner rank</th>}</tr></thead>
                        <tbody>
                            {board.map((b, i) => (
                                <tr key={b.team.id} className={picked.has(b.team.id) ? 'sel' : ''}>
                                    {!last && <td><input type="checkbox" checked={picked.has(b.team.id)} onChange={e => setPicked(s => { const n = new Set(s); e.target.checked ? n.add(b.team.id) : n.delete(b.team.id); return n })} /></td>}
                                    <td>{i + 1}</td><td><strong>{b.team.name}</strong></td>
                                    {c.criteria.map(k => <td key={k.name}>{f1(b.crit[k.name])}</td>)}
                                    <td><b>{f1(b.total)}</b></td><td>{b.n}</td><td>{b.submitted ? 'Yes' : <Badge>No</Badge>}</td>
                                    {last && <td><input className="adm-input" type="number" min="1" value={ranks[b.team.id] || ''} onChange={e => setRanks(r => ({ ...r, [b.team.id]: e.target.value }))} style={{ maxWidth: 80 }} /></td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {last && (
                <div className="adm-panel adm-row wrap" style={{ marginTop: 14 }}>
                    <button className="adm-btn" onClick={autoRanks}>Fill top {c.winnersCount} from scores</button>
                    <button className="adm-btn primary" onClick={saveRanks}>Save winners</button>
                    <span className="adm-topbar-spacer" />
                    <Switch checked={!!portal.winners_published} onChange={v => savePortal({ winners_published: v })} label={portal.winners_published ? 'Winners announced on the event page' : 'Announce winners on the event page'} />
                </div>
            )}
        </>
    )
}

/* ---------- Emails ---------- */
function EmailsTab({ portal, data, setPortal, savePortal }) {
    const toast = useToast()
    const navigate = useNavigate()
    const c = portal.config
    const [aud, setAud] = useState('all')
    const [round, setRound] = useState(Math.min(portal.current_round + 1, c.rounds.length))
    const key = TEMPLATE_FOR[aud]
    const draft = c.emails[key]
    const teams = data.teams.filter({
        all: () => true, submitted: t => !!t.submitted_at, not_submitted: t => !t.submitted_at,
        qualified: t => t.round >= round, not_qualified: t => t.round === round - 1, winners: t => t.rank != null,
    }[aud])
    const people = data.members.filter(m => teams.some(t => t.id === m.team_id)).length
    const setDraft = patch => setPortal(p => ({ ...p, config: { ...p.config, emails: { ...p.config.emails, [key]: { ...draft, ...patch } } } }))
    const send = async () => {
        try {
            await savePortal({}, { quiet: true })
            const r = await api.post(`/admin/portals/${portal.id}/email`, { audience: aud, round, template: key })
            toast(queuedText(r.queued)); navigate('/admin/outbox')
        } catch (e) { toast(e.message, 'error') }
    }
    return (
        <div className="adm-grid-2 top">
            <section className="adm-panel adm-form">
                <h3>Who</h3>
                <select className="adm-input" value={aud} onChange={e => setAud(e.target.value)}>{AUDIENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                {['qualified', 'not_qualified'].includes(aud) && (
                    <label className="adm-field"><span>Round</span><select className="adm-input" value={round} onChange={e => setRound(Number(e.target.value))}>{c.rounds.map((r, i) => <option key={i} value={i + 1}>{r.name}</option>)}</select></label>
                )}
                <p><b>{people}</b> people in <b>{teams.length}</b> {c.team.mode === 'team' ? 'teams' : 'entries'}.</p>
                <p className="adm-hint">Each person gets their own email. Placeholders: {'{{name}} {{team}} {{event}} {{round}} {{rank}} {{code}} {{link}}'}. Large mail-outs are sent within the daily email limit and continue the next day.</p>
                <button className="adm-btn primary" disabled={!people} onClick={send} style={{ alignSelf: 'flex-start' }}><Icon name="send" size={16} /> Queue {people} emails</button>
            </section>
            <section className="adm-panel adm-form">
                <h3>Draft for "{AUDIENCES.find(a => a[0] === aud)[1]}"</h3>
                <label className="adm-field"><span>Subject</span><input className="adm-input" value={draft.subject} onChange={e => setDraft({ subject: e.target.value })} /></label>
                <label className="adm-field"><span>Message</span><textarea className="adm-input" rows={12} value={draft.body} onChange={e => setDraft({ body: e.target.value })} /></label>
                <button className="adm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => savePortal({})}>Save draft</button>
            </section>
        </div>
    )
}

/* ---------- Certificates ---------- */
function CertDesigner({ tpl, onChange, sample }) {
    const box = useRef(null)
    const [w, setW] = useState(600)
    useEffect(() => {
        const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
        if (box.current) ro.observe(box.current)
        return () => ro.disconnect()
    }, [])
    const setField = (i, patch) => onChange({ ...tpl, fields: tpl.fields.map((f, k) => (k === i ? { ...f, ...patch } : f)) })
    const drag = (i, e) => {
        const r = box.current.getBoundingClientRect()
        const move = ev => setField(i, { x: Math.round(Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100))), y: Math.round(Math.min(100, Math.max(0, ((ev.clientY - r.top) / r.height) * 100))) })
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
        e.preventDefault()
    }
    const text = f => (f.text ? f.text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => sample[k] ?? '') : sample[f.key] ?? '')
    return (
        <div className="adm-form">
            <div className="adm-field"><span>Template image (PNG or JPG, landscape A4 works best; keep it under 1 MB)</span><Field field={{ type: 'image' }} value={tpl.image} onChange={image => onChange({ ...tpl, image })} /></div>
            {tpl.image && (
                <div ref={box} className="adm-cert-canvas">
                    <img src={tpl.image} alt="" draggable={false} />
                    {tpl.fields.map((f, i) => (
                        <span key={i} onPointerDown={e => drag(i, e)} title="Drag to position"
                            style={{ left: `${f.x}%`, top: `${f.y}%`, fontSize: (f.size * w) / 842, color: f.color, fontWeight: f.bold ? 700 : 400, transform: `translate(${f.align === 'center' ? '-50%' : f.align === 'right' ? '-100%' : '0'}, -50%)` }}>
                            {text(f) || `[${f.key}]`}
                        </span>
                    ))}
                </div>
            )}
            <ListEditor items={tpl.fields} max={8} addLabel="Add text" onChange={fields => onChange({ ...tpl, fields })}
                blank={() => ({ key: 'custom', text: 'Certificate of Participation', x: 50, y: 30, size: 30, color: '#111111', align: 'center', bold: true })}
                render={(f, up) => <>
                    <select className="adm-input" value={f.key} onChange={e => up({ key: e.target.value })} style={{ maxWidth: 150 }}>{CERT_KEYS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <input className="adm-input" value={f.text || ''} onChange={e => up({ text: e.target.value })} placeholder={f.key === 'custom' ? 'Text, e.g. Rank {{rank}}' : 'Optional text with {{name}}'} />
                    <input className="adm-input" type="number" min="6" max="120" value={f.size} onChange={e => up({ size: Number(e.target.value) })} style={{ maxWidth: 70 }} title="Font size" />
                    <input type="color" className="adm-swatch" value={f.color} onChange={e => up({ color: e.target.value })} title="Colour" />
                    <select className="adm-input" value={f.align} onChange={e => up({ align: e.target.value })} style={{ maxWidth: 96 }}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select>
                    <Switch checked={f.bold} onChange={v => up({ bold: v })} label="Bold" />
                </>} />
        </div>
    )
}

function CertificatesTab({ portal, data, setPortal, savePortal, reload }) {
    const toast = useToast()
    const c = portal.config
    const [which, setWhich] = useState('participant')
    const [job, setJob] = useState(null) // { label, done, total }
    const stop = useRef(false)
    const setCert = patch => setPortal(p => ({ ...p, config: { ...p.config, certificates: { ...p.config.certificates, ...patch } } }))
    const teamOf = useMemo(() => Object.fromEntries(data.teams.map(t => [t.id, t])), [data])
    const items = useMemo(() => data.members.filter(m => !c.certificates.onlySubmitted || teamOf[m.team_id]?.submitted_at).map(m => {
        const t = teamOf[m.team_id]
        const winner = portal.winners_published && t?.rank
        const template = winner && c.certificates.winner.image ? c.certificates.winner : c.certificates.participant
        return { member: m, template, data: { name: m.name, team: t?.name || '', event: portal.title, rank: winner ? String(t.rank) : '', regNo: m.reg_no || '', date: new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }) } }
    }), [data, c.certificates, portal, teamOf])
    const sample = items[0]?.data || { name: 'Aditi Sharma', team: 'Team Nova', event: portal.title, rank: '1', regNo: '23BCE0001', date: new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }) }
    const lib = () => import('../../lib/certificate')

    const preview = async () => {
        try { const { certificatePdf } = await lib(); const tpl = c.certificates[which]; window.open(URL.createObjectURL(new Blob([await certificatePdf(tpl, sample)], { type: 'application/pdf' }))) }
        catch (e) { toast(e.message, 'error') }
    }
    const zip = async () => {
        const { zipOfPdfs, safeFile } = await lib()
        const PART = 200
        try {
            for (let p = 0; p * PART < items.length; p++) {
                const part = items.slice(p * PART, p * PART + PART).map(it => ({ ...it, filename: `${safeFile(it.data.team)}-${safeFile(it.data.name)}-${it.member.id}.pdf` }))
                setJob({ label: `Building ZIP ${p + 1} of ${Math.ceil(items.length / PART)}`, done: 0, total: part.length })
                const blob = await zipOfPdfs(part, done => setJob(j => ({ ...j, done })))
                saveBlob(blob, `${safeFile(portal.title)}-certificates${items.length > PART ? `-part${p + 1}` : ''}.zip`)
            }
            toast('Certificates downloaded')
        } catch (e) { toast(e.message, 'error') }
        setJob(null)
    }
    const combined = async () => {
        const { combinedPdf, safeFile } = await lib()
        try {
            setJob({ label: 'Building one PDF', done: 0, total: items.length })
            saveBlob(new Blob([await combinedPdf(items, done => setJob(j => ({ ...j, done })))], { type: 'application/pdf' }), `${safeFile(portal.title)}-all-certificates.pdf`)
        } catch (e) { toast(e.message, 'error') }
        setJob(null)
    }
    const email = async () => {
        const todo = items.filter(it => !it.member.cert_sent_at)
        if (!todo.length) return toast('Everyone has already been emailed their certificate.')
        const { certificatePdf, toBase64 } = await lib()
        await savePortal({}, { quiet: true })
        stop.current = false
        setJob({ label: 'Emailing certificates', done: 0, total: todo.length })
        let sent = 0
        for (const it of todo) {
            if (stop.current) break
            try {
                const pdf = toBase64(await certificatePdf(it.template, it.data))
                await api.post(`/admin/portals/${portal.id}/certificates/send`, { memberId: it.member.id, pdf })
                setJob(j => ({ ...j, done: ++sent }))
            } catch (e) {
                toast(e.status === 429 ? `${e.message} ${sent} sent so far — press the button again tomorrow to continue.` : e.message, 'error')
                if (e.status === 429 || e.status === 503) break
            }
        }
        setJob(null)
        if (sent) toast(`${sent} certificates emailed`)
        reload()
    }

    const sentCount = data.members.filter(m => m.cert_sent_at).length
    return (
        <div className="adm-grid-2 top">
            <section className="adm-panel adm-form">
                <div className="adm-seg">
                    <button type="button" className={which === 'participant' ? 'on' : ''} onClick={() => setWhich('participant')}>Participation certificate</button>
                    <button type="button" className={which === 'winner' ? 'on' : ''} onClick={() => setWhich('winner')}>Winner certificate</button>
                </div>
                <CertDesigner key={which} tpl={c.certificates[which]} onChange={tpl => setCert({ [which]: tpl })} sample={sample} />
                <div className="adm-row">
                    <button className="adm-btn" onClick={() => savePortal({})}>Save template</button>
                    <button className="adm-btn" disabled={!c.certificates[which].image} onClick={preview}>Preview PDF</button>
                </div>
                {which === 'winner' && <p className="adm-hint">Winners (teams with a rank, once announced) get this design; leave it empty to give everyone the participation certificate.</p>}
            </section>
            <section className="adm-panel adm-form">
                <h3>Issue</h3>
                <Switch checked={c.certificates.released} onChange={v => { setCert({ released: v }); savePortal({ config: { ...c, certificates: { ...c.certificates, released: v } } }) }} label="Participants can download their own certificate from the event page" />
                <Switch checked={c.certificates.onlySubmitted} onChange={v => setCert({ onlySubmitted: v })} label="Only teams that made a submission" />
                <p><b>{items.length}</b> certificates · <b>{sentCount}</b> already emailed.</p>
                <p className="adm-hint">Certificates are drawn on this computer and never stored on the server. Emailed ones go straight to Gmail as attachments and count towards the daily email limit.</p>
                <div className="adm-row wrap">
                    <button className="adm-btn" disabled={!items.length || !!job || !c.certificates.participant.image} onClick={zip}>Download ZIP</button>
                    <button className="adm-btn" disabled={!items.length || !!job || !c.certificates.participant.image} onClick={combined}>Download one PDF</button>
                    <button className="adm-btn primary" disabled={!items.length || !!job || !c.certificates.participant.image} onClick={email}><Icon name="send" size={16} /> Email certificates</button>
                </div>
                {job && (
                    <div>
                        <div className="adm-progress"><span style={{ width: `${(job.done / job.total) * 100}%` }} /></div>
                        <small>{job.label}: {job.done} / {job.total}</small>
                        {job.label.startsWith('Emailing') && <button className="adm-btn small" onClick={() => { stop.current = true }} style={{ marginLeft: 10 }}>Stop</button>}
                    </div>
                )}
            </section>
        </div>
    )
}

/* ---------- Export & purge ---------- */
function ExportTab({ portal, data }) {
    const toast = useToast()
    const navigate = useNavigate()
    const { isAdmin } = useAuth()
    const c = portal.config
    const [confirmText, setConfirmText] = useState('')
    const [deletePortal, setDeletePortal] = useState(false)
    const exportAll = () => {
        const byTeam = Object.fromEntries(data.teams.map(t => [t.id, t]))
        const membersOf = id => data.members.filter(m => m.team_id === id)
        const subCols = c.rounds.flatMap((r, i) => r.submissions ? c.fields.map(f => [i + 1, f, `${r.name} · ${f.label}`]) : [])
        const sheets = [
            { name: 'Participants', rows: [['Name', 'Email', 'Reg no', 'Mobile', 'Team', 'Role', 'Team code', 'Round reached', 'Rank', 'Joined', 'Certificate emailed'],
                ...data.members.map(m => { const t = byTeam[m.team_id]; return [m.name, m.email, m.reg_no || '', m.mobile || '', t?.name, m.role, t?.code, c.rounds[(t?.round || 1) - 1]?.name, t?.rank ?? '', fmtIst(m.joined_at), m.cert_sent_at ? fmtIst(m.cert_sent_at) : ''] })] },
            { name: 'Teams', rows: [['Team', 'Code', 'Members', 'Lead', 'Round reached', 'Rank', 'Last submission', ...subCols.map(s => s[2])],
                ...data.teams.map(t => { const ms = membersOf(t.id); return [t.name, t.code, ms.length, ms.find(m => m.role === 'lead')?.email || '', c.rounds[t.round - 1]?.name, t.rank ?? '', fmtIst(t.submitted_at), ...subCols.map(([r, f]) => t.submission?.[r]?.[f.key] || '')] })] },
            { name: 'Scores', rows: [['Team', 'Round', 'Evaluator', ...c.criteria.map(k => k.name), 'Total', 'Comment'],
                ...data.scores.map(s => [byTeam[s.team_id]?.name, c.rounds[s.round - 1]?.name, s.evaluator || s.evaluator_id, ...c.criteria.map(k => s.scores[k.name] ?? ''), s.total, s.comment || ''])] },
            ...c.rounds.map((r, i) => ({ name: `Results ${r.name}`, rows: [['Position', 'Team', ...c.criteria.map(k => `${k.name} (avg)`), 'Average total', 'Judges', i + 1 < c.rounds.length ? 'Qualified for next round' : 'Rank', 'Member emails', 'Member phones'],
                ...leaderboard(data, i + 1, c.criteria).map((b, k) => [k + 1, b.team.name, ...c.criteria.map(x => b.crit[x.name] == null ? '' : Number(b.crit[x.name].toFixed(2))), b.total == null ? '' : Number(b.total.toFixed(2)), b.n,
                    i + 1 < c.rounds.length ? (b.team.round > i + 1 ? 'Yes' : 'No') : b.team.rank ?? '', membersOf(b.team.id).map(m => m.email).join(', '), membersOf(b.team.id).map(m => m.mobile).join(', ')])] })),
            { name: 'Winners', rows: [['Rank', 'Team', 'Name', 'Email', 'Reg no', 'Mobile'],
                ...data.teams.filter(t => t.rank).sort((a, b) => a.rank - b.rank).flatMap(t => membersOf(t.id).map(m => [t.rank, t.name, m.name, m.email, m.reg_no || '', m.mobile || '']))] },
        ]
        downloadXlsx(`${portal.slug}-all-data-${new Date().toISOString().slice(0, 10)}.xlsx`, sheets)
    }
    const purge = async () => {
        try {
            const r = await api.post(`/admin/portals/${portal.id}/purge`, { confirm: confirmText, deletePortal })
            toast(`Removed ${r.removed} participants and all their data`)
            navigate(deletePortal ? '/admin/portals' : 0)
        } catch (e) { toast(e.message, 'error') }
    }
    return (
        <div className="adm-grid-2 top">
            <section className="adm-panel adm-form">
                <h3>Download everything</h3>
                <p className="adm-hint">One Excel file with sheets for participants (with contacts), teams and their submitted links, every evaluator's scores, results and qualifiers for each round, and winners. Certificates are downloaded from the Certificates tab.</p>
                <button className="adm-btn primary" style={{ alignSelf: 'flex-start' }} onClick={exportAll}><Icon name="box" size={16} /> Download Excel</button>
            </section>
            {isAdmin && (
                <section className="adm-panel adm-form">
                    <h3>Delete event data</h3>
                    <p className="adm-hint">Permanently removes every registration, team, submission and score for this event (download the Excel and certificates first). Participants' site accounts are kept.</p>
                    <Switch checked={deletePortal} onChange={setDeletePortal} label="Also delete the event portal itself and its images" />
                    <label className="adm-field"><span>Type <code>{portal.slug}</code> to confirm</span><input className="adm-input" value={confirmText} onChange={e => setConfirmText(e.target.value)} /></label>
                    <button className="adm-btn danger" style={{ alignSelf: 'flex-start' }} disabled={confirmText !== portal.slug} onClick={purge}>Delete data permanently</button>
                </section>
            )}
        </div>
    )
}

export default function PortalEditor() {
    const { id } = useParams()
    const toast = useToast()
    const [tab, setTab] = useState('setup')
    const [portal, setPortal] = useState(null)
    const [saved, setSaved] = useState('')
    const [data, setData] = useState(null)

    const load = useCallback(async () => {
        try {
            const [{ item }, d] = await Promise.all([api.get(`/admin/portals/${id}`), api.get(`/admin/portals/${id}/data`)])
            setPortal(item); setSaved(JSON.stringify(item)); setData(d)
        } catch (e) { toast(e.message, 'error') }
    }, [id, toast])
    useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect -- async fetch on mount

    const savePortal = async (patch = {}, { quiet } = {}) => {
        const next = { ...portal, ...patch }
        try {
            const { item } = await api.put(`/admin/portals/${id}`, { title: next.title, slug: next.slug, status: next.status, config: next.config, current_round: next.current_round, scores_published: next.scores_published, winners_published: !!next.winners_published })
            setPortal(item); setSaved(JSON.stringify(item))
            if (!quiet) toast('Saved')
        } catch (e) { toast(e.message, 'error'); throw e }
    }

    if (!portal || !data) return <Spinner />
    const dirty = JSON.stringify(portal) !== saved
    const link = `${window.location.origin}/e/${portal.slug}`

    return (
        <>
            <PageTitle title={portal.title} subtitle={<><Badge tone={portal.status === 'open' ? 'ok' : 'neutral'}>{portal.status}</Badge> {link}</>}>
                <Link className="adm-btn ghost" to="/admin/portals">All events</Link>
                <button className="adm-btn" onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copied'))}>Copy link</button>
                <a className="adm-btn" href={`/e/${portal.slug}`} target="_blank" rel="noreferrer">Open <Icon name="external" size={14} /></a>
                <button className="adm-btn primary" disabled={!dirty} onClick={() => savePortal({}).catch(() => {})}>{dirty ? 'Save changes' : 'Saved'}</button>
            </PageTitle>
            <div className="adm-tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
            {tab === 'setup' && <SetupTab portal={portal} setPortal={setPortal} />}
            {tab === 'people' && <PeopleTab portal={portal} data={data} reload={load} />}
            {tab === 'judging' && <JudgingTab key={`${portal.current_round}-${data.teams.length}`} portal={portal} data={data} reload={load} savePortal={p => savePortal(p).catch(() => {})} />}
            {tab === 'emails' && <EmailsTab portal={portal} data={data} setPortal={setPortal} savePortal={(p, o) => savePortal(p, o)} />}
            {tab === 'certificates' && <CertificatesTab portal={portal} data={data} setPortal={setPortal} savePortal={(p, o) => savePortal(p, o)} reload={load} />}
            {tab === 'export' && <ExportTab portal={portal} data={data} />}
            {dirty && <div className="adm-savebar"><span>Unsaved changes</span><button className="adm-btn primary" onClick={() => savePortal({}).catch(() => {})}>Save changes</button></div>}
        </>
    )
}
