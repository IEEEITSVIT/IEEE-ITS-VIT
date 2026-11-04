import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Img from './Img'
import SmartLink from './SmartLink'
import SocialIcon from './SocialIcon'
import { Reveal } from './Reveal'
import { formatEventDate } from '../../shared/cms.js'
import { useSite } from '../context/SiteContext'

const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

/** Uniform portrait card — same 4:5 crop for everyone. */
export function PersonCard({ person, subtitle, delay = 0, link }) {
    const socials = [['instagram', person.instagram], ['linkedin', person.linkedin], ['website', link]].filter(([, u]) => u)
    return (
        <Reveal className="person" delay={delay}>
            <Img src={person.image} alt={person.name} ratio="4x5" width={600} face focus={person.focus || '50% 30%'} fallback={person.initials || initials(person.name)}>
                {socials.length > 0 && (
                    <div className="socials">
                        {socials.map(([p, u]) => <SmartLink key={p} to={u} className="icon-btn" aria-label={`${person.name} on ${p}`}><SocialIcon platform={p} /></SmartLink>)}
                    </div>
                )}
            </Img>
            <div>
                <h3>{person.name}</h3>
                <div className="role">{subtitle ?? person.role}</div>
            </div>
        </Reveal>
    )
}

const STATE_LABEL = { upcoming: 'Upcoming', ongoing: 'Live now', past: 'Past' }

/** Event image: poster, else first photo from the event's album, else the chapter logo. */
export function useEventImage() {
    const { moments, settings } = useSite()
    const logo = settings.site?.logoRound
    return {
        src: e => e.poster_url || moments.find(m => m.event?.id === e.id)?.photos?.[0] || '',
        fallback: logo ? <img src={logo} alt="" /> : null,
    }
}

export function EventCard({ event, delay = 0 }) {
    const pic = useEventImage()
    return (
        <Reveal delay={delay}>
            <Link to={`/events/${event.slug}`} className="card">
                <Img src={pic.src(event)} alt={event.title} ratio="16x9" width={800} fallback={pic.fallback}>
                    <span className={`chip${event.state === 'upcoming' ? ' on' : event.state === 'ongoing' ? ' live' : ''}`}>{STATE_LABEL[event.state]}</span>
                </Img>
                <div className="card-body">
                    <div className="card-meta"><span>{formatEventDate(event)}</span>{event.venue && <span>{event.venue}</span>}</div>
                    <h3 className="display h-sm">{event.title}</h3>
                    {event.summary && <p>{event.summary}</p>}
                </div>
            </Link>
        </Reveal>
    )
}

export function Countdown({ date }) {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [])
    const diff = Math.max(0, new Date(`${date}T09:00:00+05:30`).getTime() - now)
    if (!diff) return <span className="chip live">● Happening now</span>
    const parts = [['Days', Math.floor(diff / 864e5)], ['Hrs', Math.floor(diff / 36e5) % 24], ['Min', Math.floor(diff / 6e4) % 60], ['Sec', Math.floor(diff / 1e3) % 60]]
    return (
        <div className="countdown" role="timer" aria-label={`${parts[0][1]} days to go`}>
            {parts.map(([k, v]) => (
                <div key={k}>
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.strong key={v} initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ duration: 0.25 }}>
                            {String(v).padStart(2, '0')}
                        </motion.strong>
                    </AnimatePresence>
                    <small>{k}</small>
                </div>
            ))}
        </div>
    )
}

export function SectionHead({ overline, title, text, link, linkLabel }) {
    return (
        <div className="sec-head">
            <div>
                {overline && <span className="label">{overline}</span>}
                {title && <h2 className="display h-lg">{title}</h2>}
                {text && <p className="lead">{text}</p>}
            </div>
            {link && linkLabel && <SmartLink to={link} className="link-arrow">{linkLabel} <span>→</span></SmartLink>}
        </div>
    )
}
