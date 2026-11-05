import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useSite } from '../../context/SiteContext'
import { SETTINGS_FORMS } from '../../../shared/cms.js'
import { FieldForm } from '../fields'
import { PageTitle, Spinner, useToast } from '../ui'
import { PreviewFrame } from '../Preview'
import Icon from '../icons'

const PREVIEW = { home: '/', pages: '/blogs', site: '/', seo: '/', appearance: '/', merch: '/merch', blogs: '/blogs', vlogs: '/vlogs', webteam: '/web-team', games: '/games' }

export default function SettingsEditor({ settingKey }) {
    const form = SETTINGS_FORMS[settingKey]
    const { refresh } = useSite()
    const toast = useToast()
    const [value, setValue] = useState(null)
    const [initial, setInitial] = useState('')
    const [saving, setSaving] = useState(false)
    const [showPreview, setShowPreview] = useState(() => window.innerWidth >= 1100)

    useEffect(() => {
        setValue(null)
        api.get('/admin/settings').then(r => { setValue(r.settings[settingKey]); setInitial(JSON.stringify(r.settings[settingKey])) }).catch(e => toast(e.message, 'error'))
    }, [settingKey, toast])

    const dirty = value && JSON.stringify(value) !== initial
    const patch = useMemo(() => (value ? { settings: { [settingKey]: value } } : null), [value, settingKey])

    const save = async () => {
        setSaving(true)
        try {
            await api.put(`/admin/settings/${settingKey}`, { value })
            setInitial(JSON.stringify(value))
            toast('Saved — the live site updates within ~30 seconds')
            refresh(true)
        } catch (e) { toast(e.message, 'error') }
        finally { setSaving(false) }
    }

    return (
        <>
            <PageTitle title={form.label}>
                {settingKey === 'appearance' && <button className="adm-btn ghost" onClick={() => { sessionStorage.removeItem('ieee_its_intro_seen'); window.open('/', '_blank') }}>Replay intro <Icon name="external" size={15} /></button>}
                <button className={`adm-btn${showPreview ? ' ghost' : ''}`} onClick={() => setShowPreview(v => !v)}><Icon name={showPreview ? 'eyeOff' : 'eye'} size={16} /> {showPreview ? 'Hide preview' : 'Preview'}</button>
                {dirty && <button className="adm-btn ghost" onClick={() => setValue(JSON.parse(initial))}><Icon name="reset" size={16} /> Discard</button>}
                <button className="adm-btn primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Apply changes' : 'Saved'}</button>
            </PageTitle>
            {!value ? <Spinner /> : (
                <div className={showPreview ? 'adm-with-preview' : ''}>
                    <div className="adm-panel">
                        <FieldForm fields={form.fields} value={value} onChange={setValue} />
                    </div>
                    {showPreview && <div className="adm-sticky-preview"><PreviewFrame path={PREVIEW[settingKey] || '/'} patch={patch} /></div>}
                </div>
            )}
            {dirty && <div className="adm-savebar"><span>Unsaved changes — check them in the preview, then apply.</span><button className="adm-btn primary" disabled={saving} onClick={save}>Apply changes</button></div>}
        </>
    )
}
