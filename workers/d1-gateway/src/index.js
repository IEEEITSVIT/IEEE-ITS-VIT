/**
 * D1 gateway Worker.
 * POST / with header `Authorization: Bearer <GATEWAY_SECRET>` and JSON { sql, params? }.
 * Responds in the same shape as Cloudflare's D1 HTTP query API so server/db.js can use either.
 */
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

export default {
    async fetch(request, env) {
        if (request.method !== 'POST') return json({ success: false, errors: [{ message: 'Method not allowed' }] }, 405)
        const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
        if (!env.GATEWAY_SECRET || env.GATEWAY_SECRET.length < 32 || !safeEqual(token, env.GATEWAY_SECRET)) {
            return json({ success: false, errors: [{ message: 'Unauthorized' }] }, 401)
        }
        let body
        try { body = await request.json() } catch { return json({ success: false, errors: [{ message: 'Invalid JSON' }] }, 400) }
        const { sql, params } = body || {}
        if (typeof sql !== 'string' || !sql.trim()) return json({ success: false, errors: [{ message: 'sql is required' }] }, 400)
        try {
            if (Array.isArray(params) && params.length) {
                const r = await env.DB.prepare(sql).bind(...params).all()
                return json({ success: true, result: [{ results: r.results || [], meta: r.meta || {} }] })
            }
            // Parameterless: may contain several statements (schema setup).
            if (sql.trim().replace(/;\s*$/, '').includes(';')) {
                await env.DB.exec(sql.replace(/\n/g, ' '))
                return json({ success: true, result: [{ results: [], meta: {} }] })
            }
            const r = await env.DB.prepare(sql).all()
            return json({ success: true, result: [{ results: r.results || [], meta: r.meta || {} }] })
        } catch (e) {
            return json({ success: false, errors: [{ message: e.message }] }, 400)
        }
    },
}
