import { Link, useParams } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import { sanitizeHtml } from '../lib/safe'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import Section from '../components/Section'
import Img from '../components/Img'
import { itemSlug, fileType } from '../lib/items'

const officeViewer = u => `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(u)}`

/** /projects/:slug — a short write-up with the architecture diagram and links. */
export function ProjectDetail() {
    const { slug } = useParams()
    const { list, ready, settings } = useSite()
    const p = list('projects').find(x => itemSlug(x) === slug)
    if (!p) return <PageHeader title={ready ? 'Project not found' : 'Loading'} overline="Projects"><Link className="btn" to="/projects" style={{ marginTop: 20 }}>All projects</Link></PageHeader>
    const abs = u => (u ? new URL(u, window.location.origin).href : undefined)
    const jsonLd = { '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: p.title, description: p.tagline, codeRepository: p.github || undefined, url: p.live || undefined,
        programmingLanguage: p.tech?.length ? p.tech : undefined, image: abs(p.diagram || p.image), author: { '@type': 'Organization', name: settings.site?.name } }
    return (
        <>
            <Seo title={p.title} description={p.tagline} image={p.diagram || p.image} type="article" jsonLd={jsonLd} />
            <PageHeader title={p.title} overline={`Projects / ${p.status || 'Project'}`} subtitle={p.tagline} wide>
                <div className="hero-cta">
                    {p.github && <a className="btn solid" href={p.github} target="_blank" rel="noreferrer">View on GitHub <span className="arr">→</span></a>}
                    {p.live && <a className="btn" href={p.live} target="_blank" rel="noreferrer">Open live site ↗</a>}
                    <Link className="btn" to="/projects">All projects</Link>
                </div>
            </PageHeader>
            <Section id="project.detail" className="section" style={{ borderTop: 0 }}>
                <div className="wrap form" style={{ gap: 36 }}>
                    {(p.tech?.length > 0 || p.year) && (
                        <div className="pr-meta">
                            {p.year && <span><b>Year</b>{p.year}</span>}
                            {p.status && <span><b>Status</b>{p.status}</span>}
                            {p.tech?.length > 0 && <span><b>Built with</b><ul className="pr-tags">{p.tech.map(t => <li key={t}>{t}</li>)}</ul></span>}
                        </div>
                    )}
                    {p.diagram && (
                        <figure className="pr-diagram">
                            <a href={p.diagram} target="_blank" rel="noreferrer" title="Open full size"><Img src={p.diagram} alt={`${p.title} architecture diagram`} ratio="16x9" width={1600} contain eager /></a>
                            <figcaption>Architecture — click to open full size</figcaption>
                        </figure>
                    )}
                    {p.body && <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.body) }} />}
                </div>
            </Section>
        </>
    )
}

/** /resources/:slug — about the resource, with the document shown inline and download links. */
export function ResourceDetail() {
    const { slug } = useParams()
    const { list, ready, settings } = useSite()
    const r = list('resources').find(x => itemSlug(x) === slug)
    if (!r) return <PageHeader title={ready ? 'Resource not found' : 'Loading'} overline="Resources"><Link className="btn" to="/projects?tab=resources" style={{ marginTop: 20 }}>All resources</Link></PageHeader>
    const type = fileType(r.file)
    const viewer = !r.file ? null : type === 'PDF' ? r.file : ['DOC', 'DOCX', 'PPT', 'PPTX', 'XLS', 'XLSX'].includes(type) ? officeViewer(r.file) : null
    const jsonLd = { '@context': 'https://schema.org', '@type': 'LearningResource', name: r.title, description: r.summary, learningResourceType: r.category,
        keywords: r.tags?.join(', ') || undefined, url: window.location.href, provider: { '@type': 'Organization', name: settings.site?.name } }
    return (
        <>
            <Seo title={r.title} description={r.summary} image={r.image} type="article" jsonLd={jsonLd} />
            <PageHeader title={r.title} overline={`Resources / ${r.category || 'Resource'}`} subtitle={r.summary} wide>
                <div className="hero-cta">
                    {r.file && <a className="btn solid" href={r.file} target="_blank" rel="noreferrer">Open {type || 'document'} in a new tab <span className="arr">→</span></a>}
                    {r.file && <a className="btn" href={r.file} download>Download</a>}
                    {r.link && <a className="btn" href={r.link} target="_blank" rel="noreferrer">Related link ↗</a>}
                    <Link className="btn" to="/projects?tab=resources">All resources</Link>
                </div>
            </PageHeader>
            <Section id="project.detail" className="section" style={{ borderTop: 0 }}>
                <div className="wrap form" style={{ gap: 32 }}>
                    {r.tags?.length > 0 && <ul className="pr-tags">{r.tags.map(t => <li key={t}>{t}</li>)}</ul>}
                    {r.body && <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.body) }} />}
                    {viewer ? <iframe className="pr-viewer" src={viewer} title={`${r.title} document`} loading="lazy" />
                        : !r.file ? <p className="notice">The document for this resource is being prepared and will appear here soon.</p>
                            : <p className="notice">This file can't be previewed here — use <b>Open</b> or <b>Download</b> above.</p>}
                </div>
            </Section>
        </>
    )
}
