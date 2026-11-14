import { slugify } from '../../shared/cms.js'

/** URL slug of a project / resource / blog item. */
export const itemSlug = d => d.slug || slugify(d.title)
/** "PDF", "DOCX"… from a file URL. */
export const fileType = u => (String(u || '').split('?')[0].match(/\.([a-z0-9]{2,5})$/i)?.[1] || '').toUpperCase()
