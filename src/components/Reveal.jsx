import { motion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1]

/** Masked line-by-line / word-by-word heading reveal. */
export function RevealText({ text = '', as: Tag = 'span', className, delay = 0, inView = true, by = 'word' }) {
    const parts = by === 'line' ? String(text).split('\n') : String(text).split(' ')
    const trigger = inView ? { initial: 'h', whileInView: 's', viewport: { once: true, margin: '-40px' } } : { initial: 'h', animate: 's' }
    return (
        <Tag className={className} aria-label={text}>
            <motion.span style={{ display: 'inline' }} {...trigger} transition={{ staggerChildren: 0.05, delayChildren: delay }} aria-hidden="true">
                {parts.map((w, i) => (
                    <span key={i} className="mask" style={by === 'line' ? { display: 'block' } : undefined}>
                        <motion.span variants={{ h: { y: '105%' }, s: { y: '0%' } }} transition={{ duration: 0.8, ease: EASE }}>
                            {w}{by === 'word' && i < parts.length - 1 ? ' ' : ''}
                        </motion.span>
                    </span>
                ))}
            </motion.span>
        </Tag>
    )
}

/** Fade-up on scroll. */
export function Reveal({ children, delay = 0, y = 24, className, as = 'div', ...rest }) {
    const M = motion[as] || motion.div
    return (
        <M className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay, ease: EASE }} {...rest}>
            {children}
        </M>
    )
}
