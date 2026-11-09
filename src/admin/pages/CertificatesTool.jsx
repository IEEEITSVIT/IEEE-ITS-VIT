import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { readSheet, mapHeaders, normKey } from '../../lib/sheet'
import { saveBlob } from '../../lib/xlsx'
import { PageTitle, Spinner, Empty, useToast, useConfirm } from '../ui'
import { CertDesigner } from '../CertDesigner'
import Icon from '../icons'

const today = () => new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })
const blankDesign = () => ({ id: `d${Date.now().toString(36)}`, name: 'New design', template: { image: '', fields: [
    { key: 'custom', text: 'Certificate of Participation', x: 50, y: 28, size: 32, color: '#111111', align: 'center', bold: true },
    { key: 'name', x: 50, y: 50, size: 36, color: '#111111', align: 'center', bold: true },
    { key: 'custom', text: 'for taking part in {{event}}', x: 50, y: 60, size: 16, color: '#333333', align: 'center', bold: false },
] } })
const sentKey = (designId, file, n) => `ieee_its_cert_sent_${designId}_${file}_${n}`
const readSent = key => { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) } catch { return new Set() } }

/**
 * Certificates for anything — including events run outside the portal: pick or design a template,
 * upload the recipients as Excel/CSV, then download them all or email each person theirs.
 */
export default function CertificatesTool() {
    const toast = useToast()
    const confirm = useConfirm()
    const [designs, setDesigns] = useState(null)
    const [savedJson, setSavedJson] = useState('')
    const [activeId, setActiveId] = useState(null)
    const [sheet, setSheet] = useState(null)
    const [map, setMap] = useState({})
    const [event, setEvent] = useState('')
    const [mail, setMail] = useState({ subject: 'Your certificate — {{event}}', body: 'Hi {{name}},\n\nThank you for being part of {{event}}. Your certificate is attached.\n\nIEEE ITS VIT' })
    const [job, setJob] = useState(null)
    const [sent, setSent] = useState(new Set())
    const stop = useRef(false)

    useEffect(() => {
        api.get('/admin/cert-templates').then(r => { setDesigns(r.items); setSavedJson(JSON.stringify(r.items)); setActiveId(r.items[0]?.id || null) }).catch(e => toast(e.message, 'error'))
    }, [toast])

    const design = designs?.find(d => d.id === activeId)
    const setDesign = patch => setDesigns(list => list.map(d => (d.id === activeId ? { ...d, ...patch } : d)))
    const dirty = designs && JSON.stringify(designs) !== savedJson
    const saveDesigns = async (list = designs) => {
        try { const r = await api.put('/admin/cert-templates', { items: list }); setDesigns(r.items); setSavedJson(JSON.stringify(r.items)); toast('Designs saved') } catch (e) { toast(e.message, 'error') }
    }
    const removeDesign = async () => {
        if (!await confirm(`Delete the design "${design.name}"? Its template image is removed from ImageKit if nothing else uses it.`)) return
        const list = designs.filter(d => d.id !== activeId)
        setActiveId(list[0]?.id || null)
        await saveDesigns(list)
    }

    const load = async file => {
        if (!file) return
        try {
            const sh = await readSheet(file)
            setSheet({ ...sh, file: file.name }); setMap(mapHeaders(sh.headers))
        } catch (e) { toast(e.message, 'error') }
    }
    const people = useMemo(() => (sheet?.rows || []).map((r, i) => {
        const extra = Object.fromEntries(Object.entries(r).map(([h, v]) => [normKey(h), v]))
        return { line: i + 2, email: (r[map.email] || '').trim(), data: { ...extra, name: r[map.name] || '', team: r[map.team] || '', rank: r[map.rank] || '', regNo: r[map.regNo] || '', event: r[map.event] || event, date: today() } }
    }).filter(p => p.data.name), [sheet, map, event])
    const key = design && sheet ? sentKey(design.id, sheet.file, people.length) : ''
    useEffect(() => { setSent(key ? readSent(key) : new Set()) }, [key])
    const sample = people[0]?.data || { name: 'Aditi Sharma', team: 'Team Nova', event: event || 'Event name', rank: '1', regNo: '24BCE0001', date: today() }
    const lib = () => import('../../lib/certificate')
    const items = !design ? [] : people.map(p => ({ ...p, template: design.template, filename: `${p.data.name}-${p.line}.pdf`.replace(/[^\w.-]+/g, '-') }))

    const preview = async () => {
        try { const { certificatePdf } = await lib(); window.open(URL.createObjectURL(new Blob([await certificatePdf(design.template, sample)], { type: 'application/pdf' }))) } catch (e) { toast(e.message, 'error') }
    }
    const zip = async () => {
        const { zipOfPdfs, safeFile } = await lib()
        const PART = 200
        try {
            for (let p = 0; p * PART < items.length; p++) {
                const part = items.slice(p * PART, p * PART + PART)
                setJob({ label: `Building ZIP ${p + 1} of ${Math.ceil(items.length / PART)}`, done: 0, total: part.length })
                saveBlob(await zipOfPdfs(part, done => setJob(j => ({ ...j, done }))), `${safeFile(event || design.name)}-certificates${items.length > PART ? `-part${p + 1}` : ''}.zip`)
            }
        } catch (e) { toast(e.message, 'error') }
        setJob(null)
    }
    const combined = async () => {
        const { combinedPdf, safeFile } = await lib()
        try {
            setJob({ label: 'Building one PDF', done: 0, total: items.length })
            saveBlob(new Blob([await combinedPdf(items, done => setJob(j => ({ ...j, done })))], { type: 'application/pdf' }), `${safeFile(event || design.name)}-all-certificates.pdf`)
        } catch (e) { toast(e.message, 'error') }
        setJob(null)
    }
    const email = async () => {
        const todo = items.filter(it => it.email && !sent.has(it.email.toLowerCase()))
        if (!todo.length) return toast(map.email ? 'Everyone on this list has been emailed.' : 'Choose the email column first.', 'error')
        const { certificatePdf, toBase64 } = await lib()
        const fill = (t, d) => String(t).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => d[k] ?? d[normKey(k)] ?? '')
        stop.current = false
        setJob({ label: 'Emailing certificates', done: 0, total: todo.length })
        const done = new Set(sent)
        let n = 0
        for (const it of todo) {
            if (stop.current) break
            try {
                const pdf = toBase64(await certificatePdf(it.template, it.data))
                await api.post('/admin/certificates/send', { to: it.email, subject: fill(mail.subject, it.data), text: fill(mail.body, it.data), pdf, filename: `${it.data.event || 'certificate'} ${it.data.name}` })
                done.add(it.email.toLowerCase()); n++
                try { localStorage.setItem(key, JSON.stringify([...done])) } catch { /* storage full */ }
                setSent(new Set(done)); setJob(j => ({ ...j, done: n }))
            } catch (e) {
                toast(e.status === 429 ? `${e.message} ${n} sent — open this page tomorrow with the same file to continue.` : `${it.email}: ${e.message}`, 'error')
                if (e.status === 429 || e.status === 503) break
            }
        }
        setJob(null)
        if (n) toast(`${n} certificates emailed`)
    }

    if (!designs) return <Spinner />

    return (
        <>
            <PageTitle title="Certificates" subtitle="Design a certificate, upload the list of people (Excel or CSV), then download every certificate or email each person theirs. Works for events run outside the portal too. Nothing is stored on the server.">
                <button className="adm-btn" onClick={() => { const d = blankDesign(); setDesigns(l => [...l, d]); setActiveId(d.id) }}><Icon name="plus" size={16} /> New design</button>
                <button className="adm-btn primary" disabled={!dirty} onClick={() => saveDesigns()}>{dirty ? 'Save designs' : 'Saved'}</button>
            </PageTitle>
            {designs.length > 0 && (
                <div className="adm-tabs">{designs.map(d => <button key={d.id} className={d.id === activeId ? 'on' : ''} onClick={() => setActiveId(d.id)}>{d.name}</button>)}</div>
            )}
            {!design ? <Empty icon="scroll">Create a design to start.</Empty> : (
                <div className="adm-grid-2 top">
                    <section className="adm-panel adm-form">
                        <div className="adm-row">
                            <input className="adm-input" value={design.name} onChange={e => setDesign({ name: e.target.value })} aria-label="Design name" />
                            <button className="adm-btn small ghost danger-text" onClick={removeDesign}><Icon name="trash" size={14} /></button>
                        </div>
                        <CertDesigner key={design.id} tpl={design.template} onChange={template => setDesign({ template })} sample={sample} />
                        <button className="adm-btn" disabled={!design.template.image} onClick={preview} style={{ alignSelf: 'flex-start' }}>Preview PDF</button>
                    </section>
                    <section className="adm-panel adm-form">
                        <h3>Recipients</h3>
                        <input type="file" accept=".xlsx,.csv" onChange={e => load(e.target.files[0])} />
                        <p className="adm-hint">Columns such as Name, Email, Team, Rank and Reg no are detected automatically. Any other column can be used in the certificate or email text as a placeholder, e.g. a "College" column becomes {'{{college}}'}.</p>
                        <label className="adm-field"><span>Event name (for {'{{event}}'} when the sheet has no Event column)</span><input className="adm-input" value={event} onChange={e => setEvent(e.target.value)} placeholder="e.g. Quantum Computing Workshop 2026" /></label>
                        {sheet && <>
                            <div className="adm-grid-2">
                                {[['name', 'Name column *'], ['email', 'Email column'], ['team', 'Team column'], ['rank', 'Rank column'], ['regNo', 'Reg no column'], ['event', 'Event column']].map(([k, l]) => (
                                    <label key={k} className="adm-field"><span>{l}</span>
                                        <select className="adm-input" value={map[k] || ''} onChange={e => setMap(m => ({ ...m, [k]: e.target.value || undefined }))}>
                                            <option value="">— none —</option>{sheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </label>
                                ))}
                            </div>
                            <p><b>{people.length}</b> people in {sheet.file} · <b>{people.filter(p => p.email).length}</b> with an email · <b>{sent.size}</b> already emailed from this list.</p>
                        </>}
                        <h3>Email</h3>
                        <label className="adm-field"><span>Subject</span><input className="adm-input" value={mail.subject} onChange={e => setMail(m => ({ ...m, subject: e.target.value }))} /></label>
                        <label className="adm-field"><span>Message</span><textarea className="adm-input" rows={5} value={mail.body} onChange={e => setMail(m => ({ ...m, body: e.target.value }))} /></label>
                        <div className="adm-row wrap">
                            <button className="adm-btn" disabled={!people.length || !design.template.image || !!job} onClick={zip}>Download ZIP</button>
                            <button className="adm-btn" disabled={!people.length || !design.template.image || !!job} onClick={combined}>Download one PDF</button>
                            <button className="adm-btn primary" disabled={!people.length || !design.template.image || !map.email || !!job} onClick={email}><Icon name="send" size={16} /> Email certificates</button>
                        </div>
                        {job && (
                            <div>
                                <div className="adm-progress"><span style={{ width: `${(job.done / job.total) * 100}%` }} /></div>
                                <small>{job.label}: {job.done} / {job.total}</small>
                                {job.label.startsWith('Emailing') && <button className="adm-btn small" onClick={() => { stop.current = true }} style={{ marginLeft: 10 }}>Stop</button>}
                            </div>
                        )}
                        <p className="adm-hint">Emails count towards the daily limit shown in the Email Outbox; if it runs out, come back the next day with the same file and press Email again — people already emailed are skipped.</p>
                    </section>
                </div>
            )}
        </>
    )
}
