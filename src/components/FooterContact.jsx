import { useLocation } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import ContactForm from './ContactForm'
import { Reveal, RevealText } from './Reveal'

const HIDE_ON = ['/contact', '/login', '/join', '/suggestions']

/** Contact band shown just above the footer on every page (text editable in Admin → Site & Contact). */
export default function FooterContact() {
    const { settings } = useSite()
    const { pathname } = useLocation()
    const ff = settings.site?.footerForm
    if (!ff || ff.enabled === false || HIDE_ON.includes(pathname)) return null
    const site = settings.site || {}
    return (
        <section className="section footer-contact" aria-labelledby="footer-contact-title">
            <div className="wrap split">
                <div>
                    {ff.overline && <span className="label">{ff.overline}</span>}
                    <RevealText as="h2" className="display h-lg" text={ff.title} />
                    {ff.text && <p className="lead">{ff.text}</p>}
                    <div className="meta-row" style={{ marginTop: 20 }}>
                        {site.email && <a href={`mailto:${site.email}`}><b>{site.email}</b></a>}
                        {site.phone && <a href={`tel:${site.phone.replace(/\s/g, '')}`}>{site.phone}</a>}
                    </div>
                </div>
                <Reveal className="boxed" delay={0.1}>
                    <ContactForm compact buttonLabel={ff.button || 'Send message'} successText={ff.success} />
                </Reveal>
            </div>
            <span id="footer-contact-title" hidden>{ff.title}</span>
        </section>
    )
}
