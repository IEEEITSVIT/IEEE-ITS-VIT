-- IEEE ITS VIT — Cloudflare D1 (SQLite) schema
-- Apply with:  npm run db:setup            (local SQLite file)
--              npm run db:setup -- --remote (Cloudflare D1 via HTTP API)
-- Every statement is idempotent so the file can be re-run safely.

-- ───────────── Accounts ─────────────
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'editor', 'admin')),
    mobile        TEXT DEFAULT '',
    reg_no        TEXT DEFAULT '',
    member_type   TEXT DEFAULT 'External Member',
    avatar_url    TEXT DEFAULT '',
    active        INTEGER NOT NULL DEFAULT 1,
    token_version INTEGER NOT NULL DEFAULT 0,
    last_login_at TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_attempts (
    key        TEXT PRIMARY KEY,           -- "ip:<addr>" or "email:<addr>"
    count      INTEGER NOT NULL DEFAULT 0,
    window_end INTEGER NOT NULL            -- unix ms
);

-- One-time codes for "Forgot password" (emailed via SMTP). Only a hash of the code is stored.
CREATE TABLE IF NOT EXISTS password_resets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash  TEXT NOT NULL,
    expires_at INTEGER NOT NULL,           -- unix ms
    attempts   INTEGER NOT NULL DEFAULT 0,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id, used);

-- ───────────── CMS ─────────────
-- Global key/value configuration: site identity, hero, about, footer, SEO, SMTP, …
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,              -- JSON
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reusable, orderable content blocks. `type` selects the collection
-- (board, domains, faculty, web_team, faqs, blogs, magazines, vlogs, merch,
--  gallery, banners, popups, announcements, nav_links, footer_links, social_links, …)
CREATE TABLE IF NOT EXISTS content (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,
    data       TEXT NOT NULL DEFAULT '{}', -- JSON payload, shape defined per type
    sort_order INTEGER NOT NULL DEFAULT 0,
    status     TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    starts_at  TEXT,                       -- optional scheduling window (ISO)
    ends_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_type ON content (type, sort_order);

-- Events drive the timeline, home spotlight, event pages and moment ordering.
CREATE TABLE IF NOT EXISTS events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    slug             TEXT NOT NULL UNIQUE,
    title            TEXT NOT NULL,
    tag              TEXT DEFAULT '',
    summary          TEXT DEFAULT '',
    body_html        TEXT DEFAULT '',
    start_date       TEXT NOT NULL,        -- YYYY-MM-DD; timeline order + upcoming/past derive from this
    end_date         TEXT,
    date_label       TEXT DEFAULT '',      -- optional display override, e.g. "Feb 2023"
    time_text        TEXT DEFAULT '',
    venue            TEXT DEFAULT '',
    poster_url       TEXT DEFAULT '',
    registration_url TEXT DEFAULT '',
    cta_label        TEXT DEFAULT 'Register Now',
    extra            TEXT NOT NULL DEFAULT '{}', -- JSON: highlights[], agenda[], links[]
    featured         INTEGER NOT NULL DEFAULT 0,
    show_in_timeline INTEGER NOT NULL DEFAULT 1,
    status           TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events (start_date);

-- Photo albums. When event_id is set, the album inherits that event's date
-- and is ordered alongside it on the Moments page.
CREATE TABLE IF NOT EXISTS moments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER REFERENCES events (id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    album_date  TEXT,                      -- used when not linked to an event
    photos      TEXT NOT NULL DEFAULT '[]',-- JSON array of URLs
    show_on_home INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_moments_event ON moments (event_id);

-- ImageKit asset references
CREATE TABLE IF NOT EXISTS media (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    url        TEXT NOT NULL,
    file_id    TEXT DEFAULT '',
    name       TEXT DEFAULT '',
    folder     TEXT DEFAULT '',
    mime       TEXT DEFAULT '',
    size       INTEGER DEFAULT 0,
    width      INTEGER DEFAULT 0,
    height     INTEGER DEFAULT 0,
    uploaded_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────────── Submissions ─────────────
CREATE TABLE IF NOT EXISTS orders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users (id) ON DELETE SET NULL,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    mobile     TEXT DEFAULT '',
    reg_no     TEXT DEFAULT '',
    item_id    INTEGER,
    item       TEXT NOT NULL,
    size       TEXT DEFAULT '',
    color      TEXT DEFAULT '',
    qty        INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    total      REAL NOT NULL DEFAULT 0,
    status     TEXT NOT NULL DEFAULT 'Booked',
    admin_note TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Queries: suggestions, contact messages, general questions
CREATE TABLE IF NOT EXISTS queries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users (id) ON DELETE SET NULL,
    kind       TEXT NOT NULL DEFAULT 'query',  -- query | suggestion | contact
    name       TEXT DEFAULT '',
    email      TEXT NOT NULL,
    subject    TEXT DEFAULT '',
    message    TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'New',
    admin_note TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscribers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL COLLATE NOCASE,
    list       TEXT NOT NULL DEFAULT 'newsletter', -- newsletter | vlogs
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (email, list)
);

-- ───────────── Logs ─────────────
CREATE TABLE IF NOT EXISTS email_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL,
    recipient  TEXT NOT NULL,
    subject    TEXT NOT NULL,
    status     TEXT NOT NULL,             -- sent | failed | skipped
    error      TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    user_email TEXT DEFAULT '',
    action     TEXT NOT NULL,
    entity     TEXT DEFAULT '',
    entity_id  TEXT DEFAULT '',
    details    TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    email      TEXT DEFAULT '',
    type       TEXT NOT NULL,             -- LOGIN | REGISTER | LOGOUT
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────────── Recruitment ─────────────
-- Domains people can apply to. Questions are stored inline (JSON) with the domain.
CREATE TABLE IF NOT EXISTS rec_domains (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT NOT NULL,
    description    TEXT DEFAULT '',
    open           INTEGER NOT NULL DEFAULT 1,
    apply_deadline TEXT,                   -- ISO UTC; applications close after this
    test_enabled   INTEGER NOT NULL DEFAULT 0,
    test_minutes   INTEGER NOT NULL DEFAULT 20,
    test_deadline  TEXT,
    exam_link      TEXT DEFAULT '',        -- external proctored exam, shown to applicants once set
    exam_deadline  TEXT,
    whatsapp_link  TEXT DEFAULT '',        -- sent only to selected candidates
    questions      TEXT NOT NULL DEFAULT '[]',
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per person per domain: a candidate can apply to (and be selected for) several domains.
CREATE TABLE IF NOT EXISTS rec_applications (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    domain_id         INTEGER NOT NULL REFERENCES rec_domains (id) ON DELETE CASCADE,
    status            TEXT NOT NULL DEFAULT 'applied', -- applied | test_submitted | interview | selected | not_selected
    source            TEXT NOT NULL DEFAULT 'portal',  -- portal | direct (added by an admin without a test)
    answers           TEXT NOT NULL DEFAULT '{}',
    auto_score        REAL,
    manual_score      REAL,
    max_score         REAL,
    tab_switches      INTEGER NOT NULL DEFAULT 0,
    test_started_at   TEXT,
    test_submitted_at TEXT,
    note              TEXT DEFAULT '',
    result_mailed_at  TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, domain_id)
);
CREATE INDEX IF NOT EXISTS idx_rec_app_domain ON rec_applications (domain_id, status);

-- ───────────── Bulk email ─────────────
-- One row per mail-out. Recipients (with their merge fields) are kept inline so a 1,500-person
-- mail-out is a single row; it is sent in small batches within the daily SMTP quota.
CREATE TABLE IF NOT EXISTS email_campaigns (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL,
    label      TEXT DEFAULT '',
    subject    TEXT NOT NULL,
    body       TEXT NOT NULL,              -- plain text with {{placeholders}}
    recipients TEXT NOT NULL DEFAULT '[]', -- [{ email, vars }]
    total      INTEGER NOT NULL DEFAULT 0,
    cursor     INTEGER NOT NULL DEFAULT 0,
    sent       INTEGER NOT NULL DEFAULT 0,
    failed     INTEGER NOT NULL DEFAULT 0,
    failures   TEXT NOT NULL DEFAULT '[]',
    status     TEXT NOT NULL DEFAULT 'queued', -- queued | done | cancelled
    created_by TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────────── Event portals (registrations, teams, submissions, judging) ─────────────
CREATE TABLE IF NOT EXISTS ev_portals (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    slug              TEXT NOT NULL UNIQUE,
    title             TEXT NOT NULL,
    config            TEXT NOT NULL DEFAULT '{}', -- access, team size, fields, rounds, criteria, emails, certificates…
    status            TEXT NOT NULL DEFAULT 'draft', -- draft | open | closed | archived
    current_round     INTEGER NOT NULL DEFAULT 1,
    scores_published  INTEGER NOT NULL DEFAULT 0,    -- teams can see their scores up to this round
    winners_published INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ev_teams (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    portal_id    INTEGER NOT NULL REFERENCES ev_portals (id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    code         TEXT NOT NULL,                -- join code shared by the team lead
    lead_user_id INTEGER,
    submission   TEXT NOT NULL DEFAULT '{}',   -- { [round]: { [fieldKey]: value } }
    submitted_at TEXT,
    round        INTEGER NOT NULL DEFAULT 1,   -- highest round the team has qualified for
    rank         INTEGER,                      -- final placing once winners are announced
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (portal_id, code)
);
CREATE INDEX IF NOT EXISTS idx_ev_teams_portal ON ev_teams (portal_id, round);

CREATE TABLE IF NOT EXISTS ev_members (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    portal_id    INTEGER NOT NULL REFERENCES ev_portals (id) ON DELETE CASCADE,
    team_id      INTEGER NOT NULL REFERENCES ev_teams (id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role         TEXT NOT NULL DEFAULT 'member', -- lead | member
    cert_sent_at TEXT,
    joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (portal_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ev_members_team ON ev_members (team_id);

CREATE TABLE IF NOT EXISTS ev_scores (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    portal_id    INTEGER NOT NULL REFERENCES ev_portals (id) ON DELETE CASCADE,
    team_id      INTEGER NOT NULL REFERENCES ev_teams (id) ON DELETE CASCADE,
    round        INTEGER NOT NULL,
    evaluator_id INTEGER NOT NULL,
    scores       TEXT NOT NULL DEFAULT '{}',   -- { [criterion]: points }
    total        REAL NOT NULL DEFAULT 0,
    comment      TEXT DEFAULT '',
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (team_id, round, evaluator_id)
);
CREATE INDEX IF NOT EXISTS idx_ev_scores_portal ON ev_scores (portal_id, round);
