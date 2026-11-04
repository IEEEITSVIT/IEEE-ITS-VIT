/**
 * CMS schema — one definition drives both the admin forms and server-side validation.
 *
 * Field types: text | textarea | html | url | image | images | number | toggle | select |
 *              date | datetime | colors | strings | rows (array of sub-objects)
 */

export const CONTENT_TYPES = {
    banners: {
        label: 'Home Banners', singular: 'Banner', group: 'Home & Layout', title: 'title', image: 'image',
        help: 'Large promo slides shown on the home page (e.g. conferences, hackathons).',
        fields: [
            { name: 'badge', label: 'Badge text', type: 'text' },
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'subtitle', label: 'Subtitle', type: 'textarea' },
            { name: 'image', label: 'Background image', type: 'image' },
            { name: 'logo', label: 'Logo (optional)', type: 'image' },
            { name: 'ctaLabel', label: 'Button label', type: 'text' },
            { name: 'ctaUrl', label: 'Button link', type: 'url' },
            { name: 'secondaryLabel', label: 'Second button label', type: 'text' },
            { name: 'secondaryUrl', label: 'Second button link', type: 'url' },
            { name: 'facts', label: 'Key facts (one per line)', type: 'strings' },
        ],
    },
    popups: {
        label: 'Popups', singular: 'Popup', group: 'Home & Layout', title: 'title', image: 'image',
        help: 'Spotlight popups. Use the schedule to control when they appear.',
        fields: [
            { name: 'title', label: 'Title', type: 'text' },
            { name: 'text', label: 'Message', type: 'textarea' },
            { name: 'image', label: 'Poster / image', type: 'image' },
            { name: 'posterOnly', label: 'Poster only (hide title & message)', type: 'toggle' },
            { name: 'ctaLabel', label: 'Button label', type: 'text' },
            { name: 'ctaUrl', label: 'Button link', type: 'url' },
            { name: 'pages', label: 'Show on pages', type: 'text', help: 'Comma-separated paths, e.g. "/" or "/, /timeline". Use * for every page.' },
            { name: 'frequency', label: 'Frequency', type: 'select', options: ['every-visit', 'once-per-session', 'once-per-day', 'once'] },
            { name: 'delaySeconds', label: 'Delay before showing (seconds)', type: 'number' },
        ],
    },
    announcements: {
        label: 'Announcement Bar', singular: 'Announcement', group: 'Home & Layout', title: 'text',
        help: 'Thin bar at the top of every page. The first published one is shown.',
        fields: [
            { name: 'text', label: 'Text', type: 'text', required: true },
            { name: 'linkLabel', label: 'Link label', type: 'text' },
            { name: 'url', label: 'Link', type: 'url' },
        ],
    },
    gallery: {
        label: 'Home Photo Marquee', singular: 'Photo', group: 'Home & Layout', title: 'caption', image: 'image',
        help: 'Photos scrolling in the "Captured Moments" strip on the home page.',
        fields: [
            { name: 'image', label: 'Photo', type: 'image', required: true },
            { name: 'caption', label: 'Caption / alt text', type: 'text' },
            { name: 'link', label: 'Link (optional)', type: 'url' },
        ],
    },
    domains: {
        label: 'Domains', singular: 'Domain', group: 'Home & Layout', title: 'title',
        fields: [
            { name: 'icon', label: 'Icon (emoji)', type: 'text' },
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'desc', label: 'Description', type: 'textarea' },
        ],
    },
    nav_links: {
        label: 'Navigation Menu', singular: 'Menu link', group: 'Navigation & Links', title: 'label',
        fields: [
            { name: 'label', label: 'Label', type: 'text', required: true },
            { name: 'url', label: 'Link', type: 'url', required: true },
        ],
    },
    footer_links: {
        label: 'Footer Links', singular: 'Footer link', group: 'Navigation & Links', title: 'label',
        fields: [
            { name: 'group', label: 'Column', type: 'text', help: 'e.g. "Quick Links" or "Community"' },
            { name: 'label', label: 'Label', type: 'text', required: true },
            { name: 'url', label: 'Link', type: 'url', required: true },
        ],
    },
    social_links: {
        label: 'Social Links', singular: 'Social link', group: 'Navigation & Links', title: 'platform',
        fields: [
            { name: 'platform', label: 'Platform', type: 'select', options: ['instagram', 'linkedin', 'email', 'youtube', 'github', 'x', 'facebook', 'website'] },
            { name: 'url', label: 'URL', type: 'url', required: true },
        ],
    },
    board: {
        label: 'Board Members', singular: 'Board member', group: 'People', title: 'name', image: 'image',
        fields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'role', label: 'Role', type: 'text' },
            { name: 'initials', label: 'Initials (fallback)', type: 'text' },
            { name: 'image', label: 'Photo', type: 'image' },
            { name: 'focus', label: 'Photo focus (CSS position, e.g. "50% 20%")', type: 'text', help: 'Fine-tune the crop so faces line up across all cards.' },
            { name: 'instagram', label: 'Instagram URL', type: 'url' },
            { name: 'linkedin', label: 'LinkedIn URL', type: 'url' },
        ],
    },
    faculty: {
        label: 'Faculty Coordinators', singular: 'Faculty', group: 'People', title: 'name', image: 'image',
        fields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'designation', label: 'Designation', type: 'text' },
            { name: 'department', label: 'Department', type: 'text' },
            { name: 'initials', label: 'Initials (fallback)', type: 'text' },
            { name: 'image', label: 'Photo', type: 'image' },
            { name: 'focus', label: 'Photo focus (CSS position, e.g. "50% 20%")', type: 'text' },
            { name: 'website', label: 'Profile URL', type: 'url' },
            { name: 'note', label: 'Note / message', type: 'textarea' },
            { name: 'isQuote', label: 'Show note as a quote', type: 'toggle' },
        ],
    },
    web_team: {
        label: 'Web Team', singular: 'Team member', group: 'People', title: 'name', image: 'image',
        fields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'role', label: 'Role', type: 'text' },
            { name: 'initials', label: 'Initials (fallback)', type: 'text' },
            { name: 'image', label: 'Photo', type: 'image' },
            { name: 'focus', label: 'Photo focus (CSS position, e.g. "50% 20%")', type: 'text', help: 'Fine-tune the crop so faces line up across all cards.' },
            { name: 'instagram', label: 'Instagram URL', type: 'url' },
            { name: 'linkedin', label: 'LinkedIn URL', type: 'url' },
        ],
    },
    blogs: {
        label: 'Blog Posts', singular: 'Blog post', group: 'Publications', title: 'title', image: 'image',
        fields: [
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'slug', label: 'URL slug', type: 'text', help: 'Used in /blogs/<slug>. Leave empty to generate from title.' },
            { name: 'tag', label: 'Tag', type: 'text' },
            { name: 'date', label: 'Display date', type: 'text' },
            { name: 'readTime', label: 'Read time', type: 'text' },
            { name: 'image', label: 'Cover image', type: 'image' },
            { name: 'desc', label: 'Summary', type: 'textarea' },
            { name: 'content', label: 'Article body', type: 'html' },
        ],
    },
    magazines: {
        label: 'Magazines', singular: 'Magazine', group: 'Publications', title: 'title',
        fields: [
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'edition', label: 'Edition', type: 'text' },
            { name: 'icon', label: 'Icon (emoji)', type: 'text' },
            { name: 'desc', label: 'Description', type: 'textarea' },
            { name: 'url', label: 'Link / PDF', type: 'url' },
        ],
    },
    vlogs: {
        label: 'Vlogs', singular: 'Vlog', group: 'Publications', title: 'title', image: 'thumbnail',
        fields: [
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'desc', label: 'Description', type: 'textarea' },
            { name: 'url', label: 'Video URL', type: 'url' },
            { name: 'thumbnail', label: 'Thumbnail (optional)', type: 'image' },
        ],
    },
    faqs: {
        label: 'FAQs', singular: 'FAQ', group: 'Publications', title: 'q',
        fields: [
            { name: 'q', label: 'Question', type: 'text', required: true },
            { name: 'a', label: 'Answer', type: 'textarea', required: true },
        ],
    },
    merch: {
        label: 'Merch Products', singular: 'Product', group: 'Store', title: 'name', image: 'image',
        fields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'price', label: 'Price (₹)', type: 'number', required: true },
            { name: 'tag', label: 'Tag', type: 'text' },
            { name: 'desc', label: 'Description', type: 'textarea' },
            { name: 'image', label: 'Image', type: 'image' },
            { name: 'colors', label: 'Colours', type: 'colors' },
            { name: 'comingSoon', label: 'Coming soon (disable booking)', type: 'toggle' },
        ],
    },
}

export const EVENT_FIELDS = [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'slug', label: 'URL slug', type: 'text', help: 'Event page lives at /events/<slug>. Leave empty to generate.' },
    { name: 'start_date', label: 'Start date', type: 'date', required: true, help: 'Timeline order and Upcoming/Past status follow this date automatically.' },
    { name: 'end_date', label: 'End date', type: 'date' },
    { name: 'date_label', label: 'Date label override', type: 'text', help: 'Optional, e.g. "Feb 2023". Leave empty to format the dates.' },
    { name: 'time_text', label: 'Time', type: 'text' },
    { name: 'venue', label: 'Venue', type: 'text' },
    { name: 'tag', label: 'Tag', type: 'text' },
    { name: 'summary', label: 'Summary', type: 'textarea' },
    { name: 'poster_url', label: 'Poster', type: 'image' },
    { name: 'registration_url', label: 'Registration link', type: 'url' },
    { name: 'cta_label', label: 'Button label', type: 'text' },
    { name: 'featured', label: 'Feature on home page', type: 'toggle' },
    { name: 'show_in_timeline', label: 'Show in timeline', type: 'toggle' },
    { name: 'extra.heading', label: 'Event page heading', type: 'text' },
    { name: 'extra.highlightsTitle', label: 'Highlights title', type: 'text' },
    { name: 'extra.highlights', label: 'Highlights (one per line, basic HTML allowed)', type: 'strings' },
    { name: 'extra.agendaTitle', label: 'Agenda / milestones title', type: 'text' },
    { name: 'extra.agenda', label: 'Agenda / milestones', type: 'rows', fields: [{ name: 'time', label: 'Time / date' }, { name: 'label', label: 'Item' }] },
    { name: 'extra.links', label: 'Extra links', type: 'rows', fields: [{ name: 'label', label: 'Label' }, { name: 'url', label: 'URL', type: 'url' }] },
    { name: 'extra.ctaTitle', label: 'Call-to-action title', type: 'text' },
    { name: 'extra.ctaText', label: 'Call-to-action text', type: 'text' },
    { name: 'extra.closing', label: 'Closing line', type: 'text' },
    { name: 'body_html', label: 'Extra page content', type: 'html' },
]

export const MOMENT_FIELDS = [
    { name: 'title', label: 'Album title', type: 'text', required: true },
    { name: 'event_id', label: 'Linked event', type: 'event', help: 'Linked albums take the event date and are ordered with the timeline.' },
    { name: 'album_date', label: 'Album date (if not linked)', type: 'date' },
    { name: 'photos', label: 'Photos', type: 'images' },
    { name: 'show_on_home', label: 'Add photos to home marquee', type: 'toggle' },
]

/* Settings editors. Field names are dot-paths inside the setting's JSON value. */
export const SETTINGS_FORMS = {
    site: {
        label: 'Site Identity & Contact', fields: [
            { name: 'name', label: 'Site name', type: 'text' },
            { name: 'shortName', label: 'Short name', type: 'text' },
            { name: 'description', label: 'Footer description', type: 'textarea' },
            { name: 'logoRound', label: 'Round logo', type: 'image' },
            { name: 'logoText', label: 'Text logo', type: 'image' },
            { name: 'email', label: 'Contact email', type: 'text' },
            { name: 'phone', label: 'Phone', type: 'text' },
            { name: 'address', label: 'Address', type: 'text' },
            { name: 'url', label: 'Public site URL (for SEO & sitemap)', type: 'url' },
            { name: 'madeWith', label: 'Footer credit text', type: 'text' },
        ],
    },
    home: {
        label: 'Home Page', fields: [
            { name: 'heroBadge', label: 'Hero overline', type: 'text' },
            { name: 'heroEst', label: 'Hero established line', type: 'text' },
            { name: 'tickerWords', label: 'Scrolling ticker words (one per line)', type: 'strings' },
            { name: 'heroTitle', label: 'Hero title', type: 'text' },
            { name: 'heroHighlight', label: 'Hero highlighted text', type: 'text' },
            { name: 'heroSubtitle', label: 'Hero subtitle', type: 'textarea' },
            { name: 'primaryCta.label', label: 'Primary button label', type: 'text' },
            { name: 'primaryCta.url', label: 'Primary button link', type: 'url' },
            { name: 'secondaryCta.label', label: 'Secondary button label', type: 'text' },
            { name: 'secondaryCta.url', label: 'Secondary button link', type: 'url' },
            { name: 'galleryOverline', label: 'Gallery overline', type: 'text' },
            { name: 'galleryTitle', label: 'Gallery title', type: 'text' },
            { name: 'gallerySubtitle', label: 'Gallery subtitle', type: 'text' },
            { name: 'eventsOverline', label: 'Events section overline', type: 'text' },
            { name: 'eventsTitle', label: 'Events section title', type: 'text' },
            { name: 'eventsCta', label: 'Events section link label', type: 'text' },
            { name: 'galleryCta', label: 'Gallery link label', type: 'text' },
            { name: 'boardCta', label: 'Board section link label', type: 'text' },
            { name: 'upcomingOverline', label: 'Upcoming events overline', type: 'text' },
            { name: 'upcomingTitle', label: 'Upcoming events title', type: 'text' },
            { name: 'upcomingSubtitle', label: 'Upcoming events subtitle', type: 'text' },
            { name: 'aboutOverline', label: 'About overline', type: 'text' },
            { name: 'aboutTitle', label: 'About title', type: 'text' },
            { name: 'aboutParagraphs', label: 'About paragraphs (one per line)', type: 'strings' },
            { name: 'aboutImage', label: 'About image', type: 'image' },
            { name: 'stats', label: 'Stats', type: 'rows', fields: [{ name: 'value', label: 'Value' }, { name: 'label', label: 'Label' }] },
            { name: 'boardOverline', label: 'Board overline', type: 'text' },
            { name: 'boardTitle', label: 'Board title', type: 'text' },
            { name: 'boardSubtitle', label: 'Board subtitle', type: 'text' },
            { name: 'domainsOverline', label: 'Domains overline', type: 'text' },
            { name: 'domainsTitle', label: 'Domains title', type: 'text' },
            { name: 'domainsSubtitle', label: 'Domains subtitle', type: 'text' },
            { name: 'stickyTitle', label: 'Scroll section title', type: 'text' },
            { name: 'stickyText', label: 'Scroll section text', type: 'textarea' },
            { name: 'chillTitle', label: 'CTA band title', type: 'text' },
            { name: 'chillText', label: 'CTA band text', type: 'textarea' },
            { name: 'chillCta.label', label: 'CTA band button 1 label', type: 'text' },
            { name: 'chillCta.url', label: 'CTA band button 1 link', type: 'url' },
            { name: 'joinCta.label', label: 'CTA band button 2 label', type: 'text' },
            { name: 'joinCta.url', label: 'CTA band button 2 link', type: 'url' },
            { name: 'sections.banners', label: 'Show banners', type: 'toggle' },
            { name: 'sections.gallery', label: 'Show photo marquee', type: 'toggle' },
            { name: 'sections.upcoming', label: 'Show upcoming events', type: 'toggle' },
            { name: 'sections.events', label: 'Show recent events grid', type: 'toggle' },
            { name: 'sections.about', label: 'Show about', type: 'toggle' },
            { name: 'sections.board', label: 'Show board', type: 'toggle' },
            { name: 'sections.domains', label: 'Show domains', type: 'toggle' },
            { name: 'sections.sticky', label: 'Show big statement section', type: 'toggle' },
            { name: 'sections.chill', label: 'Show CTA band', type: 'toggle' },
        ],
    },
    pages: {
        label: 'Page Headers', fields: ['blogs', 'vlogs', 'timeline', 'moments', 'faq', 'faculty', 'merch', 'games', 'webteam', 'suggestions', 'contact', 'join']
            .flatMap(p => [
                { name: `${p}.overline`, label: `${p} · overline`, type: 'text' },
                { name: `${p}.title`, label: `${p} · title`, type: 'text' },
                { name: `${p}.subtitle`, label: `${p} · subtitle`, type: 'text' },
            ]),
    },
    seo: {
        label: 'SEO', fields: [
            { name: 'defaultTitle', label: 'Default title', type: 'text' },
            { name: 'titleTemplate', label: 'Title template (%s = page title)', type: 'text' },
            { name: 'description', label: 'Default meta description', type: 'textarea' },
            { name: 'keywords', label: 'Keywords', type: 'text' },
            { name: 'ogImage', label: 'Social share image', type: 'image' },
            { name: 'twitterHandle', label: 'X / Twitter handle', type: 'text' },
            { name: 'googleVerification', label: 'Google site verification', type: 'text' },
            { name: 'pages', label: 'Per-page SEO', type: 'seo-pages' },
        ],
    },
    appearance: {
        label: 'Theme, Fonts & Animations', fields: [
            { name: 'colors.accent', label: 'Accent colour', type: 'color', help: 'Buttons, highlights and the CTA band. Flat colour only.' },
            { name: 'colors.accentInk', label: 'Text on accent', type: 'color' },
            { name: 'colors.bg', label: 'Page background', type: 'color' },
            { name: 'colors.surface', label: 'Card background', type: 'color' },
            { name: 'colors.surface2', label: 'Image placeholder / raised surface', type: 'color' },
            { name: 'colors.line', label: 'Border lines', type: 'color' },
            { name: 'colors.text', label: 'Main text', type: 'color' },
            { name: 'colors.muted', label: 'Secondary text', type: 'color' },
            { name: 'fonts.display', label: 'Heading font (Google Fonts name)', type: 'text' },
            { name: 'fonts.body', label: 'Body font (Google Fonts name)', type: 'text' },
            { name: 'fonts.mono', label: 'Label / mono font (Google Fonts name)', type: 'text' },
            { name: 'radius', label: 'Corner radius (px)', type: 'number' },
            { name: 'grayscalePortraits', label: 'Black & white portraits (colour on hover)', type: 'toggle' },
            { name: 'preloader', label: 'Show startup animation', type: 'toggle' },
            { name: 'preloaderMode', label: 'Startup animation frequency', type: 'select', options: ['first-visit', 'always'] },
            { name: 'preloaderWord', label: 'Startup big word', type: 'text' },
            { name: 'preloaderLines', label: 'Startup boot lines (one per line)', type: 'strings' },
            { name: 'scrollProgress', label: 'Scroll progress bar', type: 'toggle' },
        ],
    },
    merch: {
        label: 'Merch Settings', fields: [
            { name: 'sizes', label: 'Sizes (one per line)', type: 'strings' },
            { name: 'maxQty', label: 'Max quantity per booking', type: 'number' },
            { name: 'note', label: 'Booking note', type: 'text' },
            { name: 'requireMobile', label: 'Require mobile number in profile', type: 'toggle' },
        ],
    },
    blogs: {
        label: 'Blogs Page', fields: [
            { name: 'magazineEnabled', label: 'Show magazine banner', type: 'toggle' },
            { name: 'magazineTag', label: 'Magazine tag', type: 'text' },
            { name: 'magazineTitle', label: 'Magazine title', type: 'text' },
            { name: 'magazineText', label: 'Magazine text', type: 'textarea' },
            { name: 'magazineCtaLabel', label: 'Magazine button label', type: 'text' },
            { name: 'magazineCtaUrl', label: 'Magazine button link (empty = disabled)', type: 'url' },
            { name: 'newsletterTitle', label: 'Newsletter title', type: 'text' },
            { name: 'newsletterText', label: 'Newsletter text', type: 'textarea' },
        ],
    },
    vlogs: {
        label: 'Vlogs Page', fields: [
            { name: 'channelUrl', label: 'Channel / default video URL', type: 'url' },
            { name: 'subscribeTitle', label: 'Subscribe title', type: 'text' },
            { name: 'subscribeText', label: 'Subscribe text', type: 'text' },
        ],
    },
    webteam: {
        label: 'Web Team Page', fields: [
            { name: 'noteTitle', label: 'Note title', type: 'text' },
            { name: 'noteText', label: 'Note text', type: 'textarea' },
            { name: 'noteSignature', label: 'Signature', type: 'text' },
        ],
    },
    games: { label: 'Games Page', fields: [{ name: 'tip', label: '"Did you know?" tip', type: 'textarea' }] },
}

export const PRIVATE_SETTINGS = ['notifications', 'smtp']

export const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80) || `item-${Date.now()}`

export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

export function setPath(obj, path, value) {
    const keys = path.split('.')
    const out = Array.isArray(obj) ? [...obj] : { ...(obj || {}) }
    let cur = out
    keys.forEach((k, i) => {
        if (i === keys.length - 1) cur[k] = value
        else { cur[k] = { ...(cur[k] || {}) }; cur = cur[k] }
    })
    return out
}

/** Event status relative to today's date in India. */
export function eventStatus(e, today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)) {
    const end = e.end_date || e.start_date
    if (e.start_date > today) return 'upcoming'
    if (end >= today) return 'ongoing'
    return 'past'
}

export function formatEventDate(e) {
    if (e.date_label) return e.date_label
    const fmt = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    if (!e.start_date) return ''
    if (e.end_date && e.end_date !== e.start_date) {
        const a = new Date(`${e.start_date}T00:00:00`), b = new Date(`${e.end_date}T00:00:00`)
        if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
            return `${a.toLocaleDateString('en-US', { month: 'long' })} ${a.getDate()}–${b.getDate()}, ${a.getFullYear()}`
        }
        return `${fmt(e.start_date)} – ${fmt(e.end_date)}`
    }
    return fmt(e.start_date)
}
