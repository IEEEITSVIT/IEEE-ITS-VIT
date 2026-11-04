import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import picNames from '../data/carouselImages.json'
import { useSite } from '../context/SiteContext'
import SmartLink from '../components/SmartLink'
import Seo from '../components/Seo'
import Img from '../components/Img'
import Lightbox from '../components/Lightbox'
import { RevealText, Reveal } from '../components/Reveal'
import { MovingPeopleGrid, EventCard, Countdown, SectionHead } from '../components/Cards'
import { formatEventDate } from '../../shared/cms.js'
import { label } from '../lib/safe'

const EASE = [0.22, 1, 0.36, 1]

function GridLines() {
    return (
        <div className="hero-grid" aria-hidden="true">
            <svg><defs><pattern id="g" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="currentColor" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#g)" /></svg>
        </div>
    )
}

function Spotlight({ banners }) {
    const [i, setI] = useState(0)
    const [paused, setPaused] = useState(false)
    useEffect(() => {
        if (banners.length < 2 || paused) return
        const t = setInterval(() => setI(x => (x + 1) % banners.length), 7000)
        return () => clearInterval(t)
    }, [banners.length, paused])
    if (!banners.length) return null
    const b = banners[i % banners.length]
    return (
        <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div className="spot">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                        <Img src={b.image} alt="" ratio="21x9" width={1800} />
                        <div className="spot-body">
                            {b.logo && <img className="spot-logo" src={b.logo} alt="" />}
                            {b.badge && <span className="label">{b.badge}</span>}
                            <RevealText as="h3" className="display h-lg" text={b.title} inView={false} />
                            {b.subtitle && <p className="lead" style={{ margin: 0 }}>{b.subtitle}</p>}
                            {b.facts?.length > 0 && <ul className="spot-facts">{b.facts.map((f, k) => <li key={k} className="chip">{f}</li>)}</ul>}
                            <div className="hero-cta" style={{ marginTop: 6 }}>
                                {b.ctaUrl && <SmartLink to={b.ctaUrl} className="btn solid">{label(b.ctaLabel)} <span className="arr">→</span></SmartLink>}
                                {b.secondaryUrl && <SmartLink to={b.secondaryUrl} className="btn light">{b.secondaryLabel}</SmartLink>}
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
            {banners.length > 1 && (
                <div className="spot-nav">
                    {banners.map((x, k) => (
                        <button key={x.id} onClick={() => setI(k)} aria-label={`Show ${x.title}`}>
                            {k === i % banners.length && <motion.span key={`${i}-${paused}`} initial={{ scaleX: 0 }} animate={{ scaleX: paused ? 1 : 1 }} transition={{ duration: paused ? 0 : 7, ease: 'linear' }} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function Home() {
    const { settings, list, events, moments } = useSite()
    const home = settings.home || {}
    const show = home.sections || {}
    const [lightbox, setLightbox] = useState(null)

    const upcoming = useMemo(() => events.filter(e => e.state !== 'past').sort((a, b) => (b.featured - a.featured) || a.start_date.localeCompare(b.start_date)), [events])
    const recent = useMemo(() => [...events].filter(e => e.show_in_timeline).sort((a, b) => b.start_date.localeCompare(a.start_date)).filter(e => e.id !== upcoming[0]?.id).slice(0, 3), [events, upcoming])
    const gallery = useMemo(() => {
        const items = [
            ...(picNames || []).map(n => ({ image: `/pic/${n}`, caption: '' })),
            ...list('gallery'),
            ...moments.filter(m => m.show_on_home).flatMap(m => m.photos.map(p => ({ image: p, caption: m.title }))),
        ]
        const seen = new Set()
        return items.filter(g => g.image && !seen.has(g.image) && seen.add(g.image)).slice(0, 8)
    }, [list, moments])
    const board = list('board')
    const domains = list('domains')
    const stats = home.stats || []
    const feature = upcoming[0]
    const words = home.tickerWords?.length ? home.tickerWords : domains.map(d => d.title)

    return (
        <>
            <Seo />
            {/* HERO */}
            <section className="hero">
                <GridLines />
                <div className="wrap">
                    <motion.span className="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>{home.heroBadge}</motion.span>
                    <h1 className="display h-xl hero-title">
                        <RevealText className="line" text={home.heroTitle} inView={false} delay={0.25} />
                        <RevealText className="line accent" text={home.heroHighlight} inView={false} delay={0.45} />
                    </h1>
                    <div className="hero-bottom">
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, ease: EASE, duration: 0.8 }}>
                            <p className="lead" style={{ margin: 0 }}>{home.heroSubtitle}</p>
                            <div className="hero-cta">
                                {home.primaryCta?.url && <SmartLink to={home.primaryCta.url} className="btn solid">{label(home.primaryCta.label)} <span className="arr">→</span></SmartLink>}
                                {home.secondaryCta?.url && <SmartLink to={home.secondaryCta.url} className="btn">{home.secondaryCta.label}</SmartLink>}
                            </div>
                        </motion.div>
                        {stats.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, ease: EASE, duration: 0.8 }}>
                                <div className="label plain" style={{ marginBottom: 10 }}>{home.heroEst}</div>
                                <div className="stats" style={{ '--n': stats.length }}>
                                    {stats.map((s, i) => <div className="stat" key={i}><strong>{s.value}</strong><span>{s.label}</span></div>)}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
                {words.length > 0 && (
                    <div className="ticker" aria-hidden="true">
                        <div className="ticker-track">{[...words, ...words].map((w, i) => <span key={i}>{w}</span>)}</div>
                    </div>
                )}
            </section>

            {/* UPCOMING */}
            {show.upcoming !== false && feature && (
                <section className="section">
                    <div className="wrap">
                        <SectionHead overline={home.upcomingOverline} title={home.upcomingTitle} text={home.upcomingSubtitle} />
                        <Reveal className="feature">
                            <Img src={feature.poster_url} alt={feature.title} ratio="16x9" width={1200} />
                            <div className="feature-body">
                                {feature.tag && <span className="label">{feature.tag}</span>}
                                <h3 className="display h-md">{feature.title}</h3>
                                <div className="meta-row">
                                    <span><b>{formatEventDate(feature)}</b></span>
                                    {feature.time_text && <span>{feature.time_text}</span>}
                                    {feature.venue && <span>{feature.venue}</span>}
                                </div>
                                <p className="muted" style={{ margin: 0 }}>{feature.summary}</p>
                                <Countdown date={feature.start_date} />
                                <div className="hero-cta" style={{ marginTop: 0 }}>
                                    <Link to={`/events/${feature.slug}`} className="btn solid">Event details <span className="arr">→</span></Link>
                                    {feature.registration_url && <SmartLink to={feature.registration_url} className="btn">{feature.cta_label}</SmartLink>}
                                </div>
                            </div>
                        </Reveal>
                        {upcoming.length > 1 && (
                            <div className="grid g-3" style={{ marginTop: 28 }}>
                                {upcoming.slice(1, 4).map((e, i) => <EventCard key={e.id} event={e} delay={i * 0.08} />)}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* SPOTLIGHT BANNERS */}
            {show.banners !== false && list('banners').length > 0 && (
                <section className="section tight"><div className="wrap"><Spotlight banners={list('banners')} /></div></section>
            )}

            {/* ABOUT */}
            {show.about !== false && (
                <section className="section">
                    <div className="wrap split">
                        <div>
                            <span className="label">{home.aboutOverline}</span>
                            <RevealText as="h2" className="display h-lg" text={home.aboutTitle} />
                        </div>
                        <Reveal>
                            {(home.aboutParagraphs || []).map((p, i) => <p key={i}>{p}</p>)}
                            {show.sticky && home.stickyText && <p style={{ color: 'var(--text)', fontSize: '1.2rem' }}>{home.stickyText}</p>}
                        </Reveal>
                    </div>
                </section>
            )}

            {/* DOMAINS */}
            {show.domains !== false && domains.length > 0 && (
                <section className="section">
                    <div className="wrap">
                        <SectionHead overline={home.domainsOverline} title={home.domainsTitle} text={home.domainsSubtitle} />
                        <div className="domains">
                            {domains.map((d, i) => (
                                <Reveal key={d.id} className="domain" delay={(i % 3) * 0.06}>
                                    <div className="num"><span>{String(i + 1).padStart(2, '0')}</span><span>→</span></div>
                                    <h3 className="display h-sm">{d.title}</h3>
                                    <p>{String(d.desc || '').replace(/^[•\s]+/, '').replace(/"$/, '')}</p>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* RECENT EVENTS */}
            {show.events !== false && recent.length > 0 && (
                <section className="section">
                    <div className="wrap">
                        <SectionHead overline={home.eventsOverline} title={home.eventsTitle} link="/timeline" linkLabel={home.eventsCta} />
                        <div className="grid g-3">{recent.map((e, i) => <EventCard key={e.id} event={e} delay={i * 0.08} />)}</div>
                    </div>
                </section>
            )}

            {/* GALLERY */}
            {show.gallery !== false && gallery.length > 0 && (
                <section className="section">
                    <div className="wrap">
                        <SectionHead overline={home.galleryOverline} title={home.galleryTitle} text={home.gallerySubtitle} link="/moments" linkLabel={home.galleryCta} />
                        <div className="gallery-grid">
                            {gallery.map((g, i) => (
                                <Reveal key={g.image} delay={(i % 4) * 0.05}>
                                    <button onClick={() => setLightbox(i)} aria-label={g.caption || 'Open photo'}>
                                        <Img src={g.image} alt={g.caption || ''} ratio="4x3" width={600} />
                                    </button>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* BOARD */}
            {show.board !== false && board.length > 0 && (
                <section className="section">
                    <div className="wrap">
                        <SectionHead overline={home.boardOverline} title={home.boardTitle} text={home.boardSubtitle} link="/web-team" linkLabel={home.boardCta} />
                        <MovingPeopleGrid people={board} />
                    </div>
                </section>
            )}

            {/* CTA BAND */}
            {show.chill !== false && (
                <section className="section tight">
                    <div className="wrap">
                        <Reveal className="band">
                            <div>
                                <h2 className="display h-lg">{home.chillTitle}</h2>
                                <p>{home.chillText}</p>
                            </div>
                            <div className="hero-cta" style={{ marginTop: 0 }}>
                                {home.chillCta?.url && <SmartLink to={home.chillCta.url} className="btn light">{label(home.chillCta.label)} <span className="arr">→</span></SmartLink>}
                                {home.joinCta?.url && <SmartLink to={home.joinCta.url} className="btn">{home.joinCta.label}</SmartLink>}
                            </div>
                        </Reveal>
                    </div>
                </section>
            )}

            <AnimatePresence>
                {lightbox !== null && <Lightbox photos={gallery.map(g => g.image)} title={home.galleryTitle} start={lightbox} onClose={() => setLightbox(null)} />}
            </AnimatePresence>
        </>
    )
}
