import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { img } from '../lib/safe'
import { useScrollLock } from '../lib/scrollLock'

export default function Lightbox({ photos, title, start = 0, onClose }) {
    const [i, setI] = useState(start)
    const [dir, setDir] = useState(1)
    const go = useCallback(step => { setDir(step); setI(x => (x + step + photos.length) % photos.length) }, [photos.length])

    useScrollLock(true)
    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [go, onClose])

    return (
        <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={title}>
            <div className="lightbox-top">
                <span className="label">{title}</span>
                <span className="mono muted">{String(i + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</span>
                <button className="btn sm" onClick={onClose}>Close ✕</button>
            </div>
            <div className="lightbox-stage">
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                    <motion.img key={i} src={img(photos[i], { w: 1800 })} alt={`${title} ${i + 1}`} custom={dir}
                        initial={{ opacity: 0, x: dir * 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -80 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (info.offset.x < -60) go(1); else if (info.offset.x > 60) go(-1) }} />
                </AnimatePresence>
                {photos.length > 1 && <>
                    <button className="lightbox-arrow l" onClick={() => go(-1)} aria-label="Previous photo">←</button>
                    <button className="lightbox-arrow r" onClick={() => go(1)} aria-label="Next photo">→</button>
                </>}
            </div>
            {photos.length > 1 && (
                <div className="lightbox-thumbs">
                    {photos.map((p, k) => (
                        <button key={k} className={k === i ? 'on' : ''} onClick={() => { setDir(k > i ? 1 : -1); setI(k) }} aria-label={`Photo ${k + 1}`}>
                            <div className="frame r-4x3"><img src={img(p, { w: 160 })} alt="" loading="lazy" /></div>
                        </button>
                    ))}
                </div>
            )}
        </motion.div>
    )
}
