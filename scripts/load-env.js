import fs from 'fs'
import path from 'path'

/** Loads .env and .env.local into process.env (without overriding real env vars). */
export function loadEnv() {
    for (const name of ['.env', '.env.local']) {
        const file = path.resolve(process.cwd(), name)
        if (!fs.existsSync(file)) continue
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
            if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
        }
    }
}
