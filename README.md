# IEEE ITS – VIT Chapter website

React + Vite site with a full admin CMS. Every piece of content (text, photos, events,
popups, banners, links, theme colours and fonts) lives in **Cloudflare D1** and is edited
at **`/admin`**; images are stored on **ImageKit**. Hosted on **Vercel**.

## Run locally

```bash
npm install
cp .env.example .env.local     # set SESSION_SECRET at minimum
npm run dev                    # http://localhost:5173  (site + API + admin)
```

Without Cloudflare keys the API uses a local SQLite file (`.data/ieeeits-cms.db`), created
and seeded automatically on first request. A local admin account is generated and written to
`.data/ADMIN_CREDENTIALS.txt` (or set `ADMIN_EMAIL` / `ADMIN_PASSWORD` before first run).

## Architecture

| Part | Where |
| --- | --- |
| Public site | `src/pages`, `src/components`, styles in `src/styles/site.css` (flat theme; colours/fonts overridden from the DB) |
| Admin dashboard | `src/admin` (lazy-loaded at `/admin`) |
| API | `server/router.js`, served by one Vercel function (`api/index.js`) and by the Vite dev server |
| Database | `server/schema.sql` — users, settings, content, events, moments, media, orders, queries, subscribers, email/audit logs |
| CMS field definitions | `shared/cms.js` (drives admin forms and server validation) |
| Seed content | `shared/defaults.js` (used only to seed an empty database) |

Key behaviours:
- **Events drive the timeline.** Order and Upcoming / Live / Past badges come from each event's date; photo albums linked to an event move with it.
- **Login is database-based** (scrypt-hashed passwords, signed HttpOnly session cookies, login throttling). Roles: member, editor, admin.
- **Orders and queries** are stored in D1 and emailed via SMTP to recipients set in Admin → Email & SMTP.
- **SEO**: per-page titles/descriptions, Open Graph, JSON-LD (Organization, Event, FAQ, BlogPosting), dynamic `/sitemap.xml` and `/robots.txt`.

## Deploy (Vercel + Cloudflare D1 + ImageKit)

1. **D1**: create a database (Cloudflare → Storage & Databases → D1 → Create, or `npx wrangler d1 create ieee-its`). Create an API token with **Account → D1 → Edit**.
2. **ImageKit**: Dashboard → Developer options → copy the public key, private key and URL endpoint.
3. Put everything in `.env.local` (see `.env.example`), then:
   ```bash
   npm run db:setup -- --remote        # schema + seed + first admin on D1
   npm run media:migrate -- --remote   # upload /public images to ImageKit and rewrite DB URLs
   ```
4. In **Vercel → Settings → Environment Variables** add `SESSION_SECRET`, `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_API_TOKEN`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, then redeploy.
5. Sign in at `/admin`, set SMTP + notification recipients under **Email & SMTP**, and send a test email.

## Team portraits

`scripts/portraits/` makes every portrait consistent (same backdrop, framing and tone).
See its README for usage and the photo brief to share with members.
