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
