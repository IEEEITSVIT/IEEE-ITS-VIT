import { useAuthContext } from '../context/AuthContext'

/** Kept for compatibility with existing pages: { user, logout, loading, login, register, updateProfile, … } */
export function useAuth() {
    return useAuthContext()
}
