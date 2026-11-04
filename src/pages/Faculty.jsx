import { useSite } from '../context/SiteContext'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import Img from '../components/Img'
import SmartLink from '../components/SmartLink'
import { Reveal } from '../components/Reveal'

export default function Faculty() {
    const { list } = useSite()
    return (
        <>
            <Seo />
            <PageHeader page="faculty" />
            <section className="section" style={{ borderTop: 0 }}>
                <div className="wrap form" style={{ gap: 28 }}>
                    {list('faculty').map((f, i) => (
                        <Reveal key={f.id} delay={i * 0.08} className="boxed">
                            <div className="split portrait-left">
                                <Img src={f.image} alt={f.name} ratio="4x5" width={600} face focus={f.focus || '50% 30%'} fallback={f.initials} />
                                <div>
                                    <span className="label">{f.designation}</span>
                                    <h2 className="display h-md" style={{ margin: '14px 0 6px' }}>{f.name}</h2>
                                    <p className="mono muted" style={{ fontSize: '.8rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>{f.department}</p>
                                    {f.note && <p style={{ fontSize: f.isQuote !== false ? '1.2rem' : '1rem', color: f.isQuote !== false ? 'var(--text)' : 'var(--muted)' }}>{f.isQuote !== false ? `“${f.note}”` : f.note}</p>}
                                    {f.website && <SmartLink to={f.website} className="link-arrow">View faculty profile →</SmartLink>}
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>
        </>
    )
}
