/**
 * Event portals: registration (open link or email allowlist), solo or team entries with join codes,
 * per-round link submissions, evaluator scoring, qualification, published scores, winners,
 * templated emails and certificates. Any number of portals can be created, run and purged.
 */
import crypto from 'crypto'
import { getDb, parseJson, lit, execBatches } from './db.js'
import { fail, str, isEmail, safeUrl } from './http.js'
import { createCampaign, sendDirect } from './campaigns.js'
import { slugify } from '../shared/cms.js'

const isPast = iso => !!iso && Date.parse(iso) < Date.now()
const isFuture = iso => !!iso && Date.parse(iso) > Date.now()
const isoOrNull = v => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null)
const clamp = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d)
const chunks = (arr, n = 90) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const newCode = () => Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join('')
const isVit = email => /@vitstudent\.ac\.in$/i.test(email || '')
const emails = v => [...new Set((Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map(e => String(e).trim().toLowerCase()).filter(isEmail))]

export const CERT_KEYS = ['name', 'team', 'event', 'rank', 'date', 'regNo', 'custom']

const defaultConfig = () => ({
    summary: '', details: '', banner: '', venue: '', dateText: '',
    access: 'link', allowlist: [], vitOnly: false,
    team: { mode: 'solo', min: 1, max: 1 },
    regOpens: null, regCloses: null,
    fields: [{ key: 'repo', label: 'GitHub repository', required: true }, { key: 'demo', label: 'Demo / deployed link', required: false }, { key: 'video', label: 'Video walkthrough', required: false }],
    rounds: [{ name: 'Round 1', deadline: null, submissions: true }],
    criteria: [{ name: 'Innovation', max: 10 }, { name: 'Execution', max: 10 }, { name: 'Presentation', max: 10 }],
    evaluators: [], winnersCount: 3,
    emails: {
        qualified: { subject: 'You are through to {{round}} — {{event}}', body: 'Hi {{name}},\n\nGreat news: team {{team}} has qualified for {{round}} of {{event}}.\n\nDetails and your scores are on the event page:\n{{link}}\n\nSee you there!\nIEEE ITS VIT' },
        notQualified: { subject: '{{event}} — thank you for taking part', body: 'Hi {{name}},\n\nThank you for the effort team {{team}} put into {{event}}. The competition was close and your team did not move on to {{round}} this time.\n\nYour scores and feedback are on the event page:\n{{link}}\n\nWe hope to see you at the next one.\nIEEE ITS VIT' },
        winners: { subject: 'Congratulations — {{event}} winners', body: 'Hi {{name}},\n\nCongratulations! Team {{team}} placed #{{rank}} at {{event}}.\n\nYour certificate is available on the event page:\n{{link}}\n\nIEEE ITS VIT' },
        participation: { subject: 'Your {{event}} certificate', body: 'Hi {{name}},\n\nThank you for participating in {{event}} with team {{team}}. Your certificate is attached / available on the event page:\n{{link}}\n\nIEEE ITS VIT' },
        added: { subject: 'You are registered for {{event}}', body: 'Hi {{name}},\n\nYou have been registered for {{event}}{{teamLine}}.\n\n{{account}}\n\nEvent page — details, submissions and results:\n{{link}}\n\nIEEE ITS VIT' },
        all: { subject: '{{event}} — update', body: 'Hi {{name}},\n\n\n\nEvent page: {{link}}\nIEEE ITS VIT' },
    },
    certificates: {
        released: false, onlySubmitted: false,
        participant: { image: '', fields: [{ key: 'name', x: 50, y: 52, size: 34, color: '#111111', align: 'center', bold: true }] },
        winner: { image: '', fields: [{ key: 'name', x: 50, y: 52, size: 34, color: '#111111', align: 'center', bold: true }, { key: 'rank', x: 50, y: 62, size: 22, color: '#111111', align: 'center', bold: false, text: 'Rank #{{rank}}' }] },
    },
})

function cleanCert(c = {}) {
    return {
        image: safeUrl(c.image),
        fields: (Array.isArray(c.fields) ? c.fields : []).slice(0, 8).map(f => ({
            key: CERT_KEYS.includes(f.key) ? f.key : 'name', text: str(f.text, 200),
            x: Math.min(100, Math.max(0, Math.round((Number(f.x) || 0) * 10) / 10)), y: Math.min(100, Math.max(0, Math.round((Number(f.y) || 0) * 10) / 10)), size: clamp(f.size, 6, 120, 28),
            color: /^#[0-9a-f]{6}$/i.test(f.color || '') ? f.color : '#111111', align: ['left', 'center', 'right'].includes(f.align) ? f.align : 'center', bold: !!f.bold,
            italic: !!f.italic, font: /^[a-z]{2,20}$/.test(f.font || '') ? f.font : 'helvetica',
        })),
    }
}

export function cleanConfig(input = {}) {
    const d = defaultConfig()
    const c = { ...d, ...input }
    const mode = c.team?.mode === 'team' ? 'team' : 'solo'
    const min = mode === 'solo' ? 1 : clamp(c.team?.min, 1, 10, 2)
    const rounds = (Array.isArray(c.rounds) ? c.rounds : d.rounds).slice(0, 5).map((r, i) => ({ name: str(r.name, 80) || `Round ${i + 1}`, deadline: isoOrNull(r.deadline), submissions: r.submissions !== false }))
    return {
        summary: str(c.summary, 1000), details: str(c.details, 10_000), banner: safeUrl(c.banner), venue: str(c.venue, 200), dateText: str(c.dateText, 120),
        access: c.access === 'allowlist' ? 'allowlist' : 'link', allowlist: emails(c.allowlist).slice(0, 5000), vitOnly: !!c.vitOnly,
        team: { mode, min, max: mode === 'solo' ? 1 : Math.max(min, clamp(c.team?.max, 1, 10, 4)) },
        regOpens: isoOrNull(c.regOpens), regCloses: isoOrNull(c.regCloses),
        fields: (Array.isArray(c.fields) ? c.fields : []).slice(0, 6).map((f, i) => ({ key: slugify(f.key || f.label).slice(0, 30) || `field${i + 1}`, label: str(f.label, 80) || `Link ${i + 1}`, required: !!f.required })),
        rounds: rounds.length ? rounds : d.rounds,
        criteria: (Array.isArray(c.criteria) ? c.criteria : []).slice(0, 10).map(k => ({ name: str(k.name, 60), max: clamp(k.max, 1, 1000, 10) })).filter(k => k.name),
        evaluators: emails(c.evaluators).slice(0, 100), winnersCount: clamp(c.winnersCount, 1, 50, 3),
        emails: Object.fromEntries(Object.keys(d.emails).map(k => [k, { subject: str(c.emails?.[k]?.subject, 300) || d.emails[k].subject, body: str(c.emails?.[k]?.body, 10_000) || d.emails[k].body }])),
        certificates: { released: !!c.certificates?.released, onlySubmitted: !!c.certificates?.onlySubmitted, participant: cleanCert(c.certificates?.participant), winner: cleanCert(c.certificates?.winner) },
    }
}

const portalRow = p => p && ({ ...p, config: cleanConfig(parseJson(p.config, {})) })

/** Average of every evaluator's marks for one team and round. */
function aggregate(rows, criteria) {
    if (!rows.length) return null
    const per = Object.fromEntries(criteria.map(c => [c.name, rows.reduce((s, r) => s + (Number(parseJson(r.scores, {})[c.name]) || 0), 0) / rows.length]))
    return { criteria: per, total: rows.reduce((s, r) => s + r.total, 0) / rows.length, evaluators: rows.length }
}

export function installPortals({ route, requireRole, audit, loadSettings, releaseImages, imageUrls }) {
    const db = () => getDb()
    const bySlug = async slug => portalRow(await db().first('SELECT * FROM ev_portals WHERE slug = ?', [String(slug)]))
    const byId = async id => portalRow(await db().first('SELECT * FROM ev_portals WHERE id = ?', [Number(id)]))
    const siteUrl = async () => ((await loadSettings(['site'])).site.url || '').replace(/\/$/, '')
    const isStaff = u => u && u.role !== 'member'
    const isEvaluator = (p, u) => !!u && (isStaff(u) || p.config.evaluators.includes(u.email.toLowerCase()))

    const regState = p => {
        const c = p.config
        if (p.status !== 'open') return { open: false, reason: p.status === 'draft' ? 'Registrations have not opened yet.' : 'Registrations are closed.' }
        if (isFuture(c.regOpens)) return { open: false, reason: 'Registrations have not opened yet.' }
        if (isPast(c.regCloses)) return { open: false, reason: 'Registrations are closed.' }
        return { open: true }
    }
    const eligibility = (p, u) => {
        if (!u) return 'Please sign in to register.'
        if (p.config.access === 'allowlist' && !p.config.allowlist.includes(u.email.toLowerCase()) && !isStaff(u)) return 'This event is open only to invited participants. Sign in with the email address you registered with.'
        if (p.config.vitOnly && !/@vitstudent\.ac\.in$/i.test(u.email)) return 'This event is open to VIT students only — sign in with your @vitstudent.ac.in email.'
        if (!/^\d{10}$/.test(u.mobile || '')) return 'Add your 10-digit mobile number to your profile first.'
        if (p.config.vitOnly && (u.reg_no || '').length < 6) return 'Add your registration number to your profile first.'
        return null
    }
    const membership = async (p, u) => u && db().first('SELECT m.*, t.id AS tid FROM ev_members m JOIN ev_teams t ON t.id = m.team_id WHERE m.portal_id = ? AND m.user_id = ?', [p.id, u.id])

    async function teamView(p, teamId) {
        const t = await db().first('SELECT * FROM ev_teams WHERE id = ?', [teamId])
        const members = await db().all("SELECT m.id, m.user_id, m.role, u.name, u.email FROM ev_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = ? ORDER BY CASE m.role WHEN 'lead' THEN 0 ELSE 1 END, m.id", [teamId])
        const rounds = []
        for (let r = 1; r <= Math.min(p.scores_published, p.config.rounds.length); r++) {
            const rows = await db().all('SELECT scores, total FROM ev_scores WHERE team_id = ? AND round = ?', [teamId, r])
            rounds.push({ round: r, name: p.config.rounds[r - 1]?.name, score: aggregate(rows, p.config.criteria), qualified: r < p.config.rounds.length ? t.round > r : null })
        }
        return { id: t.id, name: t.name, code: t.code, round: t.round, rank: p.winners_published ? t.rank : null, submission: parseJson(t.submission, {}), submittedAt: t.submitted_at, members, results: rounds }
    }

    function publicPortal(p) {
        const c = p.config
        return {
            slug: p.slug, title: p.title, status: p.status, summary: c.summary, details: c.details, banner: c.banner, venue: c.venue, dateText: c.dateText,
            access: c.access, vitOnly: c.vitOnly, team: c.team, regOpens: c.regOpens, regCloses: c.regCloses, fields: c.fields,
            rounds: c.rounds, criteria: c.criteria, currentRound: p.current_round, scoresPublished: p.scores_published, winnersPublished: !!p.winners_published,
            certificatesReleased: c.certificates.released,
        }
    }

    /* ── participant side ── */
    route('GET', '/api/portals/:slug', async ({ user, params }) => {
        const p = await bySlug(params.slug)
        if (!p || (p.status === 'draft' && !isStaff(user))) fail(404, 'Event not found.')
        const out = { portal: publicPortal(p), registration: regState(p) }
        if (p.winners_published) {
            const winners = await db().all('SELECT id, name, rank FROM ev_teams WHERE portal_id = ? AND rank IS NOT NULL ORDER BY rank LIMIT 50', [p.id])
            const names = winners.length ? await db().all(`SELECT m.team_id, u.name FROM ev_members m JOIN users u ON u.id = m.user_id WHERE m.team_id IN (${winners.map(() => '?').join(',')})`, winners.map(w => w.id)) : []
            out.winners = winners.map(w => ({ rank: w.rank, team: w.name, members: names.filter(n => n.team_id === w.id).map(n => n.name) }))
        }
        if (user) {
            const m = await membership(p, user)
            out.me = {
                blocked: eligibility(p, user), evaluator: isEvaluator(p, user),
                team: m ? await teamView(p, m.team_id) : null, role: m?.role || null, memberId: m?.id || null,
                profile: { name: user.name, email: user.email, regNo: user.reg_no || '' },
            }
        }
        return out
    })

    const participant = async (slug, user, { needOpen = true } = {}) => {
        requireRole(user, 'member')
        const p = await bySlug(slug)
        if (!p || p.status === 'draft') fail(404, 'Event not found.')
        if (needOpen) {
            const s = regState(p)
            if (!s.open) fail(400, s.reason)
        }
        const blocked = eligibility(p, user)
        if (blocked) fail(403, blocked)
        return p
    }

    const teamName = v => str(v, 60).replace(/\s+/g, ' ').trim()
    const nameTaken = (p, name) => db().first('SELECT id FROM ev_teams WHERE portal_id = ? AND lower(name) = lower(?)', [p.id, name])
    const isNameClash = e => /idx_ev_teams_name|lower\(name\)/.test(e.message)

    /**
     * Team names are unique per event (enforced by the idx_ev_teams_name index, so two people creating the
     * same name at the same moment cannot both succeed). Solo entries use the person's name, so a clash there
     * gets the registration number (or a counter) added instead of being refused.
     */
    async function createTeam(p, user, name, { solo } = {}) {
        let teamId = null
        let candidate = name
        for (let i = 0; i < 8 && !teamId; i++) {
            try { teamId = (await db().run('INSERT INTO ev_teams (portal_id, name, code, lead_user_id) VALUES (?, ?, ?, ?)', [p.id, candidate, newCode(), user.id])).lastId }
            catch (e) {
                if (!/UNIQUE/.test(e.message)) throw e
                if (!isNameClash(e)) continue // join code collision — try another code
                if (!solo) fail(409, `The team name "${name}" is already taken in this event — choose another.`)
                candidate = i === 0 && user.reg_no ? `${name} (${user.reg_no})` : `${name} (${i + 2})`
            }
        }
        if (!teamId) fail(500, 'Could not register right now, please try again.')
        try { await db().run("INSERT INTO ev_members (portal_id, team_id, user_id, role) VALUES (?, ?, ?, 'lead')", [p.id, teamId, user.id]) }
        catch (e) {
            await db().run('DELETE FROM ev_teams WHERE id = ?', [teamId])
            if (/UNIQUE/.test(e.message)) fail(409, 'You are already registered for this event.')
            throw e
        }
        return teamId
    }

    route('POST', '/api/portals/:slug/register', async ({ user, params, body }) => {
        const p = await participant(params.slug, user)
        if (await membership(p, user)) fail(409, 'You are already registered for this event.')
        const solo = p.config.team.mode === 'solo'
        const name = teamName(solo ? user.name : body.teamName)
        if (!solo && name.length < 2) fail(400, 'Enter a team name (at least 2 characters).')
        if (!solo && await nameTaken(p, name)) fail(409, `The team name "${name}" is already taken in this event — choose another.`)
        const teamId = await createTeam(p, user, name, { solo })
        return { team: await teamView(p, teamId) }
    })

    /* Live check while a team lead types a name. */
    route('GET', '/api/portals/:slug/team-name', async ({ params, query }) => {
        const p = await bySlug(params.slug)
        if (!p || p.status === 'draft') fail(404, 'Event not found.')
        const name = teamName(query.get('name'))
        return { name, available: name.length >= 2 && !(await nameTaken(p, name)) }
    })

    route('POST', '/api/portals/:slug/join', async ({ user, params, body }) => {
        const p = await participant(params.slug, user)
        if (p.config.team.mode !== 'team') fail(400, 'This is a solo event.')
        if (await membership(p, user)) fail(409, 'You are already in a team for this event.')
        const t = await db().first('SELECT * FROM ev_teams WHERE portal_id = ? AND code = ?', [p.id, str(body.code, 12).toUpperCase()])
        if (!t) fail(404, 'No team with that code. Check it with your team lead.')
        const n = await db().first('SELECT COUNT(*) n FROM ev_members WHERE team_id = ?', [t.id])
        if (n.n >= p.config.team.max) fail(400, `This team is full (${p.config.team.max} members).`)
        try { await db().run("INSERT INTO ev_members (portal_id, team_id, user_id, role) VALUES (?, ?, ?, 'member')", [p.id, t.id, user.id]) }
        catch (e) { if (/UNIQUE/.test(e.message)) fail(409, 'You are already in a team for this event.'); throw e }
        return { team: await teamView(p, t.id) }
    })

    route('POST', '/api/portals/:slug/leave', async ({ user, params, body }) => {
        const p = await participant(params.slug, user)
        const m = await membership(p, user)
        if (!m) fail(400, 'You are not registered.')
        const target = body.memberId ? await db().first('SELECT * FROM ev_members WHERE id = ? AND team_id = ?', [Number(body.memberId), m.team_id]) : m
        if (!target) fail(404, 'Member not found.')
        if (target.id !== m.id && m.role !== 'lead') fail(403, 'Only the team lead can remove members.')
        if (target.role === 'lead') {
            const others = await db().all('SELECT id FROM ev_members WHERE team_id = ? AND id != ? ORDER BY id', [m.team_id, target.id])
            if (others.length) fail(400, 'Remove your team mates first, or ask one of them to take over as lead.')
            await db().run('DELETE FROM ev_teams WHERE id = ?', [m.team_id])
            await db().run('DELETE FROM ev_members WHERE team_id = ?', [m.team_id])
        } else {
            await db().run('DELETE FROM ev_members WHERE id = ?', [target.id])
        }
        return { ok: true }
    })

    route('POST', '/api/portals/:slug/submit', async ({ user, params, body }) => {
        const p = await participant(params.slug, user, { needOpen: false })
        const m = await membership(p, user)
        if (!m) fail(400, 'Register first.')
        const round = clamp(body.round, 1, p.config.rounds.length, 1)
        const r = p.config.rounds[round - 1]
        const t = await db().first('SELECT * FROM ev_teams WHERE id = ?', [m.team_id])
        if (!r.submissions) fail(400, `${r.name} has no submission.`)
        if (t.round < round) fail(403, `Your team has not qualified for ${r.name}.`)
        if (p.status === 'archived' || isPast(r.deadline)) fail(400, `The ${r.name} submission deadline has passed.`)
        const size = (await db().first('SELECT COUNT(*) n FROM ev_members WHERE team_id = ?', [t.id])).n
        if (size < p.config.team.min) fail(400, `Your team needs at least ${p.config.team.min} members before submitting.`)
        const values = {}
        for (const f of p.config.fields) {
            const v = safeUrl(body.values?.[f.key]) || str(body.values?.[f.key], 500)
            if (f.required && !v) fail(400, `${f.label} is required.`)
            values[f.key] = v
        }
        const sub = { ...parseJson(t.submission, {}), [round]: { ...values, at: new Date().toISOString(), by: user.name } }
        await db().run("UPDATE ev_teams SET submission = ?, submitted_at = ?, updated_at = datetime('now') WHERE id = ?", [JSON.stringify(sub), new Date().toISOString(), t.id])
        return { team: await teamView(p, t.id) }
    })

    /* certificate data for the signed-in participant (the PDF is drawn in their browser — nothing is stored) */
    route('GET', '/api/portals/:slug/certificate', async ({ user, params }) => {
        requireRole(user, 'member')
        const p = await bySlug(params.slug)
        if (!p) fail(404, 'Event not found.')
        if (!p.config.certificates.released) fail(403, 'Certificates are not available yet.')
        const m = await membership(p, user)
        if (!m) fail(403, 'You did not take part in this event.')
        const t = await db().first('SELECT * FROM ev_teams WHERE id = ?', [m.team_id])
        if (p.config.certificates.onlySubmitted && !t.submitted_at) fail(403, 'Certificates are issued to teams that made a submission.')
        const winner = p.winners_published && t.rank
        const tpl = winner && p.config.certificates.winner.image ? p.config.certificates.winner : p.config.certificates.participant
        if (!tpl.image) fail(404, 'The certificate template has not been uploaded yet.')
        return { template: tpl, data: { name: user.name, team: t.name, event: p.title, rank: winner ? String(t.rank) : '', regNo: user.reg_no || '', date: new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }) } }
    })

    /* ── evaluators ── */
    route('GET', '/api/portals/:slug/evaluate', async ({ user, params, query }) => {
        requireRole(user, 'member')
        const p = await bySlug(params.slug)
        if (!p || !isEvaluator(p, user)) fail(403, 'You are not an evaluator for this event.')
        const round = clamp(query.get('round'), 1, p.config.rounds.length, p.current_round)
        const teams = await db().all('SELECT id, name, submission, submitted_at, round FROM ev_teams WHERE portal_id = ? AND round >= ? ORDER BY id', [p.id, round])
        const mine = await db().all('SELECT team_id, scores, total, comment FROM ev_scores WHERE portal_id = ? AND round = ? AND evaluator_id = ?', [p.id, round, user.id])
        const sizes = await db().all('SELECT team_id, COUNT(*) n FROM ev_members WHERE portal_id = ? GROUP BY team_id', [p.id])
        return {
            portal: { title: p.title, criteria: p.config.criteria, rounds: p.config.rounds, fields: p.config.fields, currentRound: p.current_round }, round,
            teams: teams.map(t => {
                const s = mine.find(x => x.team_id === t.id)
                return { id: t.id, name: t.name, size: sizes.find(x => x.team_id === t.id)?.n || 0, submission: parseJson(t.submission, {})[round] || null, mine: s ? { scores: parseJson(s.scores, {}), total: s.total, comment: s.comment } : null }
            }),
        }
    })

    route('POST', '/api/portals/:slug/evaluate/:teamId', async ({ user, params, body }) => {
        requireRole(user, 'member')
        const p = await bySlug(params.slug)
        if (!p || !isEvaluator(p, user)) fail(403, 'You are not an evaluator for this event.')
        const round = clamp(body.round, 1, p.config.rounds.length, p.current_round)
        const t = await db().first('SELECT id, round FROM ev_teams WHERE id = ? AND portal_id = ?', [Number(params.teamId), p.id])
        if (!t || t.round < round) fail(404, 'Team not in this round.')
        const scores = {}
        let total = 0
        for (const c of p.config.criteria) {
            const v = Number(body.scores?.[c.name])
            if (!Number.isFinite(v) || v < 0 || v > c.max) fail(400, `${c.name} must be between 0 and ${c.max}.`)
            scores[c.name] = v
            total += v
        }
        await db().run(`INSERT INTO ev_scores (portal_id, team_id, round, evaluator_id, scores, total, comment) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(team_id, round, evaluator_id) DO UPDATE SET scores = excluded.scores, total = excluded.total, comment = excluded.comment, updated_at = datetime('now')`,
            [p.id, t.id, round, user.id, JSON.stringify(scores), total, str(body.comment, 2000)])
        return { ok: true, total }
    })

    /* ── admin ── */
    route('GET', '/api/admin/portals', async ({ user }) => {
        requireRole(user, 'editor')
        const rows = await db().all(`SELECT p.id, p.slug, p.title, p.status, p.current_round, p.created_at,
            (SELECT COUNT(*) FROM ev_teams t WHERE t.portal_id = p.id) teams, (SELECT COUNT(*) FROM ev_members m WHERE m.portal_id = p.id) members
            FROM ev_portals p ORDER BY p.id DESC`)
        return { items: rows }
    })

    route('POST', '/api/admin/portals', async ({ user, body }) => {
        requireRole(user, 'editor')
        const title = str(body.title, 120)
        if (title.length < 3) fail(400, 'Enter an event title.')
        let slug = slugify(body.slug || title).slice(0, 60) || `event-${Date.now()}`
        if (await db().first('SELECT id FROM ev_portals WHERE slug = ?', [slug])) slug = `${slug}-${Date.now().toString(36).slice(-4)}`
        const r = await db().run('INSERT INTO ev_portals (slug, title, config) VALUES (?, ?, ?)', [slug, title, JSON.stringify(cleanConfig(body.config || {}))])
        await audit(user, 'create', 'event-portal', r.lastId, title)
        return { item: await byId(r.lastId) }
    })

    route('GET', '/api/admin/portals/:id', async ({ user, params }) => {
        requireRole(user, 'editor')
        const p = await byId(params.id)
        if (!p) fail(404, 'Event not found.')
        return { item: p }
    })

    route('PUT', '/api/admin/portals/:id', async ({ user, params, body }) => {
        requireRole(user, 'editor')
        const p = await byId(params.id)
        if (!p) fail(404, 'Event not found.')
        const slug = slugify(body.slug || p.slug).slice(0, 60) || p.slug
        if (slug !== p.slug && await db().first('SELECT id FROM ev_portals WHERE slug = ? AND id != ?', [slug, p.id])) fail(409, 'That link is already used by another event.')
        const status = ['draft', 'open', 'closed', 'archived'].includes(body.status) ? body.status : p.status
        const config = cleanConfig({ ...p.config, ...(body.config || {}) })
        const rounds = config.rounds.length
        await db().run(`UPDATE ev_portals SET slug = ?, title = ?, status = ?, config = ?, current_round = ?, scores_published = ?, winners_published = ?, updated_at = datetime('now') WHERE id = ?`,
            [slug, str(body.title, 120) || p.title, status, JSON.stringify(config), clamp(body.current_round ?? p.current_round, 1, rounds, 1),
                clamp(body.scores_published ?? p.scores_published, 0, rounds, 0), body.winners_published === undefined ? p.winners_published : body.winners_published ? 1 : 0, p.id])
        const changed = [status !== p.status && `status ${p.status} → ${status}`, body.scores_published !== undefined && body.scores_published !== p.scores_published && `scores published up to round ${body.scores_published}`,
            body.winners_published !== undefined && !!body.winners_published !== !!p.winners_published && (body.winners_published ? 'winners announced' : 'winners hidden')].filter(Boolean)
        await audit(user, 'update', 'event-portal', p.id, `${p.title}${changed.length ? ': ' + changed.join(', ') : ''}`)
        await releaseImages(user, [...imageUrls(p.config.certificates, p.config.banner)].filter(u => !imageUrls(config.certificates, config.banner).has(u)))
        return { item: await byId(p.id) }
    })

    route('GET', '/api/admin/portals/:id/data', async ({ user, params }) => {
        requireRole(user, 'editor')
        const p = await byId(params.id)
        if (!p) fail(404, 'Event not found.')
        const [teams, members, scores] = await Promise.all([
            db().all('SELECT id, name, code, lead_user_id, submission, submitted_at, round, rank, created_at FROM ev_teams WHERE portal_id = ? ORDER BY id', [p.id]),
            db().all("SELECT m.id, m.team_id, m.user_id, m.role, m.cert_sent_at, m.joined_at, u.name, u.email, u.reg_no, u.mobile, (u.password_hash = 'invited') AS invited FROM ev_members m JOIN users u ON u.id = m.user_id WHERE m.portal_id = ? ORDER BY m.team_id, m.id", [p.id]),
            db().all('SELECT s.team_id, s.round, s.scores, s.total, s.comment, s.evaluator_id, u.email evaluator FROM ev_scores s LEFT JOIN users u ON u.id = s.evaluator_id WHERE s.portal_id = ?', [p.id]),
        ])
        return { teams: teams.map(t => ({ ...t, submission: parseJson(t.submission, {}) })), members, scores: scores.map(s => ({ ...s, scores: parseJson(s.scores, {}) })) }
    })

    route('DELETE', '/api/admin/portals/:id/teams/:teamId', async ({ user, params }) => {
        requireRole(user, 'editor')
        const t = await db().first('SELECT * FROM ev_teams WHERE id = ? AND portal_id = ?', [Number(params.teamId), Number(params.id)])
        if (!t) fail(404, 'Team not found.')
        await db().run('DELETE FROM ev_scores WHERE team_id = ?', [t.id])
        await db().run('DELETE FROM ev_members WHERE team_id = ?', [t.id])
        await db().run('DELETE FROM ev_teams WHERE id = ?', [t.id])
        await audit(user, 'delete', 'event-team', t.id, `${t.name} (portal ${params.id})`)
        return { ok: true }
    })

    route('DELETE', '/api/admin/portals/:id/members/:memberId', async ({ user, params }) => {
        requireRole(user, 'editor')
        const m = await db().first('SELECT m.*, u.email FROM ev_members m JOIN users u ON u.id = m.user_id WHERE m.id = ? AND m.portal_id = ?', [Number(params.memberId), Number(params.id)])
        if (!m) fail(404, 'Member not found.')
        await db().run('DELETE FROM ev_members WHERE id = ?', [m.id])
        if (m.role === 'lead') {
            const next = await db().first('SELECT id, user_id FROM ev_members WHERE team_id = ? ORDER BY id LIMIT 1', [m.team_id])
            if (next) {
                await db().run("UPDATE ev_members SET role = 'lead' WHERE id = ?", [next.id])
                await db().run('UPDATE ev_teams SET lead_user_id = ? WHERE id = ?', [next.user_id, m.team_id])
            } else await db().run('DELETE FROM ev_teams WHERE id = ?', [m.team_id])
        }
        await audit(user, 'delete', 'event-member', m.id, `${m.email} removed (portal ${params.id})`)
        return { ok: true }
    })

    /* The complete list of teams that qualify from `round` to the next one. */
    /*
     * Admin adds participants — one typed in, or a sheet sent in chunks of up to 500 rows. People without an
     * account get one with no password (they set it on first sign-in with an emailed code). In team events,
     * rows with the same team name form one team (or join that team if it already exists). Everything is
     * written with a handful of bulk statements so 1,500 rows stay well inside D1's free-tier limits.
     */
    route('POST', '/api/admin/portals/:id/participants', async ({ user, params, body }) => {
        requireRole(user, 'editor')
        const p = await byId(params.id)
        if (!p) fail(404, 'Event not found.')
        const solo = p.config.team.mode === 'solo'
        const max = p.config.team.max
        const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 500)
        const skipped = []
        const people = []
        const seen = new Set()
        rows.forEach((r, i) => {
            const row = r.line ?? i + 1
            const email = str(r.email, 200).toLowerCase()
            if (!isEmail(email)) return skipped.push({ row, reason: `invalid email "${str(r.email, 60)}"` })
            if (seen.has(email)) return skipped.push({ row, reason: `${email} is listed twice` })
            if (p.config.vitOnly && !isVit(email)) return skipped.push({ row, reason: `${email} is not a @vitstudent.ac.in email (this event is VIT only)` })
            const team = solo ? '' : teamName(r.team)
            if (!solo && team.length < 2) return skipped.push({ row, reason: `no team name for ${email}` })
            seen.add(email)
            people.push({
                row, email, team, name: str(r.name, 120).replace(/\s+/g, ' ').trim(),
                regNo: str(r.regNo, 12).toUpperCase().replace(/\s/g, ''), mobile: str(r.mobile, 20).replace(/\D/g, '').slice(-10),
                lead: r.lead === true || /^(lead|leader|team lead|captain|yes|y|true|1)$/i.test(String(r.lead ?? r.role ?? '').trim()),
            })
        })

        // Existing accounts (new ones are created below, only for people who actually get a place).
        const users = new Map()
        const fetchUsers = async list => {
            for (const part of chunks(list)) {
                for (const u of await db().all(`SELECT id, name, email, mobile, reg_no, password_hash FROM users WHERE email IN (${part.map(() => '?').join(',')})`, part)) users.set(u.email.toLowerCase(), u)
            }
        }
        await fetchUsers(people.map(x => x.email))

        // Who is already in this event, and which teams exist.
        const already = new Map((await db().all('SELECT m.user_id, t.name FROM ev_members m JOIN ev_teams t ON t.id = m.team_id WHERE m.portal_id = ?', [p.id])).map(m => [m.user_id, m.name]))
        const teams = await db().all('SELECT t.id, t.name, t.code, (SELECT COUNT(*) FROM ev_members m WHERE m.team_id = t.id) n FROM ev_teams t WHERE t.portal_id = ?', [p.id])
        const byName = new Map(teams.map(t => [t.name.toLowerCase(), t]))
        const codes = new Set(teams.map(t => t.code))
        const code = () => { let c; do c = newCode(); while (codes.has(c)); codes.add(c); return c }

        const newTeams = new Map() // lower(name) -> { name, code, lead, members: [] }
        const joins = []          // { teamId, person }
        for (const x of people) {
            const u = users.get(x.email)
            if (u && already.has(u.id)) { skipped.push({ row: x.row, reason: `${x.email} is already registered (${already.get(u.id)})` }); continue }
            if (solo) {
                const base = teamName(u?.name || x.name) || x.email.split('@')[0]
                const regNo = u?.reg_no || x.regNo
                let name = base
                for (let i = 0; byName.has(name.toLowerCase()) || newTeams.has(name.toLowerCase()); i++) name = i === 0 && regNo ? `${base} (${regNo})` : `${base} (${i + 1})`
                newTeams.set(name.toLowerCase(), { name, code: code(), members: [x] })
                continue
            }
            const k = x.team.toLowerCase()
            const existing = byName.get(k)
            if (existing) {
                if (existing.n >= max) { skipped.push({ row: x.row, reason: `team ${existing.name} is full (${max} members)` }); continue }
                existing.n++
                joins.push({ teamId: existing.id, person: x })
                continue
            }
            const t = newTeams.get(k) || newTeams.set(k, { name: x.team, code: code(), members: [] }).get(k)
            if (t.members.length >= max) { skipped.push({ row: x.row, reason: `team ${t.name} is full (${max} members)` }); continue }
            t.members.push(x)
        }

        // Accounts for everyone who got a place: new people get one without a password (they set it on first
        // sign-in); existing accounts only have a missing mobile / reg no filled in.
        const placed = [...[...newTeams.values()].flatMap(t => t.members), ...joins.map(j => j.person)]
        const text = v => (v ? lit(v) : "''")
        const fresh = placed.filter(x => !users.has(x.email))
        if (fresh.length) {
            await execBatches(chunks(fresh, 200).map(part => `INSERT OR IGNORE INTO users (name, email, password_hash, mobile, reg_no, member_type) VALUES ${part.map(x =>
                `(${lit(x.name || x.email.split('@')[0])}, ${lit(x.email)}, 'invited', ${text(x.mobile)}, ${text(x.regNo)}, ${lit(isVit(x.email) ? 'VIT Student' : 'External Member')})`).join(', ')}`))
            await fetchUsers(fresh.map(x => x.email))
        }
        const fills = placed.filter(x => !fresh.includes(x) && ((x.mobile && !users.get(x.email).mobile) || (x.regNo && !users.get(x.email).reg_no)))
            .map(x => `UPDATE users SET mobile = CASE WHEN COALESCE(mobile, '') = '' THEN ${text(x.mobile)} ELSE mobile END, reg_no = CASE WHEN COALESCE(reg_no, '') = '' THEN ${text(x.regNo)} ELSE reg_no END WHERE id = ${users.get(x.email).id}`)
        if (fills.length) await execBatches(fills)
        for (const x of placed) x.user = users.get(x.email)
        const lost = placed.filter(x => !x.user)
        for (const x of lost) skipped.push({ row: x.row, reason: `could not create an account for ${x.email}` })

        // New teams first (the lead is the row marked as lead, otherwise the first row), then everyone's membership.
        for (const t of newTeams.values()) t.members = t.members.filter(m => m.user)
        const created = [...newTeams.values()].filter(t => t.members.length)
        for (const t of created) t.lead = t.members.find(m => m.lead) || t.members[0]
        if (created.length) {
            await execBatches(chunks(created, 200).map(part => `INSERT OR IGNORE INTO ev_teams (portal_id, name, code, lead_user_id) VALUES ${part.map(t =>
                `(${p.id}, ${lit(t.name)}, ${lit(t.code)}, ${t.lead.user.id})`).join(', ')}`))
            const ids = new Map((await db().all('SELECT id, name, code FROM ev_teams WHERE portal_id = ?', [p.id])).map(t => [t.name.toLowerCase(), t]))
            for (const t of created) {
                const row = ids.get(t.name.toLowerCase())
                if (row?.code === t.code) t.id = row.id
                else for (const m of t.members) skipped.push({ row: m.row, reason: `team name "${t.name}" was taken a moment ago — add them again` })
            }
        }
        const members = [
            ...created.filter(t => t.id).flatMap(t => t.members.map(m => ({ teamId: t.id, person: m, role: m === t.lead ? 'lead' : 'member' }))),
            ...joins.filter(j => j.person.user).map(j => ({ ...j, role: 'member' })),
        ]
        if (members.length) {
            await execBatches(chunks(members, 300).map(part => `INSERT OR IGNORE INTO ev_members (portal_id, team_id, user_id, role) VALUES ${part.map(m =>
                `(${p.id}, ${m.teamId}, ${m.person.user.id}, '${m.role}')`).join(', ')}`))
        }

        // An invite-only event lets these people in from now on.
        const addedEmails = members.map(m => m.person.email)
        if (p.config.access === 'allowlist') {
            const missing = addedEmails.filter(e => !p.config.allowlist.includes(e))
            if (missing.length) await db().run("UPDATE ev_portals SET config = ?, updated_at = datetime('now') WHERE id = ?", [JSON.stringify(cleanConfig({ ...p.config, allowlist: [...p.config.allowlist, ...missing] })), p.id])
        }
        const accounts = fresh.filter(x => users.has(x.email)).length
        await audit(user, 'import', 'event-portal', p.id, `${p.title}: ${members.length} participants added by admin (${created.filter(t => t.id).length} new ${solo ? 'entries' : 'teams'}, ${accounts} new accounts), ${skipped.length} rows skipped`)
        return {
            added: members.length, teams: created.filter(t => t.id).length, joined: joins.filter(j => j.person.user).length, accounts,
            addedEmails, noPassword: members.filter(m => m.person.user.password_hash === 'invited').map(m => m.person.email), skipped,
        }
    })

    /*
     * "You are registered" emails for people an admin added: their team, team code and the event link, and —
     * for anyone who has not set a password yet — a link to set one. emails: [...] or noPassword: true.
     */
    route('POST', '/api/admin/portals/:id/notify', async ({ req, user, params, body }) => {
        requireRole(user, 'editor')
        const p = await byId(params.id)
        if (!p) fail(404, 'Event not found.')
        const base = (await siteUrl()) || `https://${req.headers['x-forwarded-host'] || req.headers.host}`
        const wanted = Array.isArray(body.emails) ? new Set(body.emails.map(e => String(e).toLowerCase())) : null
        const rows = await db().all(`SELECT u.name, u.email, u.password_hash, t.name team, t.code FROM ev_members m JOIN users u ON u.id = m.user_id
            JOIN ev_teams t ON t.id = m.team_id WHERE m.portal_id = ?${body.noPassword ? " AND u.password_hash = 'invited'" : ''}`, [p.id])
        const solo = p.config.team.mode === 'solo'
        const recipients = rows.filter(r => !wanted || wanted.has(r.email.toLowerCase())).map(r => {
            const setup = r.password_hash === 'invited'
            return {
                email: r.email, vars: {
                    name: String(r.name).split(' ')[0], email: r.email, event: p.title, team: r.team, code: r.code, link: `${base}/e/${p.slug}`,
                    teamLine: solo ? '' : ` in team ${r.team} (team code ${r.code})`,
                    account: setup
                        ? `First time signing in? Set your password here — we will email a 6-digit code to ${r.email} to confirm it is you:\n${base}/login?mode=forgot&setup=1&email=${encodeURIComponent(r.email)}`
                        : `Sign in with your IEEE ITS VIT account (${r.email}).`,
                },
            }
        })
        if (!recipients.length) fail(400, body.noPassword ? 'Everyone in this event has already set a password.' : 'Nobody to email.')
        const draft = p.config.emails.added
        const queued = await createCampaign({ kind: 'event-added', label: `${p.title}: registration details (${recipients.length})`, subject: draft.subject, body: draft.body, recipients, user })
        await audit(user, 'email', 'event-portal', p.id, `Registration details queued for ${recipients.length} people`)
        return { queued: [queued] }
    })

    route('POST', '/api/admin/portals/:id/qualify', async ({ user, params, body }) => {
        requireRole(user, 'editor')
        const p = await byId(params.id)
        if (!p) fail(404, 'Event not found.')
        const round = clamp(body.round, 1, p.config.rounds.length - 1, 1)
        if (p.config.rounds.length < 2) fail(400, 'Add a second round first.')
        const ids = [...new Set((body.teamIds || []).map(Number).filter(Boolean))]
        await db().run('UPDATE ev_teams SET round = ? WHERE portal_id = ? AND round > ?', [round, p.id, round])
        for (const part of chunks(ids)) await db().run(`UPDATE ev_teams SET round = ? WHERE portal_id = ? AND id IN (${part.map(() => '?').join(',')})`, [round + 1, p.id, ...part])
        await audit(user, 'qualify', 'event-portal', p.id, `${ids.length} teams qualified for ${p.config.rounds[round]?.name}`)
        return { ok: true, qualified: ids.length }
    })

    route('POST', '/api/admin/portals/:id/ranks', async ({ user, params, body }) => {
        requireRole(user, 'editor')
        const p = await byId(params.id)
        if (!p) fail(404, 'Event not found.')
        await db().run('UPDATE ev_teams SET rank = NULL WHERE portal_id = ?', [p.id])
        const ranks = (body.ranks || []).filter(r => Number(r.teamId) && Number(r.rank) > 0).slice(0, 50)
        for (const r of ranks) await db().run('UPDATE ev_teams SET rank = ? WHERE id = ? AND portal_id = ?', [Math.round(Number(r.rank)), Number(r.teamId), p.id])
        await audit(user, 'rank', 'event-portal', p.id, `Winners set: ${ranks.length} teams`)
        return { ok: true }
    })

    /* Emails to an audience, using a draft from the portal settings. */
    route('POST', '/api/admin/portals/:id/email', async ({ user, params, body }) => {
        requireRole(user, 'editor')
        const p = await byId(params.id)
        if (!p) fail(404, 'Event not found.')
        const round = clamp(body.round, 1, p.config.rounds.length, p.current_round)
        const teams = await db().all('SELECT id, name, code, round, rank, submitted_at FROM ev_teams WHERE portal_id = ?', [p.id])
        const members = await db().all('SELECT m.team_id, u.name, u.email FROM ev_members m JOIN users u ON u.id = m.user_id WHERE m.portal_id = ?', [p.id])
        const pick = {
            all: () => true, submitted: t => !!t.submitted_at, not_submitted: t => !t.submitted_at,
            qualified: t => t.round >= round, not_qualified: t => t.round === round - 1, winners: t => t.rank != null,
        }[body.audience]
        if (!pick) fail(400, 'Choose who to email.')
        const link = `${await siteUrl()}/e/${p.slug}`
        const chosen = new Map(teams.filter(pick).map(t => [t.id, t]))
        const recipients = members.filter(m => chosen.has(m.team_id)).map(m => {
            const t = chosen.get(m.team_id)
            return { email: m.email, vars: { name: String(m.name).split(' ')[0], team: t.name, code: t.code, event: p.title, round: p.config.rounds[round - 1]?.name || `Round ${round}`, rank: t.rank ?? '', link } }
        })
        const draft = p.config.emails[body.template] || {}
        const subject = str(body.subject, 300) || draft.subject, text = str(body.body, 10_000) || draft.body
        const queued = await createCampaign({ kind: `event-${body.audience}`, label: `${p.title}: ${body.audience.replace('_', ' ')} (${recipients.length})`, subject, body: text, recipients, user })
        await audit(user, 'email', 'event-portal', p.id, `${body.audience} → ${recipients.length} people queued`)
        return { queued: [queued] }
    })

    /* The admin's browser draws each PDF and posts it here; it is emailed and never stored. */
    route('POST', '/api/admin/portals/:id/certificates/send', async ({ user, params, body }) => {
        requireRole(user, 'editor')
        const p = await byId(params.id)
        if (!p) fail(404, 'Event not found.')
        const m = await db().first('SELECT m.id, m.team_id, u.name, u.email FROM ev_members m JOIN users u ON u.id = m.user_id WHERE m.id = ? AND m.portal_id = ?', [Number(body.memberId), p.id])
        if (!m) fail(404, 'Participant not found.')
        const pdf = String(body.pdf || '')
        if (!/^[A-Za-z0-9+/=]+$/.test(pdf) || pdf.length > 1_500_000) fail(400, 'Certificate file is missing or too large (keep the template image under 1 MB).')
        const t = await db().first('SELECT name, rank FROM ev_teams WHERE id = ?', [m.team_id])
        const draft = t.rank && p.winners_published ? p.config.emails.winners : p.config.emails.participation
        const vars = { name: String(m.name).split(' ')[0], team: t.name, event: p.title, rank: t.rank ?? '', link: `${await siteUrl()}/e/${p.slug}` }
        const fill = s => String(s).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '')
        await sendDirect({ to: m.email, subject: fill(draft.subject), text: fill(draft.body), attachments: [{ filename: `${slugify(p.title)}-certificate.pdf`, content: Buffer.from(pdf, 'base64'), contentType: 'application/pdf' }] })
        await db().run("UPDATE ev_members SET cert_sent_at = datetime('now') WHERE id = ?", [m.id])
        return { ok: true }
    })

    /* ── standalone certificates (for events run outside the portal, recipients from an Excel sheet) ── */
    const readDesigns = async () => parseJson((await db().first("SELECT value FROM settings WHERE key = 'cert_templates'"))?.value, { items: [] })

    route('GET', '/api/admin/cert-templates', async ({ user }) => {
        requireRole(user, 'editor')
        return await readDesigns()
    })

    route('PUT', '/api/admin/cert-templates', async ({ user, body }) => {
        requireRole(user, 'editor')
        const before = await readDesigns()
        const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50).map((d, i) => ({ id: str(d.id, 40) || `d${Date.now().toString(36)}${i}`, name: str(d.name, 80) || `Design ${i + 1}`, template: cleanCert(d.template) }))
        await db().run("INSERT INTO settings (key, value, updated_at) VALUES ('cert_templates', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", [JSON.stringify({ items })])
        await audit(user, 'update', 'certificate-designs', '', `${items.length} design(s)`)
        await releaseImages(user, [...imageUrls(before.items)].filter(u => !imageUrls(items).has(u)))
        return { items }
    })

    route('POST', '/api/admin/certificates/send', async ({ user, body }) => {
        requireRole(user, 'editor')
        const to = str(body.to, 200).toLowerCase()
        if (!isEmail(to)) fail(400, `Invalid email "${str(body.to, 60)}".`)
        const pdf = String(body.pdf || '')
        if (!/^[A-Za-z0-9+/=]+$/.test(pdf) || pdf.length > 1_500_000) fail(400, 'Certificate file is missing or too large (keep the template image under 1 MB).')
        await sendDirect({ to, subject: str(body.subject, 300) || 'Your certificate', text: str(body.text, 10_000) || 'Your certificate is attached.',
            attachments: [{ filename: `${slugify(str(body.filename, 80) || 'certificate')}.pdf`, content: Buffer.from(pdf, 'base64'), contentType: 'application/pdf' }] })
        return { ok: true }
    })

    /* After the event: remove every registration, team, submission and score (export first). */
    route('POST', '/api/admin/portals/:id/purge', async ({ user, params, body }) => {
        requireRole(user, 'admin')
        const p = await byId(params.id)
        if (!p) fail(404, 'Event not found.')
        if (body.confirm !== p.slug) fail(400, `Type the event link name (${p.slug}) to confirm.`)
        const n = (await db().first('SELECT COUNT(*) n FROM ev_members WHERE portal_id = ?', [p.id])).n
        await db().run('DELETE FROM ev_scores WHERE portal_id = ?', [p.id])
        await db().run('DELETE FROM ev_members WHERE portal_id = ?', [p.id])
        await db().run('DELETE FROM ev_teams WHERE portal_id = ?', [p.id])
        if (body.deletePortal) {
            await db().run('DELETE FROM ev_portals WHERE id = ?', [p.id])
            await releaseImages(user, [...imageUrls(p.config.certificates, p.config.banner)])
        } else {
            const config = { ...p.config, allowlist: [], evaluators: [] }
            await db().run("UPDATE ev_portals SET status = 'archived', config = ?, scores_published = 0, winners_published = 0, updated_at = datetime('now') WHERE id = ?", [JSON.stringify(config), p.id])
        }
        await audit(user, 'purge', 'event-portal', p.id, `${p.title}: removed ${n} participants and all teams/scores${body.deletePortal ? '; portal deleted' : ''}`)
        return { ok: true, removed: n }
    })
}
