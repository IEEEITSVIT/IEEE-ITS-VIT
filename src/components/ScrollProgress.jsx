import { motion, useScroll, useSpring } from 'framer-motion'
import { useSite } from '../context/SiteContext'

export default function ScrollProgress() {
    const { settings } = useSite()
    const { scrollYProgress } = useScroll()
    const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 })
    if (settings.appearance?.scrollProgress === false) return null
    return <motion.div className="progress-top" style={{ scaleX }} />
}
