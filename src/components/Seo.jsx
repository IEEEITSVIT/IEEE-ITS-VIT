import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSite } from '../context/SiteContext'

function setMeta(attr, key, content) {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`)
    if (!content) { el?.remove(); return }
    if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
    }
    el.setAttribute('content', content)
}

function setLink(rel, href) {
    let el = document.head.querySelector(`link[rel="${rel}"]`)
    if (!el) {
        el = document.createElement('link')
        el.setAttribute('rel', rel)
        document.head.appendChild(el)
    }
    el.setAttribute('href', href)
}

const absolute = (base, url) => (!url ? '' : /^https?:/i.test(url) ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`)

/**
 * Per-page SEO: title, description, canonical, Open Graph / Twitter cards and JSON-LD.
 * Values come from /admin → SEO (per path) and can be overridden by the page via props.
 */
export default function Seo({ title, description, image, type = 'website', jsonLd, noindex }) {
    const { pathname } = useLocation()
    const { settings, list } = useSite()

    useEffect(() => {
        const seo = settings.seo || {}
        const site = settings.site || {}
        const page = seo.pages?.[pathname] || {}
        const base = (site.url || window.location.origin).replace(/\/$/, '')
        const pageTitle = title || page.title
        const fullTitle = pageTitle && pathname !== '/'
            ? (seo.titleTemplate || '%s').replace('%s', pageTitle)
            : seo.defaultTitle || site.name || 'IEEE ITS - VIT Chapter'
        const desc = description || page.description || seo.description || ''
        const img = absolute(base, image || page.image || seo.ogImage)
        const url = base + pathname

        document.title = fullTitle
        setMeta('name', 'description', desc)
        setMeta('name', 'keywords', seo.keywords)
        setMeta('name', 'robots', noindex || page.noindex || pathname.startsWith('/admin') ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
        setMeta('name', 'google-site-verification', seo.googleVerification)
        setMeta('property', 'og:title', fullTitle)
        setMeta('property', 'og:description', desc)
        setMeta('property', 'og:type', type)
        setMeta('property', 'og:url', url)
        setMeta('property', 'og:image', img)
        setMeta('property', 'og:site_name', site.name)
        setMeta('name', 'twitter:card', img ? 'summary_large_image' : 'summary')
        setMeta('name', 'twitter:title', fullTitle)
        setMeta('name', 'twitter:description', desc)
        setMeta('name', 'twitter:image', img)
        setMeta('name', 'twitter:site', seo.twitterHandle)
        setLink('canonical', url)

        const sameAs = list('social_links').map(l => l.url).filter(u => /^https?:/i.test(u || ''))
        const org = {
            '@type': 'Organization', '@id': `${base}/#organization`, name: site.name, url: base,
            logo: absolute(base, site.logoRound), email: site.email, telephone: site.phone || undefined,
            description: site.description || seo.description || undefined,
            sameAs: sameAs.length ? sameAs : undefined,
            parentOrganization: { '@type': 'Organization', name: 'IEEE Information Theory Society' },
        }
        const website = { '@type': 'WebSite', '@id': `${base}/#website`, name: site.name, url: base, publisher: { '@id': `${base}/#organization` } }
        let script = document.getElementById('ld-json')
        if (!script) {
            script = document.createElement('script')
            script.type = 'application/ld+json'
            script.id = 'ld-json'
            document.head.appendChild(script)
        }
        const graph = [org, website, ...(jsonLd ? [jsonLd] : [])].map(({ '@context': _, ...node }) => node)
        script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    }, [pathname, title, description, image, type, jsonLd, noindex, settings, list])

    return null
}
