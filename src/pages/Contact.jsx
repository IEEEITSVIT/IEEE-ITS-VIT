import { useSite } from '../context/SiteContext'
import ContactForm from '../components/ContactForm'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'
import { Reveal } from '../components/Reveal'
import Section from '../components/Section'

/* Public query form — stored in D1 and emailed to the recipients set in Admin → Email & SMTP. */
export default function Contact() {
    const { settings } = useSite()
    const site = settings.site || {}
    return (
        <>
            <Seo />
            <PageHeader page="contact" />
            <Section id="contact.main" className="section" style={{ borderTop: 0 }}>
                <div className="wrap split wide-left">
                    <Reveal className="boxed"><ContactForm /></Reveal>
                    <Reveal delay={0.1} className="facts">
                        {site.email && <div><span>Email</span><b><a href={`mailto:${site.email}`}>{site.email}</a></b></div>}
                        {site.phone && <div><span>Phone</span><b><a href={`tel:${site.phone.replace(/\s/g, '')}`}>{site.phone}</a></b></div>}
                        {site.address && <div><span>Address</span><b>{site.address}</b></div>}
                    </Reveal>
                </div>
            </Section>
        </>
    )
}
