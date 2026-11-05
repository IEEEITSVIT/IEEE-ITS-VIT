import { SECTIONS, sectionAttrs } from '../../shared/layout.js'
import { useSite } from '../context/SiteContext'

const LABEL = Object.fromEntries(SECTIONS.map(s => [s.id, s.label]))

/**
 * A styleable block of the page. Colours, fonts, sizes, placement and picture shape come from
 * Admin → Design (settings.layout.sections[id]) and are applied as scoped CSS variables/classes.
 */
export default function Section({ id, as: Tag = 'section', className = '', style, children, ...rest }) {
    const { settings, preview } = useSite()
    const s = settings.layout?.sections?.[id] || {}
    if (s.hidden && !preview) return null
    const { vars, className: sx } = sectionAttrs(s)
    return (
        <Tag {...rest} data-sec={id} data-sec-label={LABEL[id] || id} className={`${className} ${sx}${s.hidden ? ' sx-hidden' : ''}`.trim()} style={{ ...style, ...vars }}>
            {children}
        </Tag>
    )
}
