import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useSite } from '../../context/SiteContext'
import { MOMENT_FIELDS } from '../../../shared/cms.js'
import { FieldForm, thumb } from '../fields'
import { Drawer, PageTitle, Badge, Empty, Spinner, useToast, useConfirm, useLoader } from '../ui'

export default function MomentsManager() {
    const { refresh } = useSite()
    const toast = useToast()
    const confirm = useConfirm()
    const { data, loading, reload } = useLoader(() => api.get('/admin/moments').then(r => r.items), [])
    const [events, setEvents] = useState([])
    const [editing, setEditing] = useState(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => { api.get('/admin/events').then(r => setEvents(r.items)).catch(() => {}) }, [])

    const save = async () => {
        setSaving(true)
        try {
            if (editing.id) await api.put(`/admin/moments/${editing.id}`, editing)
            else await api.post('/admin/moments', editing)
            toast('Album saved')
            setEditing(null)
            reload()
            refresh(true)
        } catch (e) { toast(e.message, 'error') }
        finally { setSaving(false) }
    }

    const remove = async m => {
        if (!await confirm(`Delete album “${m.title}”? Its photos are also deleted from ImageKit unless they are used elsewhere on the site.`)) return
        try { await api.del(`/admin/moments/${m.id}`); toast('Album deleted'); reload(); refresh(true) }
        catch (e) { toast(e.message, 'error') }
    }

    return (
        <>
            <PageTitle title="Moments (photo albums)" subtitle="Link an album to an event and it is placed by that event's date — change the event date and the album moves with it.">
                <button className="adm-btn primary" onClick={() => setEditing({ title: '', photos: [], event_id: null, show_on_home: false, status: 'published' })}>＋ New Album</button>
            </PageTitle>
            {loading ? <Spinner /> : !data?.length ? <Empty icon="📸">No albums yet.</Empty> : (
                <div className="adm-cards">
                    {data.map(m => (
                        <div key={m.id} className="adm-card album" onClick={() => setEditing({ ...m })}>
                            <div className="adm-album-cover">
                                {m.photos.slice(0, 4).map((p, i) => <img key={i} src={thumb(p)} alt="" loading="lazy" />)}
                            </div>
                            <div className="adm-card-body">
                                <strong>{m.title}</strong>
                                <small>{m.event ? `🔗 ${m.event.title}` : 'Not linked'} · {m.effective_date || 'no date'}</small>
                                <div className="adm-row">
                                    <Badge>{m.photos.length} photos</Badge>
                                    {m.show_on_home && <Badge tone="accent">Home</Badge>}
                                    {m.status === 'draft' && <Badge tone="warn">Draft</Badge>}
                                    <button className="adm-btn small ghost danger-text" style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); remove(m) }}>🗑</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Drawer open={!!editing} wide title={editing?.id ? `Edit · ${editing.title}` : 'New album'} onClose={() => setEditing(null)}
                footer={<>
                    <select className="adm-input" value={editing?.status || 'published'} onChange={e => setEditing(s => ({ ...s, status: e.target.value }))} style={{ maxWidth: 160 }}>
                        <option value="published">Published</option><option value="draft">Draft</option>
                    </select>
                    <button className="adm-btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="adm-btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save album'}</button>
                </>}>
                {editing && <FieldForm fields={MOMENT_FIELDS} value={editing} onChange={setEditing} ctx={{ events }} />}
            </Drawer>
        </>
    )
}
