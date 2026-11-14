import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import Seo from '../components/Seo'

/* Forgot password: request a 6-digit code by email, then set a new password with it. */
function ForgotPassword({ initialEmail, initialCode, setup, notice, onDone, onBack }) {
    // Opened from the email's "Reset password" link: email and code arrive pre-filled.
    const linkCode = /^\d{6}$/.test(initialCode || '') ? initialCode : ''
    const [step, setStep] = useState(linkCode && initialEmail ? 'code' : 'email')
    const [email, setEmail] = useState(initialEmail || '')
    const [code, setCode] = useState(linkCode)
    const [pw, setPw] = useState({ next: '', confirm: '' })
    const [msg, setMsg] = useState(null)
    const [busy, setBusy] = useState(false)
    const [cooldown, setCooldown] = useState(0)

    useEffect(() => {
        if (!cooldown) return
        const t = setTimeout(() => setCooldown(c => c - 1), 1000)
        return () => clearTimeout(t)
    }, [cooldown])

    const sendCode = async e => {
        e?.preventDefault()
        setBusy(true); setMsg(null)
        try {
            const r = await api.post('/auth/forgot', { email })
            setStep('code'); setCooldown(60)
            setMsg({ ok: true, t: r.message })
        } catch (err) { setMsg({ ok: false, t: err.message }) } finally { setBusy(false) }
    }

    const reset = async e => {
        e.preventDefault()
        if (pw.next !== pw.confirm) return setMsg({ ok: false, t: 'Passwords do not match.' })
        setBusy(true); setMsg(null)
        try {
            const { user } = await api.post('/auth/reset', { email, code, password: pw.next })
            onDone(user)
        } catch (err) { setMsg({ ok: false, t: err.message }) } finally { setBusy(false) }
    }

    return (
        <>
            <span className="label">{setup ? 'Welcome' : 'Account recovery'}</span>
            <h1 className="display h-md" style={{ marginTop: 14 }}>{setup ? 'Set your password' : 'Reset password'}</h1>
            {notice && <p className="notice ok" style={{ marginTop: 14 }}>{notice}</p>}
            <p className="muted" style={{ margin: '12px 0 22px' }}>
                {step === 'email' ? (setup ? 'We will email a 6-digit code to this address to confirm it is yours, then you choose a password. If it is not in your inbox, check Spam / Junk.' : 'Enter your account email and we will send you a 6-digit code. It can take a minute — if it is not in your inbox, check Spam / Junk.') : linkCode && code === linkCode ? <>Choose a new password for <b style={{ color: 'var(--text)' }}>{email}</b>.</> : <>Enter the code sent to <b style={{ color: 'var(--text)' }}>{email}</b> and choose a new password.</>}
            </p>
            {step === 'email' ? (
                <form className="form" onSubmit={sendCode}>
                    <label className="field"><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus /></label>
                    <button className="btn solid" disabled={busy}>{busy ? 'Sending…' : 'Send code'} <span className="arr">→</span></button>
                    {msg && <p className={`notice ${msg.ok ? 'ok' : 'err'}`} role="alert">{msg.t}</p>}
                </form>
            ) : (
                <form className="form" onSubmit={reset}>
                    <label className="field"><span>6-digit code</span>
                        <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required autoFocus
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', letterSpacing: '.5em', textAlign: 'center' }} placeholder="••••••" />
                    </label>
                    <label className="field"><span>New password</span><input type="password" value={pw.next} onChange={e => setPw(x => ({ ...x, next: e.target.value }))} required minLength={8} autoComplete="new-password" placeholder="8+ characters, letters and numbers" /></label>
                    <label className="field"><span>Confirm new password</span><input type="password" value={pw.confirm} onChange={e => setPw(x => ({ ...x, confirm: e.target.value }))} required autoComplete="new-password" /></label>
                    <button className="btn solid" disabled={busy || code.length !== 6}>{busy ? 'Saving…' : setup ? 'Set password and sign in' : 'Reset password'} <span className="arr">→</span></button>
                    {msg && <p className={`notice ${msg.ok ? 'ok' : 'err'}`} role="alert">{msg.t}</p>}
                    {!(linkCode && code === linkCode) && <p className="muted" style={{ fontSize: '.85rem', margin: 0 }}>Can't find the email? Check your <b>Spam / Junk</b> folder (and <b>Promotions</b> in Gmail) and mark it "Not spam". The code expires in 10 minutes.</p>}
                    <button type="button" className="btn sm" disabled={busy || cooldown > 0} onClick={sendCode} style={{ alignSelf: 'flex-start' }}>
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                    </button>
                </form>
            )}
            <button type="button" className="link-arrow" style={{ marginTop: 22, background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0, cursor: 'pointer', color: 'var(--muted)' }} onClick={onBack}>← Back to sign in</button>
        </>
    )
}

export default function Login() {
    const { user, loading, login, register, logout, refresh } = useAuth()
    const [params] = useSearchParams()
    const navigate = useNavigate()
    const [mode, setMode] = useState(['register', 'forgot'].includes(params.get('mode')) ? params.get('mode') : 'login')
    // Accounts created by an admin (recruitment / Excel import) have no password yet: they set one with an emailed code.
    const [setup, setSetup] = useState(params.get('setup') === '1' ? { notice: '' } : null)
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
        } catch (e2) {
            if (e2.code === 'SET_PASSWORD') { setSetup({ notice: e2.message }); setMode('forgot'); setErr('') }
            else setErr(e2.message)
        } finally { setBusy(false) }
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
            <Seo title={mode === 'forgot' ? (setup ? 'Set your password' : 'Reset password') : 'Sign In'} noindex />
            <motion.div className="auth-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                {mode === 'forgot' ? (
                    <ForgotPassword initialEmail={f.email || params.get('email') || ''} initialCode={params.get('code') || ''} setup={!!setup} notice={setup?.notice}
                        onBack={() => { setMode('login'); setSetup(null); setErr('') }}
                        onDone={async u => { await refresh(); if (next?.startsWith('/')) navigate(next); else if (u.role !== 'member') navigate('/admin') }} />
                ) : (<>
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
                    {mode === 'login' && <button type="button" className="link-arrow" style={{ alignSelf: 'flex-start', background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0, cursor: 'pointer', color: 'var(--muted)' }} onClick={() => { setMode('forgot'); setErr('') }}>Forgot password?</button>}
                </form>
                </>)}
            </motion.div>
        </div>
    )
}
