import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { formatEventDate } from '../../../shared/cms.js'
import { PageTitle, Badge, Spinner, useLoader, fmtDate } from '../ui'
import Icon from '../icons'

const Stat = ({ icon, label, value, sub, to, i }) => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
        <Link to={to} className="adm-stat">
            <span className="icon"><Icon name={icon} size={20} /></span>
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
            <PageTitle title={`Welcome back, ${user.name.split(' ')[0]}`} subtitle="Everything on the IEEE ITS website is managed from here.">
                <a className="adm-btn ghost" href="/" target="_blank" rel="noreferrer">View website ↗</a>
                <Link className="adm-btn primary" to="/admin/events">＋ New event</Link>
            </PageTitle>

            <div className="adm-stats">
                <Stat i={0} icon="box" label="Orders" value={c.orders} sub={`${c.newOrders} awaiting action`} to="/admin/orders" />
                <Stat i={1} icon="mail" label="Queries" value={c.queries} sub={`${c.newQueries} new`} to="/admin/queries" />
                <Stat i={2} icon="calendar" label="Events" value={c.events} sub={`${c.upcoming} upcoming`} to="/admin/events" />
                <Stat i={3} icon="users" label="Members" value={c.users} to="/admin/users" />
                <Stat i={4} icon="inbox" label="Subscribers" value={c.subscribers} to="/admin/subscribers" />
            </div>

            <div className="adm-integrations">
                <span><Icon name="folder" size={16} /> Database: <strong>{integ.database}</strong></span>
                <span><Icon name="image" size={16} /> ImageKit: <Badge tone={integ.imagekit ? 'ok' : 'warn'}>{integ.imagekit ? 'connected' : 'not configured'}</Badge></span>
                <span><Icon name="mail" size={16} /> SMTP: <Badge tone={integ.smtp ? 'ok' : 'warn'}>{integ.smtp ? 'configured' : 'not configured'}</Badge></span>
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
                        <Link to="/admin/design"><Icon name="design" size={16} /> Design & layout</Link>
                        <Link to="/admin/c/popups"><Icon name="popup" size={16} /> Edit popup</Link>
                        <Link to="/admin/c/banners"><Icon name="image" size={16} /> Home banners</Link>
                        <Link to="/admin/s/home"><Icon name="home" size={16} /> Home text</Link>
                        <Link to="/admin/moments"><Icon name="camera" size={16} /> Add photos</Link>
                        <Link to="/admin/c/board"><Icon name="users" size={16} /> Board</Link>
                        <Link to="/admin/c/faculty"><Icon name="school" size={16} /> Faculty</Link>
                        <Link to="/admin/c/announcements"><Icon name="megaphone" size={16} /> Announcement</Link>
                        <Link to="/admin/s/seo"><Icon name="search" size={16} /> SEO</Link>
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
