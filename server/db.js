/**
 * Database adapter.
 *
 *  • Production (Vercel): Cloudflare D1, reached either
 *      – through the D1 gateway Worker (workers/d1-gateway): D1_GATEWAY_URL + D1_GATEWAY_SECRET, or
 *      – through Cloudflare's D1 HTTP API: CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN (D1:Edit).
 *  • Local development: a SQLite file via Node's built-in `node:sqlite`
 *    (same SQL dialect as D1), stored at .data/ieeeits-cms.db.
 *
 * Both expose the same tiny interface: all / first / run / exec.
 */
import fs from 'fs'
import path from 'path'

const D1_ENV = ['CF_ACCOUNT_ID', 'CF_D1_DATABASE_ID', 'CF_API_TOKEN']
const GATEWAY_ENV = ['D1_GATEWAY_URL', 'D1_GATEWAY_SECRET']

const usingGateway = () => GATEWAY_ENV.every(k => !!process.env[k])
export const usingD1 = () => usingGateway() || D1_ENV.every(k => !!process.env[k])

const normalise = params => (params || []).map(v => {
    if (v === undefined) return null
    if (typeof v === 'boolean') return v ? 1 : 0
    if (v !== null && typeof v === 'object') return JSON.stringify(v)
    return v
})

/* ───────────── Cloudflare D1 (HTTP) ───────────── */
async function d1Query(sql, params = []) {
    const { CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN, D1_GATEWAY_URL, D1_GATEWAY_SECRET } = process.env
    const [url, token] = usingGateway()
        ? [D1_GATEWAY_URL, D1_GATEWAY_SECRET]
        : [`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`, CF_API_TOKEN]
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(params.length ? { sql, params: normalise(params) } : { sql }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body.success === false) {
        const msg = body.errors?.map(e => e.message).join('; ') || `D1 HTTP ${res.status}`
        throw new Error(msg)
    }
    return body.result || []
}

const d1 = {
    async all(sql, params) {
        const [r] = await d1Query(sql, params)
        return r?.results || []
    },
    async first(sql, params) {
        return (await this.all(sql, params))[0] || null
    },
    async run(sql, params) {
        const [r] = await d1Query(sql, params)
        return { changes: r?.meta?.changes || 0, lastId: r?.meta?.last_row_id || null }
    },
    async exec(sql) {
        await d1Query(sql)
    },
}

/* ───────────── Local SQLite ───────────── */
let localDb = null
async function getLocal() {
    if (localDb) return localDb
    const { DatabaseSync } = await import('node:sqlite')
    const file = process.env.LOCAL_DB_FILE || path.resolve(process.cwd(), '.data/ieeeits-cms.db')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    localDb = new DatabaseSync(file)
    localDb.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
    return localDb
}

const local = {
    async all(sql, params) {
        return (await getLocal()).prepare(sql).all(...normalise(params)).map(r => ({ ...r }))
    },
    async first(sql, params) {
        const row = (await getLocal()).prepare(sql).get(...normalise(params))
        return row ? { ...row } : null
    },
    async run(sql, params) {
        const r = (await getLocal()).prepare(sql).run(...normalise(params))
        return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) }
    },
    async exec(sql) {
        (await getLocal()).exec(sql)
    },
}

export function getDb() {
    if (usingD1()) return d1
    if (process.env.VERCEL) {
        throw Object.assign(new Error('Database not configured: set D1_GATEWAY_URL and D1_GATEWAY_SECRET (or the CF_* D1 API variables) in Vercel.'), { status: 503 })
    }
    return local
}

export const parseJson = (v, fallback) => {
    if (v == null || v === '') return fallback
    if (typeof v !== 'string') return v
    try { return JSON.parse(v) } catch { return fallback }
}
