import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import Seo from '../components/Seo'

export default function Login() {
    const { user, loading, login, register, logout } = useAuth()
    const [params] = useSearchParams()
    const navigate = useNavigate()
    const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login')
    const [f, setF] = useState({ name: '', email: '', password: '', confirm: '', mobile: '', regNo: '' })
    const [show, setShow] = useState(false)
    const [err, setErr] = useState('')
    const [busy, setBusy] = useState(false)
    const set = k => e => setF(x => ({ ...x, [k]: e.target.value }))
    const next = params.get('next')

    const submit = async e => {
        e.preventDefault()
        setErr('')
        if (mode === 'register' && f.password !== f.confirm) return setErr('Passwords do not match.')
        setBusy(true)
        try {
            const u = mode === 'login' ? await login(f.email, f.password)
                : await register({ name: f.name, email: f.email, password: f.password, mobile: f.mobile, regNo: f.regNo })
            if (next?.startsWith('/')) navigate(next)
            else if (u.role !== 'member' && mode === 'login') navigate('/admin')
        } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
    }

    if (loading) return <div className="auth-wrap"><div className="skeleton" style={{ width: 460, height: 420 }} /></div>

    if (user) {
        return (
            <div className="auth-wrap">
                <Seo title="Your account" noindex />
                <div className="auth-card form">
                    <span className="label">{user.role === 'member' ? user.memberType : user.role}</span>
                    <h1 className="display h-md">Welcome, {user.name.split(' ')[0]}</h1>
                    <p className="muted" style={{ margin: 0 }}>Signed in as {user.email}</p>
                    {user.role !== 'member' && <Link to="/admin" className="btn solid">Admin dashboard <span className="arr">→</span></Link>}
                    <Link to="/join" className="btn">My profile</Link>
                    <button className="btn" onClick={logout}>Sign out</button>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-wrap">
            <Seo title="Sign In" noindex />
            <motion.div className="auth-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                <span className="label">Member portal</span>
                <h1 className="display h-md" style={{ marginTop: 14 }}>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
                <div className="tabs" role="tablist">
                    {['login', 'register'].map(m => (
                        <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setErr('') }}>
                            {m === 'login' ? 'Sign in' : 'Register'}
                            {mode === m && <motion.span layoutId="auth-pill" className="pill" />}
                        </button>
                    ))}
                </div>
                <form className="form" onSubmit={submit}>
                    <AnimatePresence initial={false}>
                        {mode === 'register' && (
                            <motion.label key="n" className="field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                <span>Full name</span><input value={f.name} onChange={set('name')} required autoComplete="name" />
                            </motion.label>
                        )}
                    </AnimatePresence>
                    <label className="field"><span>Email</span><input type="email" value={f.email} onChange={set('email')} required autoComplete="email" placeholder="you@vitstudent.ac.in" /></label>
                    <label className="field"><span>Password</span>
                        <div className="pw">
                            <input type={show ? 'text' : 'password'} value={f.password} onChange={set('password')} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                            <button type="button" onClick={() => setShow(v => !v)}>{show ? 'Hide' : 'Show'}</button>
                        </div>
                    </label>
                    <AnimatePresence initial={false}>
                        {mode === 'register' && (
                            <motion.div key="x" className="form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                <label className="field"><span>Confirm password</span><input type={show ? 'text' : 'password'} value={f.confirm} onChange={set('confirm')} required autoComplete="new-password" /></label>
                                <div className="row-2">
                                    <label className="field"><span>Mobile (optional)</span><input type="tel" value={f.mobile} onChange={e => setF(x => ({ ...x, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} /></label>
                                    <label className="field"><span>Reg. no (optional)</span><input value={f.regNo} onChange={e => setF(x => ({ ...x, regNo: e.target.value.toUpperCase().slice(0, 10) }))} /></label>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <button className="btn solid" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <span className="arr">→</span></button>
                    {err && <p className="notice err" role="alert">{err}</p>}
                    <p className="muted mono" style={{ fontSize: '.7rem', margin: 0 }}>Passwords are hashed; sessions use secure HttpOnly cookies.</p>
                </form>
            </motion.div>
        </div>
    )
}
