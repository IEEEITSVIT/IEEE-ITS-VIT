import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSite } from '../context/SiteContext'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'

export default function FAQ() {
    const { list } = useSite()
    const faqs = list('faqs')
    const [open, setOpen] = useState(0)
    const jsonLd = useMemo(() => ({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }), [faqs])
    return (
        <>
            <Seo jsonLd={jsonLd} />
            <PageHeader page="faq" />
            <section className="section" style={{ borderTop: 0 }}>
                <div className="wrap split narrow-left">
                    <div><span className="label">{faqs.length} questions</span></div>
                    <div className="faq">
                        {faqs.map((f, i) => (
                            <div key={f.id} className={`faq-row${open === i ? ' open' : ''}`}>
                                <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>{f.q}<span className="pm">+</span></button>
                                <AnimatePresence initial={false}>
                                    {open === i && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
                                            <p className="ans">{f.a}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </>
    )
}
