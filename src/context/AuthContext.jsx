import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

/** Database-backed session (replaces the previous Firebase/Google sign-in). */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        try {
            const { user } = await api.get('/auth/me')
            setUser(user)
        } catch {
            setUser(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { refresh() }, [refresh])

    const login = useCallback(async (email, password) => {
        const { user } = await api.post('/auth/login', { email, password })
        setUser(user)
        return user
    }, [])

    const register = useCallback(async fields => {
        const { user } = await api.post('/auth/register', fields)
        setUser(user)
        return user
    }, [])

    const logout = useCallback(async () => {
        try { await api.post('/auth/logout') } catch (err) { console.error('Logout error:', err) }
        setUser(null)
    }, [])

    const updateProfile = useCallback(async fields => {
        const { user } = await api.put('/auth/profile', fields)
        setUser(user)
        return user
    }, [])

    const value = useMemo(() => ({
        user, loading, login, register, logout, updateProfile, refresh,
        isAdmin: user?.role === 'admin', isStaff: user?.role === 'admin' || user?.role === 'editor',
    }), [user, loading, login, register, logout, updateProfile, refresh])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuthContext = () => useContext(AuthContext)
