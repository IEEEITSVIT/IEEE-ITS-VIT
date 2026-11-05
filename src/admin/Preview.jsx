/* Live preview of the public site inside the admin. Unsaved edits are streamed into the page
   (see PREVIEW in SiteContext and PreviewBridge), so nothing is live until the editor saves. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSite } from '../context/SiteContext'
import Icon from './icons'

const DEVICES = [
    { id: 'desktop', label: 'Desktop', width: 1280, icon: 'monitor' },
    { id: 'tablet', label: 'Tablet', width: 820, icon: 'tablet' },
    { id: 'phone', label: 'Phone', width: 390, icon: 'phone' },
]

/** Replace (or append) one item in a list by id — used to build preview patches. */
export const withItem = (list = [], item) =>
    list.some(x => x.id === item.id) ? list.map(x => (x.id === item.id ? item : x)) : [...list, item]

export function PreviewFrame({ path = '/', patch: draft, selectMode = false, selected, onSelect, onPath, note, focus }) {
    // Photo crops are applied straight away from the Adjust dialog, so the preview always carries the latest ones.
    const { settings } = useSite()
    const imageStyles = settings.image_styles
    const patch = useMemo(() => ({ ...draft, settings: { image_styles: imageStyles, ...draft?.settings } }), [draft, imageStyles])
    const frame = useRef(null)
    const box = useRef(null)
    const [device, setDevice] = useState('desktop')
    const [size, setSize] = useState({ w: 900, h: 700 })
    const [ready, setReady] = useState(false)
    const [current, setCurrent] = useState(path)
    const [address, setAddress] = useState(path)
    const [src, setSrc] = useState(path)
    const latest = useRef({})
    useLayoutEffect(() => { latest.current = { patch, selectMode, selected, onSelect, onPath, focus } })

    const post = useCallback(msg => frame.current?.contentWindow?.postMessage(msg, window.location.origin), [])

    useEffect(() => {
        const onMessage = e => {
            if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
            const m = e.data || {}
            const l = latest.current
            if (m.type === 'its-ready') {
                setReady(true)
                post({ type: 'its-preview', patch: l.patch })
                post({ type: 'its-select-mode', on: l.selectMode })
                if (l.selected) post({ type: 'its-focus', id: l.selected, scroll: false })
                if (l.focus) post({ type: 'its-focus', id: l.focus, highlight: false })
            }
            if (m.type === 'its-path') { setCurrent(m.path); setAddress(m.path); l.onPath?.(m.path) }
            if (m.type === 'its-select') l.onSelect?.(m.id)
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [post])

    useEffect(() => {
        if (!ready) return
        const t = setTimeout(() => post({ type: 'its-preview', patch }), 120)
        return () => clearTimeout(t)
    }, [patch, ready, post])
    useEffect(() => { if (ready) post({ type: 'its-select-mode', on: selectMode }) }, [selectMode, ready, post])
    useEffect(() => { if (ready && selected) post({ type: 'its-focus', id: selected }) }, [selected, ready, post])
    useEffect(() => {
        if (!ready || !path) return
        post({ type: 'its-navigate', path })
        if (latest.current.focus) post({ type: 'its-focus', id: latest.current.focus, highlight: false })
    }, [path, ready, post])

    useEffect(() => {
        const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
        if (box.current) ro.observe(box.current)
        return () => ro.disconnect()
    }, [])

    const go = p => { if (p.startsWith('/') && !p.startsWith('/admin')) post({ type: 'its-navigate', path: p }) }
    const reload = () => { setReady(false); setSrc(`${current}${current.includes('?') ? '&' : '?'}r=${Date.now()}`) }

    const width = DEVICES.find(d => d.id === device).width
    const scale = Math.min(1, size.w / width)

    return (
        <div className="adm-preview">
            <div className="adm-preview-bar">
                <div className="adm-seg" role="group" aria-label="Preview size">
                    {DEVICES.map(d => (
                        <button key={d.id} type="button" className={device === d.id ? 'on' : ''} onClick={() => setDevice(d.id)} title={`${d.label} (${d.width}px)`} aria-pressed={device === d.id}>
                            <Icon name={d.icon} size={16} />
                        </button>
                    ))}
                </div>
                <form className="adm-preview-url" onSubmit={e => { e.preventDefault(); go(address) }}>
                    <input className="adm-input" value={address} onChange={e => setAddress(e.target.value)} aria-label="Preview page" />
                </form>
                <button type="button" className="adm-btn small ghost" onClick={reload} title="Reload preview"><Icon name="refresh" size={16} /></button>
                <a className="adm-btn small ghost" href={current} target="_blank" rel="noreferrer" title="Open the live page (without your unsaved changes)"><Icon name="external" size={16} /></a>
            </div>
            <div className="adm-preview-stage" ref={box}>
                <iframe
                    ref={frame} name="its-preview" title="Website preview" src={src}
                    style={{ width, height: size.h / scale, transform: `scale(${scale})`, left: Math.max(0, (size.w - width * scale) / 2) }}
                />
                {!ready && <div className="adm-preview-loading">Loading preview…</div>}
            </div>
            <div className="adm-preview-note">{note || 'Preview of your unsaved changes. Nothing is live until you save.'}</div>
        </div>
    )
}
