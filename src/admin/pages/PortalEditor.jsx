import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { downloadXlsx, fmtIst, saveBlob } from '../../lib/xlsx'
import { readSheet, mapHeaders } from '../../lib/sheet'
import { Field } from '../fields'
import { Modal, PageTitle, Badge, Empty, Spinner, Switch, useToast, useConfirm, DateTimeInput, queuedText } from '../ui'
import Icon from '../icons'
import { CertDesigner, ListEditor } from '../CertDesigner'

const TABS = [['setup', 'Setup'], ['people', 'Participants'], ['judging', 'Judging & results'], ['emails', 'Emails'], ['certificates', 'Certificates'], ['export', 'Export & clean-up']]
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

/* ---------- adding participants (typed in or from Excel) ---------- */
const isLead = v => /^(lead|leader|team ?lead|captain|yes|y|true|1)$/i.test(String(v || '').trim())

/** Sends rows in chunks, then (optionally) queues the "you are registered" email for everyone added. */
async function addParticipants(portal, rows, { notify, onProgress } = {}) {
    const sum = { added: 0, teams: 0, joined: 0, accounts: 0, addedEmails: [], noPassword: [], skipped: [] }
    for (let i = 0; i < rows.length; i += 400) {
        const r = await api.post(`/admin/portals/${portal.id}/participants`, { rows: rows.slice(i, i + 400) })
        for (const k of ['added', 'teams', 'joined', 'accounts']) sum[k] += r[k]
        sum.addedEmails.push(...r.addedEmails); sum.noPassword.push(...r.noPassword); sum.skipped.push(...r.skipped)
        onProgress?.(Math.min(rows.length, i + 400))
    }
    if (notify && sum.addedEmails.length) { await api.post(`/admin/portals/${portal.id}/notify`, { emails: sum.addedEmails }); sum.notified = sum.addedEmails.length }
    return sum
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const resultText = (r, solo) => `${r.added} added${solo ? '' : ` (${plural(r.teams, 'new team')}${r.joined ? `, ${r.joined} joined existing teams` : ''})`}${r.accounts ? `, ${plural(r.accounts, 'new account')}` : ''}${r.notified ? `, ${r.notified} emails queued` : ''}`

function AddParticipant({ portal, data, onClose, onDone }) {
    const toast = useToast()
    const solo = portal.config.team.mode === 'solo'
    const [f, setF] = useState({ name: '', email: '', regNo: '', mobile: '', team: '', lead: false })
    const [notify, setNotify] = useState(true)
    const [busy, setBusy] = useState(false)
    const set = patch => setF(x => ({ ...x, ...patch }))
    const existing = data.teams.find(t => t.name.toLowerCase() === f.team.trim().replace(/\s+/g, ' ').toLowerCase())
    const size = existing ? data.members.filter(m => m.team_id === existing.id).length : 0
    const save = async (e, again) => {
        e?.preventDefault()
        setBusy(true)
        try {
            const r = await addParticipants(portal, [{ ...f, line: 1 }], { notify })
            if (!r.added) toast(r.skipped[0]?.reason || 'Not added', 'error')
            else {
                toast(`${f.name || f.email} added${existing ? ` to team ${existing.name}` : ''}${r.notified ? ' — registration email queued' : ''}`)
                onDone()
                if (again) setF(x => ({ name: '', email: '', regNo: '', mobile: '', team: x.team, lead: false })); else onClose()
            }
        } catch (err) { toast(err.message, 'error') }
        setBusy(false)
    }
    return (
        <Modal open onClose={onClose} title="Add a participant">
            <form className="adm-form" onSubmit={save}>
                <div className="adm-grid-2">
                    <label className="adm-field"><span>Name</span><input className="adm-input" value={f.name} onChange={e => set({ name: e.target.value })} required /></label>
                    <label className="adm-field"><span>Email</span><input className="adm-input" type="email" value={f.email} onChange={e => set({ email: e.target.value })} required /></label>
                    <label className="adm-field"><span>Registration no.</span><input className="adm-input" value={f.regNo} onChange={e => set({ regNo: e.target.value.toUpperCase() })} /></label>
                    <label className="adm-field"><span>Mobile</span><input className="adm-input" inputMode="numeric" value={f.mobile} onChange={e => set({ mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></label>
                </div>
                {!solo && <>
                    <label className="adm-field"><span>Team name — pick an existing team or type a new one</span>
                        <input className="adm-input" list="adm-team-names" value={f.team} onChange={e => set({ team: e.target.value })} required minLength={2} />
                        <datalist id="adm-team-names">{data.teams.map(t => <option key={t.id} value={t.name} />)}</datalist>
                    </label>
                    {existing
                        ? <p className="adm-hint">Joins team <b>{existing.name}</b> ({size} / {portal.config.team.max} members){size >= portal.config.team.max ? ' — this team is full' : ''}.</p>
                        : f.team.trim().length >= 2 && <Switch checked={f.lead} onChange={v => set({ lead: v })} label="Team lead (otherwise the first person added to a new team leads it)" />}
                </>}
                <Switch checked={notify} onChange={setNotify} label="Email them their registration details (with a set-password link if they are new)" />
                <p className="adm-hint">If this email has no account yet, one is created. The first time they sign in or register with it, the site asks them to set a password using a code sent to that email.</p>
                <div className="adm-row end">
                    <button type="button" className="adm-btn ghost" onClick={onClose}>Cancel</button>
                    <button type="button" className="adm-btn" disabled={busy} onClick={e => e.currentTarget.form.reportValidity() && save(null, true)}>Add and add another</button>
                    <button className="adm-btn primary" disabled={busy}>Add</button>
                </div>
            </form>
        </Modal>
    )
}

const PFIELDS = [['name', 'Name'], ['email', 'Email *'], ['regNo', 'Registration no.'], ['mobile', 'Mobile'], ['team', 'Team name'], ['role', 'Lead? (lead / yes)']]

function ImportParticipants({ portal, onClose, onDone }) {
    const toast = useToast()
    const solo = portal.config.team.mode === 'solo'
    const [sheet, setSheet] = useState(null)
    const [map, setMap] = useState({})
    const [notify, setNotify] = useState(true)
    const [busy, setBusy] = useState(null)
    const [result, setResult] = useState(null)
    const fields = PFIELDS.filter(([k]) => !solo || !['team', 'role'].includes(k))
    const load = async file => {
        if (!file) return
        try { const sh = await readSheet(file); setSheet({ ...sh, file: file.name }); setMap(mapHeaders(sh.headers)); setResult(null) } catch (e) { toast(e.message, 'error') }
    }
    const rows = useMemo(() => (sheet?.rows || []).map((r, i) => ({
        line: i + 2, name: r[map.name] || '', email: r[map.email] || '', regNo: r[map.regNo] || '', mobile: r[map.mobile] || '',
        team: solo ? '' : r[map.team] || '', lead: !solo && map.role ? isLead(r[map.role]) : false,
    })).filter(r => r.email || r.name), [sheet, map, solo])
    const teamCount = new Set(rows.map(r => r.team.trim().toLowerCase()).filter(Boolean)).size
    const run = async () => {
        setBusy({ done: 0, total: rows.length })
        try {
            const r = await addParticipants(portal, rows, { notify, onProgress: done => setBusy({ done, total: rows.length }) })
            setResult(r)
            toast(`${r.added} participants added — recorded in the audit log`)
            onDone()
        } catch (e) { toast(e.message, 'error') }
        setBusy(null)
    }
    const template = () => downloadXlsx(`${portal.slug}-participants-template.xlsx`, [{
        name: 'Participants', rows: solo
            ? [['Name', 'Email', 'Reg no', 'Mobile'], ['Aditi Sharma', 'aditi.sharma2024@vitstudent.ac.in', '24BCE0001', '9876543210']]
            : [['Name', 'Email', 'Reg no', 'Mobile', 'Team', 'Role'], ['Aditi Sharma', 'aditi.sharma2024@vitstudent.ac.in', '24BCE0001', '9876543210', 'Byte Busters', 'Lead'], ['Rahul Verma', 'rahul.verma2024@vitstudent.ac.in', '24BCE0002', '9876543211', 'Byte Busters', 'Member']],
    }])
    return (
        <Modal open onClose={onClose} title="Import participants from Excel" wide>
            <div className="adm-form">
                <p className="adm-hint">
                    One row per person. {solo ? 'Each row becomes its own entry.' : 'Rows with the same team name become one team (or join that team if it is already registered); the row marked Lead leads it, otherwise the first row does.'}
                    {' '}People already registered are skipped. People without an account get one and set their password the first time they sign in. <button type="button" className="adm-link" onClick={template}>Download a template</button>
                </p>
                <input type="file" accept=".xlsx,.csv" onChange={e => load(e.target.files[0])} />
                {sheet && <>
                    <div className="adm-grid-2">
                        {fields.map(([k, l]) => (
                            <label key={k} className="adm-field"><span>{l}</span>
                                <select className="adm-input" value={map[k] || ''} onChange={e => setMap(m => ({ ...m, [k]: e.target.value || undefined }))}>
                                    <option value="">— not in sheet —</option>{sheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </label>
                        ))}
                    </div>
                    {!solo && !map.team && <p className="adm-err">Choose the column that holds the team name.</p>}
                    <Switch checked={notify} onChange={setNotify} label="Email everyone added their registration details (with a set-password link for new accounts)" />
                    <div className="adm-table-wrap">
                        <table className="adm-table">
                            <thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Reg no</th><th>Mobile</th>{!solo && <th>Team</th>}</tr></thead>
                            <tbody>{rows.slice(0, 8).map(r => <tr key={r.line}><td>{r.line}</td><td>{r.name}</td><td>{r.email}</td><td>{r.regNo}</td><td>{r.mobile}</td>{!solo && <td>{r.team}{r.lead && <Badge tone="accent">lead</Badge>}</td>}</tr>)}</tbody>
                        </table>
                    </div>
                    <p className="adm-hint">{rows.length} rows in {sheet.file}{!solo && map.team ? ` · ${teamCount} teams` : ''}{rows.length > 8 ? ' — showing the first 8' : ''}.</p>
                </>}
                {busy && <div><div className="adm-progress"><span style={{ width: `${(busy.done / busy.total) * 100}%` }} /></div><small>Adding {busy.done} / {busy.total}</small></div>}
                {result && (
                    <div className="adm-panel">
                        <b>{resultText(result, solo)}.</b>
                        {result.skipped.length > 0 && <p className="adm-hint">Skipped {result.skipped.length}: {result.skipped.slice(0, 20).map(s => `row ${s.row} (${s.reason})`).join('; ')}{result.skipped.length > 20 ? '…' : ''}</p>}
                    </div>
                )}
                <div className="adm-row end">
                    <button type="button" className="adm-btn ghost" onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
                    {!result && <button type="button" className="adm-btn primary" disabled={!rows.length || !map.email || (!solo && !map.team) || !!busy} onClick={run}>Add {rows.length} participants</button>}
                </div>
            </div>
        </Modal>
    )
}

/** Wording of the "you are registered" email, and a resend for people who have not set a password yet. */
function AddedEmailPanel({ portal, data, setPortal, ensureSaved }) {
    const toast = useToast()
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const draft = portal.config.emails.added
    const noPassword = data.members.filter(m => m.invited).length
    const setDraft = patch => setPortal(p => ({ ...p, config: { ...p.config, emails: { ...p.config.emails, added: { ...draft, ...patch } } } }))
    const send = async () => {
        try {
            await ensureSaved()
            const r = await api.post(`/admin/portals/${portal.id}/notify`, { noPassword: true })
            toast(queuedText(r.queued)); navigate('/admin/outbox')
        } catch (e) { toast(e.message, 'error') }
    }
    return (
        <section className="adm-panel adm-form" style={{ marginBottom: 12 }}>
            <div className="adm-row wrap" style={{ justifyContent: 'space-between' }}>
                <span><b>{noPassword}</b> participant{noPassword === 1 ? '' : 's'} added by an admin {noPassword === 1 ? 'has' : 'have'} not set a password yet.</span>
                <div className="adm-row">
                    <button className="adm-btn small ghost" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Edit'} registration email</button>
                    <button className="adm-btn small" disabled={!noPassword} onClick={send}><Icon name="send" size={14} /> Email them a set-password link</button>
                </div>
            </div>
            {open && <>
                <label className="adm-field"><span>Subject</span><input className="adm-input" value={draft.subject} onChange={e => setDraft({ subject: e.target.value })} /></label>
                <label className="adm-field"><span>Message</span><textarea className="adm-input" rows={9} value={draft.body} onChange={e => setDraft({ body: e.target.value })} /></label>
                <p className="adm-hint">Placeholders: {'{{name}} {{event}} {{team}} {{code}} {{teamLine}} {{account}} {{link}}'}. {'{{account}}'} becomes the set-password link for people without a password, or a sign-in reminder for everyone else. Save changes before sending.</p>
            </>}
        </section>
    )
}

/* ---------- Participants ---------- */
function PeopleTab({ portal, data, reload, setPortal, ensureSaved }) {
    const toast = useToast()
    const confirm = useConfirm()
    const [q, setQ] = useState('')
    const [adding, setAdding] = useState(null)
    const openAdd = async kind => { try { await ensureSaved(); setAdding(kind) } catch { /* save failed; toast shown */ } }
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
            <div className="adm-row wrap" style={{ marginBottom: 12 }}>
                <input className="adm-input search" placeholder="Search team, code, name, email or reg no" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 220, maxWidth: 420 }} />
                <button className="adm-btn" onClick={() => openAdd('one')}><Icon name="plus" size={16} /> Add participant</button>
                <button className="adm-btn" onClick={() => openAdd('sheet')}><Icon name="upload" size={16} /> Import Excel</button>
            </div>
            <AddedEmailPanel portal={portal} data={data} setPortal={setPortal} ensureSaved={ensureSaved} />
            {adding === 'one' && <AddParticipant portal={portal} data={data} onClose={() => setAdding(null)} onDone={reload} />}
            {adding === 'sheet' && <ImportParticipants portal={portal} onClose={() => setAdding(null)} onDone={reload} />}
            {teams.length === 0 ? <Empty icon="users">No registrations yet — share the event link, or add people above.</Empty> : (
                <div className="adm-table-wrap">
                    <table className="adm-table">
                        <thead><tr><th>Team</th><th>Members</th><th>Round</th><th>Submitted</th><th /></tr></thead>
                        <tbody>
                            {teams.slice(0, 800).map(t => (
                                <tr key={t.id}>
                                    <td><strong>{t.name}</strong><small className="adm-block">code {t.code}{t.rank ? ` · rank ${t.rank}` : ''}</small></td>
                                    <td>{(members[t.id] || []).map(m => (
                                        <div key={m.id} className="adm-member">
                                            <span>{m.name}{m.role === 'lead' && <Badge tone="accent">lead</Badge>}{!!m.invited && <Badge tone="warn">No password yet</Badge>}<small className="adm-block">{m.email} · {m.reg_no || '—'} · {m.mobile || '—'}</small></span>
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
            {tab === 'people' && <PeopleTab portal={portal} data={data} reload={load} setPortal={setPortal} ensureSaved={() => (dirty ? savePortal({}, { quiet: true }) : Promise.resolve())} />}
            {tab === 'judging' && <JudgingTab key={`${portal.current_round}-${data.teams.length}`} portal={portal} data={data} reload={load} savePortal={p => savePortal(p).catch(() => {})} />}
            {tab === 'emails' && <EmailsTab portal={portal} data={data} setPortal={setPortal} savePortal={(p, o) => savePortal(p, o)} />}
            {tab === 'certificates' && <CertificatesTab portal={portal} data={data} setPortal={setPortal} savePortal={(p, o) => savePortal(p, o)} reload={load} />}
            {tab === 'export' && <ExportTab portal={portal} data={data} />}
            {dirty && <div className="adm-savebar"><span>Unsaved changes</span><button className="adm-btn primary" onClick={() => savePortal({}).catch(() => {})}>Save changes</button></div>}
        </>
    )
}
