import { useState } from 'react'
import { useSite } from '../context/SiteContext'
import { api } from '../lib/api'
import SmartLink from '../components/SmartLink'
import Seo from '../components/Seo'
import Img from '../components/Img'
import PageHeader from '../components/PageHeader'
import { Reveal } from '../components/Reveal'

const ytId = url => String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1]

export default function Vlogs() {
    const { list, settings } = useSite()
    const cfg = settings.vlogs || {}
    const [email, setEmail] = useState('')
    const [msg, setMsg] = useState('')
    const submit = async e => {
        e.preventDefault()
        try { const r = await api.post('/subscribe', { email, list: 'vlogs' }); setMsg(r.already ? 'Already subscribed.' : 'Subscribed to vlogs.'); setEmail('') }
        catch (err) { setMsg(err.message) }
    }
    return (
        <>
            <Seo />
            <PageHeader page="vlogs" />
            <section className="section" style={{ borderTop: 0 }}>
                <div className="wrap">
                    <div className="grid g-3">
                        {list('vlogs').map((v, i) => {
                            const id = ytId(v.url)
                            return (
                                <Reveal key={v.id} delay={(i % 3) * 0.06}>
                                    <SmartLink to={v.url || cfg.channelUrl} className="card">
                                        <Img src={v.thumbnail || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '')} alt={v.title} ratio="16x9" width={800} fallback="▶">
                                            <span className="chip on">▶ Watch</span>
                                        </Img>
                                        <div className="card-body"><h3 className="display h-sm">{v.title}</h3><p>{v.desc}</p></div>
                                    </SmartLink>
                                </Reveal>
                            )
                        })}
                    </div>
                </div>
            </section>
            <section className="section tight">
                <div className="wrap">
                    <div className="band">
                        <div><h2 className="display h-md">{cfg.subscribeTitle?.replace(/[^\p{L}\p{N}\s'&.,:!?—–-]/gu, '').trim()}</h2><p>{cfg.subscribeText}</p></div>
                        <form onSubmit={submit} className="hero-cta" style={{ marginTop: 0, flex: '1 1 320px', maxWidth: 480 }}>
                            <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1, minWidth: 200, borderColor: 'var(--accent-ink)', background: 'transparent', color: 'var(--accent-ink)' }} aria-label="Email" />
                            <button className="btn light">Subscribe</button>
                            {msg && <p style={{ width: '100%', margin: 0 }}>{msg}</p>}
                        </form>
                    </div>
                </div>
            </section>
        </>
    )
}
