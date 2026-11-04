/**
 * Moves every image the database references (from /public or hotlinked from other sites) into ImageKit and rewrites the URLs,
 * so all site media is served from ImageKit storage/CDN.
 *
 *   npm run media:migrate              → local SQLite
 *   npm run media:migrate -- --remote  → Cloudflare D1
 *
 * Needs IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT in .env.local.
 * Safe to re-run: already-uploaded paths are reused from the media table.
 */
import fs from 'fs'
import path from 'path'
import { loadEnv } from './load-env.js'

loadEnv()
if (!process.argv.includes('--remote')) for (const k of ['CF_ACCOUNT_ID', 'CF_D1_DATABASE_ID', 'CF_API_TOKEN', 'D1_GATEWAY_URL', 'D1_GATEWAY_SECRET']) delete process.env[k]
const { getDb } = await import('../server/db.js')
const { imagekitConfigured } = await import('../server/imagekit.js')
if (!imagekitConfigured()) { console.error('✖ Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT first.'); process.exit(1) }

const db = getDb()
const PUBLIC = path.resolve('public')
const FOLDER = process.env.IMAGEKIT_FOLDER || '/ieee-its'
const LOCAL = /^\/[^"'\s]+\.(?:jpe?g|png|webp|gif|svg|avif)$/i
// External images (hotlinked from other sites) are copied into ImageKit too; ImageKit fetches them by URL.
const EXTERNAL = /^https?:\/\/(?!ik\.imagekit\.io)[^"'\s]+\.(?:jpe?g|png|webp|gif|svg|avif)(?:\?[^"'\s]*)?$/i
const auth = `Basic ${Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64')}`
const cache = new Map((await db.all("SELECT name, url FROM media WHERE folder LIKE 'migrated:%'")).map(r => [r.name, r.url]))

async function upload(localPath) {
    if (cache.has(localPath)) return cache.get(localPath)
    const form = new FormData()
    if (EXTERNAL.test(localPath)) {
        const u = new URL(localPath)
        form.append('file', localPath)
        form.append('fileName', path.basename(u.pathname).replace(/[^\w.-]+/g, '-'))
        form.append('folder', `${FOLDER}/external/${u.hostname.replace(/[^\w-]+/g, '-')}${path.dirname(u.pathname)}`)
    } else {
        const file = path.join(PUBLIC, decodeURIComponent(localPath))
        if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) { console.warn(`  ! missing ${localPath}`); return null }
        form.append('file', new Blob([fs.readFileSync(file)]), path.basename(file))
        form.append('fileName', path.basename(file).replace(/[^\w.-]+/g, '-'))
        form.append('folder', `${FOLDER}${path.dirname(localPath) === '/' ? '' : path.dirname(localPath)}`)
    }
    form.append('useUniqueFileName', 'false')
    const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', headers: { Authorization: auth }, body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(`${localPath}: ${data.message || res.status}`)
    await db.run('INSERT INTO media (url, file_id, name, folder, mime, size, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [data.url, data.fileId, localPath, `migrated:${FOLDER}`, data.fileType || '', data.size || 0, data.width || 0, data.height || 0])
    cache.set(localPath, data.url)
    console.log(`  ↑ ${localPath} → ${data.url}`)
    return data.url
}

async function rewrite(value) {
    if (typeof value === 'string') return LOCAL.test(value) || EXTERNAL.test(value) ? (await upload(value)) || value : value
    if (Array.isArray(value)) { const out = []; for (const v of value) out.push(await rewrite(v)); return out }
    if (value && typeof value === 'object') { const out = {}; for (const [k, v] of Object.entries(value)) out[k] = await rewrite(v); return out }
    return value
}

let changed = 0
const jsonRows = [
    ['settings', 'key', 'value', await db.all('SELECT key, value FROM settings')],
    ['content', 'id', 'data', await db.all('SELECT id, data FROM content')],
    ['moments', 'id', 'photos', await db.all('SELECT id, photos FROM moments')],
    ['events', 'id', 'extra', await db.all('SELECT id, extra FROM events')],
]
for (const [table, pk, col, rows] of jsonRows) {
    for (const row of rows) {
        const before = row[col]
        const after = JSON.stringify(await rewrite(JSON.parse(before)))
        if (after !== before) { await db.run(`UPDATE ${table} SET ${col} = ? WHERE ${pk} = ?`, [after, row[pk]]); changed++ }
    }
}
for (const e of await db.all('SELECT id, poster_url FROM events')) {
    const url = await rewrite(e.poster_url)
    if (url !== e.poster_url) { await db.run('UPDATE events SET poster_url = ? WHERE id = ?', [url, e.id]); changed++ }
}
console.log(`✓ Done — ${cache.size} files on ImageKit, ${changed} records updated.`)
