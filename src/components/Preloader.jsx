import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSite } from '../context/SiteContext'
import { useScrollLock } from '../lib/scrollLock'

const SEEN_KEY = 'ieee_its_intro_seen'
const EASE = [0.76, 0, 0.24, 1]

/**
 * Startup sequence: oversized wordmark rising letter by letter, boot log, 000→100 counter,
 * then the whole panel wipes upward. Text and frequency come from Admin → Theme & Animations.
 * It also covers the first data load, so the page never flashes empty.
 */
export default function Preloader() {
    const { settings, ready, loaded } = useSite()
    const a = settings.appearance
    const [show, setShow] = useState(() => {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && ready) return false
        try { if (sessionStorage.getItem(SEEN_KEY) && ready) return false } catch { /* storage blocked */ }
        return true
    })
    const [seen] = useState(() => {
        try { return !!sessionStorage.getItem(SEEN_KEY) } catch { return false }
    })
    const [count, setCount] = useState(0)

    // Once settings arrive, respect the admin's preference.
    const skip = !!a && (a.preloader === false || (seen && a.preloaderMode !== 'always'))
    const visible = show && !skip
    useScrollLock(visible)

    useEffect(() => {
        if (!visible) return
        const t0 = performance.now()
        let raf
        const tick = t => {
            const target = loaded || t - t0 > 4000 ? 100 : 88
            setCount(c => Math.min(target, c + Math.max(0.7, (target - c) * 0.07)))
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [visible, loaded])

    useEffect(() => {
        if (visible && count >= 99.5 && ready) {
            const t = setTimeout(() => {
                setShow(false)
                try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
            }, 300)
            return () => clearTimeout(t)
        }
    }, [count, visible, ready])

    const word = a?.preloaderWord || settings.site?.shortName || ''
    const lines = a?.preloaderLines || []
    return (
        <AnimatePresence>
            {visible && (
                <motion.div className="loader" exit={{ y: '-100%' }} transition={{ duration: 0.9, ease: EASE }} aria-hidden="true">
                    <div className="loader-top">
                        <span>{settings.home?.heroBadge}</span>
                        <span>{settings.home?.heroEst}</span>
                    </div>
                    <div>
                        <div className="loader-word">
                            {word.split('').map((ch, i) => (
                                <span key={i} className="mask"><motion.span className="ch" initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>{ch === ' ' ? ' ' : ch}</motion.span></span>
                            ))}
                        </div>
                    </div>
                    <div className="loader-bottom">
                        <div className="loader-log">
                            {lines.map((l, i) => (
                                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.3 }}>[{String(i + 1).padStart(2, '0')}] {l}</motion.div>
                            ))}
                        </div>
                        <div className="loader-count">{String(Math.round(count)).padStart(3, '0')}</div>
                    </div>
                    <div className="loader-bar" style={{ transform: `scaleX(${count / 100})` }} />
                </motion.div>
            )}
        </AnimatePresence>
    )
}
