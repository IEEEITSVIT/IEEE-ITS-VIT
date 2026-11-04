import { useState } from 'react'
import { img } from '../lib/safe'

/**
 * Uniform image frame. Every image of a given kind uses the same aspect ratio and crop,
 * so cards look alike no matter what was uploaded. ImageKit URLs are resized and
 * face-cropped server-side (fo-face) for portraits.
 */
export default function Img({ src, alt = '', ratio = '16x9', width = 800, focus, face, contain, fallback, className = '', children, eager }) {
    const [err, setErr] = useState(false)
    const [h] = ratio.split('x').map(Number).reverse()
    const w = Number(ratio.split('x')[0])
    const url = src && !err ? img(src, { w: width, h: Math.round((width * h) / w), face }) : ''
    return (
        <div className={`frame r-${ratio}${contain ? ' contain' : ''} ${className}`}>
            {url
                ? <img src={url} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setErr(true)} style={focus ? { objectPosition: focus } : undefined} />
                : <span className="ph" aria-hidden="true">{fallback}</span>}
            {children}
        </div>
    )
}
