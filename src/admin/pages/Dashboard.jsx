import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { formatEventDate } from '../../../shared/cms.js'
import { PageTitle, Badge, Spinner, useLoader, fmtDate } from '../ui'

const Stat = ({ icon, label, value, sub, to, i }) => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
        <Link to={to} className="adm-stat">
            <span className="icon">{icon}</span>
            <div><strong>{value}</strong><span>{label}</span>{sub && <small>{sub}</small>}</div>
        </Link>
    </motion.div>
)

export default function Dashboard() {
    const { user } = useAuth()
    const { data, loading, error } = useLoader(() => api.get('/admin/stats'), [])
    if (loading) return <Spinner />
    if (error) return <p className="adm-hint warn">{error}</p>
    const c = data.counts
    const integ = data.integrations

    return (
        <>
            <PageTitle title={`Welcome back, ${user.name.split(' ')[0]} 👋`} subtitle="Everything on the IEEE ITS website is managed from here.">
                <a className="adm-btn ghost" href="/" target="_blank" rel="noreferrer">View website ↗</a>
                <Link className="adm-btn primary" to="/admin/events">＋ New event</Link>
            </PageTitle>

            <div className="adm-stats">
                <Stat i={0} icon="📦" label="Orders" value={c.orders} sub={`${c.newOrders} awaiting action`} to="/admin/orders" />
                <Stat i={1} icon="✉️" label="Queries" value={c.queries} sub={`${c.newQueries} new`} to="/admin/queries" />
                <Stat i={2} icon="📅" label="Events" value={c.events} sub={`${c.upcoming} upcoming`} to="/admin/events" />
                <Stat i={3} icon="👥" label="Members" value={c.users} to="/admin/users" />
                <Stat i={4} icon="📬" label="Subscribers" value={c.subscribers} to="/admin/subscribers" />
            </div>

            <div className="adm-integrations">
                <span>🗄️ Database: <strong>{integ.database}</strong></span>
                <span>🖼️ ImageKit: <Badge tone={integ.imagekit ? 'ok' : 'warn'}>{integ.imagekit ? 'connected' : 'not configured'}</Badge></span>
                <span>✉️ SMTP: <Badge tone={integ.smtp ? 'ok' : 'warn'}>{integ.smtp ? 'configured' : 'not configured'}</Badge></span>
                {data.emailFailures > 0 && <Link to="/admin/email"><Badge tone="danger">{data.emailFailures} emails not sent this week</Badge></Link>}
            </div>

            <div className="adm-grid-2 top">
                <section className="adm-panel">
                    <div className="adm-row between"><h3>Upcoming events</h3><Link to="/admin/events" className="adm-link">Manage →</Link></div>
                    {data.upcoming.length === 0 ? <p className="adm-hint">No upcoming events.</p> : data.upcoming.map(e => (
                        <div key={e.id} className="adm-mini-row"><div><strong>{e.title}</strong><small>{formatEventDate(e)} {e.venue && `· ${e.venue}`}</small></div><Badge tone={e.state === 'ongoing' ? 'ok' : 'info'}>{e.state}</Badge></div>
                    ))}
                </section>
                <section className="adm-panel">
                    <div className="adm-row between"><h3>Quick actions</h3></div>
                    <div className="adm-quick">
                        <Link to="/admin/c/popups">🪧 Edit popup</Link>
                        <Link to="/admin/c/banners">🖼️ Home banners</Link>
                        <Link to="/admin/s/home">🏠 Home text</Link>
                        <Link to="/admin/moments">📸 Add photos</Link>
                        <Link to="/admin/c/board">👥 Board</Link>
                        <Link to="/admin/c/faculty">🎓 Faculty</Link>
                        <Link to="/admin/c/announcements">📣 Announcement</Link>
                        <Link to="/admin/s/seo">🔎 SEO</Link>
                    </div>
                </section>
                <section className="adm-panel">
                    <div className="adm-row between"><h3>Recent orders</h3><Link to="/admin/orders" className="adm-link">All →</Link></div>
                    {data.recentOrders.length === 0 ? <p className="adm-hint">No orders yet.</p> : data.recentOrders.map(o => (
                        <div key={o.id} className="adm-mini-row"><div><strong>#{o.id} · {o.name}</strong><small>{o.item} · {o.size} × {o.qty} · {fmtDate(o.created_at)}</small></div><Badge tone="info">{o.status}</Badge></div>
                    ))}
                </section>
                <section className="adm-panel">
                    <div className="adm-row between"><h3>Recent queries</h3><Link to="/admin/queries" className="adm-link">All →</Link></div>
                    {data.recentQueries.length === 0 ? <p className="adm-hint">No queries yet.</p> : data.recentQueries.map(q => (
                        <div key={q.id} className="adm-mini-row"><div><strong>{q.name || q.email}</strong><small className="clip">{q.subject || q.message}</small></div><Badge tone={q.status === 'New' ? 'info' : 'neutral'}>{q.kind}</Badge></div>
                    ))}
                </section>
            </div>
            {data.recentAudit.length > 0 && (
                <section className="adm-panel">
                    <h3>Recent changes</h3>
                    {data.recentAudit.map(a => <div key={a.id} className="adm-mini-row"><div><strong>{a.user_email}</strong><small>{a.action} {a.entity} {a.details && `· ${a.details}`}</small></div><small>{fmtDate(a.created_at)}</small></div>)}
                </section>
            )}
        </>
    )
}
