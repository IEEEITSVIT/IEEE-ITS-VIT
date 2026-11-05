import { useRef, useState } from 'react'
import { api } from '../../lib/api'
import { uploadToImageKit, thumb } from '../fields'
import { PageTitle, Empty, Spinner, useToast, useConfirm, useLoader, fmtDate } from '../ui'
import Icon from '../icons'

export default function MediaLibrary() {
    const toast = useToast()
    const confirm = useConfirm()
    const { data, loading, setData } = useLoader(() => api.get('/admin/media'), [])
    const [progress, setProgress] = useState('')
    const [q, setQ] = useState('')
    const fileRef = useRef()

    const upload = async files => {
        let ok = 0
        for (const [i, f] of [...files].entries()) {
            try {
                const item = await uploadToImageKit(f, p => setProgress(`${i + 1}/${files.length} · ${Math.round(p * 100)}%`))
                setData(d => ({ ...d, items: [item, ...d.items] }))
                ok++
            } catch (e) { toast(e.message, 'error') }
        }
        setProgress('')
        if (ok) toast(`Uploaded ${ok} file${ok > 1 ? 's' : ''}`)
    }

    const remove = async m => {
        if (!await confirm(`Delete “${m.name}” from ImageKit permanently?`)) return
        try { await api.del(`/admin/media/${m.id}`); setData(d => ({ ...d, items: d.items.filter(x => x.id !== m.id) })); toast('Deleted') }
        catch (e) { toast(e.message, 'error') }
    }

    const items = (data?.items || []).filter(m => !q || `${m.name} ${m.url}`.toLowerCase().includes(q.toLowerCase()))

    return (
        <>
            <PageTitle title="Media Library" subtitle="Images are stored on ImageKit (optimised + CDN). Drag files anywhere on this page to upload. When a photo is removed from the site and nothing else uses it, it is deleted from ImageKit automatically.">
                <input className="adm-input search" placeholder="Search files…" value={q} onChange={e => setQ(e.target.value)} />
                <button className="adm-btn primary" disabled={!data?.imagekit || !!progress} onClick={() => fileRef.current.click()}>{progress ? `Uploading ${progress}` : '⬆ Upload images'}</button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { upload(e.target.files); e.target.value = '' }} />
            </PageTitle>
            {data && !data.imagekit && <p className="adm-hint warn">ImageKit is not connected. Add IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT to the environment to enable uploads.</p>}
            <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (data?.imagekit) upload(e.dataTransfer.files) }}>
                {loading ? <Spinner /> : items.length === 0 ? <Empty icon="image">No uploads yet.</Empty> : (
                    <div className="adm-media-grid large">
                        {items.map(m => (
                            <figure key={m.id} className="adm-media-card">
                                <img src={thumb(m.url)} alt={m.name} loading="lazy" />
                                <figcaption>
                                    <strong title={m.name}>{m.name || 'image'}</strong>
                                    <small>{m.width ? `${m.width}×${m.height} · ` : ''}{m.size ? `${Math.round(m.size / 1024)} KB · ` : ''}{fmtDate(m.created_at)}</small>
                                    <div className="adm-row">
                                        <button className="adm-btn small" onClick={() => { navigator.clipboard.writeText(m.url); toast('URL copied') }}>Copy URL</button>
                                        <a className="adm-btn small ghost" href={m.url} target="_blank" rel="noreferrer">Open</a>
                                        <button className="adm-btn small ghost danger-text" onClick={() => remove(m)} aria-label="Delete"><Icon name="trash" size={16} /></button>
                                    </div>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}
