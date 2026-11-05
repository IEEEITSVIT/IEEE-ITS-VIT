import { useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { PageTitle, Badge, Empty, Spinner, useToast, useConfirm, useLoader, downloadCsv, fmtDate, Drawer } from '../ui'

const ORDER_STATUSES = ['Booked', 'Confirmed', 'Ready for pickup', 'Delivered', 'Cancelled']
const QUERY_STATUSES = ['New', 'In progress', 'Resolved', 'Spam']
const tone = s => ({ Booked: 'info', New: 'info', Confirmed: 'accent', 'In progress': 'accent', 'Ready for pickup': 'warn', Delivered: 'ok', Resolved: 'ok', Cancelled: 'danger', Spam: 'danger' }[s] || 'neutral')

function InboxTable({ kind }) {
    const isOrders = kind === 'orders'
    const statuses = isOrders ? ORDER_STATUSES : QUERY_STATUSES
    const { isAdmin } = useAuth()
    const toast = useToast()
    const confirm = useConfirm()
    const { data, loading, setData } = useLoader(() => api.get(`/admin/${kind}`).then(r => r.items), [kind])
    const [q, setQ] = useState('')
    const [status, setStatus] = useState('')
    const [open, setOpen] = useState(null)

    const rows = (data || []).filter(r => (!status || r.status === status) && (!q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())))

    const update = async (row, patch) => {
        const next = { ...row, ...patch }
        try {
            await api.patch(`/admin/${kind}/${row.id}`, { status: next.status, admin_note: next.admin_note })
            setData(list => list.map(x => (x.id === row.id ? next : x)))
            if (open?.id === row.id) setOpen(next)
            toast('Updated')
        } catch (e) { toast(e.message, 'error') }
    }

    const remove = async row => {
        if (!await confirm(`Delete ${isOrders ? 'order' : 'query'} #${row.id}?`)) return
        try { await api.del(`/admin/${kind}/${row.id}`); setData(list => list.filter(x => x.id !== row.id)); setOpen(null); toast('Deleted') }
        catch (e) { toast(e.message, 'error') }
    }

    const total = rows.filter(r => r.status !== 'Cancelled').reduce((s, r) => s + (Number(r.total) || 0), 0)

    return (
        <>
            <PageTitle title={isOrders ? 'Orders' : 'Queries & Suggestions'} subtitle={isOrders ? 'Merch bookings. Each new booking emails the order recipients set in Email & SMTP.' : 'Contact queries and member suggestions. New ones are emailed to the query recipients.'}>
                <input className="adm-input search" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
                <select className="adm-input" value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 170 }}>
                    <option value="">All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}
                </select>
                <button className="adm-btn" disabled={!rows.length} onClick={() => downloadCsv(`ieee-its-${kind}-${new Date().toISOString().slice(0, 10)}.csv`, rows)}>⬇ CSV</button>
            </PageTitle>
            {isOrders && rows.length > 0 && <p className="adm-hint">{rows.length} orders · {rows.reduce((s, r) => s + (r.status !== 'Cancelled' ? r.qty : 0), 0)} items · ₹{total.toLocaleString('en-IN')} booked value</p>}
            {loading ? <Spinner /> : rows.length === 0 ? <Empty icon={isOrders ? 'box' : 'mail'}>Nothing here yet.</Empty> : (
                <div className="adm-table-wrap">
                    <table className="adm-table">
                        <thead>
                            <tr>
                                <th>#</th><th>Date</th><th>Name</th>
                                {isOrders ? <><th>Item</th><th>Size</th><th>Qty</th><th>Total</th></> : <><th>Type</th><th>Subject / message</th></>}
                                <th>Status</th><th />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.id} onClick={() => setOpen(r)}>
                                    <td>{r.id}</td>
                                    <td className="nowrap">{fmtDate(r.created_at)}</td>
                                    <td><strong>{r.name || '—'}</strong><br /><small>{r.email}</small></td>
                                    {isOrders
                                        ? <><td>{r.item}{r.color && <span className="adm-swatch" style={{ background: r.color }} />}</td><td>{r.size}</td><td>{r.qty}</td><td>₹{r.total}</td></>
                                        : <><td><Badge>{r.kind}</Badge></td><td className="clip"><strong>{r.subject}</strong> {r.message}</td></>}
                                    <td onClick={e => e.stopPropagation()}>
                                        <select className={`adm-input status ${tone(r.status)}`} value={r.status} onChange={e => update(r, { status: e.target.value })}>
                                            {statuses.map(s => <option key={s}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <a className="adm-btn small ghost" href={`mailto:${r.email}?subject=${encodeURIComponent(isOrders ? `Your IEEE ITS booking #${r.id}` : `Re: ${r.subject || 'Your query to IEEE ITS'}`)}`}>Reply</a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Drawer open={!!open} title={`${isOrders ? 'Order' : 'Query'} #${open?.id}`} onClose={() => setOpen(null)}
                footer={<>
                    {isAdmin && <button className="adm-btn ghost danger-text" onClick={() => remove(open)}>Delete</button>}
                    <a className="adm-btn" href={`mailto:${open?.email}`}>Email {open?.name?.split(' ')[0]}</a>
                    <button className="adm-btn primary" onClick={() => update(open, { admin_note: open.admin_note })}>Save note</button>
                </>}>
                {open && (
                    <div className="adm-detail">
                        {Object.entries(open).filter(([k]) => !['admin_note', 'user_id', 'item_id', 'updated_at'].includes(k)).map(([k, v]) => (
                            <div key={k}><span>{k.replace(/_/g, ' ')}</span><p>{k.endsWith('_at') ? fmtDate(v) : String(v ?? '—')}</p></div>
                        ))}
                        <label className="adm-field"><span>Internal note</span>
                            <textarea className="adm-input" rows={4} value={open.admin_note || ''} onChange={e => setOpen(o => ({ ...o, admin_note: e.target.value }))} />
                        </label>
                    </div>
                )}
            </Drawer>
        </>
    )
}

export const Orders = () => <InboxTable kind="orders" />
export const Queries = () => <InboxTable kind="queries" />

export function Subscribers() {
    const { isAdmin } = useAuth()
    const toast = useToast()
    const confirm = useConfirm()
    const { data, loading, setData } = useLoader(() => api.get('/admin/subscribers').then(r => r.items), [])
    const [list, setList] = useState('')
    const rows = (data || []).filter(r => !list || r.list === list)
    const remove = async r => {
        if (!await confirm(`Remove ${r.email} from ${r.list}?`)) return
        try { await api.del(`/admin/subscribers/${r.id}`); setData(d => d.filter(x => x.id !== r.id)); toast('Removed') }
        catch (e) { toast(e.message, 'error') }
    }
    return (
        <>
            <PageTitle title="Subscribers" subtitle="Newsletter (Blogs page) and Vlogs subscribers.">
                <select className="adm-input" value={list} onChange={e => setList(e.target.value)} style={{ maxWidth: 160 }}>
                    <option value="">All lists</option><option value="newsletter">Newsletter</option><option value="vlogs">Vlogs</option>
                </select>
                <button className="adm-btn" onClick={() => navigator.clipboard.writeText(rows.map(r => r.email).join(', ')).then(() => toast('Emails copied'))}>Copy emails</button>
                <button className="adm-btn" disabled={!rows.length} onClick={() => downloadCsv('ieee-its-subscribers.csv', rows)}>⬇ CSV</button>
            </PageTitle>
            {loading ? <Spinner /> : rows.length === 0 ? <Empty icon="inbox">No subscribers yet.</Empty> : (
                <div className="adm-table-wrap">
                    <table className="adm-table">
                        <thead><tr><th>Email</th><th>List</th><th>Subscribed</th><th /></tr></thead>
                        <tbody>{rows.map(r => (
                            <tr key={r.id}><td>{r.email}</td><td><Badge>{r.list}</Badge></td><td>{fmtDate(r.created_at)}</td>
                                <td>{isAdmin && <button className="adm-btn small ghost danger-text" onClick={() => remove(r)}>Remove</button>}</td></tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </>
    )
}
