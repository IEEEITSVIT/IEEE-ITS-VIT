import { Link, useLocation } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import { img } from '../lib/safe'
import Section from './Section'
import { Reveal } from './Reveal'

/** "Our work" band above the footer, linking to Projects & Resources (Admin → Site & Contact). */
export default function WorkCta() {
    const { pathname } = useLocation()
    const { settings, list } = useSite()
    const c = settings.site?.workCta || {}
    const projects = list('projects'), resources = list('resources')
    if (!c.enabled || /^\/(projects|resources)(\/|$)/.test(pathname) || (!projects.length && !resources.length)) return null
    const covers = projects.filter(p => p.image).slice(0, 3)

    return (
        <Section id="work.cta" className="section tight work-cta-section">
            <div className="wrap">
                <Reveal className="work-cta">
                    <div className="work-cta-text">
                        {c.overline && <span className="label">{c.overline}</span>}
                        <h2 className="display h-lg">{c.title}</h2>
                        {c.text && <p>{c.text}</p>}
                        <div className="hero-cta" style={{ marginTop: 6 }}>
                            <Link to="/projects" className="btn solid">{c.projectsLabel || 'Projects'} <span className="arr">→</span></Link>
                            <Link to="/projects?tab=resources" className="btn">{c.resourcesLabel || 'Resources'}</Link>
                        </div>
                    </div>
                    <Link to="/projects" className="work-cta-visual" aria-label="Open Projects & Resources">
                        <div className="work-cta-stack" style={{ '--step': covers.length > 1 ? `${38 / (covers.length - 1)}%` : '19%', '--vstep': covers.length > 1 ? `${30 / (covers.length - 1)}%` : '15%' }}>
                            {covers.map((p, i) => <img key={p.id} src={img(p.image, { w: 520 })} alt="" style={{ '--i': i }} loading="lazy" />)}
                            {!covers.length && <span className="work-cta-empty">{'</>'}</span>}
                        </div>
                        <div className="work-cta-stats">
                            <span><b>{projects.length}</b>{projects.length === 1 ? 'project' : 'projects'}</span>
                            <span><b>{resources.length}</b>{resources.length === 1 ? 'resource' : 'resources'}</span>
                        </div>
                    </Link>
                </Reveal>
            </div>
        </Section>
    )
}
