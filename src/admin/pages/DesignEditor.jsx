import { useEffect, useMemo, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { api } from '../../lib/api'
import { useSite } from '../../context/SiteContext'
import { SECTIONS, HOME_ORDER, FONTS, POSITIONS, fieldsFor, homeOrder } from '../../../shared/layout.js'
import { PageTitle, Spinner, Switch, useToast } from '../ui'
import { PreviewFrame } from '../Preview'
import Icon from '../icons'

const BY_ID = Object.fromEntries(SECTIONS.map(s => [s.id, s]))
const GROUPS = [
    { label: 'Home page', ids: null },
    { label: 'Every page', ids: ['page.header', 'footer.contact', 'footer'] },
    { label: 'Inner pages', ids: SECTIONS.filter(s => !s.id.startsWith('home.') && !['page.header', 'footer.contact', 'footer'].includes(s.id)).map(s => s.id) },
]
const OPTION_LABEL = { '': 'Auto', left: 'Left', center: 'Centre', right: 'Right', narrow: 'Narrow', normal: 'Normal', wide: 'Wide', full: 'Full', cover: 'Fill (crop)', contain: 'Fit whole' }
const optionLabel = o => OPTION_LABEL[o] ?? o.replace('x', ':')
const SHARED = ['page.header', 'footer', 'footer.contact']

/* ---------- controls ---------- */
/** Hex field that keeps what is typed until it forms a full #rrggbb colour. */
function HexInput({ value, onChange }) {
    const [text, setText] = useState(value || '')
    const [last, setLast] = useState(value)
    if (value !== last) { setLast(value); setText(value || '') }
    return (
        <input className="adm-input" value={text} placeholder="Theme colour" style={{ maxWidth: 130 }} spellCheck={false}
            onChange={e => {
                const t = e.target.value.trim()
                setText(t)
                if (/^#[0-9a-f]{6}$/i.test(t)) onChange(t.toLowerCase())
                else if (!t) onChange(undefined)
            }} />
    )
}

function StyleControl({ field, value, onChange }) {
    switch (field.type) {
        case 'font': return (
            <select className="adm-input" value={value || ''} onChange={e => onChange(e.target.value || undefined)} style={value ? { fontFamily: `'${value}'` } : undefined}>
                {FONTS.map(f => <option key={f} value={f}>{f || 'Theme default'}</option>)}
            </select>
        )
        case 'range': {
            const set = value !== undefined
            return (
                <div className="adm-range">
                    <input type="range" min={field.min} max={field.max} step={field.step} value={set ? value : field.def > 0 ? field.def : Math.round((field.min + field.max) / 2)}
                        className={set ? '' : 'unset'} onChange={e => onChange(Number(e.target.value))} />
                    <span>{set ? `${value}${field.unit || ''}` : 'Auto'}</span>
                    {set && <button type="button" className="adm-icon-btn" onClick={() => onChange(undefined)} aria-label="Reset"><Icon name="reset" size={14} /></button>}
                </div>
            )
        }
        case 'enum': return (
            <div className="adm-seg wrap">
                {field.options.map(o => <button key={o} type="button" className={(value || '') === o ? 'on' : ''} onClick={() => onChange(o || undefined)}>{optionLabel(o)}</button>)}
            </div>
        )
        case 'color': return (
            <div className="adm-row">
                <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} className={`adm-swatch${value ? '' : ' unset'}`} />
                <HexInput value={value} onChange={onChange} />
                {value && <button type="button" className="adm-icon-btn" onClick={() => onChange(undefined)} aria-label="Use theme colour"><Icon name="reset" size={14} /></button>}
            </div>
        )
        case 'toggle': return <Switch checked={!!value} onChange={v => onChange(v || undefined)} />
        case 'position': return (
            <div className="adm-pos">
                {POSITIONS.map(p => <button key={p} type="button" className={value === p ? 'on' : ''} onClick={() => onChange(value === p ? undefined : p)} aria-label={p.replace('-', ' ')} title={p.replace('-', ' ')}><span /></button>)}
            </div>
        )
        default: return null
    }
}

function HomeRow({ id, hidden, active, onSelect, onToggle }) {
    const controls = useDragControls()
    return (
        <Reorder.Item value={id} dragListener={false} dragControls={controls} className={`adm-sec-row${active ? ' active' : ''}${hidden ? ' off' : ''}`}>
            <button type="button" className="adm-drag" onPointerDown={e => controls.start(e)} aria-label="Drag to reorder"><Icon name="drag" size={16} /></button>
            <button type="button" className="adm-sec-name" onClick={onSelect}>{BY_ID[id].label}</button>
            <button type="button" className="adm-icon-btn" onClick={onToggle} title={hidden ? 'Show section' : 'Hide section'} aria-label={hidden ? 'Show section' : 'Hide section'}><Icon name={hidden ? 'eyeOff' : 'eye'} size={16} /></button>
        </Reorder.Item>
    )
}

export default function DesignEditor() {
    const { refresh, events } = useSite()
    const toast = useToast()
    const [draft, setDraft] = useState(null)
    const [initial, setInitial] = useState('')
    const [selected, setSelected] = useState('home.hero')
    const [path, setPath] = useState('/')
    const [current, setCurrent] = useState('/')
    const [picking, setPicking] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        api.get('/admin/settings').then(r => {
            const layout = { sections: r.settings.layout?.sections || {}, order: { home: homeOrder(r.settings.layout) } }
            setDraft(layout); setInitial(JSON.stringify(layout))
        }).catch(e => toast(e.message, 'error'))
    }, [toast])

    const dirty = draft && JSON.stringify(draft) !== initial
    const patch = useMemo(() => (draft ? { settings: { layout: draft } } : null), [draft])
    const sec = BY_ID[selected]
    const style = draft?.sections?.[selected] || {}

    const setStyle = (name, v) => setDraft(d => {
        const next = { ...(d.sections[selected] || {}), [name]: v }
        if (v === undefined) delete next[name]
        const sections = { ...d.sections, [selected]: next }
        if (!Object.keys(next).length) delete sections[selected]
        return { ...d, sections }
    })
    const toggleHidden = id => setDraft(d => {
        const next = { ...(d.sections[id] || {}) }
        if (next.hidden) delete next.hidden; else next.hidden = true
        return { ...d, sections: { ...d.sections, [id]: next } }
    })

    /** Select a section from the list and show the page it lives on. */
    const choose = id => {
        setSelected(id)
        if (id.startsWith('home.')) setPath('/')
        else if (SHARED.includes(id)) { if (id === 'page.header' && current === '/') setPath('/timeline') }
        else if (id === 'event.detail') setPath(events[0] ? `/events/${events[0].slug}` : '/timeline')
        else setPath(BY_ID[id].page)
    }

    const save = async () => {
        setSaving(true)
        try {
            const { value } = await api.put('/admin/settings/layout', { value: draft })
            const layout = { sections: value.sections, order: { home: homeOrder(value) } }
            setDraft(layout); setInitial(JSON.stringify(layout))
            toast('Design applied — the live site updates within ~30 seconds')
            refresh(true)
        } catch (e) { toast(e.message, 'error') }
        finally { setSaving(false) }
    }

    if (!draft) return <Spinner />

    const fields = fieldsFor(sec?.kind)
    const groups = [...new Set(fields.map(f => f.group))]

    return (
        <>
            <PageTitle title="Design & Layout" subtitle="Click any part of the preview (or pick from the list) to style it: fonts, sizes, colours, placement and picture shape. Drag home sections to reorder. Nothing changes on the live site until you apply.">
                <button className={`adm-btn${picking ? ' primary' : ''}`} onClick={() => setPicking(v => !v)} aria-pressed={picking}><Icon name="pointer" size={16} /> {picking ? 'Click-to-select on' : 'Click-to-select off'}</button>
                {dirty && <button className="adm-btn ghost" onClick={() => setDraft(JSON.parse(initial))}><Icon name="reset" size={16} /> Discard</button>}
                <button className="adm-btn primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Applying…' : dirty ? 'Apply changes' : 'Applied'}</button>
            </PageTitle>

            <div className="adm-design">
                <aside className="adm-panel adm-design-list">
                    {GROUPS.map(g => (
                        <div key={g.label} className="adm-design-group">
                            <p>{g.label}</p>
                            {g.ids === null ? (
                                <>
                                    <div className={`adm-sec-row${selected === 'home.hero' ? ' active' : ''}`}>
                                        <span className="adm-drag pinned" title="The hero always stays on top"><Icon name="lock" size={14} /></span>
                                        <button type="button" className="adm-sec-name" onClick={() => choose('home.hero')}>Hero</button>
                                    </div>
                                    <Reorder.Group axis="y" values={draft.order.home} onReorder={ids => setDraft(d => ({ ...d, order: { home: ids } }))} className="adm-sec-list">
                                        {draft.order.home.filter(id => HOME_ORDER.includes(id)).map(id => (
                                            <HomeRow key={id} id={id} hidden={!!draft.sections[id]?.hidden} active={selected === id} onSelect={() => choose(id)} onToggle={() => toggleHidden(id)} />
                                        ))}
                                    </Reorder.Group>
                                </>
                            ) : g.ids.map(id => (
                                <div key={id} className={`adm-sec-row${selected === id ? ' active' : ''}${draft.sections[id]?.hidden ? ' off' : ''}`}>
                                    <span className="adm-drag pinned" />
                                    <button type="button" className="adm-sec-name" onClick={() => choose(id)}>{BY_ID[id].label}</button>
                                    {draft.sections[id] && Object.keys(draft.sections[id]).length > 0 && <span className="adm-dot" title="Has custom styles" />}
                                </div>
                            ))}
                        </div>
                    ))}
                </aside>

                <div className="adm-design-preview">
                    <PreviewFrame path={path} patch={patch} selectMode={picking} selected={selected} onSelect={setSelected} onPath={setCurrent}
                        note={picking ? 'Click a section in the preview to select it. Links are disabled while click-to-select is on.' : undefined} />
                </div>

                <aside className="adm-panel adm-design-props">
                    <div className="adm-row between">
                        <h3>{sec?.label}</h3>
                        {Object.keys(style).length > 0 && <button className="adm-btn small ghost" onClick={() => setDraft(d => { const sections = { ...d.sections }; delete sections[selected]; return { ...d, sections } })}><Icon name="reset" size={14} /> Reset</button>}
                    </div>
                    {groups.map(g => (
                        <fieldset key={g} className="adm-props-group">
                            <legend>{g}</legend>
                            {fields.filter(f => f.group === g).map(f => (
                                <div key={f.name} className="adm-prop">
                                    <label>{f.label}</label>
                                    <StyleControl field={f} value={style[f.name]} onChange={v => setStyle(f.name, v)} />
                                </div>
                            ))}
                        </fieldset>
                    ))}
                    <p className="adm-hint">Photos can be cropped one by one: open the item that uses the photo and choose <b>Adjust</b> under the image.</p>
                </aside>
            </div>
            {dirty && <div className="adm-savebar"><span>Unsaved design changes — check them in the preview (try the phone view too), then apply.</span><button className="adm-btn primary" disabled={saving} onClick={save}>Apply changes</button></div>}
        </>
    )
}
