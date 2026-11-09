/**
 * Certificates are drawn in the browser from the admin's template image (pdf-lib), so nothing is
 * stored: participants generate their own on demand, and the admin can email them or download ZIPs.
 */
import { PDFDocument, rgb } from 'pdf-lib'
import { certFont, fontVariant } from './certFonts'

const PAGE_W = 842 // A4 landscape width in points; field sizes are relative to this
const imageCache = new Map()
const fontCache = new Map()
const fetchBytes = (cache, url, what) => {
    if (!cache.has(url)) cache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(`Could not load the ${what}.`); return r.arrayBuffer() }).catch(e => { cache.delete(url); throw e }))
    return cache.get(url)
}

/** ImageKit converts any upload to a JPEG of sensible size; local paths are used as they are. */
const templateUrl = url => (/ik\.imagekit\.io/.test(url) ? `${url}${url.includes('?') ? '&' : '?'}tr=w-2000,q-85,f-jpg` : url)

const imageBytes = url => fetchBytes(imageCache, templateUrl(url), 'certificate template image')

/** Embeds (once per document) the font a field asks for; web fonts are subset to the letters used. */
async function pdfFont(doc, ctx, f) {
    const font = certFont(f.font)
    const { key, value } = fontVariant(font, f.bold, f.italic)
    const id = `${font.id}-${key}`
    if (!ctx.fonts.has(id)) {
        ctx.fonts.set(id, (async () => {
            if (font.std) return doc.embedFont(value)
            if (!ctx.fontkit) { ctx.fontkit = true; doc.registerFontkit((await import('@pdf-lib/fontkit')).default) }
            return doc.embedFont(await fetchBytes(fontCache, value, `${font.family} font`), { subset: true })
        })())
    }
    return ctx.fonts.get(id)
}

const fill = (text, data) => String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => data[k] ?? '')
// Standard PDF fonts only cover Latin-1, so accents are folded and other characters dropped.
const latin1 = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^ -ÿ–—‘’“”]/g, '').trim()
const hex = c => { const n = parseInt(String(c || '#111111').slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255) }

export const fieldText = (f, data) => (f.text ? fill(f.text, data) : f.key === 'custom' ? '' : data[f.key] ?? '')

/** Adds one certificate page to `doc` (embedding each template image once per document). */
async function addPage(doc, template, data, ctx) {
    if (!ctx.images.has(template.image)) {
        const bytes = await imageBytes(template.image)
        const isPng = new Uint8Array(bytes.slice(0, 4))[1] === 0x50
        ctx.images.set(template.image, isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes))
    }
    const img = ctx.images.get(template.image)
    const w = PAGE_W, h = (PAGE_W * img.height) / img.width
    const page = doc.addPage([w, h])
    page.drawImage(img, { x: 0, y: 0, width: w, height: h })
    for (const f of template.fields || []) {
        const text = latin1(fieldText(f, data))
        if (!text) continue
        const font = await pdfFont(doc, ctx, f)
        let size = f.size || 28
        while (font.widthOfTextAtSize(text, size) > w * 0.9 && size > 8) size -= 1
        const tw = font.widthOfTextAtSize(text, size)
        const x = (f.x / 100) * w - (f.align === 'center' ? tw / 2 : f.align === 'right' ? tw : 0)
        const y = h - (f.y / 100) * h - size * 0.35
        page.drawText(text, { x, y, size, font, color: hex(f.color) })
    }
}

async function newDoc() {
    const doc = await PDFDocument.create()
    return { doc, ctx: { images: new Map(), fonts: new Map() } }
}

export async function certificatePdf(template, data) {
    const { doc, ctx } = await newDoc()
    doc.setTitle(`${data.event || 'Event'} certificate — ${data.name || ''}`)
    await addPage(doc, template, data, ctx)
    return doc.save()
}

/** Every certificate in one PDF (the template is embedded once, so it stays small). */
export async function combinedPdf(items, onProgress) {
    const { doc, ctx } = await newDoc()
    for (const [i, it] of items.entries()) { await addPage(doc, it.template, it.data, ctx); onProgress?.(i + 1) }
    return doc.save()
}

export async function zipOfPdfs(items, onProgress) {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const [i, it] of items.entries()) {
        zip.file(it.filename, await certificatePdf(it.template, it.data), { compression: 'STORE' })
        onProgress?.(i + 1)
    }
    return zip.generateAsync({ type: 'blob' })
}

export function toBase64(bytes) {
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return btoa(s)
}

export const safeFile = s => String(s || 'certificate').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 80)
