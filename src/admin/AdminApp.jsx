import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useSite } from '../context/SiteContext'
import { CONTENT_TYPES, SETTINGS_FORMS } from '../../shared/cms.js'
import { ToastProvider, ConfirmProvider } from './ui'
import Dashboard from './pages/Dashboard'
import ContentManager from './pages/ContentManager'
import EventsManager from './pages/EventsManager'
import MomentsManager from './pages/MomentsManager'
import SettingsEditor from './pages/SettingsEditor'
import MediaLibrary from './pages/MediaLibrary'
import { Orders, Queries, Subscribers } from './pages/Inbox'
import Users from './pages/Users'
import EmailSettings from './pages/EmailSettings'
import AuditLog from './pages/AuditLog'
import DesignEditor from './pages/DesignEditor'
import Icon from './icons'
import './admin.css'

const NAV = [
    { group: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true }] },
    {
        group: 'Home & Layout', items: [
            { to: '/admin/design', label: 'Design & Layout', icon: 'design' },
            { to: '/admin/s/home', label: 'Home Page Text', icon: 'home' },
            { to: '/admin/c/banners', label: 'Home Banners', icon: 'image' },
            { to: '/admin/c/popups', label: 'Popups', icon: 'popup' },
            { to: '/admin/c/announcements', label: 'Announcement Bar', icon: 'megaphone' },
            { to: '/admin/c/gallery', label: 'Home Photo Marquee', icon: 'film' },
            { to: '/admin/c/domains', label: 'Domains', icon: 'grid' },
            { to: '/admin/s/pages', label: 'Page Headers', icon: 'type' },
        ],
    },
    { group: 'Events', items: [{ to: '/admin/events', label: 'Events & Timeline', icon: 'calendar' }, { to: '/admin/moments', label: 'Moments (Albums)', icon: 'camera' }] },
    { group: 'People', items: [{ to: '/admin/c/board', label: 'Board Members', icon: 'users' }, { to: '/admin/c/faculty', label: 'Faculty', icon: 'school' }, { to: '/admin/c/web_team', label: 'Web Team', icon: 'code' }] },
    { group: 'Publications', items: [{ to: '/admin/c/blogs', label: 'Blogs', icon: 'pen' }, { to: '/admin/c/magazines', label: 'Magazines', icon: 'book' }, { to: '/admin/c/vlogs', label: 'Vlogs', icon: 'video' }, { to: '/admin/c/faqs', label: 'FAQs', icon: 'help' }] },
    {
        group: 'Store & Inbox', items: [
            { to: '/admin/orders', label: 'Orders', icon: 'box' }, { to: '/admin/queries', label: 'Queries', icon: 'mail' },
            { to: '/admin/subscribers', label: 'Subscribers', icon: 'inbox' }, { to: '/admin/c/merch', label: 'Merch Products', icon: 'shirt' }, { to: '/admin/s/merch', label: 'Merch Settings', icon: 'settings' },
        ],
    },
    { group: 'Navigation & Links', items: [{ to: '/admin/c/nav_links', label: 'Navbar Menu', icon: 'compass' }, { to: '/admin/c/footer_links', label: 'Footer Links', icon: 'link' }, { to: '/admin/c/social_links', label: 'Social Links', icon: 'globe' }] },
    { group: 'Media', items: [{ to: '/admin/media', label: 'Media Library', icon: 'folder' }] },
    {
        group: 'Settings', items: [
            { to: '/admin/s/site', label: 'Site & Contact', icon: 'tag' }, { to: '/admin/s/seo', label: 'SEO', icon: 'search' },
            { to: '/admin/s/appearance', label: 'Animations', icon: 'sparkles' }, { to: '/admin/s/blogs', label: 'Blogs Page', icon: 'news' },
            { to: '/admin/s/vlogs', label: 'Vlogs Page', icon: 'tv' }, { to: '/admin/s/webteam', label: 'Web Team Page', icon: 'code' },
            { to: '/admin/s/games', label: 'Games Page', icon: 'gamepad' },
            { to: '/admin/email', label: 'Email & SMTP', icon: 'send', admin: true }, { to: '/admin/users', label: 'Users & Roles', icon: 'lock', admin: true },
            { to: '/admin/audit', label: 'Audit Log', icon: 'scroll', admin: true },
        ],
    },
]

function ContentRoute() {
    const { type } = useParams()
    return CONTENT_TYPES[type] ? <ContentManager key={type} type={type} /> : <Navigate to="/admin" replace />
}
function SettingsRoute() {
    const { key } = useParams()
    return SETTINGS_FORMS[key] ? <SettingsEditor key={key} settingKey={key} /> : <Navigate to="/admin" replace />
}

function AdminLogin() {
    const { login, user, logout } = useAuth()
    const [form, setForm] = useState({ email: '', password: '' })
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const submit = async e => {
        e.preventDefault()
        setBusy(true); setError('')
        try {
            const u = await login(form.email, form.password)
            if (u.role === 'member') setError('This account does not have admin access.')
        } catch (err) { setError(err.message) } finally { setBusy(false) }
    }
    return (
        <div className="adm-login">
            <motion.form className="adm-login-card" onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <img src="/logo-round.png" alt="" />
                <h1>IEEE ITS Admin</h1>
                <p>Sign in to manage the website.</p>
                {user && user.role === 'member' && <p className="adm-hint warn">Signed in as {user.email}, which is a member account. <button type="button" className="adm-link" onClick={logout}>Sign out</button></p>}
                <label className="adm-field"><span>Email</span><input className="adm-input" type="email" autoComplete="username" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></label>
                <label className="adm-field"><span>Password</span><input className="adm-input" type="password" autoComplete="current-password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></label>
                {error && <p className="adm-err" role="alert">{error}</p>}
                <button className="adm-btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in →'}</button>
                <a href="/login?mode=forgot&next=/admin" className="adm-link">Forgot password?</a>
                <a href="/" className="adm-link">← Back to website</a>
            </motion.form>
        </div>
    )
}

export default function AdminApp() {
    const { user, loading, logout, isAdmin, isStaff } = useAuth()
    const { refresh } = useSite()
    const { pathname } = useLocation()
    const [navOpen, setNavOpen] = useState(false)

    useEffect(() => {
        document.title = 'Admin · IEEE ITS VIT'
        let robots = document.head.querySelector('meta[name="robots"]')
        if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
        robots.content = 'noindex, nofollow'
    }, [])
    // Close the mobile sidebar when the route changes (state reset keyed on pathname).
    const [navPath, setNavPath] = useState(pathname)
    if (navPath !== pathname) { setNavPath(pathname); setNavOpen(false) }

    if (loading) return <div className="admin-boot">Loading…</div>
    if (!isStaff) return <ToastProvider><AdminLogin /></ToastProvider>

    return (
        <ToastProvider>
            <ConfirmProvider>
                <div className={`adm-shell${navOpen ? ' nav-open' : ''}`}>
                    <aside className="adm-sidebar">
                        <div className="adm-brand">
                            <img src="/logo-round.png" alt="" />
                            <div><strong>IEEE ITS</strong><span>Content Studio</span></div>
                        </div>
                        <nav>
                            {NAV.map(g => {
                                const items = g.items.filter(i => !i.admin || isAdmin)
                                if (!items.length) return null
                                return (
                                    <div key={g.group} className="adm-nav-group">
                                        <p>{g.group}</p>
                                        {items.map(i => (
                                            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                                                <Icon name={i.icon} />{i.label}
                                            </NavLink>
                                        ))}
                                    </div>
                                )
                            })}
                        </nav>
                    </aside>
                    <div className="adm-scrim" onClick={() => setNavOpen(false)} />
                    <div className="adm-main">
                        <header className="adm-topbar">
                            <button className="adm-icon-btn adm-menu" onClick={() => setNavOpen(v => !v)} aria-label="Toggle menu"><Icon name="menu" /></button>
                            <div className="adm-topbar-spacer" />
                            <button className="adm-btn small ghost" onClick={() => refresh(true)} title="Reload site content"><Icon name="refresh" size={16} /> Sync</button>
                            <a className="adm-btn small ghost" href="/" target="_blank" rel="noreferrer">Website <Icon name="external" size={15} /></a>
                            <div className="adm-user">
                                <span className="adm-avatar">{user.name[0]?.toUpperCase()}</span>
                                <div><strong>{user.name}</strong><small>{user.role}</small></div>
                                <button className="adm-btn small ghost" onClick={logout}>Sign out</button>
                            </div>
                        </header>
                        <AnimatePresence mode="wait">
                            <motion.main key={pathname} className="adm-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                                <Routes>
                                    <Route path="/admin" element={<Dashboard />} />
                                    <Route path="/admin/c/:type" element={<ContentRoute />} />
                                    <Route path="/admin/s/:key" element={<SettingsRoute />} />
                                    <Route path="/admin/design" element={<DesignEditor />} />
                                    <Route path="/admin/events" element={<EventsManager />} />
                                    <Route path="/admin/moments" element={<MomentsManager />} />
                                    <Route path="/admin/media" element={<MediaLibrary />} />
                                    <Route path="/admin/orders" element={<Orders />} />
                                    <Route path="/admin/queries" element={<Queries />} />
                                    <Route path="/admin/subscribers" element={<Subscribers />} />
                                    {isAdmin && <Route path="/admin/users" element={<Users />} />}
                                    {isAdmin && <Route path="/admin/email" element={<EmailSettings />} />}
                                    {isAdmin && <Route path="/admin/audit" element={<AuditLog />} />}
                                    <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
                                </Routes>
                            </motion.main>
                        </AnimatePresence>
                    </div>
                </div>
            </ConfirmProvider>
        </ToastProvider>
    )
}
