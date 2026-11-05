/* Schema-driven form fields for the CMS (see shared/cms.js for field definitions). */
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { img } from '../lib/safe'
import { useSite } from '../context/SiteContext'
import { getPath, setPath } from '../../shared/cms.js'
import { Modal, Switch, useToast, Spinner } from './ui'
import Icon from './icons'

const MAX_UPLOAD = 15 * 1024 * 1024
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif'

/* ---------- ImageKit upload (browser → ImageKit directly, signed by our server) ---------- */
export async function uploadToImageKit(file, onProgress) {
    if (!file.type.startsWith('image/')) throw new Error(`${file.name}: only image files can be uploaded.`)
    if (file.size > MAX_UPLOAD) throw new Error(`${file.name}: file is larger than 15 MB.`)
    const auth = await api.get('/admin/media/auth')
    const body = new FormData()
    body.append('file', file)
    body.append('fileName', file.name.replace(/[^\w.-]+/g, '-'))
    body.append('publicKey', auth.publicKey)
    body.append('signature', auth.signature)
    body.append('expire', String(auth.expire))
    body.append('token', auth.token)
    body.append('folder', auth.folder)
    body.append('useUniqueFileName', 'true')
    const res = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload')
        xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total)
        xhr.onload = () => {
            const data = JSON.parse(xhr.responseText || '{}')
            xhr.status < 300 ? resolve(data) : reject(new Error(data.message || `Upload failed (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(body)
    })
    const { item } = await api.post('/admin/media', {
        url: res.url, fileId: res.fileId, name: res.name, folder: auth.folder, mime: file.type, size: res.size, width: res.width, height: res.height,
    })
    return item
}

/* ---------- Media picker ---------- */
export function MediaPicker({ open, onClose, onPick, multiple }) {
    const [items, setItems] = useState(null)
    const [ikReady, setIkReady] = useState(true)
    const [selected, setSelected] = useState([])
    const [url, setUrl] = useState('')
    const [progress, setProgress] = useState(null)
    const toast = useToast()
    const fileRef = useRef()

    useEffect(() => {
        if (!open) return
        setSelected([])
        api.get('/admin/media').then(r => { setItems(r.items); setIkReady(r.imagekit) }).catch(e => toast(e.message, 'error'))
    }, [open, toast])

    const upload = async files => {
        const done = []
        for (const [i, f] of [...files].entries()) {
            try {
                const item = await uploadToImageKit(f, p => setProgress(`${i + 1}/${files.length} · ${Math.round(p * 100)}%`))
                done.push(item)
            } catch (e) { toast(e.message, 'error') }
        }
        setProgress(null)
        if (done.length) {
            setItems(list => [...done, ...(list || [])])
            setSelected(s => (multiple ? [...s, ...done.map(d => d.url)] : [done[0].url]))
            toast(`Uploaded ${done.length} file${done.length > 1 ? 's' : ''} to ImageKit`)
        }
    }

    const toggle = u => setSelected(s => (multiple ? (s.includes(u) ? s.filter(x => x !== u) : [...s, u]) : [u]))
    const finish = () => { if (selected.length) onPick(multiple ? selected : selected[0]); onClose() }

    return (
        <Modal open={open} onClose={onClose} title="Media library" wide>
            <div className="adm-picker-bar">
                <button className="adm-btn primary" disabled={!ikReady || !!progress} onClick={() => fileRef.current.click()}>
                    {progress ? `Uploading ${progress}` : 'Upload to ImageKit'}
                </button>
                <input ref={fileRef} type="file" accept={ACCEPT} multiple={multiple} hidden onChange={e => { upload(e.target.files); e.target.value = '' }} />
                <div className="adm-row grow">
                    <input className="adm-input" placeholder="…or paste an image URL / path (e.g. /logo-round.png)" value={url} onChange={e => setUrl(e.target.value)} />
                    <button className="adm-btn" disabled={!url.trim()} onClick={() => { onPick(multiple ? [url.trim()] : url.trim()); setUrl(''); onClose() }}>Use URL</button>
                </div>
            </div>
            {!ikReady && <p className="adm-hint warn">ImageKit keys are not configured yet — paste image URLs for now, or add IMAGEKIT_* environment variables.</p>}
            <div
                className="adm-media-grid"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (ikReady) upload(e.dataTransfer.files) }}
            >
                {items === null ? <Spinner /> : items.length === 0 ? <p className="adm-hint">No uploads yet. Drag images here or use Upload.</p> : items.map(m => (
                    <button key={m.id} className={`adm-media-tile${selected.includes(m.url) ? ' selected' : ''}`} onClick={() => toggle(m.url)} title={m.name}>
                        <img src={thumb(m.url)} alt={m.name} loading="lazy" />
                    </button>
                ))}
            </div>
            <div className="adm-row end" style={{ marginTop: 14 }}>
                <span className="adm-hint">{selected.length} selected</span>
                <button className="adm-btn ghost" onClick={onClose}>Cancel</button>
                <button className="adm-btn primary" disabled={!selected.length} onClick={finish}>Use selected</button>
            </div>
        </Modal>
    )
}

export const thumb = u => (/ik\.imagekit\.io/.test(u) ? `${u}${u.includes('?') ? '&' : '?'}tr=w-300,h-300,c-at_max` : u)

/* ---------- Crop / fit editor (stored per image in settings.image_styles) ---------- */
const CROP_DEFAULT = { fit: 'cover', x: 50, y: 50, zoom: 1 }
const SHAPES = [['1x1', 'Square'], ['4x5', 'Portrait'], ['4x3', 'Card'], ['16x9', 'Wide'], ['21x9', 'Banner']]
const cropStyle = st => ({ objectFit: st.fit, objectPosition: `${st.x}% ${st.y}%`, ...(st.zoom > 1 ? { scale: String(st.zoom), transformOrigin: `${st.x}% ${st.y}%` } : {}) })
const ratioOf = r => r.replace('x', ' / ')

export function ImageAdjust({ url, onClose }) {
    const { settings, refresh } = useSite()
    const toast = useToast()
    const [st, setSt] = useState(() => ({ ...CROP_DEFAULT, ...(settings.image_styles?.[url] || {}) }))
    const [shape, setShape] = useState('16x9')
    const [saving, setSaving] = useState(false)
    const drag = useRef(null)
    const src = img(url, { w: 1400 })

    const onDown = e => {
        if (st.fit !== 'cover') return
        e.currentTarget.setPointerCapture(e.pointerId)
        const r = e.currentTarget.getBoundingClientRect()
        drag.current = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y, w: r.width, h: r.height }
    }
    const onMove = e => {
        const d = drag.current
        if (!d) return
        const clamp = v => Math.round(Math.min(100, Math.max(0, v)))
        // Dragging the photo right reveals more of its left side, so the focal point moves the other way.
        setSt(s => ({ ...s, x: clamp(d.sx - ((e.clientX - d.x) / d.w) * 100 / s.zoom), y: clamp(d.sy - ((e.clientY - d.y) / d.h) * 100 / s.zoom) }))
    }
    const apply = async () => {
        setSaving(true)
        try {
            const same = st.fit === 'cover' && st.x === 50 && st.y === 50 && st.zoom === 1
            await api.put('/admin/settings/image_styles', { value: { [url]: same ? null : st } })
            toast('Photo framing applied everywhere this photo is used')
            refresh(true)
            onClose()
        } catch (e) { toast(e.message, 'error') }
        finally { setSaving(false) }
    }

    return (
        <Modal open onClose={onClose} title="Adjust photo" wide>
            <div className="adm-crop">
                <div className="adm-crop-main">
                    <div className="adm-seg wrap">
                        {SHAPES.map(([r, l]) => <button key={r} type="button" className={shape === r ? 'on' : ''} onClick={() => setShape(r)}>{l} {r.replace('x', ':')}</button>)}
                    </div>
                    <div className={`adm-crop-stage${st.fit === 'cover' ? ' draggable' : ''}`} style={{ aspectRatio: ratioOf(shape), width: `min(100%, calc(58vh * ${ratioOf(shape)}))` }}
                        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
                        <img src={src} alt="" draggable={false} style={cropStyle(st)} />
                        {st.fit === 'cover' && <span className="adm-crop-hint">Drag to reposition</span>}
                    </div>
                </div>
                <div className="adm-crop-side">
                    <div className="adm-prop"><label>Fit</label>
                        <div className="adm-seg">
                            <button type="button" className={st.fit === 'cover' ? 'on' : ''} onClick={() => setSt(s => ({ ...s, fit: 'cover' }))}>Fill frame (crop)</button>
                            <button type="button" className={st.fit === 'contain' ? 'on' : ''} onClick={() => setSt(s => ({ ...s, fit: 'contain', zoom: 1 }))}>Show whole photo</button>
                        </div>
                    </div>
                    <div className="adm-prop"><label>Zoom</label>
                        <div className="adm-range">
                            <input type="range" min="1" max="3" step="0.05" value={st.zoom} disabled={st.fit !== 'cover'} onChange={e => setSt(s => ({ ...s, zoom: Number(e.target.value) }))} />
                            <span>{Math.round(st.zoom * 100)}%</span>
                        </div>
                    </div>
                    <div className="adm-prop"><label>Focus point</label><span className="adm-hint">{st.x}% across · {st.y}% down</span></div>
                    <p className="adm-hint">How it will look in each frame used on the site:</p>
                    <div className="adm-crop-strip">
                        {SHAPES.map(([r, l]) => (
                            <figure key={r}><div style={{ aspectRatio: ratioOf(r) }}><img src={src} alt="" style={cropStyle(st)} /></div><figcaption>{l}</figcaption></figure>
                        ))}
                    </div>
                </div>
            </div>
            <div className="adm-row end">
                <button type="button" className="adm-btn ghost" onClick={() => setSt(CROP_DEFAULT)}><Icon name="reset" size={15} /> Reset</button>
                <button type="button" className="adm-btn ghost" onClick={onClose}>Cancel</button>
                <button type="button" className="adm-btn primary" disabled={saving} onClick={apply}>{saving ? 'Applying…' : 'Apply'}</button>
            </div>
        </Modal>
    )
}

/* ---------- Single image ---------- */
function ImageInput({ value, onChange }) {
    const [open, setOpen] = useState(false)
    const [adjust, setAdjust] = useState(false)
    const [busy, setBusy] = useState(false)
    const toast = useToast()
    const fileRef = useRef()
    const quickUpload = async f => {
        if (!f) return
        setBusy(true)
        try { onChange((await uploadToImageKit(f)).url); toast('Image uploaded') }
        catch (e) { toast(e.message, 'error') }
        finally { setBusy(false) }
    }
    return (
        <div className="adm-image-input" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); quickUpload(e.dataTransfer.files[0]) }}>
            <div className="adm-image-preview">{value ? <img src={thumb(value)} alt="" /> : <span>No image</span>}</div>
            <div className="adm-image-actions">
                <input className="adm-input" value={value || ''} placeholder="Image URL" onChange={e => onChange(e.target.value)} />
                <div className="adm-row">
                    <button type="button" className="adm-btn small" onClick={() => setOpen(true)}>Library</button>
                    <button type="button" className="adm-btn small" disabled={busy} onClick={() => fileRef.current.click()}>{busy ? 'Uploading…' : 'Upload'}</button>
                    {value && <button type="button" className="adm-btn small" onClick={() => setAdjust(true)}><Icon name="crop" size={14} /> Adjust</button>}
                    {value && <button type="button" className="adm-btn small ghost" onClick={() => onChange('')}>Remove</button>}
                </div>
                <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={e => { quickUpload(e.target.files[0]); e.target.value = '' }} />
            </div>
            <MediaPicker open={open} onClose={() => setOpen(false)} onPick={onChange} />
            {adjust && value && <ImageAdjust url={value} onClose={() => setAdjust(false)} />}
        </div>
    )
}

/* ---------- Image list (albums) ---------- */
function ImagesInput({ value = [], onChange }) {
    const [open, setOpen] = useState(false)
    const [adjust, setAdjust] = useState(null)
    const move = (i, d) => {
        const j = i + d
        if (j < 0 || j >= value.length) return
        const next = [...value];
        [next[i], next[j]] = [next[j], next[i]]
        onChange(next)
    }
    return (
        <div>
            <div className="adm-images">
                {value.map((u, i) => (
                    <div key={`${u}-${i}`} className="adm-images-item">
                        <img src={thumb(u)} alt="" loading="lazy" />
                        <div className="adm-images-tools">
                            <button type="button" onClick={() => move(i, -1)} aria-label="Move left">◀</button>
                            <button type="button" onClick={() => setAdjust(u)} aria-label="Adjust crop" title="Adjust crop"><Icon name="crop" size={13} /></button>
                            <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Remove">✕</button>
                            <button type="button" onClick={() => move(i, 1)} aria-label="Move right">▶</button>
                        </div>
                        {i === 0 && <span className="adm-cover">Cover</span>}
                    </div>
                ))}
                <button type="button" className="adm-images-add" onClick={() => setOpen(true)}>＋ Add photos</button>
            </div>
            <MediaPicker open={open} multiple onClose={() => setOpen(false)} onPick={urls => onChange([...value, ...urls])} />
            {adjust && <ImageAdjust url={adjust} onClose={() => setAdjust(null)} />}
        </div>
    )
}

/* ---------- Rich text ---------- */
function RichText({ value, onChange }) {
    const ref = useRef()
    const [source, setSource] = useState(false)
    useEffect(() => {
        if (!source && ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || ''
    }, [value, source])
    const cmd = (c, arg) => { ref.current.focus(); document.execCommand(c, false, arg); onChange(ref.current.innerHTML) }
    return (
        <div className="adm-rte">
            <div className="adm-rte-bar">
                <button type="button" onClick={() => cmd('bold')}><b>B</b></button>
                <button type="button" onClick={() => cmd('italic')}><i>I</i></button>
                <button type="button" onClick={() => cmd('formatBlock', 'h2')}>H2</button>
                <button type="button" onClick={() => cmd('formatBlock', 'h3')}>H3</button>
                <button type="button" onClick={() => cmd('formatBlock', 'p')}>¶</button>
                <button type="button" onClick={() => cmd('insertUnorderedList')}>• List</button>
                <button type="button" onClick={() => cmd('insertOrderedList')}>1. List</button>
                <button type="button" onClick={() => cmd('formatBlock', 'blockquote')}>❝</button>
                <button type="button" onClick={() => { const u = prompt('Link URL (https://…)'); if (u && /^(https?:|mailto:|\/)/.test(u)) cmd('createLink', u) }}>Link</button>
                <button type="button" onClick={() => { const u = prompt('Image URL'); if (u && /^(https?:|\/)/.test(u)) cmd('insertImage', u) }}>Image</button>
                <button type="button" onClick={() => cmd('removeFormat')}>⌫</button>
                <button type="button" className={source ? 'on' : ''} onClick={() => setSource(s => !s)}>{'</>'}</button>
            </div>
            {source
                ? <textarea className="adm-input mono" rows={14} value={value || ''} onChange={e => onChange(e.target.value)} />
                : <div ref={ref} className="adm-rte-body" contentEditable suppressContentEditableWarning onInput={e => onChange(e.currentTarget.innerHTML)} />}
        </div>
    )
}

/* ---------- Rows (array of objects) ---------- */
function RowsInput({ field, value = [], onChange }) {
    const sub = field.fields || []
    const update = (i, k, v) => onChange(value.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
    return (
        <div className="adm-rows">
            {value.map((row, i) => (
                <div className="adm-rows-item" key={i}>
                    {sub.map(sf => (
                        <input key={sf.name} className="adm-input" placeholder={sf.label} value={row[sf.name] || ''} onChange={e => update(i, sf.name, e.target.value)} />
                    ))}
                    <button type="button" className="adm-icon-btn" onClick={() => i > 0 && onChange(value.map((r, j) => (j === i - 1 ? value[i] : j === i ? value[i - 1] : r)))} aria-label="Move up">↑</button>
                    <button type="button" className="adm-icon-btn" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
                </div>
            ))}
            <button type="button" className="adm-btn small" onClick={() => onChange([...value, Object.fromEntries(sub.map(s => [s.name, '']))])}>＋ Add row</button>
        </div>
    )
}

/* ---------- Per-page SEO ---------- */
function SeoPagesInput({ value = {}, onChange }) {
    const [newPath, setNewPath] = useState('')
    const set = (path, k, v) => onChange({ ...value, [path]: { ...(value[path] || {}), [k]: v } })
    return (
        <div className="adm-seo-pages">
            {Object.entries(value).map(([path, p]) => (
                <details key={path} className="adm-seo-page">
                    <summary><code>{path}</code> <span>{p.title || '—'}</span>{p.noindex && <em>noindex</em>}</summary>
                    <input className="adm-input" placeholder="Title" value={p.title || ''} onChange={e => set(path, 'title', e.target.value)} />
                    <textarea className="adm-input" rows={2} placeholder="Meta description (aim for 120–160 characters)" value={p.description || ''} onChange={e => set(path, 'description', e.target.value)} />
                    <div className="adm-hint">{(p.description || '').length} characters</div>
                    <input className="adm-input" placeholder="Share image URL (optional)" value={p.image || ''} onChange={e => set(path, 'image', e.target.value)} />
                    <div className="adm-row">
                        <Switch checked={p.noindex} onChange={v => set(path, 'noindex', v)} label="Hide from search engines" />
                        <button type="button" className="adm-btn small ghost" onClick={() => { const n = { ...value }; delete n[path]; onChange(n) }}>Remove</button>
                    </div>
                </details>
            ))}
            <div className="adm-row">
                <input className="adm-input" placeholder="/path" value={newPath} onChange={e => setNewPath(e.target.value)} />
                <button type="button" className="adm-btn small" onClick={() => { if (newPath.startsWith('/')) { onChange({ ...value, [newPath]: {} }); setNewPath('') } }}>Add page</button>
            </div>
        </div>
    )
}

/* ---------- Field switch ---------- */
export function Field({ field, value, onChange, ctx = {} }) {
    const common = { className: 'adm-input', value: value ?? '', onChange: e => onChange(e.target.value) }
    switch (field.type) {
        case 'textarea': return <textarea {...common} rows={4} />
        case 'html': return <RichText value={value} onChange={onChange} />
        case 'url': return <input {...common} placeholder="/page or https://…" />
        case 'image': return <ImageInput value={value} onChange={onChange} />
        case 'images': return <ImagesInput value={value || []} onChange={onChange} />
        case 'number': return <input {...common} type="number" onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
        case 'toggle': return <Switch checked={value} onChange={onChange} />
        case 'select': return <select {...common}>{field.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
        case 'date': return <input {...common} type="date" />
        case 'color': return (
            <div className="adm-row">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={e => onChange(e.target.value)} style={{ width: 44, height: 36, border: 'none', background: 'none', padding: 0 }} />
                <input {...common} style={{ maxWidth: 140 }} />
            </div>
        )
        case 'strings': return <textarea className="adm-input" rows={5} value={(value || []).join('\n')} onChange={e => onChange(e.target.value.split('\n'))} />
        case 'colors': return (
            <div className="adm-row wrap">
                {(value || []).map((c, i) => (
                    <span key={i} className="adm-color">
                        <input type="color" value={/^#[0-9a-f]{6}$/i.test(c) ? c : '#000000'} onChange={e => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
                        <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove colour">✕</button>
                    </span>
                ))}
                <button type="button" className="adm-btn small" onClick={() => onChange([...(value || []), '#121212'])}>＋ Colour</button>
            </div>
        )
        case 'rows': return <RowsInput field={field} value={value || []} onChange={onChange} />
        case 'event': return (
            <select {...common} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Not linked —</option>
                {(ctx.events || []).map(ev => <option key={ev.id} value={ev.id}>{ev.start_date} · {ev.title}</option>)}
            </select>
        )
        case 'seo-pages': return <SeoPagesInput value={value || {}} onChange={onChange} />
        default: return <input {...common} />
    }
}

/** Renders a list of fields bound to dot-paths inside `value`. */
export function FieldForm({ fields, value, onChange, ctx }) {
    return (
        <div className="adm-form">
            {fields.map(f => (
                <div key={f.name} className={`adm-field type-${f.type}`}>
                    <label>{f.label}{f.required && <span className="req">*</span>}</label>
                    <Field field={f} ctx={ctx} value={getPath(value, f.name)} onChange={v => onChange(setPath(value, f.name, v))} />
                    {f.help && <div className="adm-hint">{f.help}</div>}
                </div>
            ))}
        </div>
    )
}
