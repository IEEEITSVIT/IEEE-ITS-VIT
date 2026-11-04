import { useEffect, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { api } from '../../lib/api'
import { useSite } from '../../context/SiteContext'
import { CONTENT_TYPES } from '../../../shared/cms.js'
import { FieldForm, thumb } from '../fields'
import { Drawer, PageTitle, Badge, Empty, Spinner, useToast, useConfirm, useLoader, Switch } from '../ui'

const toLocalInput = v => (v ? String(v).replace(' ', 'T').slice(0, 16) : '')

function blank(def) {
    const d = {}
    for (const f of def.fields) {
        if (f.type === 'toggle') d[f.name] = false
        else if (['images', 'strings', 'colors', 'rows'].includes(f.type)) d[f.name] = []
        else if (f.type === 'select') d[f.name] = f.options[0]
    }
    return d
}

function strip(item) {
    // eslint-disable-next-line no-unused-vars
    const { id, _status, _sort, _starts_at, _ends_at, _updated_at, ...data } = item
    return data
}

function Row({ item, def, onEdit, onToggle, onDuplicate, onDelete }) {
    const controls = useDragControls()
    const now = new Date().toISOString().slice(0, 16)
    const scheduled = (item._starts_at && toLocalInput(item._starts_at) > now) ? 'Scheduled' : (item._ends_at && toLocalInput(item._ends_at) < now) ? 'Expired' : null
    const image = def.image ? item[def.image] : null
    return (
        <Reorder.Item value={item} dragListener={false} dragControls={controls} className="adm-list-row" whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,.15)' }}>
            <button className="adm-drag" onPointerDown={e => controls.start(e)} aria-label="Drag to reorder">⋮⋮</button>
            {def.image && <div className="adm-thumb">{image ? <img src={thumb(image)} alt="" /> : <span>—</span>}</div>}
            <div className="adm-list-main" onClick={onEdit}>
                <strong>{item[def.title] || <em>Untitled</em>}</strong>
                <small>{def.fields.filter(f => f.name !== def.title && ['text', 'url'].includes(f.type)).slice(0, 2).map(f => item[f.name]).filter(Boolean).join(' · ')}</small>
            </div>
            {scheduled && <Badge tone="warn">{scheduled}</Badge>}
            <Switch checked={item._status === 'published'} onChange={onToggle} label={item._status === 'published' ? 'Live' : 'Draft'} />
            <div className="adm-row">
                <button className="adm-btn small" onClick={onEdit}>Edit</button>
                <button className="adm-btn small ghost" onClick={onDuplicate} title="Duplicate">⧉</button>
                <button className="adm-btn small ghost danger-text" onClick={onDelete} title="Delete">🗑</button>
            </div>
        </Reorder.Item>
    )
}

export default function ContentManager({ type }) {
    const def = CONTENT_TYPES[type]
    const { refresh } = useSite()
    const toast = useToast()
    const confirm = useConfirm()
    const { data, loading, error, reload, setData } = useLoader(() => api.get(`/admin/content/${type}`).then(r => r.items), [type])
    const [items, setItems] = useState([])
    const [editing, setEditing] = useState(null) // { id?, data, status, starts_at, ends_at }
    const [saving, setSaving] = useState(false)
    const [q, setQ] = useState('')

    useEffect(() => { setItems(data || []) }, [data])

    const afterChange = () => { refresh(true) }

    const save = async () => {
        setSaving(true)
        try {
            const body = { data: editing.data, status: editing.status, starts_at: editing.starts_at || null, ends_at: editing.ends_at || null }
            const { item } = editing.id ? await api.put(`/admin/content/${type}/${editing.id}`, body) : await api.post(`/admin/content/${type}`, body)
            setData(list => (editing.id ? list.map(x => (x.id === item.id ? item : x)) : [...list, item]))
            toast(`${def.singular} ${editing.id ? 'updated' : 'created'}`)
            setEditing(null)
            afterChange()
        } catch (e) { toast(e.message, 'error') }
        finally { setSaving(false) }
    }

    const toggle = async (item, on) => {
        try {
            const { item: updated } = await api.put(`/admin/content/${type}/${item.id}`, { data: strip(item), status: on ? 'published' : 'draft', starts_at: item._starts_at, ends_at: item._ends_at })
            setData(list => list.map(x => (x.id === item.id ? updated : x)))
            toast(on ? 'Published' : 'Moved to drafts')
            afterChange()
        } catch (e) { toast(e.message, 'error') }
    }

    const duplicate = async item => {
        try {
            const d = strip(item)
            if (d.slug) d.slug = `${d.slug}-copy`
            const { item: created } = await api.post(`/admin/content/${type}`, { data: { ...d, [def.title]: `${d[def.title] || ''} (copy)` }, status: 'draft' })
            setData(list => [...list, created])
            toast('Duplicated as draft')
        } catch (e) { toast(e.message, 'error') }
    }

    const remove = async item => {
        if (!await confirm(`Delete “${item[def.title] || def.singular}”? This cannot be undone.`)) return
        try {
            await api.del(`/admin/content/${type}/${item.id}`)
            setData(list => list.filter(x => x.id !== item.id))
            toast('Deleted')
            afterChange()
        } catch (e) { toast(e.message, 'error') }
    }

    const persistOrder = async () => {
        try {
            await api.post(`/admin/content/${type}/reorder`, { ids: items.map(i => i.id) })
            setData(items)
            afterChange()
        } catch (e) { toast(e.message, 'error'); reload() }
    }

    const filtered = q ? items.filter(i => JSON.stringify(i).toLowerCase().includes(q.toLowerCase())) : items

    return (
        <>
            <PageTitle title={def.label} subtitle={def.help}>
                <input className="adm-input search" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
                <button className="adm-btn primary" onClick={() => setEditing({ data: blank(def), status: 'published' })}>＋ Add {def.singular}</button>
            </PageTitle>
            {loading ? <Spinner /> : error ? <p className="adm-hint warn">{error}</p> : filtered.length === 0 ? (
                <Empty>No {def.label.toLowerCase()} yet.</Empty>
            ) : (
                <Reorder.Group axis="y" values={items} onReorder={q ? () => {} : setItems} className="adm-list" onPointerUp={() => !q && JSON.stringify(items.map(i => i.id)) !== JSON.stringify((data || []).map(i => i.id)) && persistOrder()}>
                    {filtered.map(item => (
                        <Row key={item.id} item={item} def={def}
                            onEdit={() => setEditing({ id: item.id, data: strip(item), status: item._status, starts_at: toLocalInput(item._starts_at), ends_at: toLocalInput(item._ends_at) })}
                            onToggle={on => toggle(item, on)} onDuplicate={() => duplicate(item)} onDelete={() => remove(item)} />
                    ))}
                </Reorder.Group>
            )}
            <p className="adm-hint">Drag ⋮⋮ to reorder — the website follows this order.</p>

            <Drawer open={!!editing} title={`${editing?.id ? 'Edit' : 'New'} ${def.singular}`} onClose={() => setEditing(null)}
                footer={<>
                    <select className="adm-input" value={editing?.status || 'published'} onChange={e => setEditing(s => ({ ...s, status: e.target.value }))} style={{ maxWidth: 160 }}>
                        <option value="published">Published</option><option value="draft">Draft</option>
                    </select>
                    <button className="adm-btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="adm-btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
                </>}>
                {editing && <>
                    <FieldForm fields={def.fields} value={editing.data} onChange={d => setEditing(s => ({ ...s, data: d }))} />
                    <fieldset className="adm-fieldset">
                        <legend>Schedule (optional)</legend>
                        <div className="adm-grid-2">
                            <label className="adm-field"><span>Show from</span><input type="datetime-local" className="adm-input" value={editing.starts_at || ''} onChange={e => setEditing(s => ({ ...s, starts_at: e.target.value }))} /></label>
                            <label className="adm-field"><span>Hide after</span><input type="datetime-local" className="adm-input" value={editing.ends_at || ''} onChange={e => setEditing(s => ({ ...s, ends_at: e.target.value }))} /></label>
                        </div>
                        <div className="adm-hint">Times are in UTC. Leave empty to show whenever the item is published.</div>
                    </fieldset>
                </>}
            </Drawer>
        </>
    )
}
