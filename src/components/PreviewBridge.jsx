import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PREVIEW } from '../context/SiteContext'

const send = msg => window.parent.postMessage(msg, window.location.origin)

/**
 * Talks to the admin preview window: follows its navigation, reports the current page,
 * and in "select" mode turns clicks on a section into a selection for the Design editor.
 */
export default function PreviewBridge() {
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const selected = useRef(null)

    useEffect(() => { if (PREVIEW) send({ type: 'its-path', path: pathname }) }, [pathname])

    useEffect(() => {
        if (!PREVIEW) return
        const mark = id => {
            selected.current = id
            document.querySelectorAll('.sx-selected').forEach(el => el.classList.remove('sx-selected'))
            if (id) document.querySelectorAll(`[data-sec="${CSS.escape(id)}"]`).forEach(el => el.classList.add('sx-selected'))
        }
        const onMessage = e => {
            if (e.origin !== window.location.origin || e.source !== window.parent) return
            const m = e.data || {}
            if (m.type === 'its-navigate' && typeof m.path === 'string' && m.path.startsWith('/')) navigate(m.path)
            if (m.type === 'its-select-mode') document.documentElement.classList.toggle('its-select-mode', !!m.on)
            if (m.type === 'its-focus') {
                if (m.highlight !== false) mark(m.id)
                if (m.scroll === false || !m.id) return
                // The section may not be rendered yet (just navigated) — retry briefly.
                let tries = 0
                const go = () => {
                    const el = document.querySelector(`[data-sec="${CSS.escape(m.id)}"]`)
                    // Scroll only this page; scrollIntoView would also scroll the admin around the preview.
                    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' })
                    else if (tries++ < 20) setTimeout(go, 150)
                }
                go()
            }
        }
        const onClick = e => {
            if (!document.documentElement.classList.contains('its-select-mode')) return
            const sec = e.target.closest?.('[data-sec]')
            if (!sec) return
            e.preventDefault()
            e.stopPropagation()
            mark(sec.dataset.sec)
            send({ type: 'its-select', id: sec.dataset.sec })
        }
        // Re-apply the highlight after React re-renders a section.
        const observer = new MutationObserver(() => {
            if (selected.current && !document.querySelector('.sx-selected')) mark(selected.current)
        })
        observer.observe(document.body, { childList: true, subtree: true })
        window.addEventListener('message', onMessage)
        document.addEventListener('click', onClick, true)
        return () => { window.removeEventListener('message', onMessage); document.removeEventListener('click', onClick, true); observer.disconnect() }
    }, [navigate])

    return null
}
