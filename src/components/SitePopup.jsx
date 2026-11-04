import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import SmartLink from './SmartLink'
import Img from './Img'
import { label } from '../lib/safe'

const storageFor = f => (f === 'once' || f === 'once-per-day' ? localStorage : sessionStorage)

function shouldShow(p) {
    if (p.frequency === 'every-visit') return true
    try {
        const raw = storageFor(p.frequency).getItem(`ieee_its_popup_${p.id}`)
        if (!raw) return true
        if (p.frequency === 'once-per-day') return Date.now() - Number(raw) > 864e5
        return false
    } catch { return true }
}

function markShown(p) {
    try { storageFor(p.frequency).setItem(`ieee_its_popup_${p.id}`, String(Date.now())) } catch { /* ignore */ }
}

const matchesPage = (pages, pathname) => {
    const list = String(pages || '/').split(',').map(s => s.trim()).filter(Boolean)
    return list.includes('*') || list.includes(pathname)
}

/** Admin-controlled spotlight popups (replaces the hardcoded home-page spotlight). */
export default function SitePopup() {
    const { list, loaded } = useSite()
    const { pathname } = useLocation()
    const [active, setActive] = useState(null)

    const candidate = useMemo(
        () => list('popups').find(p => matchesPage(p.pages, pathname) && shouldShow(p)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [list, pathname, loaded]
    )

    useEffect(() => {
        if (!candidate || pathname.startsWith('/admin')) return
        const introPending = !sessionStorage.getItem('ieee_its_intro_seen')
        const delay = Math.max(0, Number(candidate.delaySeconds) || 0) * 1000 + (introPending ? 3200 : 600)
        const t = setTimeout(() => { setActive(candidate); markShown(candidate) }, delay)
        return () => clearTimeout(t)
    }, [candidate, pathname])

    useEffect(() => {
        document.body.style.overflow = active ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [active])

    useEffect(() => { setActive(null) }, [pathname])

    return (
        <AnimatePresence>
            {active && (
                <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActive(null)}
                    role="dialog" aria-modal="true" aria-label={active.title || 'Announcement'}>
                    <motion.div className="modal" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setActive(null)} aria-label="Close">✕</button>
                        {active.image && (
                            <SmartLink to={active.ctaUrl} onClick={() => setActive(null)}>
                                <Img src={active.image} alt={active.title || 'Poster'} ratio={active.posterOnly ? '4x5' : '16x9'} width={900} contain={active.posterOnly} />
                            </SmartLink>
                        )}
                        {(!active.posterOnly || active.ctaUrl) && (
                            <div className="modal-body">
                                {!active.posterOnly && active.title && <h2 className="display h-sm">{active.title}</h2>}
                                {!active.posterOnly && active.text && <p className="muted" style={{ margin: 0 }}>{active.text}</p>}
                                {active.ctaUrl && (
                                    <SmartLink to={active.ctaUrl} onClick={() => setActive(null)} className="btn solid" style={{ alignSelf: 'flex-start' }}>
                                        {label(active.ctaLabel) || 'Learn more'} <span className="arr">→</span>
                                    </SmartLink>
                                )}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
