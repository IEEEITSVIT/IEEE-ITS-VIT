import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import Section from '../components/Section'
import { PersonCard } from '../components/Cards'

const startYear = y => Number(String(y).match(/\d{4}/)?.[0] || 0)
const GROUP_ORDER = ['Board', 'Web Team']

/** Past boards and web teams by year (Admin → Advisory Board). Newest year first; ?year= picks one. */
export default function AdvisoryBoard() {
    const { list } = useSite()
    const [params, setParams] = useSearchParams()
    const members = list('advisory')
    const years = useMemo(() => [...new Set(members.map(m => String(m.year || '').trim()).filter(Boolean))].sort((a, b) => startYear(b) - startYear(a) || b.localeCompare(a)), [members])
    const year = years.includes(params.get('year')) ? params.get('year') : years[0]
    const groups = useMemo(() => {
        const inYear = members.filter(m => String(m.year || '').trim() === year)
        const names = [...new Set(inYear.map(m => m.group || 'Board'))].sort((a, b) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99))
        return names.map(g => ({ name: g, people: inYear.filter(m => (m.group || 'Board') === g) }))
    }, [members, year])
    const label = y => y.replace(/\s*[-–]\s*/, '–')

    return (
        <>
            <Seo />
            <PageHeader page="advisory" />
            <Section id="advisory.list" className="section" style={{ borderTop: 0 }}>
                <div className="wrap">
                    {years.length === 0 ? <p className="muted">Past boards will be added soon.</p> : <>
                        <div className="year-tabs" role="tablist" aria-label="Board year">
                            {years.map(y => (
                                <button key={y} role="tab" aria-selected={y === year} className={`chip${y === year ? ' on' : ''}`}
                                    onClick={() => setParams(y === years[0] ? {} : { year: y }, { replace: true })}>{label(y)}</button>
                            ))}
                        </div>
                        {groups.map(g => (
                            <div key={`${year}-${g.name}`} className="advisory-group">
                                <h2 className="display h-md">{g.name === 'Board' ? `Board ${label(year)}` : `${g.name} ${label(year)}`}</h2>
                                <div className="grid g-4 people">{g.people.map((m, i) => <PersonCard key={m.id} person={m} delay={(i % 4) * 0.05} />)}</div>
                            </div>
                        ))}
                    </>}
                </div>
            </Section>
        </>
    )
}
