import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useSite } from '../context/SiteContext'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import Img from '../components/Img'
import Lightbox from '../components/Lightbox'
import { Reveal } from '../components/Reveal'

/* Albums are ordered by their linked event's date (or their own album date). */
export default function Moments() {
    const { moments } = useSite()
    const { hash } = useLocation()
    const [open, setOpen] = useState(null)
    const albums = moments.filter(m => m.photos?.length)
    const years = [...new Set(albums.map(a => (a.effective_date || '').slice(0, 4) || '—'))]

    useEffect(() => {
        if (!hash) return
        const t = setTimeout(() => {
            const el = document.querySelector(hash)
            if (!el) return
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.classList.add('highlight-ring')
            setTimeout(() => el.classList.remove('highlight-ring'), 2200)
        }, 500)
        return () => clearTimeout(t)
    }, [hash, albums.length])

    return (
        <>
            <Seo />
            <PageHeader page="moments" />
            <section className="section" style={{ borderTop: 0, paddingTop: 0 }}>
                <div className="wrap tl">
                    {years.map(y => (
                        <div className="tl-year" key={y}>
                            <h2 className="display h-lg">{y}</h2>
                            <div className="grid g-2">
                                {albums.filter(a => ((a.effective_date || '').slice(0, 4) || '—') === y).map((a, i) => (
                                    <Reveal key={a.id} delay={(i % 2) * 0.06}>
                                        <div className="card" id={`album-${a.id}`}>
                                            <button onClick={() => setOpen(a)} style={{ padding: 0, border: 0, background: 'none', cursor: 'zoom-in' }} aria-label={`Open ${a.title}`}>
                                                <Img src={a.photos[0]} alt={a.title} ratio="4x3" width={800}>
                                                    <span className="chip">{a.photos.length} photos</span>
                                                </Img>
                                            </button>
                                            <div className="card-body">
                                                <h3 className="display h-sm">{a.title}</h3>
                                                {a.event && <Link to={`/events/${a.event.slug}`} className="card-meta"><span>{a.event.title} →</span></Link>}
                                            </div>
                                        </div>
                                    </Reveal>
                                ))}
                            </div>
                        </div>
                    ))}
                    {!albums.length && <p className="empty">No albums yet</p>}
                </div>
            </section>
            <AnimatePresence>{open && <Lightbox photos={open.photos} title={open.title} onClose={() => setOpen(null)} />}</AnimatePresence>
        </>
    )
}
