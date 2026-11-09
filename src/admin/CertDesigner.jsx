/* Certificate template designer (event portals and the standalone Certificates tool) and a small list editor. */
import { useEffect, useRef, useState } from 'react'
import { Field } from './fields'
import { Switch } from './ui'
import Icon from './icons'
import { CERT_FONTS, certFont, cssFont } from '../lib/certFonts'

export const CERT_KEYS = [['name', 'Participant name'], ['team', 'Team name'], ['event', 'Event title'], ['rank', 'Rank'], ['date', 'Date'], ['regNo', 'Registration no.'], ['custom', 'Custom text']]

/* ---------- small list editors ---------- */
export function ListEditor({ items, onChange, render, blank, max, addLabel }) {
    return (
        <div className="adm-stack">
            {items.map((it, i) => (
                <div key={i} className="adm-row adm-listrow">
                    {render(it, patch => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x))))}
                    <button type="button" className="adm-icon-btn" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Remove"><Icon name="trash" size={15} /></button>
                </div>
            ))}
            {items.length < max && <button type="button" className="adm-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...items, blank(items.length)])}><Icon name="plus" size={14} /> {addLabel}</button>}
        </div>
    )
}

const PALETTE = [['name', 'Name'], ['team', 'Team'], ['event', 'Event'], ['rank', 'Rank'], ['date', 'Date'], ['regNo', 'Reg no'], ['custom', 'Text']]
const newField = (key, x = 50, y = 50) => ({
    key, x, y, size: key === 'name' ? 34 : key === 'custom' ? 22 : 18, color: '#111111', align: 'center', bold: key === 'name', italic: false,
    font: key === 'name' ? 'playfair' : 'helvetica', text: key === 'custom' ? 'Certificate of Participation' : key === 'rank' ? 'Rank #{{rank}}' : '',
})
const SNAP = 1.2 // % distance at which a dragged text snaps to the centre line

/**
 * Certificate designer: drag text chips from the palette onto the template, drag placed text to move it
 * (snaps to the centre), click to select and edit font, size, colour and style. Arrow keys nudge.
 */
export function CertDesigner({ tpl, onChange, sample }) {
    const box = useRef(null)
    const [w, setW] = useState(600)
    const [sel, setSel] = useState(tpl.fields.length ? 0 : -1)
    const [guide, setGuide] = useState(false)
    useEffect(() => {
        const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
        if (box.current) ro.observe(box.current)
        return () => ro.disconnect()
    }, [tpl.image])
    const fields = tpl.fields
    const setField = (i, patch) => onChange({ ...tpl, fields: fields.map((f, k) => (k === i ? { ...f, ...patch } : f)) })
    const add = (key, x, y) => { onChange({ ...tpl, fields: [...fields, newField(key, x, y)] }); setSel(fields.length) }
    const remove = i => { onChange({ ...tpl, fields: fields.filter((_, k) => k !== i) }); setSel(-1) }
    const pos = (clientX, clientY) => {
        const r = box.current.getBoundingClientRect()
        let x = ((clientX - r.left) / r.width) * 100, y = ((clientY - r.top) / r.height) * 100
        const snapped = Math.abs(x - 50) < SNAP
        if (snapped) x = 50
        return { x: Math.round(Math.min(100, Math.max(0, x)) * 10) / 10, y: Math.round(Math.min(100, Math.max(0, y)) * 10) / 10, snapped }
    }
    const startDrag = (i, e) => {
        e.preventDefault(); e.stopPropagation()
        setSel(i)
        const r = e.currentTarget.getBoundingClientRect()
        const f = fields[i]
        // keep the grab point: offset between pointer and the field's anchor
        const anchorX = f.align === 'center' ? r.left + r.width / 2 : f.align === 'right' ? r.right : r.left
        const off = { x: e.clientX - anchorX, y: e.clientY - (r.top + r.height / 2) }
        const move = ev => { const p = pos(ev.clientX - off.x, ev.clientY - off.y); setGuide(p.snapped); setField(i, { x: p.x, y: p.y }) }
        const up = () => { setGuide(false); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    }
    const onKey = e => {
        if (sel < 0 || !fields[sel] || /input|select|textarea/i.test(e.target.tagName)) return
        const step = e.shiftKey ? 2 : 0.5
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
        if (d) { e.preventDefault(); setField(sel, { x: Math.min(100, Math.max(0, +(fields[sel].x + d[0]).toFixed(1))), y: Math.min(100, Math.max(0, +(fields[sel].y + d[1]).toFixed(1))) }) }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(sel) }
    }
    const text = f => (f.text ? f.text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => sample[k] ?? '') : sample[f.key] ?? '')
    const f = fields[sel]

    return (
        <div className="adm-form">
            <div className="adm-field"><span>Template image (PNG or JPG, landscape A4 works best; keep it under 1 MB)</span><Field field={{ type: 'image' }} value={tpl.image} onChange={image => onChange({ ...tpl, image })} /></div>
            {tpl.image && <>
                <div className="adm-cert-palette">
                    <span>Drag onto the certificate:</span>
                    {PALETTE.map(([k, l]) => (
                        <button key={k} type="button" draggable onDragStart={e => { e.dataTransfer.setData('text/cert-field', k); e.dataTransfer.effectAllowed = 'copy' }}
                            onClick={() => add(k, 50, 50)} title="Drag onto the image, or click to add in the centre">+ {l}</button>
                    ))}
                </div>
                <div ref={box} className="adm-cert-canvas" tabIndex={0} onKeyDown={onKey} onPointerDown={() => setSel(-1)}
                    onDragOver={e => { if (e.dataTransfer.types.includes('text/cert-field')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
                    onDrop={e => { const k = e.dataTransfer.getData('text/cert-field'); if (!k) return; e.preventDefault(); const p = pos(e.clientX, e.clientY); add(k, p.x, p.y) }}>
                    <img src={tpl.image} alt="" draggable={false} />
                    {guide && <i className="adm-cert-guide" />}
                    {fields.map((fl, i) => (
                        <span key={i} className={i === sel ? 'on' : ''} onPointerDown={e => startDrag(i, e)} title="Drag to move · arrow keys nudge · Delete removes"
                            style={{ left: `${fl.x}%`, top: `${fl.y}%`, fontSize: (fl.size * w) / 842, color: fl.color, fontFamily: cssFont(certFont(fl.font), fl.bold, fl.italic),
                                fontWeight: fl.bold ? 700 : 400, fontStyle: fl.italic ? 'italic' : 'normal', transform: `translate(${fl.align === 'center' ? '-50%' : fl.align === 'right' ? '-100%' : '0'}, -50%)` }}>
                            {text(fl) || `[${fl.key}]`}
                        </span>
                    ))}
                </div>
                <p className="adm-hint">Click a text to edit it. Drag to move (it snaps to the centre line); arrow keys nudge, Shift + arrow moves further, Delete removes.</p>
            </>}
            {f && (
                <div className="adm-cert-inspector">
                    <div className="adm-row between"><strong>Selected text</strong>
                        <div className="adm-row">
                            <button type="button" className="adm-btn small" onClick={() => { onChange({ ...tpl, fields: [...fields, { ...f, y: Math.min(100, f.y + 8) }] }); setSel(fields.length) }}>Duplicate</button>
                            <button type="button" className="adm-btn small ghost danger-text" onClick={() => remove(sel)}><Icon name="trash" size={14} /> Remove</button>
                        </div>
                    </div>
                    <div className="adm-grid-2">
                        <label className="adm-field"><span>Shows</span>
                            <select className="adm-input" value={f.key} onChange={e => setField(sel, { key: e.target.value })}>{CERT_KEYS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                        </label>
                        <label className="adm-field"><span>Font</span>
                            <select className="adm-input" value={f.font || 'helvetica'} onChange={e => setField(sel, { font: e.target.value })} style={{ fontFamily: cssFont(certFont(f.font), false, false) }}>
                                {CERT_FONTS.map(ft => <option key={ft.id} value={ft.id} style={{ fontFamily: cssFont(ft, false, false) }}>{ft.label}</option>)}
                            </select>
                        </label>
                    </div>
                    <label className="adm-field"><span>{f.key === 'custom' ? 'Text' : 'Text (optional — use {{name}}, {{team}}, {{rank}}, {{event}}, or any sheet column)'}</span>
                        <input className="adm-input" value={f.text || ''} onChange={e => setField(sel, { text: e.target.value })} placeholder={f.key === 'custom' ? 'Certificate of Participation' : `Leave empty to show the ${f.key}`} />
                    </label>
                    <div className="adm-grid-2">
                        <label className="adm-field"><span>Size ({f.size} pt)</span><input type="range" min="8" max="96" value={f.size} onChange={e => setField(sel, { size: Number(e.target.value) })} /></label>
                        <div className="adm-field"><span>Colour</span><div className="adm-row"><input type="color" className="adm-swatch" value={f.color} onChange={e => setField(sel, { color: e.target.value })} /><code>{f.color}</code></div></div>
                    </div>
                    <div className="adm-row wrap">
                        <div className="adm-seg">{[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']].map(([a, l]) => <button key={a} type="button" className={f.align === a ? 'on' : ''} onClick={() => setField(sel, { align: a })}>{l}</button>)}</div>
                        <Switch checked={f.bold} onChange={v => setField(sel, { bold: v })} label="Bold" />
                        <Switch checked={!!f.italic} onChange={v => setField(sel, { italic: v })} label="Italic" />
                        <span className="adm-hint">x {f.x}% · y {f.y}%</span>
                    </div>
                </div>
            )}
            {fields.length > 0 && (
                <div className="adm-row wrap">{fields.map((fl, i) => <button key={i} type="button" className={`adm-chipcheck${i === sel ? ' on' : ''}`} onClick={() => setSel(i)}>{text(fl) || fl.key}</button>)}</div>
            )}
        </div>
    )
}
