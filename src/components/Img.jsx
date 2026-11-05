import { useState } from 'react'
import { img } from '../lib/safe'
import { useSite } from '../context/SiteContext'

/**
 * Uniform image frame. Every image of a given kind uses the same aspect ratio and crop,
 * so cards look alike no matter what was uploaded. ImageKit URLs are resized and
 * face-cropped server-side (fo-face) for portraits. An image adjusted in the admin (fit, focal point,
 * zoom — settings.image_styles) is fetched uncropped and framed in the browser instead.
 */
export default function Img({ src, alt = '', ratio = '16x9', width = 800, focus, face, contain, fallback, className = '', children, eager }) {
    const [err, setErr] = useState(false)
    const { settings } = useSite()
    const st = src ? settings.image_styles?.[src] : null
    const [h] = ratio.split('x').map(Number).reverse()
    const w = Number(ratio.split('x')[0])
    const url = !src || err ? '' : st ? img(src, { w: width }) : img(src, { w: width, h: Math.round((width * h) / w), face })
    const imgStyle = st
        ? { objectFit: st.fit, objectPosition: `${st.x}% ${st.y}%`, ...(st.zoom > 1 ? { scale: String(st.zoom), transformOrigin: `${st.x}% ${st.y}%` } : {}) }
        : focus ? { objectPosition: focus } : undefined
    return (
        <div className={`frame r-${ratio}${contain ? ' contain' : ''} ${className}`}>
            {url
                ? <img src={url} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setErr(true)} style={imgStyle} />
                : <span className="ph" aria-hidden="true">{fallback}</span>}
            {children}
        </div>
    )
}
