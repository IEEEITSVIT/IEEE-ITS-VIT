import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { useSite } from '../../context/SiteContext'
import { downloadXlsx, fmtIst } from '../../lib/xlsx'
import { readSheet, mapHeaders } from '../../lib/sheet'
import { Drawer, Modal, PageTitle, Badge, Empty, Spinner, Switch, useToast, useConfirm, DateTimeInput, fmtLocal, queuedText } from '../ui'
import Icon from '../icons'

const STATUS = { applied: 'Applied', test_submitted: 'Test submitted', interview: 'Interview', selected: 'Selected', not_selected: 'Not selected' }
const TONE = { applied: 'neutral', test_submitted: 'info', interview: 'warn', selected: 'ok', not_selected: 'neutral' }
const TABS = [['applicants', 'Applicants'], ['domains', 'Domains & tests'], ['emails', 'Emails'], ['settings', 'Settings']]
const blankDomain = () => ({ title: '', description: '', open: true, apply_deadline: null, test_enabled: false, test_minutes: 20, test_deadline: null, exam_link: '', exam_deadline: null, whatsapp_link: '', questions: [], sort_order: 0 })
const scoreText = a => (a.score == null ? '—' : `${a.score}${a.max_score ? ` / ${a.max_score}` : ''}`)

/* ---------- domain editor with questions ---------- */
function QuestionEditor({ value, onChange }) {
    const set = (i, patch) => onChange(value.map((q, k) => (k === i ? { ...q, ...patch } : q)))
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= value.length) return; const n = [...value]; [n[i], n[j]] = [n[j], n[i]]; onChange(n) }
    return (
        <div className="adm-stack">
            {value.map((q, i) => (
                <div key={q.id || i} className="adm-qcard">
                    <div className="adm-row between">
                        <strong>Q{i + 1} · {q.kind === 'mcq' ? 'Multiple choice (auto-scored)' : 'Written answer (you score it)'}</strong>
                        <div className="adm-row">
                            <button type="button" className="adm-icon-btn" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                            <button type="button" className="adm-icon-btn" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                            <button type="button" className="adm-icon-btn" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Remove"><Icon name="trash" size={15} /></button>
                        </div>
                    </div>
                    <textarea className="adm-input" rows={2} placeholder="Question" value={q.prompt} onChange={e => set(i, { prompt: e.target.value })} />
                    {q.kind === 'mcq' && (
                        <>
                            <textarea className="adm-input" rows={4} placeholder="One option per line" value={(q.options || []).join('\n')} onChange={e => set(i, { options: e.target.value.split('\n') })} />
                            <label className="adm-field"><span>Correct option</span>
                                <select className="adm-input" value={q.answer ?? 0} onChange={e => set(i, { answer: Number(e.target.value) })}>
                                    {(q.options || []).map((o, k) => o.trim() && <option key={k} value={k}>{o}</option>)}
                                </select>
                            </label>
                        </>
                    )}
                    <label className="adm-field" style={{ maxWidth: 120 }}><span>Points</span><input className="adm-input" type="number" min="0" max="100" value={q.points ?? 1} onChange={e => set(i, { points: Number(e.target.value) })} /></label>
                </div>
            ))}
            <div className="adm-row">
                <button type="button" className="adm-btn small" onClick={() => onChange([...value, { id: `q${Date.now().toString(36)}`, kind: 'mcq', prompt: '', options: ['', ''], answer: 0, points: 1 }])}><Icon name="plus" size={14} /> Multiple choice</button>
                <button type="button" className="adm-btn small" onClick={() => onChange([...value, { id: `q${Date.now().toString(36)}`, kind: 'text', prompt: '', points: 5 }])}><Icon name="plus" size={14} /> Written answer</button>
            </div>
        </div>
    )
}

function DomainDrawer({ domain, onClose, onSaved }) {
    const toast = useToast()
    const [d, setD] = useState(domain)
    const [busy, setBusy] = useState(false)
    const set = patch => setD(x => ({ ...x, ...patch }))
    const save = async () => {
        setBusy(true)
        try {
            const body = { ...d, questions: d.questions.map(q => ({ ...q, options: (q.options || []).map(o => o.trim()).filter(Boolean) })) }
            const { item } = d.id ? await api.put(`/admin/recruitment/domains/${d.id}`, body) : await api.post('/admin/recruitment/domains', body)
            toast('Domain saved'); onSaved(item)
        } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
    }
    return (
        <Drawer open wide title={d.id ? `Edit · ${d.title}` : 'New domain'} onClose={onClose}
            footer={<><button className="adm-btn ghost" onClick={onClose}>Cancel</button><button className="adm-btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save domain'}</button></>}>
            <div className="adm-form">
                <label className="adm-field"><span>Domain name</span><input className="adm-input" value={d.title} onChange={e => set({ title: e.target.value })} /></label>
                <label className="adm-field"><span>Description (what members of this domain do)</span><textarea className="adm-input" rows={3} value={d.description} onChange={e => set({ description: e.target.value })} /></label>
                <div className="adm-grid-2">
                    <div className="adm-field"><span>Accepting applications</span><Switch checked={d.open} onChange={v => set({ open: v })} label={d.open ? 'Open' : 'Closed'} /></div>
                    <label className="adm-field"><span>Applications close</span><DateTimeInput value={d.apply_deadline} onChange={v => set({ apply_deadline: v })} /></label>
                </div>
                <fieldset className="adm-fieldset"><legend>Online test</legend>
                    <Switch checked={d.test_enabled} onChange={v => set({ test_enabled: v })} label="This domain has a timed test" />
                    {d.test_enabled && <>
                        <div className="adm-grid-2">
                            <label className="adm-field"><span>Time limit (minutes)</span><input className="adm-input" type="number" min="1" max="240" value={d.test_minutes} onChange={e => set({ test_minutes: Number(e.target.value) })} /></label>
                            <label className="adm-field"><span>Test must be started by</span><DateTimeInput value={d.test_deadline} onChange={v => set({ test_deadline: v })} /></label>
                        </div>
                        <QuestionEditor value={d.questions} onChange={questions => set({ questions })} />
                    </>}
                </fieldset>
                <fieldset className="adm-fieldset"><legend>Proctored exam (optional, external link)</legend>
                    <div className="adm-grid-2">
                        <label className="adm-field"><span>Exam link (shown to applicants once set)</span><input className="adm-input" value={d.exam_link} onChange={e => set({ exam_link: e.target.value })} placeholder="https://…" /></label>
                        <label className="adm-field"><span>Exam deadline</span><DateTimeInput value={d.exam_deadline} onChange={v => set({ exam_deadline: v })} /></label>
                    </div>
                </fieldset>
                <label className="adm-field"><span>WhatsApp group link (sent only to selected candidates)</span><input className="adm-input" value={d.whatsapp_link} onChange={e => set({ whatsapp_link: e.target.value })} placeholder="https://chat.whatsapp.com/…" /></label>
            </div>
        </Drawer>
    )
}

/* ---------- applicant detail ---------- */
function ApplicantDrawer({ id, onClose, onChanged }) {
    const toast = useToast()
    const [data, setData] = useState(null)
    const [manual, setManual] = useState('')
    const [note, setNote] = useState('')
    useEffect(() => {
        api.get(`/admin/recruitment/applications/${id}`).then(d => { setData(d); setManual(d.item.manual_score ?? ''); setNote(d.item.note || '') }).catch(e => toast(e.message, 'error'))
    }, [id, toast])
    const patch = async body => { try { await api.patch('/admin/recruitment/applications', { ids: [id], ...body }); toast('Saved'); onChanged() } catch (e) { toast(e.message, 'error') } }
    const a = data?.item
    return (
        <Drawer open wide title={a ? `${a.name} · application` : 'Application'} onClose={onClose}
            footer={a && <>
                <button className="adm-btn" onClick={() => patch({ status: 'interview' })}>Mark for interview</button>
                <button className="adm-btn" onClick={() => patch({ status: 'not_selected' })}>Not selected</button>
                <button className="adm-btn primary" onClick={() => patch({ status: 'selected' })}>Select</button>
            </>}>
            {!a ? <Spinner /> : (
                <div className="adm-form">
                    <div className="adm-panel adm-kv">
                        <span>Email</span><b>{a.email}</b><span>Reg no</span><b>{a.reg_no || '—'}</b><span>Mobile</span><b>{a.mobile || '—'}</b>
                        <span>Status</span><b><Badge tone={TONE[a.status]}>{STATUS[a.status]}</Badge>{a.source !== 'portal' && <Badge tone="accent">{a.source === 'import' ? 'Imported from Excel' : 'Added directly'}</Badge>}</b>
                        <span>Test</span><b>{a.test_submitted_at ? `Submitted ${fmtLocal(a.test_submitted_at)}` : a.test_started_at ? 'Started, not submitted' : 'Not taken'}</b>
                        <span>Proctoring</span><b>{a.tab_switches ? <Badge tone="warn">Left the test {a.tab_switches} time{a.tab_switches > 1 ? 's' : ''}</Badge> : 'No issues recorded'}</b>
                        <span>Auto score</span><b>{a.auto_score ?? '—'}{a.max_score ? ` / ${a.max_score}` : ''}</b>
                    </div>
                    {data.questions.map((q, i) => {
                        const ans = a.answers[q.id]
                        return (
                            <div key={q.id} className="adm-qcard">
                                <strong>Q{i + 1}. {q.prompt}</strong>
                                {q.kind === 'mcq' ? (
                                    <p className={ans === q.answer ? 'adm-ok' : 'adm-err'}>{ans === null || ans === undefined ? 'Not answered' : q.options[ans]} {ans === q.answer ? '(correct)' : `(correct: ${q.options[q.answer]})`}</p>
                                ) : <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{ans || <em>Not answered</em>}</p>}
                                <small className="adm-hint">{q.points} point{q.points === 1 ? '' : 's'}</small>
                            </div>
                        )
                    })}
                    <div className="adm-grid-2">
                        <label className="adm-field"><span>Score for written answers / interview</span><input className="adm-input" type="number" value={manual} onChange={e => setManual(e.target.value)} /></label>
                        <div className="adm-field"><span>&nbsp;</span><button className="adm-btn" onClick={() => patch({ manualScore: manual })}>Save score</button></div>
                    </div>
                    <label className="adm-field"><span>Private note</span><textarea className="adm-input" rows={3} value={note} onChange={e => setNote(e.target.value)} /></label>
                    <button className="adm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => patch({ note })}>Save note</button>
                </div>
            )}
        </Drawer>
    )
}

function DirectAdd({ domains, onClose, onDone }) {
    const toast = useToast()
    const [f, setF] = useState({ name: '', email: '', regNo: '', mobile: '', note: '', domainIds: [] })
    const save = async e => {
        e.preventDefault()
        try { await api.post('/admin/recruitment/direct', f); toast('Candidate added and selected — recorded in the audit log'); onDone() } catch (err) { toast(err.message, 'error') }
    }
    return (
        <Modal open onClose={onClose} title="Add and select directly (no test)">
            <form className="adm-form" onSubmit={save}>
                <div className="adm-grid-2">
                    <label className="adm-field"><span>Name</span><input className="adm-input" value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} required /></label>
                    <label className="adm-field"><span>Email</span><input className="adm-input" type="email" value={f.email} onChange={e => setF(x => ({ ...x, email: e.target.value }))} required /></label>
                    <label className="adm-field"><span>Registration no.</span><input className="adm-input" value={f.regNo} onChange={e => setF(x => ({ ...x, regNo: e.target.value.toUpperCase() }))} /></label>
                    <label className="adm-field"><span>Mobile</span><input className="adm-input" value={f.mobile} onChange={e => setF(x => ({ ...x, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} /></label>
                </div>
                <div className="adm-field"><span>Select for domains</span>
                    <div className="adm-row wrap">{domains.map(d => (
                        <label key={d.id} className="adm-chipcheck"><input type="checkbox" checked={f.domainIds.includes(d.id)} onChange={e => setF(x => ({ ...x, domainIds: e.target.checked ? [...x.domainIds, d.id] : x.domainIds.filter(i => i !== d.id) }))} />{d.title}</label>
                    ))}</div>
                </div>
                <label className="adm-field"><span>Reason (saved in the audit log)</span><input className="adm-input" value={f.note} onChange={e => setF(x => ({ ...x, note: e.target.value }))} placeholder="e.g. Core team recommendation" /></label>
                <p className="adm-hint">If they have no account yet, one is created; they set a password with "Forgot password".</p>
                <div className="adm-row end"><button type="button" className="adm-btn ghost" onClick={onClose}>Cancel</button><button className="adm-btn primary" disabled={!f.domainIds.length}>Add and select</button></div>
            </form>
        </Modal>
    )
}

/* ---------- import a manually made selection list ---------- */
const FIELDS = [['name', 'Name'], ['email', 'Email *'], ['regNo', 'Registration no.'], ['mobile', 'Mobile'], ['domain', 'Domain(s)'], ['status', 'Status']]
const parseStatus = v => (/not|reject|^no$|fail/i.test(v) ? 'not_selected' : /interview|shortlist/i.test(v) ? 'interview' : /select|^yes$|accept|pass/i.test(v) ? 'selected' : null)
const splitDomains = v => String(v || '').split(/[,;|\n]+/).map(x => x.trim()).filter(Boolean)

function ImportSelections({ domains, onClose, onDone }) {
    const toast = useToast()
    const [sheet, setSheet] = useState(null)
    const [map, setMap] = useState({})
    const [fixedDomains, setFixedDomains] = useState([])
    const [fixedStatus, setFixedStatus] = useState('selected')
    const [final, setFinal] = useState(false)
    const [busy, setBusy] = useState(null)
    const [result, setResult] = useState(null)

    const load = async file => {
        if (!file) return
        try { const sh = await readSheet(file); setSheet({ ...sh, file: file.name }); setMap(mapHeaders(sh.headers)); setResult(null) } catch (e) { toast(e.message, 'error') }
    }
    const rows = useMemo(() => (sheet?.rows || []).map((r, i) => ({
        line: i + 2, name: r[map.name] || '', email: r[map.email] || '', regNo: r[map.regNo] || '', mobile: r[map.mobile] || '',
        domains: map.domain ? splitDomains(r[map.domain]) : fixedDomains.map(id => domains.find(d => d.id === id)?.title),
        status: (map.status && parseStatus(r[map.status])) || fixedStatus,
    })).filter(r => r.email || r.name), [sheet, map, fixedDomains, fixedStatus, domains])

    const run = async () => {
        setBusy({ done: 0, total: rows.length })
        const sum = { people: 0, selections: 0, created: 0, skipped: [], unknownDomains: new Set(), listed: {} }
        try {
            for (let i = 0; i < rows.length; i += 250) {
                const r = await api.post('/admin/recruitment/import', { rows: rows.slice(i, i + 250), note: `Imported from ${sheet.file}` })
                sum.people += r.people; sum.selections += r.selections; sum.created += r.created; sum.skipped.push(...r.skipped)
                r.unknownDomains.forEach(d => sum.unknownDomains.add(d))
                for (const [d, list] of Object.entries(r.listed)) (sum.listed[d] ||= []).push(...list)
                setBusy({ done: Math.min(rows.length, i + 250), total: rows.length })
            }
            if (final && Object.keys(sum.listed).length) sum.changed = (await api.post('/admin/recruitment/import/finalize', { listed: sum.listed })).changed
            setResult({ ...sum, unknownDomains: [...sum.unknownDomains] })
            toast(`Imported ${sum.selections} selections — recorded in the audit log`)
            onDone()
        } catch (e) { toast(e.message, 'error') }
        setBusy(null)
    }
    const template = () => downloadXlsx('selection-list-template.xlsx', [{ name: 'Selections', rows: [['Name', 'Email', 'Reg no', 'Mobile', 'Domain', 'Status'], ['Aditi Sharma', 'aditi.sharma2024@vitstudent.ac.in', '24BCE0001', '9876543210', domains.slice(0, 2).map(d => d.title).join(', ') || 'Technical', 'Selected']] }])

    return (
        <Modal open onClose={onClose} title="Import selections from Excel" wide>
            <div className="adm-form">
                <p className="adm-hint">Use this when selections were made outside the portal (offline interviews, a shared sheet). One row per person; several domains in one cell are separated by commas. People without an account get one (they set a password with "Forgot password"). <button type="button" className="adm-link" onClick={template}>Download a template</button></p>
                <input type="file" accept=".xlsx,.csv" onChange={e => load(e.target.files[0])} />
                {sheet && <>
                    <div className="adm-grid-2">
                        {FIELDS.map(([k, l]) => (
                            <label key={k} className="adm-field"><span>{l}</span>
                                <select className="adm-input" value={map[k] || ''} onChange={e => setMap(m => ({ ...m, [k]: e.target.value || undefined }))}>
                                    <option value="">— not in sheet —</option>{sheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </label>
                        ))}
                    </div>
                    {!map.domain && (
                        <div className="adm-field"><span>No domain column — apply every row to</span>
                            <div className="adm-row wrap">{domains.map(d => <label key={d.id} className="adm-chipcheck"><input type="checkbox" checked={fixedDomains.includes(d.id)} onChange={e => setFixedDomains(x => (e.target.checked ? [...x, d.id] : x.filter(i => i !== d.id)))} />{d.title}</label>)}</div>
                        </div>
                    )}
                    {!map.status && (
                        <label className="adm-field" style={{ maxWidth: 260 }}><span>Status for every row</span>
                            <select className="adm-input" value={fixedStatus} onChange={e => setFixedStatus(e.target.value)}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                        </label>
                    )}
                    <Switch checked={final} onChange={setFinal} label="This sheet is the final list — everyone else in these domains becomes Not selected" />
                    <div className="adm-table-wrap">
                        <table className="adm-table">
                            <thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Reg no</th><th>Domains</th><th>Status</th></tr></thead>
                            <tbody>{rows.slice(0, 8).map(r => <tr key={r.line}><td>{r.line}</td><td>{r.name}</td><td>{r.email}</td><td>{r.regNo}</td><td>{r.domains.join(', ')}</td><td>{STATUS[r.status]}</td></tr>)}</tbody>
                        </table>
                    </div>
                    <p className="adm-hint">{rows.length} rows in {sheet.file}{rows.length > 8 ? ' — showing the first 8' : ''}.</p>
                </>}
                {busy && <div><div className="adm-progress"><span style={{ width: `${(busy.done / busy.total) * 100}%` }} /></div><small>Importing {busy.done} / {busy.total}</small></div>}
                {result && (
                    <div className="adm-panel">
                        <b>{result.selections} selections for {result.people} people</b> ({result.created} new accounts){result.changed !== undefined && <>, {result.changed} others marked Not selected</>}.
                        {result.unknownDomains.length > 0 && <p className="adm-err">Unknown domains (rows skipped): {result.unknownDomains.join(', ')}</p>}
                        {result.skipped.length > 0 && <p className="adm-hint">Skipped: {result.skipped.slice(0, 20).map(s => `row ${s.row} (${s.reason})`).join('; ')}{result.skipped.length > 20 ? '…' : ''}</p>}
                    </div>
                )}
                <div className="adm-row end">
                    <button type="button" className="adm-btn ghost" onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
                    {!result && <button type="button" className="adm-btn primary" disabled={!rows.length || !map.email || (!map.domain && !fixedDomains.length) || !!busy} onClick={run}>Import {rows.length} rows</button>}
                </div>
            </div>
        </Modal>
    )
}

/* ---------- emails ---------- */
function EmailsTab({ domains, apps }) {
    const toast = useToast()
    const navigate = useNavigate()
    const [tpl, setTpl] = useState(null)
    const [aud, setAud] = useState({ domainIds: [], statuses: [], pendingTestOnly: false })
    const [msg, setMsg] = useState({ subject: '', body: '' })
    const [opts, setOpts] = useState({ includeNotSelected: true, includeUndecided: false, onlyNew: true })
    useEffect(() => { api.get('/admin/settings').then(r => { setTpl(r.settings.recruitment_mail); setMsg({ subject: r.settings.recruitment_mail?.reminderSubject || '', body: r.settings.recruitment_mail?.reminderBody || '' }) }).catch(() => {}) }, [])

    const people = useMemo(() => {
        const m = new Map()
        for (const a of apps) { if (!m.has(a.user_id)) m.set(a.user_id, []); m.get(a.user_id).push(a) }
        return [...m.values()]
    }, [apps])
    const pending = people.filter(p => !opts.onlyNew || p.some(a => !a.result_mailed_at))
    const nSelected = pending.filter(p => p.some(a => a.status === 'selected')).length
    const nNot = opts.includeNotSelected ? pending.filter(p => !p.some(a => a.status === 'selected') && (opts.includeUndecided || p.every(a => a.status === 'not_selected'))).length : 0
    const nWaiting = pending.filter(p => !p.some(a => a.status === 'selected') && !p.every(a => a.status === 'not_selected')).length
    const audience = people.filter(p => p.some(a => (!aud.domainIds.length || aud.domainIds.includes(a.domain_id)) && (!aud.statuses.length || aud.statuses.includes(a.status)) && (!aud.pendingTestOnly || !a.test_submitted_at))).length
    const missingLinks = domains.filter(d => !d.whatsapp_link && apps.some(a => a.domain_id === d.id && a.status === 'selected'))

    const send = async body => {
        try { const r = await api.post('/admin/recruitment/email', body); toast(queuedText(r.queued)); navigate('/admin/outbox') } catch (e) { toast(e.message, 'error') }
    }
    const toggle = (key, v) => setAud(a => ({ ...a, [key]: a[key].includes(v) ? a[key].filter(x => x !== v) : [...a[key], v] }))

    return (
        <div className="adm-grid-2 top">
            <section className="adm-panel">
                <h3>Result emails</h3>
                <p className="adm-hint">Selected candidates get one email listing every domain they were selected for, with each domain's WhatsApp group link. Everyone else gets a kind "thank you" message. Edit the wording in <Link to="/admin/s/recruitment_mail">Recruitment Emails</Link>.</p>
                {missingLinks.length > 0 && <p className="adm-hint warn">Add WhatsApp links for: {missingLinks.map(d => d.title).join(', ')} (Domains & tests).</p>}
                <Switch checked={opts.includeNotSelected} onChange={v => setOpts(o => ({ ...o, includeNotSelected: v }))} label="Also email candidates who were not selected" />
                {opts.includeNotSelected && <Switch checked={opts.includeUndecided} onChange={v => setOpts(o => ({ ...o, includeUndecided: v }))} label={`Also treat ${nWaiting} undecided applicant${nWaiting === 1 ? '' : 's'} (Applied / Test submitted / Interview) as not selected`} />}
                <Switch checked={opts.onlyNew} onChange={v => setOpts(o => ({ ...o, onlyNew: v }))} label="Skip people who were already emailed their result" />
                <p><b>{nSelected}</b> selected · <b>{nNot}</b> not selected will be emailed.</p>
                <button className="adm-btn primary" disabled={!nSelected && !nNot} onClick={() => send({ kind: 'results', ...opts })}><Icon name="send" size={16} /> Queue result emails</button>
            </section>
            <section className="adm-panel">
                <h3>Reminders & messages</h3>
                <div className="adm-field"><span>Domains (none = all)</span>
                    <div className="adm-row wrap">{domains.map(d => <label key={d.id} className="adm-chipcheck"><input type="checkbox" checked={aud.domainIds.includes(d.id)} onChange={() => toggle('domainIds', d.id)} />{d.title}</label>)}</div>
                </div>
                <div className="adm-field"><span>Status (none = everyone)</span>
                    <div className="adm-row wrap">{Object.entries(STATUS).map(([k, l]) => <label key={k} className="adm-chipcheck"><input type="checkbox" checked={aud.statuses.includes(k)} onChange={() => toggle('statuses', k)} />{l}</label>)}</div>
                </div>
                <Switch checked={aud.pendingTestOnly} onChange={v => setAud(a => ({ ...a, pendingTestOnly: v }))} label="Only people who have not submitted the test" />
                <label className="adm-field"><span>Subject</span><input className="adm-input" value={msg.subject} onChange={e => setMsg(m => ({ ...m, subject: e.target.value }))} /></label>
                <label className="adm-field"><span>Message</span><textarea className="adm-input" rows={8} value={msg.body} onChange={e => setMsg(m => ({ ...m, body: e.target.value }))} /></label>
                <p className="adm-hint">Placeholders: {'{{name}} {{domain}} {{deadline}} {{exam}}'}. Goes to <b>{audience}</b> people.</p>
                <div className="adm-row">
                    <button className="adm-btn" onClick={() => setMsg({ subject: tpl?.reminderSubject || '', body: tpl?.reminderBody || '' })}>Use reminder draft</button>
                    <button className="adm-btn primary" disabled={!audience} onClick={() => send({ kind: 'custom', ...aud, subject: msg.subject, body: msg.body })}><Icon name="send" size={16} /> Queue email</button>
                </div>
            </section>
        </div>
    )
}

function SettingsTab({ onReset }) {
    const toast = useToast()
    const confirm = useConfirm()
    const { isAdmin } = useAuth()
    const { refresh } = useSite()
    const [s, setS] = useState(null)
    useEffect(() => { api.get('/admin/settings').then(r => setS(r.settings.recruitment)).catch(e => toast(e.message, 'error')) }, [toast])
    const save = async next => {
        setS(next)
        try { await api.put('/admin/settings/recruitment', { value: next }); toast(next.open ? 'Saved — the Recruitments button is visible on the site' : 'Saved'); refresh(true) } catch (e) { toast(e.message, 'error') }
    }
    const reset = async () => {
        const typed = window.prompt('This deletes every application (export the Excel file first). Type DELETE to confirm.')
        if (typed !== 'DELETE' || !await confirm('Delete all recruitment applications now?')) return
        try { await api('/admin/recruitment/applications', { method: 'DELETE', body: { confirm: 'DELETE' } }); toast('All applications cleared'); onReset() } catch (e) { toast(e.message, 'error') }
    }
    if (!s) return <Spinner />
    return (
        <div className="adm-grid-2 top">
            <section className="adm-panel adm-form">
                <h3>Portal</h3>
                <Switch checked={s.open} onChange={v => save({ ...s, open: v })} label={s.open ? 'Open — the Recruitments button shows next to Login / Sign up' : 'Hidden from the website (only admins can preview /recruitment)'} />
                <Switch checked={s.resultsPublished} onChange={v => save({ ...s, resultsPublished: v })} label="Show final results (Selected / Not selected) in candidates' portal" />
                <label className="adm-field"><span>Title</span><input className="adm-input" value={s.title} onChange={e => setS({ ...s, title: e.target.value })} onBlur={() => save(s)} /></label>
                <label className="adm-field"><span>Introduction</span><textarea className="adm-input" rows={4} value={s.intro} onChange={e => setS({ ...s, intro: e.target.value })} onBlur={() => save(s)} /></label>
                <a className="adm-btn" href="/recruitment" target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>Open the portal <Icon name="external" size={14} /></a>
            </section>
            {isAdmin && (
                <section className="adm-panel adm-form">
                    <h3>New season</h3>
                    <p className="adm-hint">After results are out and the master data is downloaded, clear every application so the next recruitment starts fresh. Domains and questions are kept.</p>
                    <button className="adm-btn danger" style={{ alignSelf: 'flex-start' }} onClick={reset}>Clear all applications</button>
                </section>
            )}
        </div>
    )
}

export default function RecruitmentAdmin() {
    const toast = useToast()
    const confirm = useConfirm()
    const { isAdmin } = useAuth()
    const [tab, setTab] = useState('applicants')
    const [domains, setDomains] = useState(null)
    const [apps, setApps] = useState([])
    const [editing, setEditing] = useState(null)
    const [viewing, setViewing] = useState(null)
    const [direct, setDirect] = useState(false)
    const [importing, setImporting] = useState(false)
    const [f, setF] = useState({ domain: '', status: '', min: '', q: '', sort: 'score' })
    const [sel, setSel] = useState([])
    const [topN, setTopN] = useState('')

    const load = useCallback(async () => {
        try {
            const [r, a] = await Promise.all([api.get('/admin/recruitment'), api.get('/admin/recruitment/applications')])
            setDomains(r.domains); setApps(a.items)
        } catch (e) { toast(e.message, 'error') }
    }, [toast])
    useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect -- async fetch on mount

    const title = useMemo(() => Object.fromEntries((domains || []).map(d => [d.id, d.title])), [domains])
    const rows = useMemo(() => {
        const q = f.q.toLowerCase()
        const list = apps.filter(a => (!f.domain || a.domain_id === Number(f.domain)) && (!f.status || a.status === f.status) && (f.min === '' || (a.score ?? -1) >= Number(f.min))
            && (!q || `${a.name} ${a.email} ${a.reg_no}`.toLowerCase().includes(q)))
        const by = { score: (x, y) => (y.score ?? -1) - (x.score ?? -1), newest: (x, y) => y.id - x.id, name: (x, y) => x.name.localeCompare(y.name) }[f.sort]
        return list.sort(by)
    }, [apps, f])

    const bulk = async status => {
        if (!sel.length) return
        if (status === 'not_selected' && !await confirm(`Mark ${sel.length} application(s) as not selected?`, { danger: false, okLabel: 'Mark' })) return
        try { await api.patch('/admin/recruitment/applications', { ids: sel, status }); toast(`${sel.length} updated`); setSel([]); load() } catch (e) { toast(e.message, 'error') }
    }

    const exportMaster = () => {
        const people = new Map()
        for (const a of apps) {
            if (!people.has(a.user_id)) people.set(a.user_id, { a, list: [] })
            people.get(a.user_id).list.push(a)
        }
        const master = [['Name', 'Email', 'Reg no', 'Mobile', 'Domains applied', 'Selected for', 'Overall status', 'Best score', 'Result emailed']]
        for (const { a, list } of people.values()) {
            const selected = list.filter(x => x.status === 'selected').map(x => title[x.domain_id])
            const overall = selected.length ? 'Selected' : list.some(x => x.status === 'interview') ? 'Interview' : list.every(x => x.status === 'not_selected') ? 'Not selected' : 'In progress'
            master.push([a.name, a.email, a.reg_no || '', a.mobile || '', list.map(x => title[x.domain_id]).join(', '), selected.join(', '), overall,
                Math.max(...list.map(x => x.score ?? 0)), list.some(x => x.result_mailed_at) ? 'Yes' : 'No'])
        }
        const detail = [['Name', 'Email', 'Reg no', 'Mobile', 'Domain', 'Status', 'Source', 'Auto score', 'Manual score', 'Total', 'Max', 'Tab switches', 'Applied', 'Test submitted', 'Note']]
        for (const a of apps) detail.push([a.name, a.email, a.reg_no || '', a.mobile || '', title[a.domain_id], STATUS[a.status], a.source, a.auto_score ?? '', a.manual_score ?? '', a.score ?? '', a.max_score ?? '', a.tab_switches, fmtIst(a.created_at), fmtIst(a.test_submitted_at), a.note || ''])
        const perDomain = (domains || []).map(d => ({ name: d.title, rows: [['Name', 'Email', 'Reg no', 'Mobile', 'Status', 'Score'], ...apps.filter(a => a.domain_id === d.id).map(a => [a.name, a.email, a.reg_no || '', a.mobile || '', STATUS[a.status], a.score ?? ''])] }))
        downloadXlsx(`recruitment-master-${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: 'Master', rows: master }, { name: 'Applications', rows: detail }, ...perDomain])
    }

    if (!domains) return <Spinner />
    const count = (id, st) => apps.filter(a => a.domain_id === id && (!st || a.status === st)).length

    return (
        <>
            <PageTitle title="Recruitment" subtitle="Domains, tests, applicants, interviews and selections. A candidate can apply to and be selected for several domains.">
                <button className="adm-btn" onClick={exportMaster} disabled={!apps.length}><Icon name="box" size={16} /> Master data (Excel)</button>
                {isAdmin && <button className="adm-btn" onClick={() => setImporting(true)}><Icon name="upload" size={16} /> Import Excel</button>}
                {isAdmin && <button className="adm-btn" onClick={() => setDirect(true)}><Icon name="plus" size={16} /> Add directly</button>}
                {tab === 'domains' && <button className="adm-btn primary" onClick={() => setEditing(blankDomain())}><Icon name="plus" size={16} /> New domain</button>}
            </PageTitle>
            <div className="adm-tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'applicants' ? ` (${apps.length})` : ''}</button>)}</div>

            {tab === 'applicants' && (
                <>
                    <div className="adm-filters">
                        <select className="adm-input" value={f.domain} onChange={e => setF(x => ({ ...x, domain: e.target.value }))}><option value="">All domains</option>{domains.map(d => <option key={d.id} value={d.id}>{d.title} ({count(d.id)})</option>)}</select>
                        <select className="adm-input" value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))}><option value="">All statuses</option>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                        <input className="adm-input" type="number" placeholder="Min score" value={f.min} onChange={e => setF(x => ({ ...x, min: e.target.value }))} />
                        <select className="adm-input" value={f.sort} onChange={e => setF(x => ({ ...x, sort: e.target.value }))}><option value="score">Highest score</option><option value="newest">Newest</option><option value="name">Name</option></select>
                        <input className="adm-input search" placeholder="Name, email or reg no" value={f.q} onChange={e => setF(x => ({ ...x, q: e.target.value }))} />
                    </div>
                    <div className="adm-bulkbar">
                        <span>{sel.length ? `${sel.length} selected` : `${rows.length} shown`}</span>
                        <input className="adm-input" type="number" min="1" placeholder="Top N" value={topN} onChange={e => setTopN(e.target.value)} style={{ maxWidth: 90 }} />
                        <button className="adm-btn small" disabled={!topN} onClick={() => setSel(rows.slice(0, Number(topN)).map(a => a.id))}>Pick top {topN || 'N'}</button>
                        <span className="adm-topbar-spacer" />
                        <button className="adm-btn small" disabled={!sel.length} onClick={() => bulk('interview')}>Mark for interview</button>
                        <button className="adm-btn small primary" disabled={!sel.length} onClick={() => bulk('selected')}>Select</button>
                        <button className="adm-btn small" disabled={!sel.length} onClick={() => bulk('not_selected')}>Not selected</button>
                        <button className="adm-btn small ghost" disabled={!sel.length} onClick={() => bulk('applied')}>Reset</button>
                    </div>
                    {rows.length === 0 ? <Empty icon="users">No applications match.</Empty> : (
                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead><tr>
                                    <th><input type="checkbox" checked={sel.length > 0 && sel.length === rows.length} onChange={e => setSel(e.target.checked ? rows.map(a => a.id) : [])} aria-label="Select all" /></th>
                                    <th>Candidate</th><th>Reg no</th><th>Domain</th><th>Status</th><th>Score</th><th>Flags</th><th>Applied</th>
                                </tr></thead>
                                <tbody>
                                    {rows.slice(0, 1000).map(a => (
                                        <tr key={a.id} className={sel.includes(a.id) ? 'sel' : ''}>
                                            <td><input type="checkbox" checked={sel.includes(a.id)} onChange={e => setSel(s => (e.target.checked ? [...s, a.id] : s.filter(x => x !== a.id)))} aria-label={`Select ${a.name}`} /></td>
                                            <td><button className="adm-link" onClick={() => setViewing(a.id)}><strong>{a.name}</strong></button><small className="adm-block">{a.email} · {a.mobile || 'no mobile'}</small></td>
                                            <td>{a.reg_no || '—'}</td>
                                            <td>{title[a.domain_id]}</td>
                                            <td><Badge tone={TONE[a.status]}>{STATUS[a.status]}</Badge>{a.source !== 'portal' && <small className="adm-block">{a.source === 'import' ? 'imported from Excel' : 'added directly'}</small>}</td>
                                            <td>{scoreText(a)}</td>
                                            <td>{a.tab_switches > 0 && <Badge tone="warn">{a.tab_switches} tab switch{a.tab_switches > 1 ? 'es' : ''}</Badge>}</td>
                                            <td><small>{fmtLocal(a.created_at.includes('T') ? a.created_at : a.created_at.replace(' ', 'T') + 'Z')}</small></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {rows.length > 1000 && <p className="adm-hint" style={{ padding: 12 }}>Showing the first 1,000 — narrow the filters or use the Excel export for everything.</p>}
                        </div>
                    )}
                </>
            )}

            {tab === 'domains' && (domains.length === 0 ? <Empty icon="grid">No domains yet. Create one to open applications.</Empty> : (
                <div className="adm-cards">
                    {domains.map(d => (
                        <div key={d.id} className="adm-card" onClick={() => setEditing(d)}>
                            <div className="adm-card-body">
                                <div className="adm-row between"><strong>{d.title}</strong><Badge tone={d.open ? 'ok' : 'neutral'}>{d.open ? 'Open' : 'Closed'}</Badge></div>
                                <small>{d.apply_deadline ? `Apply by ${fmtLocal(d.apply_deadline)}` : 'No deadline'}</small>
                                <small>{d.test_enabled ? `Test: ${d.questions.length} questions · ${d.test_minutes} min` : 'No test'}{d.exam_link ? ' · proctored exam link set' : ''}</small>
                                <small>{count(d.id)} applied · {count(d.id, 'interview')} interview · {count(d.id, 'selected')} selected</small>
                                {!d.whatsapp_link && <small className="adm-err">No WhatsApp link yet</small>}
                                {isAdmin && <button className="adm-btn small ghost danger-text" style={{ alignSelf: 'flex-start' }} onClick={async e => {
                                    e.stopPropagation()
                                    if (!await confirm(`Delete ${d.title} and its ${count(d.id)} applications?`)) return
                                    try { await api.del(`/admin/recruitment/domains/${d.id}`); toast('Domain deleted'); load() } catch (err) { toast(err.message, 'error') }
                                }}><Icon name="trash" size={14} /> Delete</button>}
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            {tab === 'emails' && <EmailsTab domains={domains} apps={apps} />}
            {tab === 'settings' && <SettingsTab onReset={load} />}

            {editing && <DomainDrawer domain={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
            {viewing && <ApplicantDrawer id={viewing} onClose={() => setViewing(null)} onChanged={load} />}
            {importing && <ImportSelections domains={domains} onClose={() => setImporting(false)} onDone={load} />}
            {direct && <DirectAdd domains={domains} onClose={() => setDirect(false)} onDone={() => { setDirect(false); load() }} />}
        </>
    )
}
