import { Link } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import PageHeader from '../components/PageHeader'
import SmartLink from '../components/SmartLink'
import Seo from '../components/Seo'
import Img from '../components/Img'
import { Reveal } from '../components/Reveal'
import { formatEventDate } from '../../shared/cms.js'
import { useEventImage } from '../components/Cards'

/* Events are grouped by year and ordered by date. Upcoming / Live / Past status is computed
   from today's date, so changing an event's date in the admin moves it automatically. */
export default function EventTimeline() {
    const { events, moments } = useSite()
    const timeline = events.filter(e => e.show_in_timeline).sort((a, b) => b.start_date.localeCompare(a.start_date))
    const years = [...new Set(timeline.map(e => e.start_date.slice(0, 4)))]
    const photos = id => moments.filter(m => m.event?.id === id)
    const pic = useEventImage()

    return (
        <>
            <Seo />
            <PageHeader page="timeline" />
            <section className="section" style={{ borderTop: 0, paddingTop: 0 }}>
                <div className="wrap tl">
                    {years.map(y => (
                        <div className="tl-year" key={y}>
                            <h2 className="display h-lg">{y}</h2>
                            <div className="tl-items">
                                {timeline.filter(e => e.start_date.startsWith(y)).map((e, i) => {
                                    const albums = photos(e.id)
                                    const count = albums.reduce((n, a) => n + a.photos.length, 0)
                                    return (
                                        <Reveal key={e.id} delay={i * 0.05} className={`tl-item${e.state !== 'past' ? ' upcoming' : ''}`}>
                                            <Link to={`/events/${e.slug}`} aria-label={e.title}>
                                                <Img src={pic.src(e)} alt={e.title} ratio="16x9" width={500} fallback={pic.fallback} />
                                            </Link>
                                            <div className="card-body">
                                                <div className="card-meta">
                                                    <span>{formatEventDate(e)}</span>
                                                    {e.state === 'upcoming' && <span className="chip on">Upcoming</span>}
                                                    {e.state === 'ongoing' && <span className="chip live">Live now</span>}
                                                </div>
                                                <h3 className="display h-sm"><Link to={`/events/${e.slug}`}>{e.title}</Link></h3>
                                                {e.summary && <p>{e.summary}</p>}
                                                <div className="hero-cta" style={{ marginTop: 6 }}>
                                                    <Link to={`/events/${e.slug}`} className="link-arrow">Details →</Link>
                                                    {e.state !== 'past' && e.registration_url && <SmartLink to={e.registration_url} className="link-arrow">{e.cta_label} →</SmartLink>}
                                                    {count > 0 && <Link to={`/moments#album-${albums[0].id}`} className="link-arrow">{count} photos →</Link>}
                                                </div>
                                            </div>
                                        </Reveal>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                    {!timeline.length && <p className="empty">No events yet</p>}
                </div>
            </section>
        </>
    )
}
