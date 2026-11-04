import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSite } from '../context/SiteContext'
import SmartLink from '../components/SmartLink'
import Seo from '../components/Seo'
import Img from '../components/Img'
import PageHeader from '../components/PageHeader'
import { Reveal } from '../components/Reveal'
import { Countdown, useEventImage } from '../components/Cards'
import { formatEventDate } from '../../shared/cms.js'
import { sanitizeHtml, sanitizeInline, label } from '../lib/safe'

export default function EventDetail({ slug: fixedSlug }) {
    const params = useParams()
    const slug = fixedSlug || params.slug
    const { events, moments, ready } = useSite()
    const e = events.find(x => x.slug === slug)
    const pic = useEventImage()

    if (!e) {
        return (
            <>
                <Seo title="Event" noindex />
                <PageHeader title={ready ? 'Event not found' : 'Loading'} overline="Events" subtitle={ready ? 'This event may have been moved or removed.' : ''}>
                    {ready && <Link to="/timeline" className="btn" style={{ marginTop: 20 }}>All events</Link>}
                </PageHeader>
            </>
        )
    }

    const x = e.extra || {}
    const albums = moments.filter(m => m.event?.id === e.id)
    const photos = albums.flatMap(a => a.photos.map(p => ({ p, id: a.id }))).slice(0, 8)
    const jsonLd = {
        '@context': 'https://schema.org', '@type': 'Event', name: e.title, description: e.summary,
        startDate: e.start_date, endDate: e.end_date || e.start_date,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled',
        location: { '@type': 'Place', name: e.venue || 'VIT Vellore', address: 'Vellore Institute of Technology, Vellore, Tamil Nadu, India' },
        image: e.poster_url ? [new URL(e.poster_url, window.location.origin).href] : undefined,
        organizer: { '@type': 'Organization', name: 'IEEE ITS - VIT Chapter', url: window.location.origin },
    }
    const facts = [['Date', formatEventDate(e)], ['Time', e.time_text], ['Venue', e.venue], ['Status', { upcoming: 'Upcoming', ongoing: 'Live now', past: 'Concluded' }[e.state]]].filter(f => f[1])

    return (
        <>
            <Seo title={e.title} description={e.summary} image={e.poster_url} type="article" jsonLd={jsonLd} />
            <PageHeader title={e.title} overline={`Events / ${e.tag || 'Event'}`} subtitle={e.summary} wide />
            <section className="section" style={{ borderTop: 0 }}>
                <div className="wrap ev-hero">
                    <Reveal>
                        <Img src={pic.src(e)} alt={`${e.title} poster`} ratio="16x9" width={1400} contain={!!e.poster_url} eager fallback={pic.fallback} />
                    </Reveal>
                    <Reveal delay={0.1} className="form">
                        <div className="facts">{facts.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
                        {e.state === 'upcoming' && <Countdown date={e.start_date} />}
                        {e.state !== 'past' && e.registration_url && <SmartLink to={e.registration_url} className="btn solid">{label(e.cta_label) || 'Register'} <span className="arr">→</span></SmartLink>}
                        {x.links?.map((l, i) => <SmartLink key={i} to={l.url} className="btn">{l.label}</SmartLink>)}
                    </Reveal>
                </div>
            </section>

            {(x.highlights?.length > 0 || x.agenda?.length > 0) && (
                <section className="section">
                    <div className="wrap split">
                        {x.highlights?.length > 0 && (
                            <div>
                                <span className="label">{x.highlightsTitle || 'Highlights'}</span>
                                {x.heading && <h2 className="display h-md" style={{ margin: '16px 0 24px' }}>{x.heading}</h2>}
                                <ul className="bullets">{x.highlights.map((h, i) => <li key={i} dangerouslySetInnerHTML={{ __html: sanitizeInline(h) }} />)}</ul>
                            </div>
                        )}
                        {x.agenda?.length > 0 && (
                            <div>
                                <span className="label">{x.agendaTitle || 'Agenda'}</span>
                                <div className="agenda" style={{ marginTop: 20 }}>
                                    {x.agenda.map((a, i) => (
                                        <motion.div key={i} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                                            <strong>{a.time}</strong><span>{a.label}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {e.body_html && <section className="section"><div className="wrap"><div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.body_html) }} /></div></section>}

            {photos.length > 0 && (
                <section className="section">
                    <div className="wrap">
                        <div className="sec-head"><div><span className="label">Moments</span><h2 className="display h-md">From the event</h2></div><Link to={`/moments#album-${albums[0].id}`} className="link-arrow">All photos →</Link></div>
                        <div className="gallery-grid">
                            {photos.map(({ p, id }, i) => <Link key={i} to={`/moments#album-${id}`}><Img src={p} alt={e.title} ratio="4x3" width={500} /></Link>)}
                        </div>
                    </div>
                </section>
            )}

            {(x.ctaTitle || x.closing) && (
                <section className="section tight">
                    <div className="wrap">
                        <div className="band">
                            <div>{x.ctaTitle && <h2 className="display h-md">{x.ctaTitle.replace(/[^\p{L}\p{N}\s'&.,:!?—–-]/gu, '').trim()}</h2>}{x.ctaText && <p>{x.ctaText}</p>}{x.closing && <p>{x.closing}</p>}</div>
                            {e.state !== 'past' && e.registration_url && <SmartLink to={e.registration_url} className="btn light">{label(e.cta_label)} <span className="arr">→</span></SmartLink>}
                        </div>
                    </div>
                </section>
            )}
        </>
    )
}
