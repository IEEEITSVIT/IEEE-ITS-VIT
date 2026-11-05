import { useSite } from '../context/SiteContext'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import { PersonCard } from '../components/Cards'
import { Reveal } from '../components/Reveal'
import Section from '../components/Section'

export default function WebTeam() {
    const { list, settings } = useSite()
    const note = settings.webteam || {}
    return (
        <>
            <Seo />
            <PageHeader page="webteam" />
            <Section id="webteam.list" className="section" style={{ borderTop: 0 }}>
                <div className="wrap">
                    <div className="grid g-4 people">{list('web_team').map((m, i) => <PersonCard key={m.id} person={m} delay={(i % 4) * 0.06} />)}</div>
                </div>
            </Section>
            {note.noteText && (
                <Section id="webteam.note" className="section">
                    <div className="wrap split">
                        <div><span className="label">{note.noteTitle}</span></div>
                        <Reveal><p style={{ fontSize: '1.15rem', color: 'var(--text)' }}>{note.noteText}</p><p className="mono muted">{note.noteSignature}</p></Reveal>
                    </div>
                </Section>
            )}
        </>
    )
}
