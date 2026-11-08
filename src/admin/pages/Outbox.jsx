import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { PageTitle, Badge, Empty, Spinner, useToast, fmtDate } from '../ui'
import Icon from '../icons'

/**
 * Bulk email queue. Mail-outs are sent in small batches within the daily SMTP limit
 * while this page is open; a daily job continues anything left over.
 */
export default function Outbox() {
    const { isAdmin } = useAuth()
    const toast = useToast()
    const [data, setData] = useState(null)
    const [running, setRunning] = useState(false)
    const [limit, setLimit] = useState('')
    const stop = useRef(false)

    const load = useCallback(() => api.get('/admin/outbox').then(d => { setData(d); setLimit(String(d.quota.dailyLimit)); return d }).catch(e => toast(e.message, 'error')), [toast])

    const pending = data?.items.filter(c => c.status === 'queued') || []

    const run = async () => {
        setRunning(true); stop.current = false
        try {
            while (!stop.current) {
                const r = await api.post('/admin/outbox/process')
                await load()
                if (r.quotaReached) { toast("Today's email limit is reached — sending continues tomorrow.", 'error'); break }
                if (r.idle) { toast('All queued emails are sent.'); break }
                if (!r.sent && !r.busy) break
            }
        } catch (e) { toast(e.message, 'error') }
        setRunning(false)
    }
    // Load, then start sending automatically when something is queued and allowance is left.
    const runRef = useRef(run)
    useEffect(() => { runRef.current = run })
    useEffect(() => {
        let alive = true
        load().then(d => { if (alive && d?.items.some(c => c.status === 'queued') && d.quota.remaining > 0) runRef.current() })
        return () => { alive = false; stop.current = true }
    }, [load])

    const cancel = async id => { await api.post(`/admin/outbox/${id}/cancel`); load() }
    const retry = async id => { try { await api.post(`/admin/outbox/${id}/retry`); toast('Failed addresses queued again'); load() } catch (e) { toast(e.message, 'error') } }
    const saveLimit = async () => { try { await api.put('/admin/outbox/limits', { dailyLimit: Number(limit) }); toast('Daily limit saved'); load() } catch (e) { toast(e.message, 'error') } }

    if (!data) return <Spinner />
    const q = data.quota
    const left = pending.reduce((s, c) => s + c.total - c.cursor, 0)

    return (
        <>
            <PageTitle title="Email Outbox" subtitle="Recruitment results, reminders and event emails are queued here and sent in small batches. Gmail allows about 500 emails a day, so large mail-outs continue automatically the next day.">
                {running
                    ? <button className="adm-btn" onClick={() => { stop.current = true }}>Pause sending</button>
                    : <button className="adm-btn primary" disabled={!pending.length || !q.remaining} onClick={run}><Icon name="send" size={16} /> Send now</button>}
            </PageTitle>
            <div className="adm-stats">
                <div className="adm-stat"><span className="icon"><Icon name="send" size={20} /></span><div><strong>{q.used}</strong><span>sent today (limit {q.dailyLimit})</span></div></div>
                <div className="adm-stat"><span className="icon"><Icon name="inbox" size={20} /></span><div><strong>{left}</strong><span>waiting to send</span>{left > q.remaining && <small>{(d => (d === 1 ? 'The rest goes out tomorrow' : `Finishes in about ${d} days at the current limit`))(Math.ceil((left - q.remaining) / q.dailyLimit))}</small>}</div></div>
                <div className="adm-stat"><span className="icon"><Icon name="check" size={20} /></span><div><strong>{q.remaining}</strong><span>left for today</span></div></div>
            </div>
            {running && <p className="adm-hint warn">Sending… keep this tab open. You can pause at any time; nothing is sent twice.</p>}
            {isAdmin && (
                <div className="adm-panel adm-row wrap">
                    <label className="adm-field" style={{ margin: 0 }}><span>Daily sending limit</span>
                        <input className="adm-input" type="number" min="10" max="2000" value={limit} onChange={e => setLimit(e.target.value)} style={{ maxWidth: 140 }} />
                    </label>
                    <button className="adm-btn" onClick={saveLimit}>Save</button>
                    <span className="adm-hint">Keep it below your provider's limit (Gmail: ~500/day) and leave room for password-reset emails. Google Workspace accounts can go to ~1,500.</span>
                </div>
            )}
            {data.items.length === 0 ? <Empty icon="send">Nothing has been queued yet.</Empty> : (
                <div className="adm-table-wrap">
                    <table className="adm-table">
                        <thead><tr><th>Mail-out</th><th>Progress</th><th>Status</th><th>Queued</th><th /></tr></thead>
                        <tbody>
                            {data.items.map(c => (
                                <tr key={c.id}>
                                    <td><strong>{c.label || c.kind}</strong><small className="adm-block">{c.subject}</small></td>
                                    <td style={{ minWidth: 180 }}>
                                        <div className="adm-progress"><span style={{ width: `${c.total ? (c.sent / c.total) * 100 : 0}%` }} /></div>
                                        <small>{c.sent} / {c.total} sent{c.failed ? ` · ${c.failed} failed` : ''}</small>
                                    </td>
                                    <td><Badge tone={c.status === 'done' ? 'ok' : c.status === 'cancelled' ? 'neutral' : 'info'}>{c.status === 'queued' ? 'Sending' : c.status}</Badge></td>
                                    <td><small>{fmtDate(c.created_at)}<br />{c.created_by}</small></td>
                                    <td className="adm-row end">
                                        {c.failed > 0 && <button className="adm-btn small" onClick={() => retry(c.id)}>Retry failed</button>}
                                        {c.status === 'queued' && <button className="adm-btn small ghost danger-text" onClick={() => cancel(c.id)}>Cancel</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    )
}
