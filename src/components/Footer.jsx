import { Link } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import SmartLink from './SmartLink'
import SocialIcon from './SocialIcon'
import Section from './Section'

export default function Footer() {
    const { list, settings } = useSite()
    const site = settings.site || {}
    const groups = {}
    for (const l of list('footer_links')) (groups[l.group || 'Links'] ||= []).push(l)
    const cols = Object.keys(groups).length + 1

    return (
        <Section id="footer" as="footer" className="footer">
            <div className="wrap">
                <div className="footer-top" style={{ '--cols': cols }}>
                    <div className="footer-brand">
                        <Link to="/" className="nav-brand">
                            {site.logoRound && <img className="round" src={site.logoRound} alt="" style={{ width: 44, height: 44 }} />}
                            {site.logoText && <img className="text" src={site.logoText} alt={site.shortName || ''} style={{ height: 24 }} />}
                        </Link>
                        <p>{site.description}</p>
                        <div className="footer-socials">
                            {list('social_links').map(s => (
                                <SmartLink key={s.id} to={s.url} className="icon-btn" aria-label={s.platform}><SocialIcon platform={s.platform} /></SmartLink>
                            ))}
                        </div>
                    </div>
                    {Object.entries(groups).map(([group, links]) => (
                        <div key={group}>
                            <h4>{group}</h4>
                            <ul>{links.map(l => <li key={l.id}><SmartLink to={l.url}>{l.label}</SmartLink></li>)}</ul>
                        </div>
                    ))}
                    <div>
                        <h4>Contact</h4>
                        <ul>
                            {site.email && <li><a href={`mailto:${site.email}`}>{site.email}</a></li>}
                            {site.phone && <li><a href={`tel:${site.phone.replace(/\s/g, '')}`}>{site.phone}</a></li>}
                            {site.address && <li className="muted">{site.address}</li>}
                        </ul>
                    </div>
                </div>
                <div className="footer-word" aria-hidden="true">{site.shortName}</div>
                <div className="footer-bottom">
                    <span>© {new Date().getFullYear()} {site.name}</span>
                    <span>{site.madeWith} <Link to="/web-team">Web Team</Link></span>
                </div>
            </div>
        </Section>
    )
}
