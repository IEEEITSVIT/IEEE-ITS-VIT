import { useEffect } from 'react'
import { useSite } from '../context/SiteContext'
import { layoutFonts } from '../../shared/layout.js'

const VARS = { bg: '--bg', surface: '--surface', surface2: '--surface-2', line: '--line', text: '--text', muted: '--muted', accent: '--accent', accentInk: '--accent-ink' }

/** Applies colours, fonts and radius from Admin → Theme (stored in D1) as CSS variables. */
export default function ThemeApplier() {
    const { settings } = useSite()
    const a = settings.appearance
    const extraFonts = layoutFonts(settings.layout).join('|')

    useEffect(() => {
        if (!a) return
        const root = document.documentElement.style
        for (const [k, v] of Object.entries(a.colors || {})) if (VARS[k] && /^#[0-9a-f]{6}$/i.test(v)) root.setProperty(VARS[k], v)
        if (a.radius !== undefined && a.radius !== null) {
            root.setProperty('--radius', `${Number(a.radius)}px`)
            root.setProperty('--radius-sm', `${Math.round(Number(a.radius) * 0.6)}px`)
        }
        const f = a.fonts || {}
        const families = [f.display, f.body, f.mono, ...(extraFonts ? extraFonts.split('|') : [])].filter(Boolean)
        if (f.display) root.setProperty('--font-display', `'${f.display}', system-ui, sans-serif`)
        if (f.body) root.setProperty('--font-body', `'${f.body}', system-ui, sans-serif`)
        if (f.mono) root.setProperty('--font-mono', `'${f.mono}', ui-monospace, monospace`)
        if (families.length) {
            const href = `https://fonts.googleapis.com/css2?${[...new Set(families)].map(n => `family=${encodeURIComponent(n).replace(/%20/g, '+')}:wght@400;500;600;700`).join('&')}&display=swap`
            let link = document.getElementById('theme-fonts')
            if (!link) {
                link = Object.assign(document.createElement('link'), { id: 'theme-fonts', rel: 'stylesheet' })
                document.head.appendChild(link)
            }
            if (link.href !== href) link.href = href
        }
        const meta = document.querySelector('meta[name="theme-color"]')
        if (meta && a.colors?.bg) meta.content = a.colors.bg
        // Declare light/dark so Samsung Internet and Chrome's auto-dark mode leave the admin-chosen colours alone.
        if (/^#[0-9a-f]{6}$/i.test(a.colors?.bg || '')) {
            const n = parseInt(a.colors.bg.slice(1), 16), lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
            const scheme = lum < 0.5 ? 'dark' : 'light'
            document.documentElement.style.colorScheme = scheme
            const cs = document.querySelector('meta[name="color-scheme"]')
            if (cs) cs.content = scheme
        }
        document.documentElement.dataset.portraits = a.grayscalePortraits === false ? 'color' : 'mono'
    }, [a, extraFonts])

    return null
}
