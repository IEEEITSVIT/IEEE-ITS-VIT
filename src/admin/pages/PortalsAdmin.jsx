import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { PageTitle, Badge, Empty, Spinner, Modal, useToast, fmtDate } from '../ui'
import Icon from '../icons'

const TONE = { draft: 'neutral', open: 'ok', closed: 'warn', archived: 'neutral' }

/** All event registration portals: create, open, judge, export and purge — any number of events. */
export default function PortalsAdmin() {
    const toast = useToast()
    const navigate = useNavigate()
    const [items, setItems] = useState(null)
    const [creating, setCreating] = useState(false)
    const [title, setTitle] = useState('')

    useEffect(() => { api.get('/admin/portals').then(r => setItems(r.items)).catch(e => toast(e.message, 'error')) }, [toast])

    const create = async e => {
        e.preventDefault()
        try { const { item } = await api.post('/admin/portals', { title }); toast('Event portal created as a draft'); navigate(`/admin/portals/${item.id}`) }
        catch (err) { toast(err.message, 'error') }
    }

    return (
        <>
            <PageTitle title="Event Portals" subtitle="Registration pages for hackathons and competitions: solo or team entries, link submissions, judging rounds, results, winners and certificates.">
                <button className="adm-btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New event portal</button>
            </PageTitle>
            {!items ? <Spinner /> : items.length === 0 ? <Empty icon="calendar">No event portals yet.</Empty> : (
                <div className="adm-table-wrap">
                    <table className="adm-table">
                        <thead><tr><th>Event</th><th>Status</th><th>Teams</th><th>Participants</th><th>Round</th><th>Created</th><th /></tr></thead>
                        <tbody>
                            {items.map(p => (
                                <tr key={p.id}>
                                    <td><Link to={`/admin/portals/${p.id}`} className="adm-link"><strong>{p.title}</strong></Link><small className="adm-block">/e/{p.slug}</small></td>
                                    <td><Badge tone={TONE[p.status]}>{p.status}</Badge></td>
                                    <td>{p.teams}</td><td>{p.members}</td><td>{p.current_round}</td>
                                    <td><small>{fmtDate(p.created_at)}</small></td>
                                    <td className="adm-row end">
                                        <a className="adm-btn small ghost" href={`/e/${p.slug}`} target="_blank" rel="noreferrer">View <Icon name="external" size={14} /></a>
                                        <Link className="adm-btn small" to={`/admin/portals/${p.id}`}>Manage</Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Modal open={creating} onClose={() => setCreating(false)} title="New event portal">
                <form className="adm-form" onSubmit={create}>
                    <label className="adm-field"><span>Event title</span><input className="adm-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. HackIT 2026" required minLength={3} autoFocus /></label>
                    <p className="adm-hint">It starts as a draft that only admins can see. Set it up, then switch the status to Open.</p>
                    <div className="adm-row end"><button type="button" className="adm-btn ghost" onClick={() => setCreating(false)}>Cancel</button><button className="adm-btn primary">Create</button></div>
                </form>
            </Modal>
        </>
    )
}
