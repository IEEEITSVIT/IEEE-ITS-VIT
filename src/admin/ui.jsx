/* Small UI kit for the admin dashboard. */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])
    const push = useCallback((message, tone = 'ok') => {
        const id = Math.random()
        setToasts(t => [...t, { id, message, tone }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tone === 'error' ? 6000 : 3200)
    }, [])
    return (
        <ToastCtx.Provider value={push}>
            {children}
            <div className="adm-toasts" role="status" aria-live="polite">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div key={t.id} className={`adm-toast ${t.tone}`} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}>
                            {t.tone === 'error' ? '⚠️' : '✅'} {t.message}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastCtx.Provider>
    )
}
export const useToast = () => useContext(ToastCtx)

/* ---------- Confirm dialog ---------- */
const ConfirmCtx = createContext(async () => false)
export function ConfirmProvider({ children }) {
    const [state, setState] = useState(null)
    const confirm = useCallback((message, { danger = true, okLabel = 'Delete' } = {}) =>
        new Promise(resolve => setState({ message, danger, okLabel, resolve })), [])
    const close = v => { state?.resolve(v); setState(null) }
    return (
        <ConfirmCtx.Provider value={confirm}>
            {children}
            <AnimatePresence>
                {state && (
                    <motion.div className="adm-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close(false)}>
                        <motion.div className="adm-modal small" initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
                            <p>{state.message}</p>
                            <div className="adm-row end">
                                <button className="adm-btn ghost" onClick={() => close(false)}>Cancel</button>
                                <button className={`adm-btn ${state.danger ? 'danger' : 'primary'}`} onClick={() => close(true)} autoFocus>{state.okLabel}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </ConfirmCtx.Provider>
    )
}
export const useConfirm = () => useContext(ConfirmCtx)

/* ---------- Drawer ---------- */
export function Drawer({ open, title, onClose, children, footer, wide }) {
    useEffect(() => {
        if (!open) return
        const onKey = e => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])
    return (
        <AnimatePresence>
            {open && (
                <motion.div className="adm-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
                    <motion.aside className={`adm-drawer${wide ? ' wide' : ''}`} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 32, stiffness: 300 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
                        <header><h3>{title}</h3><button className="adm-icon-btn" onClick={onClose} aria-label="Close">✕</button></header>
                        <div className="adm-drawer-body">{children}</div>
                        {footer && <footer>{footer}</footer>}
                    </motion.aside>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export function Modal({ open, onClose, title, children, wide }) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div className="adm-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
                    <motion.div className={`adm-modal${wide ? ' wide' : ''}`} initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                        <header><h3>{title}</h3><button className="adm-icon-btn" onClick={onClose} aria-label="Close">✕</button></header>
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/* ---------- Bits ---------- */
export const Switch = ({ checked, onChange, label }) => (
    <label className="adm-switch">
        <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
        <span className="track"><span className="thumb" /></span>
        {label && <span className="lbl">{label}</span>}
    </label>
)

export const Badge = ({ tone = 'neutral', children }) => <span className={`adm-badge ${tone}`}>{children}</span>

export const PageTitle = ({ title, subtitle, children }) => (
    <div className="adm-page-title">
        <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
        <div className="adm-row">{children}</div>
    </div>
)

export const Empty = ({ icon = '🗂️', children }) => <div className="adm-empty"><div>{icon}</div><p>{children}</p></div>

export const Spinner = () => <div className="adm-spinner" aria-label="Loading" />

export function useLoader(fn, deps = []) {
    const [state, setState] = useState({ data: null, loading: true, error: '' })
    const load = useCallback(async () => {
        setState(s => ({ ...s, loading: true }))
        try { setState({ data: await fn(), loading: false, error: '' }) }
        catch (e) { setState({ data: null, loading: false, error: e.message }) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)
    useEffect(() => { load() }, [load])
    return { ...state, reload: load, setData: data => setState(s => ({ ...s, data: typeof data === 'function' ? data(s.data) : data })) }
}

export function downloadCsv(filename, rows, columns) {
    const cols = columns || Object.keys(rows[0] || {})
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: filename })
    a.click()
    URL.revokeObjectURL(url)
}

export const fmtDate = s => {
    if (!s) return '—'
    const d = new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z')
    return isNaN(d) ? s : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}
