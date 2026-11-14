import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import Img from './Img'
import SmartLink from './SmartLink'
import SocialIcon from './SocialIcon'
import { Reveal } from './Reveal'
import { formatEventDate } from '../../shared/cms.js'
import { useSite } from '../context/SiteContext'

const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

/** Uniform portrait card — same 4:5 crop for everyone. */
const ENTER = { left: { x: -70, y: 0 }, right: { x: 70, y: 0 }, up: { x: 0, y: -70 }, down: { x: 0, y: 70 } }
const near = v => (typeof window !== 'undefined' && window.innerWidth <= 720 ? Math.sign(v) * 28 : v)

export function PersonCard({ person, subtitle, delay = 0, link, from }) {
    const enter = ENTER[from] ? { x: near(ENTER[from].x), y: near(ENTER[from].y) } : { x: 0, y: 24 }
    // Entries created ahead of time (no name yet) show a quiet placeholder instead of empty text.
    if (!person.name) person = { ...person, name: 'Name to be added', role: person.role || 'Position', placeholder: true }
    const socials = [['instagram', person.instagram], ['linkedin', person.linkedin], ['website', link]].filter(([, u]) => u)
    return (
        <Reveal className={`person${person.placeholder ? ' placeholder' : ''}`} delay={delay} x={enter.x} y={enter.y}>
            <Img src={person.image} alt={person.placeholder ? '' : person.name} ratio="4x5" width={600} face focus={person.focus || '50% 30%'} fallback={person.placeholder ? '' : person.initials || initials(person.name)}>
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

/* Columns of the people grid at the current width (mirrors the .g-4 breakpoints in site.css). */
function useColumns() {
    const get = () => (window.innerWidth <= 720 ? 2 : window.innerWidth <= 1000 ? 3 : 4)
    const [cols, setCols] = useState(get)
    useEffect(() => {
        const on = () => setCols(get())
        window.addEventListener('resize', on)
        return () => window.removeEventListener('resize', on)
    }, [])
    return cols
}

/**
 * People grid with motion on scroll: each column enters from its own side (left / up / down / right)
 * and, while scrolling, alternate columns drift up and down in opposite directions.
 * The card's own fade + black & white → colour hover is unchanged.
 */
export function MovingPeopleGrid({ people }) {
    const ref = useRef(null)
    const cols = useColumns()
    const reduce = useReducedMotion()
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
    // On phones (two columns) the cards only slide in; drifting columns look uneven on a narrow screen.
    const drift = cols > 2 ? 46 : 0
    const rise = useTransform(scrollYProgress, [0, 1], [drift, -drift])
    const sink = useTransform(scrollYProgress, [0, 1], [-drift, drift])
    const dirs = cols === 4 ? ['left', 'up', 'down', 'right'] : cols === 3 ? ['left', 'up', 'right'] : ['left', 'right']
    return (
        <div ref={ref} className="grid g-4 people moving-grid">
            {people.map((m, i) => {
                const col = i % cols
                return (
                    <motion.div key={m.id} style={reduce || !drift ? undefined : { y: col % 2 ? sink : rise }}>
                        <PersonCard person={m} from={reduce ? undefined : dirs[col]} delay={Math.floor(i / cols) * 0.04 + col * 0.06} />
                    </motion.div>
                )
            })}
        </div>
    )
}

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
