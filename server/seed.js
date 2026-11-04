import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { getDb, usingD1 } from './db.js'
import { hashPassword } from './auth.js'
import { DEFAULT_SETTINGS, DEFAULT_PRIVATE_SETTINGS, DEFAULT_CONTENT, DEFAULT_EVENTS, DEFAULT_MOMENTS } from '../shared/defaults.js'

const SCHEMA_FILE = fileURLToPath(new URL('./schema.sql', import.meta.url))

export function schemaSql() {
    return fs.readFileSync(SCHEMA_FILE, 'utf8')
        .split('\n').map(l => l.replace(/--.*$/, '')).filter(l => l.trim()).join('\n')
}

export async function applySchema() {
    const db = getDb()
    const statements = schemaSql().split(';').map(s => s.trim()).filter(Boolean)
    if (usingD1()) {
        for (const s of statements) await db.exec(s)
    } else {
        await db.exec(statements.join(';\n') + ';')
    }
}

/** Inserts default content only where nothing exists yet — never overwrites admin edits. */
export async function seedDefaults({ log = () => {} } = {}) {
    const db = getDb()

    for (const [key, value] of Object.entries({ ...DEFAULT_SETTINGS, ...DEFAULT_PRIVATE_SETTINGS })) {
        const r = await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)])
        if (r.changes) log(`settings.${key}`)
    }

    for (const [type, items] of Object.entries(DEFAULT_CONTENT)) {
        const existing = await db.first('SELECT COUNT(*) AS n FROM content WHERE type = ?', [type])
        if (existing.n > 0) continue
        let i = 0
        for (const data of items) await db.run('INSERT INTO content (type, data, sort_order) VALUES (?, ?, ?)', [type, JSON.stringify(data), i++])
        log(`content.${type} (${items.length})`)
    }

    const eventCount = await db.first('SELECT COUNT(*) AS n FROM events')
    if (eventCount.n === 0) {
        for (const e of DEFAULT_EVENTS) {
            await db.run(
                `INSERT INTO events (slug, title, tag, summary, body_html, start_date, end_date, date_label, time_text, venue,
                  poster_url, registration_url, cta_label, extra, featured, show_in_timeline)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [e.slug, e.title, e.tag, e.summary, e.body_html, e.start_date, e.end_date, e.date_label, e.time_text, e.venue,
                    e.poster_url, e.registration_url, e.cta_label, JSON.stringify(e.extra), e.featured, e.show_in_timeline]
            )
        }
        log(`events (${DEFAULT_EVENTS.length})`)
    }

    const momentCount = await db.first('SELECT COUNT(*) AS n FROM moments')
    if (momentCount.n === 0) {
        const ids = Object.fromEntries((await db.all('SELECT id, slug FROM events')).map(r => [r.slug, r.id]))
        let i = 0
        for (const m of DEFAULT_MOMENTS) {
            await db.run(
                'INSERT INTO moments (event_id, title, album_date, photos, show_on_home, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
                [ids[m.event_slug] || null, m.title, m.album_date || null, JSON.stringify(m.photos), m.show_on_home || 0, i++]
            )
        }
        log(`moments (${DEFAULT_MOMENTS.length})`)
    }
}

/**
 * Makes sure at least one admin exists.
 * Uses ADMIN_EMAIL / ADMIN_PASSWORD when set; otherwise (local dev only) generates
 * a random password and writes it to .data/ADMIN_CREDENTIALS.txt.
 */
export async function ensureAdmin({ log = () => {} } = {}) {
    const db = getDb()
    const admin = await db.first("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    if (admin) return
    let email = process.env.ADMIN_EMAIL
    let password = process.env.ADMIN_PASSWORD
    let generated = false
    if (!email || !password) {
        if (process.env.VERCEL) return
        email = email || 'admin@ieeeits.local'
        password = `Its-${crypto.randomBytes(9).toString('base64url')}9`
        generated = true
    }
    await db.run(
        "INSERT INTO users (name, email, password_hash, role, member_type) VALUES (?, ?, ?, 'admin', 'Administrator')",
        ['Site Admin', email.toLowerCase(), await hashPassword(password)]
    )
    if (generated) {
        const file = path.resolve(process.cwd(), '.data/ADMIN_CREDENTIALS.txt')
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, `Local development admin (change the password after first login)\nemail: ${email}\npassword: ${password}\n`)
        log(`admin user created — credentials written to ${path.relative(process.cwd(), file)}`)
    } else {
        log(`admin user created for ${email}`)
    }
}

let ready = null
/** Lazily initialises the local SQLite database on first request (D1 is set up with `npm run db:setup -- --remote`). */
export function ensureReady() {
    if (usingD1()) return Promise.resolve()
    if (!ready) {
        ready = (async () => {
            await applySchema()
            await seedDefaults({ log: m => console.log(`[seed] ${m}`) })
            await ensureAdmin({ log: m => console.log(`[seed] ${m}`) })
        })().catch(e => { ready = null; throw e })
    }
    return ready
}
