/**
 * Fonts for certificates. The three standard PDF fonts need no download; the others are
 * open-licence (OFL) fonts from Fontsource, embedded into the PDF (subset) and loaded for the admin preview.
 */
import greatvibes_r from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff?url'
import dancing_r from '@fontsource/dancing-script/files/dancing-script-latin-400-normal.woff?url'
import dancing_b from '@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff?url'
import playfair_r from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff?url'
import playfair_b from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff?url'
import playfair_i from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff?url'
import playfair_bi from '@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff?url'
import cinzel_r from '@fontsource/cinzel/files/cinzel-latin-400-normal.woff?url'
import cinzel_b from '@fontsource/cinzel/files/cinzel-latin-700-normal.woff?url'
import montserrat_r from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff?url'
import montserrat_b from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff?url'
import montserrat_i from '@fontsource/montserrat/files/montserrat-latin-400-italic.woff?url'
import montserrat_bi from '@fontsource/montserrat/files/montserrat-latin-700-italic.woff?url'
import poppins_r from '@fontsource/poppins/files/poppins-latin-400-normal.woff?url'
import poppins_b from '@fontsource/poppins/files/poppins-latin-700-normal.woff?url'
import poppins_i from '@fontsource/poppins/files/poppins-latin-400-italic.woff?url'
import poppins_bi from '@fontsource/poppins/files/poppins-latin-700-italic.woff?url'
import lora_r from '@fontsource/lora/files/lora-latin-400-normal.woff?url'
import lora_b from '@fontsource/lora/files/lora-latin-700-normal.woff?url'
import lora_i from '@fontsource/lora/files/lora-latin-400-italic.woff?url'
import lora_bi from '@fontsource/lora/files/lora-latin-700-italic.woff?url'

export const CERT_FONTS = [
    { id: 'helvetica', label: 'Helvetica (clean sans)', css: 'Helvetica, Arial, sans-serif', std: { r: 'Helvetica', b: 'Helvetica-Bold', i: 'Helvetica-Oblique', bi: 'Helvetica-BoldOblique' } },
    { id: 'times', label: 'Times (classic serif)', css: '"Times New Roman", Times, serif', std: { r: 'Times-Roman', b: 'Times-Bold', i: 'Times-Italic', bi: 'Times-BoldItalic' } },
    { id: 'courier', label: 'Courier (typewriter)', css: '"Courier New", Courier, monospace', std: { r: 'Courier', b: 'Courier-Bold', i: 'Courier-Oblique', bi: 'Courier-BoldOblique' } },
    { id: 'greatvibes', label: 'Great Vibes (script)', family: 'Great Vibes', files: { r: greatvibes_r } },
    { id: 'dancing', label: 'Dancing Script', family: 'Dancing Script', files: { r: dancing_r, b: dancing_b } },
    { id: 'playfair', label: 'Playfair Display (elegant serif)', family: 'Playfair Display', files: { r: playfair_r, b: playfair_b, i: playfair_i, bi: playfair_bi } },
    { id: 'cinzel', label: 'Cinzel (engraved capitals)', family: 'Cinzel', files: { r: cinzel_r, b: cinzel_b } },
    { id: 'montserrat', label: 'Montserrat (modern)', family: 'Montserrat', files: { r: montserrat_r, b: montserrat_b, i: montserrat_i, bi: montserrat_bi } },
    { id: 'poppins', label: 'Poppins (rounded)', family: 'Poppins', files: { r: poppins_r, b: poppins_b, i: poppins_i, bi: poppins_bi } },
    { id: 'lora', label: 'Lora (book serif)', family: 'Lora', files: { r: lora_r, b: lora_b, i: lora_i, bi: lora_bi } },
]

const byId = Object.fromEntries(CERT_FONTS.map(f => [f.id, f]))
export const certFont = id => byId[id] || byId.helvetica

/** The closest available style: bold/italic fall back to what the font actually has. */
export function fontVariant(font, bold, italic) {
    const set = font.std || font.files
    const want = `${bold ? 'b' : ''}${italic ? 'i' : ''}` || 'r'
    const v = set[want] ? want : set[bold ? 'b' : 'r'] ? (bold ? 'b' : 'r') : 'r'
    return { key: v, value: set[v] }
}

/** CSS font-family for the live preview; loads web fonts on first use. */
const loaded = new Set()
export function cssFont(font, bold, italic) {
    if (font.std) return font.css
    const { key, value } = fontVariant(font, bold, italic)
    const family = `Cert ${font.family}`
    const id = `${font.id}-${key}`
    if (!loaded.has(id) && typeof FontFace !== 'undefined') {
        loaded.add(id)
        new FontFace(family, `url(${value})`, { weight: key.includes('b') ? '700' : '400', style: key.includes('i') ? 'italic' : 'normal' }).load().then(f => document.fonts.add(f)).catch(() => loaded.delete(id))
    }
    return `"${family}", ${font.family.includes('Vibes') || font.family.includes('Script') ? 'cursive' : 'serif'}`
}
