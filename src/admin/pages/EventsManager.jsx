import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useSite } from '../../context/SiteContext'
import { EVENT_FIELDS, formatEventDate, eventStatus, slugify } from '../../../shared/cms.js'
import { FieldForm, thumb } from '../fields'
import { Drawer, PageTitle, Badge, Empty, Spinner, useToast, useConfirm, useLoader } from '../ui'
import { PreviewFrame, withItem } from '../Preview'
import Icon from '../icons'

const BLANK = { title: '', start_date: new Date().toISOString().slice(0, 10), cta_label: 'Register Now', show_in_timeline: true, featured: false, extra: { highlights: [], agenda: [], links: [] }, status: 'published' }
const TONE = { upcoming: 'info', ongoing: 'ok', past: 'neutral' }

export default function EventsManager() {
    const { refresh, events: liveEvents } = useSite()
    const toast = useToast()
    const confirm = useConfirm()
    const { data, loading, setData } = useLoader(() => api.get('/admin/events').then(r => r.items), [])
    const [editing, setEditing] = useState(null)
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState('all')

    const save = async () => {
        setSaving(true)
        try {
            const { item } = editing.id ? await api.put(`/admin/events/${editing.id}`, editing) : await api.post('/admin/events', editing)
            setData(list => {
                const next = editing.id ? list.map(x => (x.id === item.id ? item : x)) : [item, ...list]
                return next.sort((a, b) => b.start_date.localeCompare(a.start_date))
            })
            toast(`Event saved — timeline position follows ${item.start_date}`)
            setEditing(null)
            refresh(true)
        } catch (e) { toast(e.message, 'error') }
        finally { setSaving(false) }
    }

    const remove = async e => {
        if (!await confirm(`Delete “${e.title}”? Linked photo albums are kept (unlinked). The poster is deleted from ImageKit unless used elsewhere.`)) return
        try {
            await api.del(`/admin/events/${e.id}`)
            setData(list => list.filter(x => x.id !== e.id))
            toast('Event deleted')
            refresh(true)
        } catch (err) { toast(err.message, 'error') }
    }

    // Preview the event page and the timeline with the unsaved event in place.
    const slug = editing ? editing.slug || slugify(editing.title) : ''
    const patch = useMemo(() => {
        if (!editing) return null
        const ev = { ...editing, id: editing.id ?? -1, slug, featured: !!editing.featured, show_in_timeline: editing.show_in_timeline !== false, extra: editing.extra || {}, state: eventStatus(editing) }
        return { events: withItem(liveEvents, ev).sort((a, b) => a.start_date.localeCompare(b.start_date)) }
    }, [editing, liveEvents, slug])
    const [path, setPath] = useState('/timeline')
    useEffect(() => { if (slug) setPath(`/events/${slug}`) }, [slug])

    const list = (data || []).filter(e => filter === 'all' || e.state === filter || (filter === 'draft' && e.status === 'draft'))

    return (
        <>
            <PageTitle title="Events & Timeline" subtitle="Dates drive everything: timeline order, Upcoming/Live/Past badges, the home countdown and Moments ordering.">
                <select className="adm-input" value={filter} onChange={e => setFilter(e.target.value)} style={{ maxWidth: 160 }}>
                    <option value="all">All events</option><option value="upcoming">Upcoming</option><option value="ongoing">Live</option><option value="past">Past</option><option value="draft">Drafts</option>
                </select>
                <button className="adm-btn primary" onClick={() => setEditing({ ...BLANK })}><Icon name="plus" size={16} /> Add Event</button>
            </PageTitle>
            {loading ? <Spinner /> : list.length === 0 ? <Empty icon="calendar">No events here.</Empty> : (
                <div className="adm-timeline">
                    {list.map(e => (
                        <div key={e.id} className={`adm-timeline-item ${e.state}`}>
                            <div className="adm-timeline-date">{formatEventDate(e)}</div>
                            <div className="adm-list-row">
                                <div className="adm-thumb">{e.poster_url ? <img src={thumb(e.poster_url)} alt="" /> : <Icon name="calendar" />}</div>
                                <div className="adm-list-main" onClick={() => setEditing({ ...e })}>
                                    <strong>{e.title}</strong>
                                    <small>/events/{e.slug}{e.venue ? ` · ${e.venue}` : ''}</small>
                                </div>
                                <Badge tone={TONE[e.state]}>{e.state === 'ongoing' ? 'Live' : e.state}</Badge>
                                {e.featured && <Badge tone="accent">Featured</Badge>}
                                {e.status === 'draft' && <Badge tone="warn">Draft</Badge>}
                                {!e.show_in_timeline && <Badge>Hidden</Badge>}
                                <div className="adm-row">
                                    <Link className="adm-btn small ghost" to={`/events/${e.slug}`} target="_blank">View <Icon name="external" size={14} /></Link>
                                    <button className="adm-btn small" onClick={() => setEditing({ ...e })}>Edit</button>
                                    <button className="adm-btn small ghost danger-text" onClick={() => remove(e)} aria-label="Delete"><Icon name="trash" size={16} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Drawer open={!!editing} wide title={editing?.id ? `Edit · ${editing.title}` : 'New event'} onClose={() => setEditing(null)}
                preview={editing && <PreviewFrame path={path} patch={patch} />}
                footer={<>
                    <select className="adm-input" value={editing?.status || 'published'} onChange={ev => setEditing(s => ({ ...s, status: ev.target.value }))} style={{ maxWidth: 160 }}>
                        <option value="published">Published</option><option value="draft">Draft</option>
                    </select>
                    <button className="adm-btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="adm-btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save event'}</button>
                </>}>
                {editing && <FieldForm fields={EVENT_FIELDS} value={editing} onChange={setEditing} />}
            </Drawer>
        </>
    )
}
