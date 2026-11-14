import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useSite } from '../context/SiteContext'
import { api } from '../lib/api'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import Img from '../components/Img'
import { Reveal } from '../components/Reveal'
import Section from '../components/Section'

export default function Merch() {
    const { user } = useAuth()
    const { list, settings } = useSite()
    const [params, setParams] = useSearchParams()
    const cfg = settings.merch || {}
    const sizes = cfg.sizes || []
    const cur = cfg.currency || '₹'
    const items = list('merch')
    const logo = settings.site?.logoRound
    const tab = params.get('tab') === 'orders' && user ? 'orders' : 'shop'
    const [orders, setOrders] = useState([])
    const [sel, setSel] = useState(null)
    const [size, setSize] = useState('')
    const [color, setColor] = useState(0)
    const [qty, setQty] = useState(1)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [done, setDone] = useState(false)

    useEffect(() => {
        if (!user) return
        api.get('/orders/mine').then(r => setOrders(r.orders)).catch(() => {})
    }, [user])

    const open = item => { setSel(item); setSize(''); setColor(0); setQty(1); setError('') }
    const book = async () => {
        setBusy(true); setError('')
        try {
            const { order } = await api.post('/orders', { itemId: sel.id, size, color: sel.colors?.[color], qty })
            setOrders(o => [order, ...o]); setSel(null); setDone(true); setTimeout(() => setDone(false), 5000)
        } catch (e) { setError(e.message === 'MOBILE_REQUIRED' ? 'mobile' : e.message) } finally { setBusy(false) }
    }

    return (
        <>
            <Seo />
            <PageHeader page="merch" />
            <Section id="merch.list" className="section" style={{ borderTop: 0 }}>
                <div className="wrap">
                    {user ? (
                        <div className="game-tabs">
                            <button className={`game-tab${tab === 'shop' ? ' active' : ''}`} onClick={() => setParams({})}>Shop</button>
                            <button className={`game-tab${tab === 'orders' ? ' active' : ''}`} onClick={() => setParams({ tab: 'orders' })}>My bookings ({orders.length})</button>
                        </div>
                    ) : (
                        <p className="notice" style={{ marginBottom: 28 }}>Sign in to book merchandise. <Link to="/login?next=/merch" className="accent">Sign in →</Link></p>
                    )}
                    {done && <p className="notice ok" role="status" style={{ marginBottom: 24 }}>Booking confirmed — a confirmation has been sent to your email (check Spam / Junk if you don't see it).</p>}

                    {tab === 'shop' ? (
                        <div className="grid g-3">
                            {items.map((it, i) => (
                                <Reveal key={it.id} delay={(i % 3) * 0.06} className="card">
                                    <Img src={it.image} alt={it.name} ratio="1x1" width={700} fallback={logo ? <img src={logo} alt="" /> : null}>{it.tag && <span className={`chip${it.comingSoon ? '' : ' on'}`}>{it.tag}</span>}</Img>
                                    <div className="card-body">
                                        <div className="card-meta"><span>{cur}{it.price}</span>{it.colors?.length > 0 && <span className="swatches">{it.colors.map((c, k) => <span key={k} className="swatch" style={{ background: c, width: 16, height: 16, cursor: 'default' }} />)}</span>}</div>
                                        <h3 className="display h-sm">{it.name}</h3>
                                        <p>{it.desc}</p>
                                        {user
                                            ? <button className="btn solid" disabled={it.comingSoon} onClick={() => open(it)} style={{ alignSelf: 'flex-start', marginTop: 6 }}>{it.comingSoon ? 'Coming soon' : 'Book now'}</button>
                                            : <Link to="/login?next=/merch" className="btn" style={{ alignSelf: 'flex-start', marginTop: 6 }}>Sign in to book</Link>}
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    ) : (
                        <div>
                            {orders.length === 0 && <p className="empty">No bookings yet</p>}
                            {orders.map(o => (
                                <div key={o.id} className="order-row">
                                    <h3 className="display h-sm" style={{ margin: 0 }}>{o.item}</h3>
                                    <span className="chip on">{o.status}</span>
                                    <div className="meta-row"><span>#{o.id}</span><span>Size <b>{o.size}</b></span><span>Qty <b>{o.qty}</b></span><span>Total <b>{cur}{o.total}</b></span><span>{new Date(o.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN')}</span></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Section>

            <AnimatePresence>
                {sel && (
                    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSel(null)}>
                        <motion.div className="modal" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={sel.name}>
                            <button className="modal-close" onClick={() => setSel(null)} aria-label="Close">✕</button>
                            <div className="modal-body">
                                <span className="label">Book</span>
                                <h2 className="display h-md">{sel.name}</h2>
                                {sel.colors?.length > 0 && <div className="field"><span>Colour</span><div className="swatches">{sel.colors.map((c, k) => <button key={k} className={`swatch${color === k ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(k)} aria-label={`Colour ${k + 1}`} />)}</div></div>}
                                <div className="field"><span>Size</span><div className="sizes">{sizes.map(s => <button key={s} className={`size${size === s ? ' on' : ''}`} onClick={() => setSize(s)}>{s}</button>)}</div></div>
                                <div className="field"><span>Quantity</span><div className="qty"><button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Less">−</button><span>{qty}</span><button onClick={() => setQty(q => Math.min(Number(cfg.maxQty) || 5, q + 1))} aria-label="More">+</button></div></div>
                                <div className="meta-row"><span>Total <b>{cur}{Number(sel.price) * qty}</b></span></div>
                                {cfg.note && <p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>{cfg.note}</p>}
                                {error && <p className="notice err" role="alert">{error === 'mobile' ? <>Mobile number required. Add it on your <Link to="/join" className="accent">profile</Link> to continue.</> : error}</p>}
                                <button className="btn solid" disabled={!size || busy} onClick={book}>{busy ? 'Booking…' : 'Confirm booking'} <span className="arr">→</span></button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
