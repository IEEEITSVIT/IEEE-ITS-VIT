import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

const CACHE_KEY = 'ieee_its_site_cache_v2'
const SiteContext = createContext(null)

/** The admin renders the site inside <iframe name="its-preview"> and streams unsaved edits into it. */
export const PREVIEW = typeof window !== 'undefined' && window.name === 'its-preview' && window.parent !== window

function readCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY)
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}

/**
 * All site content comes from the database via /api/public/bootstrap.
 * The last successful response is cached in the browser so repeat visits render instantly;
 * nothing is bundled into the JavaScript.
 */
export function SiteProvider({ children }) {
    const [data, setData] = useState(readCache)
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState('')
    const [draft, setDraft] = useState(null) // preview only: { settings?, content?, events?, moments?, popup? }

    const refresh = useCallback(async (fresh = false) => {
        try {
            const next = await api.get(`/public/bootstrap${fresh ? `?t=${Date.now()}` : ''}`)
            setData(next)
            setError('')
            if (!PREVIEW) try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)) } catch { /* storage full or blocked */ }
        } catch (e) {
            setError(e.message || 'Could not reach the server')
        } finally {
            setLoaded(true)
        }
    }, [])

    useEffect(() => { refresh() }, [refresh])

    useEffect(() => {
        if (!PREVIEW) return
        const onMessage = e => {
            if (e.origin !== window.location.origin || e.source !== window.parent) return
            if (e.data?.type === 'its-preview') setDraft(e.data.patch || null)
        }
        window.addEventListener('message', onMessage)
        window.parent.postMessage({ type: 'its-ready' }, window.location.origin)
        return () => window.removeEventListener('message', onMessage)
    }, [])

    const value = useMemo(() => {
        const content = { ...(data?.content || {}), ...(draft?.content || {}) }
        return {
            ready: !!data,
            content,
            settings: { ...(data?.settings || {}), ...(draft?.settings || {}) },
            events: draft?.events || data?.events || [],
            moments: draft?.moments || data?.moments || [],
            list: type => content[type] || [],
            preview: PREVIEW,
            previewPopup: draft?.popup || null,
            loaded,
            error,
            refresh,
        }
    }, [data, draft, loaded, error, refresh])

    return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export const useSite = () => useContext(SiteContext)
