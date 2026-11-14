import { Link, useSearchParams } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import Section from '../components/Section'
import Img from '../components/Img'
import { Reveal } from '../components/Reveal'
import { itemSlug, fileType } from '../lib/items'


/** Projects and study resources on one page; ?tab=resources opens the second tab. */
export default function ProjectsResources() {
    const { list } = useSite()
    const [params, setParams] = useSearchParams()
    const projects = list('projects')
    const resources = list('resources')
    const tab = params.get('tab') === 'resources' ? 'resources' : 'projects'

    return (
        <>
            <Seo />
            <PageHeader page="projects" />
            <Section id="projects.list" className="section" style={{ borderTop: 0 }}>
                <div className="wrap">
                    <div className="year-tabs" role="tablist" aria-label="Projects or resources">
                        <button role="tab" aria-selected={tab === 'projects'} className={`chip${tab === 'projects' ? ' on' : ''}`} onClick={() => setParams({}, { replace: true })}>Projects ({projects.length})</button>
                        <button role="tab" aria-selected={tab === 'resources'} className={`chip${tab === 'resources' ? ' on' : ''}`} onClick={() => setParams({ tab: 'resources' }, { replace: true })}>Resources ({resources.length})</button>
                    </div>

                    {tab === 'projects' && (projects.length === 0 ? <p className="muted">Projects will be added soon.</p> : (
                        <div className="grid g-2 pr-grid">
                            {projects.map((p, i) => (
                                <Reveal key={p.id} delay={(i % 2) * 0.06}>
                                    <Link to={`/projects/${itemSlug(p)}`} className="card pr-card">
                                        <Img src={p.image || p.diagram} alt={p.title} ratio="16x9" width={900} contain={!p.image} />
                                        <div className="card-body">
                                            <div className="rec-top">{p.status && <span className="chip">{p.status}</span>}{p.year && <span className="muted small">{p.year}</span>}</div>
                                            <h3 className="display h-sm">{p.title}</h3>
                                            {p.tagline && <p>{p.tagline}</p>}
                                            {p.tech?.length > 0 && <ul className="pr-tags">{p.tech.slice(0, 6).map(t => <li key={t}>{t}</li>)}</ul>}
                                            <span className="link-arrow">Read more →</span>
                                        </div>
                                    </Link>
                                </Reveal>
                            ))}
                        </div>
                    ))}

                    {tab === 'resources' && (resources.length === 0 ? <p className="muted">Resources will be added soon.</p> : (
                        <div className="grid g-3 pr-grid">
                            {resources.map((r, i) => (
                                <Reveal key={r.id} delay={(i % 3) * 0.05}>
                                    <Link to={`/resources/${itemSlug(r)}`} className="card pr-card pr-resource">
                                        {r.image && <Img src={r.image} alt={r.title} ratio="16x9" width={700} />}
                                        <div className="card-body">
                                            <div className="rec-top">
                                                {r.category && <span className="chip">{r.category}</span>}
                                                <span className="pr-file">{r.file ? fileType(r.file) || 'FILE' : 'Coming soon'}</span>
                                            </div>
                                            <h3 className="display h-sm">{r.title}</h3>
                                            {r.summary && <p>{r.summary}</p>}
                                            {r.tags?.length > 0 && <ul className="pr-tags">{r.tags.slice(0, 6).map(t => <li key={t}>{t}</li>)}</ul>}
                                            <span className="link-arrow">Open →</span>
                                        </div>
                                    </Link>
                                </Reveal>
                            ))}
                        </div>
                    ))}
                </div>
            </Section>
        </>
    )
}
