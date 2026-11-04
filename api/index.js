/**
 * Single Vercel serverless function serving every /api/* route
 * (vercel.json rewrites /api/<path> → /api?__path=<path>). One function keeps
 * the project well inside the Hobby plan's function limit.
 */
import { handle } from '../server/router.js'

export default async function handler(req, res) {
    const url = new URL(req.url, 'http://local')
    const p = url.searchParams.get('__path')
    return handle(req, res, p ? `/api/${p}` : undefined)
}
