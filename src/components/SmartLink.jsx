import { Link } from 'react-router-dom'
import { safeHref, isExternal } from '../lib/safe'

/** Renders a router <Link> for internal paths and a safe new-tab <a> for external URLs. */
export default function SmartLink({ to, children, ...rest }) {
    const href = safeHref(to)
    if (!href) return <span {...rest}>{children}</span>
    if (isExternal(href)) {
        const newTab = /^https?:/i.test(href)
        return <a href={href} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>{children}</a>
    }
    return <Link to={href} {...rest}>{children}</Link>
}
