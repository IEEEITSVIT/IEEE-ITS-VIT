# IEEE ITS – VIT Chapter website

The website of the **IEEE Information Theory Society student chapter at VIT Vellore**, with a full admin
studio behind it. Every piece of content — text, photos, events, popups, banners, links, theme, layout and
SEO — is edited at **`/admin`**, and the site also runs the chapter's **recruitment**, **event registrations**
(hackathons, competitions), **judging**, **certificates** and **bulk email**.

- **Live:** https://ieee-its-vit.vercel.app
- **Stack:** React 19 + Vite · one Node API function on **Vercel** · **Cloudflare D1** (SQLite) database ·
  **ImageKit** for images · SMTP (Gmail) for email. Everything runs on the free tiers.

---

## Contents

1. [Features](#features)
2. [Run locally](#run-locally)
3. [Configuration (environment variables)](#configuration)
4. [Deploy](#deploy)
5. [Admin guide](#admin-guide)
6. [Email: two SMTP accounts, limits and the Outbox](#email)
7. [Free-tier limits](#free-tier-limits)
8. [Project structure](#project-structure)
9. [Security](#security)
10. [Troubleshooting](#troubleshooting)

---

## Features

### Public site
- Home (hero, upcoming event with countdown, spotlight banners, about, domains, recent events, gallery, board),
  events timeline and event pages, photo albums (Moments), blogs, vlogs, faculty, web team, merch booking,
  mini-games, FAQ, contact form, suggestions, member accounts.
- Optimised for phones (iPhone and Android): no sideways scrolling, 16 px form fields, safe areas, home-screen icon.
- SEO: per-page titles and descriptions, Open Graph/Twitter cards, JSON-LD (Organization, WebSite, Event, FAQ,
  BlogPosting), dynamic `/sitemap.xml` and `/robots.txt`, Google Search Console verification.
- Accounts are database-based (no Google sign-in): register, sign in, profile (registration number, mobile),
  **password reset by a 6-digit code or a one-click link** sent by email.

### Admin studio (`/admin`)
- **Content:** every section of every page, board/faculty/web team, events, albums, blogs, merch, FAQs, popups,
  banners, announcement bar, navigation and footer links, SEO.
- **Design & Layout:** per-section fonts, sizes, colours, alignment, picture side, columns, spacing, picture
  shape; drag home sections into order; click any part of the live preview to select it.
- **Preview before applying:** every editor shows the real site with your unsaved changes (desktop/tablet/phone).
- **Photos:** upload to ImageKit; crop/zoom/fit any image (applied wherever it is used); unused images are
  deleted from ImageKit automatically.
- **Inbox:** merch orders, queries, suggestions, subscribers; email notifications to chosen recipients.
- **Users & roles** (member, editor, admin) and a full **audit log** of admin actions.

### Recruitment portal
- Hidden until an admin opens it; then a **Recruitments** button appears next to Login / Sign up.
- Only **@vitstudent.ac.in** accounts with a registration number and mobile number can apply — to one or more
  domains. Each domain has an application deadline and can be closed at any time.
- Optional **timed test** per domain (multiple choice auto-scored; written answers scored by the admin), run full
  screen with autosave; leaving the tab/full screen is recorded. Optional **external proctored exam link** with
  its own deadline.
- Admin: **edit any candidate** — name, email, registration number, phone, which domains they are in and the status in each.
- Admin: filter by domain/status/score, pick the top N, **mark for interview**, **select** (one person can be
  selected for several domains), **add and select directly without a test**, or **import a manually made
  selection list from Excel** (optionally as the final list for those domains). Everything is in the audit log.
- **Result emails:** selected candidates get their domains and each domain's **WhatsApp group link**; people
  marked *Not selected* get a kind thank-you note (undecided applicants are skipped). **Reminders** to one domain,
  some statuses, or everyone.
- **Master data** download as Excel (name, email, reg no, mobile, domains, status, scores).

### Event portals (any number of events, at `/e/<event-link>`)
- Registration by **open link** or an **email allowlist**; optional VIT-students-only.
- **Solo or team** events (min/max size). Team leads get a **join code**; **team names are unique within an event**.
- Up to 6 **submission link fields**, per-round **deadlines**, up to 5 rounds.
- **Evaluators** (by email) get a judging panel and score against your criteria; scores are averaged.
- Qualify the **top N** for the next round, **publish scores** (each team sees its own), announce the
  **top 1–N winners** on the event page.
- **Emails** to everyone / submitted / not submitted / qualified / not qualified / winners, from editable drafts.
- **Excel export** of everything (participants with contacts, teams and links, every judge's scores, results per
  round, qualifiers, winners), then **Delete data** to purge the event.

### Projects & Resources (`/projects`)
- **Projects:** each opens a short write-up with an **architecture diagram**, the **GitHub** link, a live link, tech
  stack and status (Admin → Publications → Projects).
- **Resources:** study material such as a **DSA guide** — upload the document (PDF, Word, PowerPoint, Excel, text,
  ZIP; stored on ImageKit). Each opens a page with its description and the document shown inline (PDF and Office files),
  plus open-in-new-tab and download (Admin → Publications → Resources).
- **Advisory Board** (`/advisory-board`, More menu): past boards and web teams by year, managed in Admin → People.

### Certificates
- Design templates by **dragging text onto the certificate image** (snaps to the centre, arrow keys nudge) with
  **10 fonts** (Helvetica, Times, Courier, Great Vibes, Dancing Script, Playfair Display, Cinzel, Montserrat,
  Poppins, Lora), size, colour, alignment, bold/italic. Text can include `{{name}}`, `{{team}}`, `{{rank}}`,
  `{{event}}` or any Excel column.
- For event portals (participants and winners) **and** for any list uploaded from **Excel/CSV** (events run
  outside the portal) — Admin → Certificates.
- Participants download their own; admins download a **ZIP** or **one combined PDF**, or **email** each person
  theirs. PDFs are made in the browser and **never stored on the server**.

---

## Run locally

Requires **Node.js 22+**.

```bash
npm install
cp .env.example .env.local     # set SESSION_SECRET at minimum
npm run dev                    # http://localhost:5173  (site + API + admin)
```

Without Cloudflare keys the API uses a local SQLite file (`.data/ieeeits-cms.db`), created and seeded on the first
request. A local admin account is created and written to `.data/ADMIN_CREDENTIALS.txt` (or set `ADMIN_EMAIL` /
`ADMIN_PASSWORD` before the first run).

> **Careful:** if `.env.local` contains the Cloudflare D1 keys, `npm run dev` talks to the **live database**.
> Remove them (or run with `CF_ACCOUNT_ID= CF_API_TOKEN= CF_D1_DATABASE_ID=`) to work on local data.

| Command | What it does |
| --- | --- |
| `npm run dev` | Site, API and admin with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint |
| `npm run db:setup` | Create tables, seed defaults, ensure an admin (local SQLite) |
| `npm run db:setup -- --remote` | The same on Cloudflare D1 (safe to re-run; never overwrites content) |
| `npm run media:migrate -- --remote` | Upload images in `public/` to ImageKit and update the database |

---

## Configuration

Set these in `.env.local` for local use and in **Vercel → Settings → Environment Variables** for the live site
(see `.env.example`). Redeploy after changing Vercel variables.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | yes | 32+ random characters; signs login sessions and encrypts stored SMTP passwords. Keep it the same everywhere. |
| `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_API_TOKEN` | yes* | Cloudflare D1 over the HTTP API (token permission: Account → D1 → Edit). |
| `D1_GATEWAY_URL`, `D1_GATEWAY_SECRET` | optional* | Use the gateway Worker instead of the HTTP API (recommended for large events, see below). |
| `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, `IMAGEKIT_FOLDER` | yes | Image uploads and delivery. |
| `CRON_SECRET` | recommended | Lets the daily Vercel cron continue large email mail-outs. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | optional | First admin created by `db:setup` when none exists. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | optional | Override the **main** SMTP set in the admin. |
| `SMTP_AUTH_HOST`, `SMTP_AUTH_PORT`, `SMTP_AUTH_SECURE`, `SMTP_AUTH_USER`, `SMTP_AUTH_PASS` | optional | Override the **account-email** SMTP set in the admin. |

\* either the D1 HTTP API keys or the gateway pair.

---

## Deploy

1. **Database (D1):** Cloudflare → Storage & Databases → D1 → Create (or `npx wrangler d1 create ieee-its`), and an
   API token with *Account → D1 → Edit*.
2. **Images (ImageKit):** Dashboard → Developer options → public key, private key, URL endpoint.
3. Put the keys in `.env.local`, then:
   ```bash
   npm run db:setup -- --remote        # tables + default content + first admin on D1
   npm run media:migrate -- --remote   # images in public/ → ImageKit
   ```
4. **Vercel:** import the GitHub repository, add the environment variables above, deploy. `vercel.json` routes
   `/api/*` to one serverless function, serves the SPA, and schedules the daily email cron (`/api/cron/outbox`, 09:00 IST).
5. Sign in at **`/admin`** → **Email & SMTP**: set the main SMTP and the account-email SMTP, notification recipients,
   and send a test email from each.
6. Optional: verify the site in Google Search Console and submit `https://<your-domain>/sitemap.xml`.

Database changes ship as idempotent statements in `server/schema.sql`; after pulling new features run
`npm run db:setup -- --remote` once (it only adds what is missing).

---

## Admin guide

| I want to… | Go to |
| --- | --- |
| Change text, photos, events, board, popups | The matching item in the sidebar (each editor has a **Preview**) |
| Restyle or reorder sections | **Design & Layout** → click a section in the preview → adjust → **Apply changes** |
| Crop a photo | Any image field → **Adjust** |
| Open recruitment | **Recruitment → Settings → Recruitments open** |
| Add domains, deadlines, tests, WhatsApp links | **Recruitment → Domains & tests** |
| Shortlist / select candidates | **Recruitment → Applicants** (filters, *Pick top N*, bulk buttons) |
| Upload an offline selection list | **Recruitment → Import Excel** (template downloadable there) |
| Fix a candidate's name, email, reg no or phone, or change their domains | **Recruitment → Applicants** → click the name (**Edit**) |
| Send results / reminders | **Recruitment → Emails** (wording in **Recruitment Emails**) |
| Run a hackathon | **Event Portals → New event portal** → Setup → status *Open* → share `/e/<link>` |
| Judge | Add evaluator emails in the portal's Setup; they open `/e/<link>/judge` |
| Announce results | Portal → **Judging & results** (qualify, publish scores, winners) |
| Certificates | Portal → **Certificates**, or **Certificates** for an Excel list |
| Add a project or a study resource | **Projects** / **Resources** (upload the diagram or the document there) |
| Past boards by year | **Advisory Board** |
| Export and clean up after an event | Portal → **Export & clean-up** |
| Watch email sending | **Email Outbox** |

Text placeholders in emails: recruitment `{{name}} {{domains}} {{whatsapp}} {{domain}} {{deadline}} {{exam}}`;
events `{{name}} {{team}} {{event}} {{round}} {{rank}} {{code}} {{link}}`; certificate lists also accept any
Excel column (`College` → `{{college}}`).

---

<a id="email"></a>
## Email: two SMTP accounts, limits and the Outbox

**Admin → Email & SMTP** has two accounts:

| Account | Sends |
| --- | --- |
| **Main SMTP** | order/query notifications and confirmations, recruitment results and reminders, event emails, certificates (everything in the Email Outbox) |
| **Account emails SMTP** | password-reset codes and links only |

Keeping account emails on their own mailbox means a big mail-out can never use up the daily allowance that reset
codes need. Both can point to the same mailbox (use **Copy main SMTP settings**) and be changed independently later;
if the account-email SMTP is empty, the main one is used.

- **Gmail:** use an **App Password** (Google Account → Security → 2-Step Verification → App passwords). A free Gmail
  account sends about **500 emails/day**; Google Workspace about 2,000.
- **Email Outbox:** bulk mail is queued as one *mail-out* and sent in batches within a **daily limit** (default 400,
  adjustable). It sends while the Outbox page is open and once a day via the Vercel cron (needs `CRON_SECRET`); a
  1,500-person mail-out finishes over about four days on free Gmail. Failed addresses can be retried.
- Certificate emails count towards the same daily limit; sending stops cleanly at the limit and continues where it
  left off the next day.

---

## Free-tier limits

| Service | Free allowance | What it means here |
| --- | --- | --- |
| Vercel Hobby | 100 GB bandwidth/month, 60 s functions, daily cron | Plenty for the site and portals |
| Cloudflare D1 | 5 GB, 5 M reads/day, 100 k writes/day | 1,000–1,500 participants per event is comfortable |
| Cloudflare API (D1 over HTTP) | ~1,200 requests / 5 min | Only a concern in a registration rush — deploy `workers/d1-gateway` (Workers free plan, 100 k requests/day) and set `D1_GATEWAY_URL` + `D1_GATEWAY_SECRET` |
| ImageKit | 20 GB bandwidth/month | Images are resized and cached; certificates are not stored |
| Gmail SMTP | ~500 emails/day per account | Handled by the Outbox daily limit; use a second mailbox for account emails |

---

## Project structure

| Part | Where |
| --- | --- |
| Public pages and components | `src/pages`, `src/components`, styles in `src/styles/site.css` |
| Admin studio | `src/admin` (lazy-loaded at `/admin`) |
| Browser helpers | `src/lib` — API client, Excel read/write (`sheet.js`, `xlsx.js`), certificates (`certificate.js`, `certFonts.js`) |
| API | `server/router.js` (+ `recruit.js`, `portals.js`, `campaigns.js`, `mailer.js`, `auth.js`), served by `api/index.js` on Vercel and by the Vite dev server locally |
| Database schema | `server/schema.sql` (idempotent) |
| Shared definitions | `shared/cms.js` (admin forms + validation), `shared/layout.js` (design system), `shared/defaults.js` (seed content) |
| Scripts | `scripts/` — database setup, ImageKit migration, portrait processing |
| D1 gateway Worker | `workers/d1-gateway` |

---

## Security

- Passwords hashed with scrypt; sessions are signed HttpOnly cookies that can be revoked (password change, role change).
- Sign-in and reset requests are rate-limited; reset codes are 6 digits, hashed, single-use, expire in 10 minutes and
  lock after 5 wrong tries; responses never reveal whether an account exists.
- State-changing API calls require a custom header (CSRF protection); admin-written HTML is sanitised.
- SMTP passwords are stored **encrypted** (AES-256-GCM, key derived from `SESSION_SECRET`) and never sent to the browser.
- Secrets live only in environment variables and git-ignored files (`.env.local`, `.env.vercel`, `.data/`) — never commit them.
- Every admin action (content, selections, imports, emails, purges) is recorded in the audit log.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Password reset by email is not available" | Set the main or account-email SMTP in Admin → Email & SMTP and send a test. |
| Bulk emails stop | Daily limit reached — they continue tomorrow (Outbox page or the daily cron with `CRON_SECRET`). |
| Daily cron returns 401 | Add `CRON_SECRET` in Vercel and redeploy. |
| Changes not visible on the site | The public data is cached for about 30 seconds; reload again. |
| New feature tables missing on D1 | Run `npm run db:setup -- --remote`. |
| Certificate shows a box/blank for a name | Fonts cover Latin letters; accents are simplified and other scripts are dropped. |
