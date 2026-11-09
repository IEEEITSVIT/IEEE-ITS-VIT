/**
 * Reads the first sheet of an .xlsx file, or a .csv file, in the browser.
 * Returns { headers: [...], rows: [{ header: value }] } with every value as trimmed text.
 */
import JSZip from 'jszip'

const byTag = (node, tag) => [...node.getElementsByTagNameNS('*', tag)]
const textOf = node => byTag(node, 't').map(t => t.textContent).join('')
const colIndex = ref => [...String(ref).replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

async function readXlsx(file) {
    const zip = await JSZip.loadAsync(file)
    const xml = async path => {
        const f = zip.file(path)
        return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null
    }
    // first sheet in workbook order → its file via the workbook relationships
    const wb = await xml('xl/workbook.xml')
    const rels = await xml('xl/_rels/workbook.xml.rels')
    const first = wb && byTag(wb, 'sheet')[0]
    const rid = first?.getAttribute('r:id') || first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    const target = rels && byTag(rels, 'Relationship').find(r => r.getAttribute('Id') === rid)?.getAttribute('Target')
    const path = target ? (target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`) : 'xl/worksheets/sheet1.xml'
    const sheet = await xml(path)
    if (!sheet) throw new Error('Could not find a worksheet in this file.')
    const sst = await xml('xl/sharedStrings.xml')
    const shared = sst ? byTag(sst, 'si').map(textOf) : []
    const grid = []
    for (const row of byTag(sheet, 'row')) {
        const cells = []
        let next = 0
        for (const c of byTag(row, 'c')) {
            const i = c.getAttribute('r') ? colIndex(c.getAttribute('r')) : next
            next = i + 1
            const t = c.getAttribute('t')
            const v = byTag(c, 'v')[0]?.textContent ?? ''
            cells[i] = t === 's' ? shared[Number(v)] ?? '' : t === 'inlineStr' ? textOf(c) : t === 'b' ? (v === '1' ? 'TRUE' : 'FALSE') : v
        }
        grid.push(Array.from(cells, x => (x ?? '').trim()))
    }
    return grid
}

function readCsv(text) {
    const rows = [[]]
    let cur = '', q = false
    const s = text.replace(/^\uFEFF/, '')
    for (let i = 0; i < s.length; i++) {
        const ch = s[i]
        if (q) {
            if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch
        } else if (ch === '"') q = true
        else if (ch === ',' || ch === ';' || ch === '\t') { rows.at(-1).push(cur.trim()); cur = '' }
        else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; rows.at(-1).push(cur.trim()); cur = ''; rows.push([]) }
        else cur += ch
    }
    rows.at(-1).push(cur.trim())
    return rows
}

export async function readSheet(file) {
    const isCsv = /\.(csv|txt|tsv)$/i.test(file.name) || /csv|text/.test(file.type)
    const grid = (isCsv ? readCsv(await file.text()) : await readXlsx(file)).filter(r => r.some(Boolean))
    if (grid.length < 2) throw new Error('The sheet needs a header row and at least one data row.')
    const headers = grid[0].map((h, i) => h || `Column ${i + 1}`)
    const rows = grid.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])))
    return { headers, rows }
}

/** "Registration No." → "registrationno" — for matching headers loosely. */
export const normKey = h => String(h).toLowerCase().replace(/[^a-z0-9]/g, '')

const ALIASES = {
    name: ['name', 'fullname', 'participantname', 'studentname', 'candidatename', 'participant', 'student'],
    email: ['email', 'emailid', 'mailid', 'emailaddress', 'mail', 'vitemail', 'studentemail'],
    regNo: ['regno', 'registrationnumber', 'registrationno', 'regnumber', 'rollno', 'registerno', 'registernumber'],
    mobile: ['mobile', 'phone', 'phonenumber', 'mobilenumber', 'contact', 'contactnumber', 'whatsapp', 'mobileno'],
    team: ['team', 'teamname'],
    rank: ['rank', 'position', 'place', 'prize'],
    event: ['event', 'eventname'],
    domain: ['domain', 'domains', 'selectedfor', 'selecteddomain', 'selecteddomains'],
    status: ['status', 'result', 'selection', 'selectionstatus'],
}

/** Finds which header holds each known field. */
export function mapHeaders(headers) {
    const out = {}
    for (const [field, names] of Object.entries(ALIASES)) {
        const h = headers.find(x => names.includes(normKey(x)))
        if (h) out[field] = h
    }
    return out
}
