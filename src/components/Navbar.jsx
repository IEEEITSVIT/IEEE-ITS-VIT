import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useSite } from '../context/SiteContext'
import SmartLink from './SmartLink'

const PRIMARY = 6 // links shown inline; the rest go under "More"

export default function Navbar() {
    const { pathname } = useLocation()
    const { user, logout, isStaff } = useAuth()
    const { list, settings } = useSite()
    const site = settings.site || {}
    const [scrolled, setScrolled] = useState(false)
    const [open, setOpen] = useState(false)
    const [more, setMore] = useState(false)
    const [userMenu, setUserMenu] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    // Close menus when the route changes (state reset keyed on pathname).
    const [lastPath, setLastPath] = useState(pathname)
    if (lastPath !== pathname) { setLastPath(pathname); setOpen(false); setMore(false); setUserMenu(false) }

    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [open])

    const links = list('nav_links')
    const inline = links.slice(0, PRIMARY)
    const extra = links.slice(PRIMARY)
    const active = url => (url === '/' ? pathname === '/' : pathname.startsWith(url))
    const first = user?.name?.split(' ')[0] || ''

    return (
        <>
            <header className={`nav${scrolled ? ' scrolled' : ''}`}>
                <div className="wrap">
                    <Link to="/" className="nav-brand" aria-label={site.name || 'Home'}>
                        {site.logoRound && <img className="round" src={site.logoRound} alt="" />}
                        {site.logoText && <img className="text" src={site.logoText} alt={site.shortName || ''} />}
                    </Link>
                    <ul className="nav-links">
                        {inline.map(l => <li key={l.id}><SmartLink to={l.url} className={active(l.url) ? 'active' : ''}>{l.label}</SmartLink></li>)}
                        {extra.length > 0 && (
                            <li className="nav-more" onMouseLeave={() => setMore(false)}>
                                <button onClick={() => setMore(v => !v)} onMouseEnter={() => setMore(true)} aria-expanded={more}>More ▾</button>
                                <AnimatePresence>
                                    {more && (
                                        <motion.div className="nav-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                                            {extra.map(l => <SmartLink key={l.id} to={l.url}>{l.label}</SmartLink>)}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </li>
                        )}
                    </ul>
                    <div className="nav-actions">
                        {user ? (
                            <div className="nav-more desk">
                                <button className="nav-user" onClick={() => setUserMenu(v => !v)} aria-expanded={userMenu}>
                                    <span className="avatar-dot">{user.picture ? <img src={user.picture} alt="" /> : first[0]?.toUpperCase()}</span>{first}
                                </button>
                                <AnimatePresence>
                                    {userMenu && (
                                        <motion.div className="nav-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                                            <Link to="/join">My profile</Link>
                                            <Link to="/merch?tab=orders">My bookings</Link>
                                            {isStaff && <Link to="/admin">Admin dashboard</Link>}
                                            <button onClick={logout}>Sign out</button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
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
                    <motion.nav className="mobile-menu" initial={{ clipPath: 'inset(0 0 100% 0)' }} animate={{ clipPath: 'inset(0 0 0% 0)' }} exit={{ clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}>
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
