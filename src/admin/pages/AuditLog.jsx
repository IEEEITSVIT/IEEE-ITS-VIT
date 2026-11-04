import { useState } from 'react'
import { api } from '../../lib/api'
import { PageTitle, Badge, Spinner, useLoader, fmtDate, downloadCsv } from '../ui'

export default function AuditLog() {
    const { data, loading } = useLoader(() => api.get('/admin/audit'), [])
    const [tab, setTab] = useState('audit')
    const rows = tab === 'audit' ? data?.items || [] : data?.activity || []
    return (
        <>
            <PageTitle title="Audit & Activity" subtitle="Every admin change and every member sign-in, newest first.">
                <div className="adm-seg">
                    <button className={tab === 'audit' ? 'on' : ''} onClick={() => setTab('audit')}>Admin changes</button>
                    <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>Sign-ins</button>
                </div>
                <button className="adm-btn" disabled={!rows.length} onClick={() => downloadCsv(`ieee-its-${tab}.csv`, rows)}>⬇ CSV</button>
            </PageTitle>
            {loading ? <Spinner /> : (
                <div className="adm-table-wrap">
                    <table className="adm-table compact">
                        <thead>{tab === 'audit'
                            ? <tr><th>When</th><th>Who</th><th>Action</th><th>What</th><th>Details</th></tr>
                            : <tr><th>When</th><th>Email</th><th>Event</th></tr>}</thead>
                        <tbody>
                            {rows.map(r => tab === 'audit' ? (
                                <tr key={r.id}><td className="nowrap">{fmtDate(r.created_at)}</td><td>{r.user_email}</td>
                                    <td><Badge tone={r.action === 'delete' ? 'danger' : r.action === 'create' ? 'ok' : 'info'}>{r.action}</Badge></td>
                                    <td>{r.entity}{r.entity_id ? ` #${r.entity_id}` : ''}</td><td className="clip">{r.details}</td></tr>
                            ) : (
                                <tr key={r.id}><td className="nowrap">{fmtDate(r.created_at)}</td><td>{r.email}</td><td><Badge>{r.type}</Badge></td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    )
}
