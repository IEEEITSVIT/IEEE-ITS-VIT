/**
 * Visual design layer: per-section styles (Admin → Design) and per-image crop/fit (image fields → Adjust).
 * Shared by the public site (applies them), the admin (edits them) and the server (validates them).
 *
 * settings.layout = { sections: { [sectionId]: SectionStyle }, order: { home: [sectionId, …] } }
 * settings.image_styles = { [imageUrl]: { fit, x, y, zoom } }
 */

/** Every styleable block of the site. `page` is where the editor previews it. */
export const SECTIONS = [
    { id: 'home.hero', page: '/', label: 'Hero', kind: 'hero' },
    { id: 'home.upcoming', page: '/', label: 'Upcoming event', kind: 'split', images: true },
    { id: 'home.banners', page: '/', label: 'Spotlight banners', kind: 'overlay', images: true },
    { id: 'home.about', page: '/', label: 'About', kind: 'split' },
    { id: 'home.domains', page: '/', label: 'Domains', kind: 'grid' },
    { id: 'home.events', page: '/', label: 'Recent events', kind: 'grid', images: true },
    { id: 'home.gallery', page: '/', label: 'Photo gallery', kind: 'grid', images: true },
    { id: 'home.board', page: '/', label: 'Board members', kind: 'grid', images: true },
    { id: 'home.cta', page: '/', label: 'Join band', kind: 'band' },
    { id: 'page.header', page: '/timeline', label: 'Page headers (all inner pages)', kind: 'header' },
    { id: 'timeline.list', page: '/timeline', label: 'Events timeline', kind: 'list', images: true },
    { id: 'moments.list', page: '/moments', label: 'Photo albums', kind: 'grid', images: true },
    { id: 'faculty.list', page: '/faculty', label: 'Faculty profiles', kind: 'split', images: true },
    { id: 'webteam.list', page: '/web-team', label: 'Web team', kind: 'grid', images: true },
    { id: 'advisory.list', page: '/advisory-board', label: 'Advisory Board', kind: 'grid', images: true },
    { id: 'webteam.note', page: '/web-team', label: 'Developers’ note', kind: 'split' },
    { id: 'blogs.list', page: '/blogs', label: 'Blog list', kind: 'grid', images: true },
    { id: 'vlogs.list', page: '/vlogs', label: 'Vlogs', kind: 'grid', images: true },
    { id: 'merch.list', page: '/merch', label: 'Merch products', kind: 'grid', images: true },
    { id: 'faq.list', page: '/faq', label: 'FAQ', kind: 'split' },
    { id: 'contact.main', page: '/contact', label: 'Contact page', kind: 'split' },
    { id: 'join.main', page: '/join', label: 'Join page', kind: 'split' },
    { id: 'suggestions.main', page: '/suggestions', label: 'Suggestions page', kind: 'list' },
    { id: 'games.main', page: '/games', label: 'Games', kind: 'grid' },
    { id: 'event.detail', page: '/timeline', label: 'Event pages', kind: 'split', images: true },
    { id: 'recruitment.main', page: '/recruitment', label: 'Recruitment portal', kind: 'grid' },
    { id: 'portal.main', page: '/timeline', label: 'Event registration portals', kind: 'split', images: true },
    { id: 'footer.contact', page: '/', label: 'Contact form above footer', kind: 'split' },
    { id: 'footer', page: '/', label: 'Footer', kind: 'footer' },
]
export const SECTION_IDS = SECTIONS.map(s => s.id)

/** Home sections that can be reordered by dragging (the hero always stays on top). */
export const HOME_ORDER = ['home.upcoming', 'home.banners', 'home.about', 'home.domains', 'home.events', 'home.gallery', 'home.board', 'home.cta']

export const homeOrder = layout => {
    const saved = (layout?.order?.home || []).filter(id => HOME_ORDER.includes(id))
    return [...saved, ...HOME_ORDER.filter(id => !saved.includes(id))]
}

export const FONTS = ['', 'Space Grotesk', 'Inter', 'JetBrains Mono', 'Poppins', 'Manrope', 'DM Sans', 'Sora', 'Outfit', 'Plus Jakarta Sans', 'IBM Plex Sans', 'Montserrat', 'Playfair Display', 'Roboto', 'Lexend']
export const RATIOS = ['', '1x1', '4x5', '3x4', '4x3', '3x2', '16x9', '21x9']
export const POSITIONS = ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']

/**
 * Section style options. type: color | font | range | enum | toggle.
 * Empty / missing values mean "use the site theme".
 */
export const STYLE_FIELDS = [
    { group: 'Text', name: 'headingFont', label: 'Heading font', type: 'font' },
    { group: 'Text', name: 'bodyFont', label: 'Body font', type: 'font' },
    { group: 'Text', name: 'titleSize', label: 'Heading size', type: 'range', min: 60, max: 160, step: 5, unit: '%', def: 100 },
    { group: 'Text', name: 'textSize', label: 'Body text size', type: 'range', min: 80, max: 140, step: 5, unit: '%', def: 100 },
    { group: 'Text', name: 'align', label: 'Text alignment', type: 'enum', options: ['', 'left', 'center', 'right'] },
    { group: 'Colours', name: 'bg', label: 'Background', type: 'color' },
    { group: 'Colours', name: 'text', label: 'Heading & text', type: 'color' },
    { group: 'Colours', name: 'muted', label: 'Secondary text', type: 'color' },
    { group: 'Colours', name: 'accent', label: 'Accent (buttons, labels)', type: 'color' },
    { group: 'Colours', name: 'accentInk', label: 'Text on accent', type: 'color' },
    { group: 'Colours', name: 'surface', label: 'Cards', type: 'color' },
    { group: 'Colours', name: 'line', label: 'Borders', type: 'color' },
    { group: 'Layout', name: 'swap', label: 'Swap sides (picture ↔ text)', type: 'toggle', kinds: ['split', 'band', 'footer'] },
    { group: 'Layout', name: 'stack', label: 'Stack vertically', type: 'toggle', kinds: ['split', 'band'] },
    { group: 'Layout', name: 'textPosition', label: 'Text position on picture', type: 'position', kinds: ['overlay'] },
    { group: 'Layout', name: 'width', label: 'Content width', type: 'enum', options: ['', 'narrow', 'normal', 'wide', 'full'] },
    { group: 'Layout', name: 'columns', label: 'Columns (desktop)', type: 'range', min: 1, max: 6, step: 1, def: 0, kinds: ['grid'] },
    { group: 'Layout', name: 'columnsMobile', label: 'Columns (phone)', type: 'range', min: 1, max: 3, step: 1, def: 0, kinds: ['grid'] },
    { group: 'Layout', name: 'padTop', label: 'Space above', type: 'range', min: 0, max: 200, step: 4, unit: 'px', def: -1 },
    { group: 'Layout', name: 'padBottom', label: 'Space below', type: 'range', min: 0, max: 200, step: 4, unit: 'px', def: -1 },
    { group: 'Layout', name: 'hidden', label: 'Hide this section', type: 'toggle' },
    { group: 'Pictures', name: 'ratio', label: 'Picture shape', type: 'enum', options: RATIOS, kinds: ['split', 'grid', 'overlay', 'list'] },
    { group: 'Pictures', name: 'fit', label: 'Picture fit', type: 'enum', options: ['', 'cover', 'contain'], kinds: ['split', 'grid', 'overlay', 'list'] },
    { group: 'Pictures', name: 'radius', label: 'Corner rounding', type: 'range', min: 0, max: 40, step: 1, unit: 'px', def: -1 },
    { group: 'Pictures', name: 'colorPhotos', label: 'Show portraits in colour', type: 'toggle', kinds: ['grid', 'split'] },
]

export const fieldsFor = kind => STYLE_FIELDS.filter(f => !f.kinds || f.kinds.includes(kind))

const HEX = /^#[0-9a-f]{6}$/i
const FONT_OK = /^[A-Za-z0-9 ]{1,40}$/

/** Validate one section style; unknown or empty values are dropped. */
export function cleanSectionStyle(input) {
    const out = {}
    if (!input || typeof input !== 'object') return out
    for (const f of STYLE_FIELDS) {
        const v = input[f.name]
        if (v === undefined || v === null || v === '') continue
        if (f.type === 'color' && HEX.test(String(v))) out[f.name] = String(v).toLowerCase()
        else if (f.type === 'font' && FONT_OK.test(String(v))) out[f.name] = String(v)
        else if (f.type === 'range' && Number.isFinite(Number(v)) && Number(v) >= f.min && Number(v) <= f.max) out[f.name] = Number(v)
        else if (f.type === 'enum' && f.options.includes(v)) out[f.name] = v
        else if (f.type === 'position' && POSITIONS.includes(v)) out[f.name] = v
        else if (f.type === 'toggle' && v === true) out[f.name] = true
    }
    return out
}

export function cleanLayout(input) {
    const sections = {}
    for (const [id, style] of Object.entries(input?.sections || {})) {
        if (!SECTION_IDS.includes(id)) continue
        const s = cleanSectionStyle(style)
        if (Object.keys(s).length) sections[id] = s
    }
    const home = (Array.isArray(input?.order?.home) ? input.order.home : []).filter(id => HOME_ORDER.includes(id))
    return { sections, order: { home: [...new Set(home)] } }
}

/** Per-image crop: fit cover/contain, focal point x/y in %, zoom 1–3. */
export function cleanImageStyle(input) {
    if (!input || typeof input !== 'object') return null
    const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d)
    const style = { fit: input.fit === 'contain' ? 'contain' : 'cover', x: num(input.x, 0, 100, 50), y: num(input.y, 0, 100, 50), zoom: num(input.zoom, 1, 3, 1) }
    return style.fit === 'cover' && style.x === 50 && style.y === 50 && style.zoom === 1 ? null : style
}

/** CSS custom properties + class names for a section's saved style. */
export function sectionAttrs(style = {}) {
    const vars = {}, cls = ['sx']
    const color = (name, prop) => { if (style[name]) vars[prop] = style[name] }
    color('bg', '--bg'); color('text', '--text'); color('muted', '--muted'); color('accent', '--accent')
    color('accentInk', '--accent-ink'); color('surface', '--surface'); color('line', '--line')
    if (style.surface) vars['--surface-2'] = style.surface
    if (style.bg) cls.push('sx-bg')
    if (style.text) cls.push('sx-fg')
    if (style.headingFont) vars['--font-display'] = `'${style.headingFont}', system-ui, sans-serif`
    if (style.bodyFont) { vars['--font-body'] = `'${style.bodyFont}', system-ui, sans-serif`; cls.push('sx-body-font') }
    if (style.titleSize && style.titleSize !== 100) vars['--ts'] = style.titleSize / 100
    if (style.textSize && style.textSize !== 100) { vars['--bs'] = style.textSize / 100; cls.push('sx-bs') }
    if (style.align) cls.push(`sx-align-${style.align}`)
    if (style.swap) cls.push('sx-swap')
    if (style.stack) cls.push('sx-stack')
    if (style.textPosition) cls.push(`sx-pos-${style.textPosition}`)
    if (style.width) cls.push(`sx-w-${style.width}`)
    if (style.columns) { vars['--sec-cols'] = style.columns; cls.push('sx-cols') }
    if (style.columnsMobile) { vars['--sec-mcols'] = style.columnsMobile; cls.push('sx-mcols') }
    if (style.padTop !== undefined) { vars['--sec-pt'] = `${style.padTop}px`; cls.push('sx-pt') }
    if (style.padBottom !== undefined) { vars['--sec-pb'] = `${style.padBottom}px`; cls.push('sx-pb') }
    if (style.ratio) { const [w, h] = style.ratio.split('x'); vars['--sec-ratio'] = `${w} / ${h}`; cls.push('sx-ratio') }
    if (style.fit) cls.push(`sx-fit-${style.fit}`)
    if (style.radius !== undefined) { vars['--radius'] = `${style.radius}px`; vars['--radius-sm'] = `${Math.round(style.radius * 0.6)}px` }
    if (style.colorPhotos) cls.push('sx-color')
    return { vars, className: cls.join(' ') }
}

/** Every Google Font a layout uses, so the theme loader can request them. */
export const layoutFonts = layout => Object.values(layout?.sections || {}).flatMap(s => [s.headingFont, s.bodyFont]).filter(Boolean)
