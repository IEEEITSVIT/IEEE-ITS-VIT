import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

const CACHE_KEY = 'ieee_its_site_cache_v2'
const SiteContext = createContext(null)

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

    const refresh = useCallback(async (fresh = false) => {
        try {
            const next = await api.get(`/public/bootstrap${fresh ? `?t=${Date.now()}` : ''}`)
            setData(next)
            setError('')
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)) } catch { /* storage full or blocked */ }
        } catch (e) {
            setError(e.message || 'Could not reach the server')
        } finally {
            setLoaded(true)
        }
    }, [])

    useEffect(() => { refresh() }, [refresh])

    const value = useMemo(() => {
        const content = data?.content || {}
        return {
            ready: !!data,
            content,
            settings: data?.settings || {},
            events: data?.events || [],
            moments: data?.moments || [],
            list: type => content[type] || [],
            loaded,
            error,
            refresh,
        }
    }, [data, loaded, error, refresh])

    return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export const useSite = () => useContext(SiteContext)
