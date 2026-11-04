/**
 * Creates the schema, seeds default content and ensures an admin account.
 *
 *   npm run db:setup                 → local SQLite (.data/ieeeits-cms.db)
 *   npm run db:setup -- --remote     → Cloudflare D1 (needs CF_* vars in .env.local)
 *
 * Optional: ADMIN_EMAIL / ADMIN_PASSWORD to choose the first admin's credentials.
 */
import { loadEnv } from './load-env.js'

loadEnv()
const remote = process.argv.includes('--remote')
if (!remote) for (const k of ['CF_ACCOUNT_ID', 'CF_D1_DATABASE_ID', 'CF_API_TOKEN', 'D1_GATEWAY_URL', 'D1_GATEWAY_SECRET']) delete process.env[k]

const { usingD1 } = await import('../server/db.js')
const { applySchema, seedDefaults, ensureAdmin } = await import('../server/seed.js')

if (remote && !usingD1()) {
    console.error('✖ --remote needs D1_GATEWAY_URL + D1_GATEWAY_SECRET, or CF_ACCOUNT_ID + CF_D1_DATABASE_ID + CF_API_TOKEN (see .env.example).')
    process.exit(1)
}
console.log(`→ Target: ${usingD1() ? 'Cloudflare D1' : 'local SQLite'}`)
await applySchema()
console.log('✓ schema applied')
await seedDefaults({ log: m => console.log(`✓ seeded ${m}`) })
await ensureAdmin({ log: m => console.log(`✓ ${m}`) })
console.log('Done.')
