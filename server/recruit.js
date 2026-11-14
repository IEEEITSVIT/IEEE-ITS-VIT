/**
 * Recruitment portal: domains with deadlines and optional timed tests, applications,
 * scoring, interview shortlist, selection (also directly by an admin) and result emails.
 * Only @vitstudent.ac.in accounts with a registration number and mobile number can apply.
 */
import { getDb, parseJson, lit, execBatches } from './db.js'
import { fail, str, isEmail, safeUrl } from './http.js'
import { createCampaign } from './campaigns.js'

const STATUSES = ['applied', 'test_submitted', 'interview', 'selected', 'not_selected']
const isPast = iso => !!iso && Date.parse(iso) < Date.now()
const isoOrNull = v => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null)
const isVit = email => /@vitstudent\.ac\.in$/i.test(email || '')
const profileComplete = u => !!u && /^\d{10}$/.test(u.mobile || '') && (u.reg_no || '').length >= 6
const chunks = (arr, n = 90) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

function cleanQuestions(input) {
    return (Array.isArray(input) ? input : []).slice(0, 100).map((q, i) => {
        const kind = q.kind === 'text' ? 'text' : 'mcq'
        const options = kind === 'mcq' ? (Array.isArray(q.options) ? q.options : []).map(o => str(o, 300)).filter(Boolean).slice(0, 8) : []
        return {
            id: str(q.id, 40) || `q${Date.now().toString(36)}${i}`, kind, prompt: str(q.prompt, 2000),
            options, answer: kind === 'mcq' ? Math.min(Math.max(0, Number(q.answer) || 0), Math.max(0, options.length - 1)) : null,
            points: Math.max(0, Math.min(100, Number(q.points) || 1)),
        }
    }).filter(q => q.prompt && (q.kind === 'text' || q.options.length >= 2))
}

const domainRow = d => d && ({ ...d, open: !!d.open, test_enabled: !!d.test_enabled, questions: parseJson(d.questions, []) })

function publicDomain(d) {
    const qs = d.questions
    return {
        id: d.id, title: d.title, description: d.description, accepting: d.open && !isPast(d.apply_deadline), apply_deadline: d.apply_deadline,
        test: d.test_enabled && qs.length ? { minutes: d.test_minutes, deadline: d.test_deadline, questions: qs.length } : null,
        exam: d.exam_link ? { deadline: d.exam_deadline } : null,
    }
}

const scoreOf = a => (a.auto_score ?? 0) + (a.manual_score ?? 0)

export function installRecruitment({ route, requireRole, audit, loadSettings }) {
    const db = () => getDb()
    const settings = async () => (await loadSettings(['recruitment'])).recruitment
    const loadDomain = async id => domainRow(await db().first('SELECT * FROM rec_domains WHERE id = ?', [Number(id)]))

    /* ── candidate side ── */
    route('GET', '/api/recruitment', async ({ user }) => {
        const s = await settings()
        const staff = user && user.role !== 'member'
        if (!s.open && !staff) return { open: false, title: s.title }
        const domains = (await db().all('SELECT * FROM rec_domains ORDER BY sort_order, id')).map(domainRow)
        let me = null
        if (user) {
            const apps = await db().all('SELECT * FROM rec_applications WHERE user_id = ?', [user.id])
            me = {
                eligible: isVit(user.email), profileComplete: profileComplete(user),
                applications: apps.map(a => {
                    const d = domains.find(x => x.id === a.domain_id)
                    const decided = ['selected', 'not_selected'].includes(a.status)
                    return {
                        domainId: a.domain_id, appliedAt: a.created_at, testSubmittedAt: a.test_submitted_at, testStartedAt: a.test_started_at,
                        status: decided && !s.resultsPublished ? 'under_review' : a.status,
                        examLink: d?.exam_link && !isPast(d.exam_deadline) ? d.exam_link : '',
                    }
                }),
            }
        }
        return { open: !!s.open, preview: !s.open && staff, title: s.title, intro: s.intro, resultsPublished: !!s.resultsPublished, domains: domains.map(publicDomain), me }
    })

    const assertCandidate = async user => {
        requireRole(user, 'member')
        const s = await settings()
        if (!s.open) fail(403, 'Recruitments are closed right now.')
        if (!isVit(user.email)) fail(403, 'Only @vitstudent.ac.in accounts can join the chapter. Please sign in with your VIT student email.')
        if (!profileComplete(user)) fail(400, 'Add your registration number and 10-digit mobile number to your profile first.')
    }

    route('POST', '/api/recruitment/apply', async ({ user, body }) => {
        await assertCandidate(user)
        const ids = [...new Set((Array.isArray(body.domainIds) ? body.domainIds : []).map(Number).filter(Boolean))].slice(0, 20)
        if (!ids.length) fail(400, 'Choose at least one domain.')
        for (const id of ids) {
            const d = await loadDomain(id)
            if (!d) fail(404, 'Domain not found.')
            if (!d.open || isPast(d.apply_deadline)) fail(400, `Applications for ${d.title} are closed.`)
            await db().run('INSERT OR IGNORE INTO rec_applications (user_id, domain_id) VALUES (?, ?)', [user.id, id])
        }
        return { ok: true }
    })

    route('DELETE', '/api/recruitment/apply/:domainId', async ({ user, params }) => {
        await assertCandidate(user)
        const d = await loadDomain(params.domainId)
        if (!d || isPast(d.apply_deadline)) fail(400, 'This application can no longer be withdrawn.')
        const r = await db().run("DELETE FROM rec_applications WHERE user_id = ? AND domain_id = ? AND status = 'applied' AND test_started_at IS NULL", [user.id, d.id])
        if (!r.changes) fail(400, 'Only applications without a started test can be withdrawn.')
        return { ok: true }
    })

    /* timed test: questions are sent without answers; the clock runs from the first start */
    const testContext = async (user, domainId) => {
        await assertCandidate(user)
        const d = await loadDomain(domainId)
        if (!d || !d.test_enabled || !d.questions.length) fail(404, 'This domain has no test.')
        const app = await db().first('SELECT * FROM rec_applications WHERE user_id = ? AND domain_id = ?', [user.id, d.id])
        if (!app) fail(403, 'Apply to this domain first.')
        if (app.test_submitted_at) fail(400, 'You have already submitted this test.')
        const limitMs = d.test_minutes * 60_000
        const remaining = app.test_started_at ? Math.max(0, Date.parse(app.test_started_at) + limitMs - Date.now()) : limitMs
        return { d, app, remaining }
    }

    route('POST', '/api/recruitment/test/:domainId/start', async ({ user, params }) => {
        const { d, app, remaining } = await testContext(user, params.domainId)
        if (!app.test_started_at) {
            if (isPast(d.test_deadline)) fail(400, 'The deadline for this test has passed.')
            await db().run("UPDATE rec_applications SET test_started_at = ?, updated_at = datetime('now') WHERE id = ?", [new Date().toISOString(), app.id])
        }
        return {
            title: d.title, minutes: d.test_minutes, remainingMs: remaining, answers: parseJson(app.answers, {}), tabSwitches: app.tab_switches,
            questions: d.questions.map(({ answer, ...q }) => q), // eslint-disable-line no-unused-vars
        }
    })

    route('POST', '/api/recruitment/test/:domainId/save', async ({ user, params, body }) => {
        const { app, remaining } = await testContext(user, params.domainId)
        if (remaining <= 0) return { ok: false, expired: true }
        await db().run("UPDATE rec_applications SET answers = ?, tab_switches = MAX(tab_switches, ?), updated_at = datetime('now') WHERE id = ?",
            [JSON.stringify(body.answers || {}).slice(0, 100_000), Math.max(0, Number(body.tabSwitches) || 0), app.id])
        return { ok: true }
    })

    route('POST', '/api/recruitment/test/:domainId/submit', async ({ user, params, body }) => {
        const { d, app, remaining } = await testContext(user, params.domainId)
        if (!app.test_started_at) fail(400, 'Start the test first.')
        // 90 s grace for slow connections; after that the last autosaved answers are what counts.
        const late = remaining <= 0 && Date.parse(app.test_started_at) + d.test_minutes * 60_000 + 90_000 < Date.now()
        const answers = late ? parseJson(app.answers, {}) : (body.answers && typeof body.answers === 'object' ? body.answers : {})
        let auto = 0, max = 0
        for (const q of d.questions) {
            max += q.points
            if (q.kind === 'mcq' && Number(answers[q.id]) === q.answer && answers[q.id] !== '' && answers[q.id] != null) auto += q.points
        }
        const clean = Object.fromEntries(d.questions.map(q => [q.id, q.kind === 'mcq' ? (answers[q.id] ?? null) : str(answers[q.id], 5000)]))
        await db().run(`UPDATE rec_applications SET answers = ?, auto_score = ?, max_score = ?, tab_switches = MAX(tab_switches, ?), test_submitted_at = ?,
            status = CASE WHEN status = 'applied' THEN 'test_submitted' ELSE status END, updated_at = datetime('now') WHERE id = ?`,
            [JSON.stringify(clean), auto, max, Math.max(0, Number(body.tabSwitches) || 0), new Date().toISOString(), app.id])
        return { ok: true }
    })

    /* ── admin side ── */
    route('GET', '/api/admin/recruitment', async ({ user }) => {
        requireRole(user, 'editor')
        const domains = (await db().all('SELECT * FROM rec_domains ORDER BY sort_order, id')).map(domainRow)
        const counts = await db().all('SELECT domain_id, status, COUNT(*) n FROM rec_applications GROUP BY domain_id, status')
        return { domains, counts }
    })

    const domainFields = b => [
        str(b.title, 120), str(b.description, 4000), b.open === false ? 0 : 1, isoOrNull(b.apply_deadline),
        b.test_enabled ? 1 : 0, Math.max(1, Math.min(240, Number(b.test_minutes) || 20)), isoOrNull(b.test_deadline),
        safeUrl(b.exam_link), isoOrNull(b.exam_deadline), safeUrl(b.whatsapp_link), JSON.stringify(cleanQuestions(b.questions)), Number(b.sort_order) || 0,
    ]

    route('POST', '/api/admin/recruitment/domains', async ({ user, body }) => {
        requireRole(user, 'editor')
        if (!str(body.title)) fail(400, 'Domain title is required.')
        const r = await db().run(`INSERT INTO rec_domains (title, description, open, apply_deadline, test_enabled, test_minutes, test_deadline, exam_link, exam_deadline, whatsapp_link, questions, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, domainFields(body))
        await audit(user, 'create', 'recruitment-domain', r.lastId, str(body.title, 120))
        return { item: await loadDomain(r.lastId) }
    })

    route('PUT', '/api/admin/recruitment/domains/:id', async ({ user, params, body }) => {
        requireRole(user, 'editor')
        if (!str(body.title)) fail(400, 'Domain title is required.')
        await db().run(`UPDATE rec_domains SET title = ?, description = ?, open = ?, apply_deadline = ?, test_enabled = ?, test_minutes = ?, test_deadline = ?,
            exam_link = ?, exam_deadline = ?, whatsapp_link = ?, questions = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?`, [...domainFields(body), Number(params.id)])
        await audit(user, 'update', 'recruitment-domain', params.id, `${str(body.title, 120)}${body.open === false ? ' (closed)' : ''}`)
        return { item: await loadDomain(params.id) }
    })

    route('DELETE', '/api/admin/recruitment/domains/:id', async ({ user, params }) => {
        requireRole(user, 'admin')
        const d = await loadDomain(params.id)
        if (!d) fail(404, 'Domain not found.')
        await db().run('DELETE FROM rec_applications WHERE domain_id = ?', [d.id])
        await db().run('DELETE FROM rec_domains WHERE id = ?', [d.id])
        await audit(user, 'delete', 'recruitment-domain', d.id, `${d.title} and its applications`)
        return { ok: true }
    })

    route('GET', '/api/admin/recruitment/applications', async ({ user }) => {
        requireRole(user, 'editor')
        const rows = await db().all(`SELECT a.id, a.user_id, a.domain_id, a.status, a.source, a.auto_score, a.manual_score, a.max_score, a.tab_switches,
            a.test_started_at, a.test_submitted_at, a.note, a.result_mailed_at, a.created_at, u.name, u.email, u.reg_no, u.mobile,
            (u.password_hash = 'invited') AS invited
            FROM rec_applications a JOIN users u ON u.id = a.user_id ORDER BY a.id DESC`)
        return { items: rows.map(r => ({ ...r, score: r.auto_score == null && r.manual_score == null ? null : scoreOf(r) })) }
    })

    route('GET', '/api/admin/recruitment/applications/:id', async ({ user, params }) => {
        requireRole(user, 'editor')
        const a = await db().first('SELECT a.*, u.name, u.email, u.reg_no, u.mobile FROM rec_applications a JOIN users u ON u.id = a.user_id WHERE a.id = ?', [Number(params.id)])
        if (!a) fail(404, 'Application not found.')
        const d = await loadDomain(a.domain_id)
        return { item: { ...a, answers: parseJson(a.answers, {}) }, questions: d?.questions || [] }
    })

    route('PATCH', '/api/admin/recruitment/applications', async ({ user, body }) => {
        requireRole(user, 'editor')
        const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Boolean))]
        if (!ids.length) fail(400, 'Select at least one application.')
        const sets = [], vals = []
        if (body.status !== undefined) { if (!STATUSES.includes(body.status)) fail(400, 'Unknown status.'); sets.push('status = ?'); vals.push(body.status) }
        if (body.manualScore !== undefined) { sets.push('manual_score = ?'); vals.push(body.manualScore === '' || body.manualScore === null ? null : Number(body.manualScore) || 0) }
        if (body.note !== undefined) { sets.push('note = ?'); vals.push(str(body.note, 2000)) }
        if (!sets.length) fail(400, 'Nothing to change.')
        for (const part of chunks(ids)) {
            await db().run(`UPDATE rec_applications SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id IN (${part.map(() => '?').join(',')})`, [...vals, ...part])
        }
        await audit(user, 'update', 'recruitment-application', ids.length === 1 ? ids[0] : `${ids.length} applications`,
            [body.status && `status → ${body.status}`, body.manualScore !== undefined && `score → ${body.manualScore}`, body.note !== undefined && 'note'].filter(Boolean).join(', '))
        return { ok: true, updated: ids.length }
    })

    /* Direct ("wildcard") selection: add a person and select them without any test. */
    route('POST', '/api/admin/recruitment/direct', async ({ user, body }) => {
        requireRole(user, 'admin')
        const email = str(body.email, 200).toLowerCase()
        if (!isEmail(email)) fail(400, 'Valid email required.')
        const ids = [...new Set((Array.isArray(body.domainIds) ? body.domainIds : []).map(Number).filter(Boolean))]
        if (!ids.length) fail(400, 'Choose at least one domain.')
        const mobile = str(body.mobile, 15).replace(/\D/g, '').slice(0, 10)
        let person = await db().first('SELECT * FROM users WHERE email = ?', [email])
        if (!person) {
            // No password yet: they set one with "Forgot password" when they first sign in.
            const r = await db().run("INSERT INTO users (name, email, password_hash, mobile, reg_no, member_type) VALUES (?, ?, 'invited', ?, ?, ?)",
                [str(body.name, 120) || email, email, mobile, str(body.regNo, 12).toUpperCase(), isVit(email) ? 'VIT Student' : 'External Member'])
            person = { id: r.lastId }
        } else if (mobile || body.regNo) {
            await db().run("UPDATE users SET mobile = COALESCE(NULLIF(?, ''), mobile), reg_no = COALESCE(NULLIF(?, ''), reg_no) WHERE id = ?", [mobile, str(body.regNo, 12).toUpperCase(), person.id])
        }
        for (const id of ids) {
            await db().run(`INSERT INTO rec_applications (user_id, domain_id, status, source, note) VALUES (?, ?, 'selected', 'direct', ?)
                ON CONFLICT(user_id, domain_id) DO UPDATE SET status = 'selected', note = excluded.note, updated_at = datetime('now')`,
                [person.id, id, str(body.note, 2000) || 'Selected directly by admin'])
        }
        const names = (await db().all(`SELECT title FROM rec_domains WHERE id IN (${ids.map(() => '?').join(',')})`, ids)).map(d => d.title)
        await audit(user, 'select-direct', 'recruitment', person.id, `${email} selected without test for: ${names.join(', ')}`)
        return { ok: true, email, needsPassword: (await db().first('SELECT password_hash FROM users WHERE id = ?', [person.id])).password_hash === 'invited' }
    })

    /* Result emails, reminders and custom messages (queued as mail-outs). */
    route('POST', '/api/admin/recruitment/email', async ({ user, body }) => {
        requireRole(user, 'editor')
        const tpl = (await loadSettings(['recruitment_mail'])).recruitment_mail
        const domains = (await db().all('SELECT * FROM rec_domains')).map(domainRow)
        const byId = Object.fromEntries(domains.map(d => [d.id, d]))
        const rows = await db().all('SELECT a.id, a.user_id, a.domain_id, a.status, a.result_mailed_at, a.test_submitted_at, u.name, u.email FROM rec_applications a JOIN users u ON u.id = a.user_id')
        const people = new Map()
        for (const r of rows) {
            if (!people.has(r.user_id)) people.set(r.user_id, { name: r.name, email: r.email, apps: [] })
            people.get(r.user_id).apps.push(r)
        }
        const first = n => String(n || '').split(' ')[0] || 'there'
        const fmt = iso => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'soon')
        const queued = []

        if (body.kind === 'results') {
            const selected = [], notSelected = [], appIds = []
            for (const p of people.values()) {
                if (body.onlyNew !== false && p.apps.every(a => a.result_mailed_at)) continue
                const picks = p.apps.filter(a => a.status === 'selected')
                const doms = picks.map(a => byId[a.domain_id]).filter(Boolean)
                if (doms.length) {
                    selected.push({ email: p.email, vars: { name: first(p.name), domains: doms.map(d => d.title).join(', '),
                        whatsapp: doms.map(d => `${d.title}: ${d.whatsapp_link || '(link will be shared soon)'}`).join('\n') } })
                } else if (body.includeNotSelected !== false && (body.includeUndecided || p.apps.every(a => a.status === 'not_selected'))) {
                    // By default only people explicitly marked "Not selected" everywhere get the thank-you note,
                    // so nobody still waiting for an interview is told they were not selected.
                    notSelected.push({ email: p.email, vars: { name: first(p.name), domains: p.apps.map(a => byId[a.domain_id]?.title).filter(Boolean).join(', ') } })
                } else continue
                appIds.push(...p.apps.map(a => a.id))
            }
            if (selected.length) queued.push(await createCampaign({ kind: 'recruitment-selected', label: `Selected candidates (${selected.length})`, subject: tpl.selectedSubject, body: tpl.selectedBody, recipients: selected, user }))
            if (notSelected.length) queued.push(await createCampaign({ kind: 'recruitment-not-selected', label: `Not selected (${notSelected.length})`, subject: tpl.notSelectedSubject, body: tpl.notSelectedBody, recipients: notSelected, user }))
            if (!queued.length) fail(400, 'Everyone has already been emailed their result.')
            for (const part of chunks(appIds)) await db().run(`UPDATE rec_applications SET result_mailed_at = datetime('now') WHERE id IN (${part.map(() => '?').join(',')})`, part)
            await audit(user, 'email', 'recruitment', '', `Results queued: ${selected.length} selected, ${notSelected.length} not selected`)
            return { queued }
        }

        // reminder / custom: applicants of the chosen domains (all when none chosen), optionally by status
        const domainIds = (body.domainIds || []).map(Number).filter(Boolean)
        const statuses = (body.statuses || []).filter(s => STATUSES.includes(s))
        const recipients = []
        for (const p of people.values()) {
            const apps = p.apps.filter(a => (!domainIds.length || domainIds.includes(a.domain_id)) && (!statuses.length || statuses.includes(a.status))
                && (!body.pendingTestOnly || !a.test_submitted_at))
            if (!apps.length) continue
            const doms = apps.map(a => byId[a.domain_id]).filter(Boolean)
            recipients.push({ email: p.email, vars: {
                name: first(p.name), domain: doms.map(d => d.title).join(', '), domains: doms.map(d => d.title).join(', '),
                deadline: doms.map(d => `${d.title}: ${fmt(d.test_deadline || d.exam_deadline || d.apply_deadline)}`).join('\n'),
                exam: doms.filter(d => d.exam_link).map(d => `${d.title}: ${d.exam_link} (due ${fmt(d.exam_deadline)})`).join('\n'),
            } })
        }
        const subject = body.kind === 'custom' ? body.subject : (body.subject || tpl.reminderSubject)
        const text = body.kind === 'custom' ? body.body : (body.body || tpl.reminderBody)
        queued.push(await createCampaign({ kind: `recruitment-${body.kind === 'custom' ? 'message' : 'reminder'}`, label: `${body.kind === 'custom' ? 'Message' : 'Reminder'} to ${recipients.length} applicants`, subject, body: text, recipients, user }))
        await audit(user, 'email', 'recruitment', '', `${body.kind} queued for ${recipients.length} applicants`)
        return { queued }
    })

    /*
     * Import a manually made list from Excel: each row is a person and the domain(s) they were selected for
     * (or another status). The admin's browser sends the sheet in chunks of a few hundred rows.
     */
    route('POST', '/api/admin/recruitment/import', async ({ user, body }) => {
        requireRole(user, 'admin')
        const domains = (await db().all('SELECT id, title FROM rec_domains')).map(d => ({ ...d, key: d.title.toLowerCase().replace(/[^a-z0-9]/g, '') }))
        const findDomain = v => {
            const k = String(v).toLowerCase().replace(/[^a-z0-9]/g, '')
            return k && (domains.find(d => d.key === k || String(d.id) === k) || domains.find(d => d.key.startsWith(k) || k.startsWith(d.key)))
        }
        const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 500)
        const skipped = [], unknown = new Set(), picks = []
        rows.forEach((r, i) => {
            const email = str(r.email, 200).toLowerCase()
            if (!isEmail(email)) return skipped.push({ row: r.line ?? i + 2, reason: `invalid email "${str(r.email, 60)}"` })
            const status = STATUSES.includes(r.status) ? r.status : 'selected'
            const ids = []
            for (const name of (Array.isArray(r.domains) ? r.domains : [])) {
                const d = findDomain(name)
                if (d) ids.push(d.id); else if (String(name).trim()) unknown.add(String(name).trim())
            }
            if (!ids.length) return skipped.push({ row: r.line ?? i + 2, reason: 'no known domain' })
            picks.push({ email, name: str(r.name, 120) || email, regNo: str(r.regNo, 12).toUpperCase().replace(/\s/g, ''), mobile: str(r.mobile, 20).replace(/\D/g, '').slice(-10), status, ids: [...new Set(ids)] })
        })
        const emails = [...new Set(picks.map(p => p.email))]
        const ids = new Map()
        for (const part of chunks(emails)) for (const u of await db().all(`SELECT id, email FROM users WHERE email IN (${part.map(() => '?').join(',')})`, part)) ids.set(u.email.toLowerCase(), u.id)
        const fresh = picks.filter((p, i, a) => !ids.has(p.email) && a.findIndex(x => x.email === p.email) === i)
        // New people get an account without a password; they set one with "Forgot password".
        if (fresh.length) await execBatches(chunks(fresh, 200).map(part => `INSERT OR IGNORE INTO users (name, email, password_hash, mobile, reg_no, member_type) VALUES ${part.map(p =>
            `(${lit(p.name)}, ${lit(p.email)}, 'invited', ${lit(p.mobile)}, ${lit(p.regNo)}, ${lit(isVit(p.email) ? 'VIT Student' : 'External Member')})`).join(', ')}`))
        if (fresh.length) for (const part of chunks(fresh.map(p => p.email))) for (const u of await db().all(`SELECT id, email FROM users WHERE email IN (${part.map(() => '?').join(',')})`, part)) ids.set(u.email.toLowerCase(), u.id)
        const updates = picks.filter(p => !fresh.includes(p) && (p.mobile || p.regNo)).map(p =>
            `UPDATE users SET mobile = COALESCE(${lit(p.mobile)}, mobile), reg_no = COALESCE(${lit(p.regNo)}, reg_no) WHERE id = ${ids.get(p.email)}`)
        const note = str(body.note, 300) || 'Imported from Excel'
        const values = picks.flatMap(p => p.ids.map(d => `(${ids.get(p.email)}, ${d}, ${lit(p.status)}, 'import', ${lit(note)})`))
        await execBatches([...updates, ...chunks(values, 300).map(part => `INSERT INTO rec_applications (user_id, domain_id, status, source, note) VALUES ${part.join(', ')}
            ON CONFLICT(user_id, domain_id) DO UPDATE SET status = excluded.status, source = CASE WHEN rec_applications.source = 'portal' THEN 'portal' ELSE 'import' END, note = excluded.note, updated_at = datetime('now')`)])
        await audit(user, 'import', 'recruitment', '', `Excel import: ${values.length} selections for ${picks.length} people (${fresh.length} new accounts), ${skipped.length} rows skipped`)
        const listed = {}
        for (const p of picks) for (const d of p.ids) (listed[d] ||= []).push(p.email)
        return { people: picks.length, selections: values.length, created: fresh.length, createdEmails: fresh.map(p => p.email), skipped, unknownDomains: [...unknown], listed }
    })

    /* After an import marked as the final list: everyone not on the sheet for a domain becomes "not selected" there. */
    route('POST', '/api/admin/recruitment/import/finalize', async ({ user, body }) => {
        requireRole(user, 'admin')
        const listed = body.listed && typeof body.listed === 'object' ? body.listed : {}
        let changed = 0
        for (const [domainId, list] of Object.entries(listed).slice(0, 50)) {
            const keep = [...new Set((Array.isArray(list) ? list : []).map(e => str(e, 200).toLowerCase()).filter(isEmail))].slice(0, 5000)
            if (!Number(domainId) || !keep.length) continue
            const r = await db().run(`UPDATE rec_applications SET status = 'not_selected', updated_at = datetime('now') WHERE domain_id = ${Number(domainId)}
                AND status != 'not_selected' AND user_id NOT IN (SELECT id FROM users WHERE email IN (${keep.map(lit).join(', ')}))`)
            changed += r.changes
        }
        await audit(user, 'import', 'recruitment', '', `Excel list set as final for ${Object.keys(listed).length} domain(s): ${changed} others marked not selected`)
        return { changed }
    })

    /*
     * Invite people an admin added (directly or by Excel) to set their password. Sent through the
     * Outbox. Only accounts that still have no password are emailed. emails: [...] or all: true.
     */
    route('POST', '/api/admin/recruitment/invite', async ({ req, user, body }) => {
        requireRole(user, 'admin')
        const tpl = (await loadSettings(['recruitment_mail'])).recruitment_mail
        const { site } = await loadSettings(['site'])
        const base = (site.url || `https://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '')
        const wanted = body.all ? null : new Set((Array.isArray(body.emails) ? body.emails : []).map(e => String(e).toLowerCase()))
        const rows = await db().all(`SELECT u.id, u.name, u.email, GROUP_CONCAT(d.title, ', ') domains FROM users u
            JOIN rec_applications a ON a.user_id = u.id JOIN rec_domains d ON d.id = a.domain_id
            WHERE u.password_hash = 'invited' AND u.active = 1 GROUP BY u.id`)
        const recipients = rows.filter(r => !wanted || wanted.has(r.email.toLowerCase())).map(r => ({
            email: r.email, vars: { name: String(r.name).split(' ')[0], email: r.email, domains: r.domains,
                link: `${base}/login?mode=forgot&setup=1&email=${encodeURIComponent(r.email)}` },
        }))
        if (!recipients.length) fail(400, 'Everyone selected has already set a password.')
        const queued = await createCampaign({ kind: 'recruitment-invite', label: `Set-password invitations (${recipients.length})`, subject: tpl.inviteSubject, body: tpl.inviteBody, recipients, user })
        await audit(user, 'email', 'recruitment', '', `Set-password invitations queued for ${recipients.length} people`)
        return { queued: [queued] }
    })

    /* One candidate with all their domain applications (for the admin's Edit candidate window). */
    route('GET', '/api/admin/recruitment/candidates/:userId', async ({ user, params }) => {
        requireRole(user, 'editor')
        const person = await db().first("SELECT id, name, email, reg_no, mobile, member_type, (password_hash = 'invited') AS invited FROM users WHERE id = ?", [Number(params.userId)])
        if (!person) fail(404, 'Candidate not found.')
        const apps = await db().all(`SELECT id, domain_id, status, source, auto_score, manual_score, max_score, note, test_submitted_at, created_at
            FROM rec_applications WHERE user_id = ? ORDER BY id`, [person.id])
        return { person, applications: apps }
    })

    /*
     * Edit everything about a candidate: name, email, reg no, mobile, which domains they are in and the
     * status in each. Domains left out of the list are removed from the candidate (with their answers).
     */
    route('PUT', '/api/admin/recruitment/candidates/:userId', async ({ user, params, body }) => {
        requireRole(user, 'admin')
        const person = await db().first('SELECT * FROM users WHERE id = ?', [Number(params.userId)])
        if (!person) fail(404, 'Candidate not found.')
        const name = str(body.name, 120)
        const email = str(body.email, 200).toLowerCase()
        const mobile = str(body.mobile, 20).replace(/\D/g, '').slice(-10)
        const regNo = str(body.regNo, 12).toUpperCase().replace(/\s/g, '')
        if (name.length < 2) fail(400, 'Enter the full name.')
        if (!isEmail(email)) fail(400, 'Enter a valid email address.')
        if (mobile && mobile.length !== 10) fail(400, 'Mobile number must be 10 digits.')
        if (email !== person.email.toLowerCase() && await db().first('SELECT id FROM users WHERE email = ? AND id != ?', [email, person.id])) fail(409, 'Another account already uses that email.')
        const valid = new Set((await db().all('SELECT id FROM rec_domains')).map(d => d.id))
        const wanted = new Map()
        for (const d of Array.isArray(body.domains) ? body.domains : []) {
            const id = Number(d.domainId)
            if (!valid.has(id)) continue
            wanted.set(id, { status: STATUSES.includes(d.status) ? d.status : 'applied', note: d.note === undefined ? undefined : str(d.note, 2000),
                manual: d.manualScore === undefined ? undefined : d.manualScore === '' || d.manualScore === null ? null : Number(d.manualScore) || 0 })
        }
        const changes = []
        for (const [k, a, b] of [['name', person.name, name], ['email', person.email, email], ['reg no', person.reg_no || '', regNo], ['mobile', person.mobile || '', mobile]]) if (String(a) !== String(b)) changes.push(`${k}: "${a}" → "${b}"`)
        await db().run("UPDATE users SET name = ?, email = ?, reg_no = ?, mobile = ?, member_type = CASE WHEN role = 'member' THEN ? ELSE member_type END, updated_at = datetime('now') WHERE id = ?",
            [name, email, regNo, mobile, isVit(email) ? 'VIT Student' : 'External Member', person.id])
        const titles = Object.fromEntries((await db().all('SELECT id, title FROM rec_domains')).map(d => [d.id, d.title]))
        const current = await db().all('SELECT id, domain_id, status FROM rec_applications WHERE user_id = ?', [person.id])
        for (const a of current) {
            if (!wanted.has(a.domain_id)) {
                await db().run('DELETE FROM rec_applications WHERE id = ?', [a.id])
                changes.push(`removed from ${titles[a.domain_id]}`)
                continue
            }
            const w = wanted.get(a.domain_id)
            const sets = ['status = ?'], vals = [w.status]
            if (w.note !== undefined) { sets.push('note = ?'); vals.push(w.note) }
            if (w.manual !== undefined) { sets.push('manual_score = ?'); vals.push(w.manual) }
            await db().run(`UPDATE rec_applications SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, [...vals, a.id])
            if (a.status !== w.status) changes.push(`${titles[a.domain_id]}: ${a.status} → ${w.status}`)
            wanted.delete(a.domain_id)
        }
        for (const [domainId, w] of wanted) {
            await db().run("INSERT INTO rec_applications (user_id, domain_id, status, source, note, manual_score) VALUES (?, ?, ?, 'direct', ?, ?)",
                [person.id, domainId, w.status, w.note || 'Added by admin', w.manual ?? null])
            changes.push(`added to ${titles[domainId]} (${w.status})`)
        }
        await audit(user, 'edit', 'recruitment-candidate', person.id, `${email}: ${changes.length ? changes.join('; ') : 'no changes'}`)
        return { ok: true, changes }
    })

    route('DELETE', '/api/admin/recruitment/applications', async ({ user, body }) => {
        requireRole(user, 'admin')
        if (body.confirm !== 'DELETE') fail(400, 'Type DELETE to confirm.')
        const n = await db().first('SELECT COUNT(*) n FROM rec_applications')
        await db().run('DELETE FROM rec_applications')
        await audit(user, 'delete', 'recruitment', '', `Cleared all ${n.n} applications (new season)`)
        return { ok: true, deleted: n.n }
    })
}
