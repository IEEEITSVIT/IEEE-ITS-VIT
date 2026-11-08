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

## Recruitment & event portals

- **Recruitment** (Admin → Recruitment): hidden until switched on; then a *Recruitments* button appears next to Login / Sign up.
  Only `@vitstudent.ac.in` accounts with a registration number and mobile number can apply, to one or more domains.
  Domains have deadlines, optional timed tests (multiple choice is auto-scored, written answers are scored by the admin,
  tab switches are logged) and an optional external proctored-exam link. Admins filter by score, shortlist for interview,
  select (also directly, without a test — logged in the audit log), email results with each domain's WhatsApp link,
  send reminders, and download the master data as Excel.
- **Event portals** (Admin → Event Portals): any number of events at `/e/<link>`. Open link or email allowlist, solo or
  team entries (join codes), per-round link submissions with deadlines, evaluators (by email) scoring against criteria,
  qualification, published scores, winners, templated emails, certificates and a full Excel export. *Delete data* removes
  every registration after the event.
- **Certificates** are drawn in the browser (pdf-lib) from the admin's template: participants download their own, admins
  download ZIPs or one combined PDF, or email them as attachments. Nothing is stored on the server.
- **Email Outbox**: bulk email is queued and sent in batches within a daily limit (default 400 — Gmail allows ~500/day).
  It sends while the Outbox page is open and once a day via the Vercel cron in `vercel.json`; set `CRON_SECRET`
  in Vercel for the cron to run.
- **Free tier**: during big registration rushes the Cloudflare API allows ~1,200 database requests per 5 minutes.
  Deploying the gateway Worker in `workers/d1-gateway` (free: 100k requests/day) and setting `D1_GATEWAY_URL`
  + `D1_GATEWAY_SECRET` removes that ceiling.
