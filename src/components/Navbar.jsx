import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useSite } from '../context/SiteContext'
import SmartLink from './SmartLink'
import { useScrollLock } from '../lib/scrollLock'

const canHover = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

/**
 * Accessible dropdown: opens on hover (desktop) or tap/click, stays open while the pointer
 * crosses into the menu, and closes on outside click, Esc, selecting an item or route change.
 */
function Dropdown({ button, buttonClass, active, children, label }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    const timer = useRef()
    const { pathname } = useLocation()
    const [lastPath, setLastPath] = useState(pathname)
    if (lastPath !== pathname) { setLastPath(pathname); setOpen(false) }

    useEffect(() => {
        if (!open) return
        const onDown = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
        const onKey = e => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus() } }
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey)
        return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
    }, [open])
    useEffect(() => () => clearTimeout(timer.current), [])

    const enter = () => { clearTimeout(timer.current); if (canHover()) setOpen(true) }
    const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 220) }

    return (
        <div className="nav-more" ref={ref} onMouseEnter={enter} onMouseLeave={leave}>
            <button className={`${buttonClass || ''}${active ? ' active' : ''}`} aria-haspopup="menu" aria-expanded={open} aria-label={label}
                onClick={() => setOpen(v => (canHover() ? true : !v))}>
                {button}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div className="nav-menu" role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }} onClick={e => { if (e.target.closest('a,button')) setOpen(false) }}>
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default function Navbar() {
    const { pathname } = useLocation()
    const { user, logout, isStaff } = useAuth()
    const { list, settings } = useSite()
    const site = settings.site || {}
    const [scrolled, setScrolled] = useState(false)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    // Close menus when the route changes (state reset keyed on pathname).
    const [lastPath, setLastPath] = useState(pathname)
    if (lastPath !== pathname) { setLastPath(pathname); setOpen(false) }

    const headerRef = useRef(null)
    const [menuTop, setMenuTop] = useState(0)
    useScrollLock(open)
    useEffect(() => {
        if (open && headerRef.current) setMenuTop(Math.max(0, headerRef.current.getBoundingClientRect().bottom))
    }, [open])

    const links = list('nav_links')
    const inline = links.filter(l => l.placement !== 'more')
    const extra = links.filter(l => l.placement === 'more')
    const active = url => (url === '/' ? pathname === '/' : pathname.startsWith(url))
    const first = user?.name?.split(' ')[0] || ''

    return (
        <>
            <header ref={headerRef} className={`nav${scrolled ? ' scrolled' : ''}`}>
                <div className="wrap">
                    <Link to="/" className="nav-brand" aria-label={site.name || 'Home'}>
                        {site.logoRound && <img className="round" src={site.logoRound} alt="" />}
                        {site.logoText && <img className="text" src={site.logoText} alt={site.shortName || ''} />}
                    </Link>
                    <ul className="nav-links">
                        {inline.map(l => <li key={l.id}><SmartLink to={l.url} className={active(l.url) ? 'active' : ''}>{l.label}</SmartLink></li>)}
                        {extra.length > 0 && (
                            <li>
                                <Dropdown button={<>More <span aria-hidden="true">▾</span></>} label="More pages" active={extra.some(l => active(l.url))}>
                                    {extra.map(l => <SmartLink key={l.id} to={l.url} role="menuitem" className={active(l.url) ? 'active' : ''}>{l.label}</SmartLink>)}
                                </Dropdown>
                            </li>
                        )}
                    </ul>
                    <div className="nav-actions">
                        {user ? (
                            <div className="desk">
                                <Dropdown buttonClass="nav-user" label="Account menu" button={<>
                                    <span className={`avatar-dot${user.picture ? '' : ' logo'}`}>
                                        {user.picture || site.logoRound ? <img src={user.picture || site.logoRound} alt="" /> : first[0]?.toUpperCase()}
                                    </span>{first} <span aria-hidden="true">▾</span>
                                </>}>
                                    <Link to="/join" role="menuitem">My profile</Link>
                                    <Link to="/merch?tab=orders" role="menuitem">My bookings</Link>
                                    {isStaff && <Link to="/admin" role="menuitem">Admin dashboard</Link>}
                                    <button role="menuitem" onClick={logout}>Sign out</button>
                                </Dropdown>
                            </div>
                        ) : (
                            <>
                                <Link to="/login" className="btn sm desk">Login</Link>
                                <Link to="/join" className="btn sm solid desk">Join</Link>
                            </>
                        )}
                        <button className={`nav-burger${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)} aria-label="Menu" aria-expanded={open}>
                            <span /><span /><span />
                        </button>
                    </div>
                </div>
            </header>
            <AnimatePresence>
                {open && (
                    <motion.nav className="mobile-menu" style={menuTop ? { top: menuTop } : undefined} initial={{ clipPath: 'inset(0 0 100% 0)' }} animate={{ clipPath: 'inset(0 0 0% 0)' }} exit={{ clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}>
                        {links.map((l, i) => (
                            <motion.div key={l.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.03 }}>
                                <SmartLink to={l.url} className={active(l.url) ? 'active' : ''}>{l.label}</SmartLink>
                            </motion.div>
                        ))}
                        <div className="mm-actions">
                            {user ? (
                                <>
                                    <Link to="/join" className="btn">Profile</Link>
                                    {isStaff && <Link to="/admin" className="btn">Admin</Link>}
                                    <button className="btn" onClick={logout}>Sign out</button>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" className="btn">Login</Link>
                                    <Link to="/join" className="btn solid">Join</Link>
                                </>
                            )}
                        </div>
                    </motion.nav>
                )}
            </AnimatePresence>
        </>
    )
}
