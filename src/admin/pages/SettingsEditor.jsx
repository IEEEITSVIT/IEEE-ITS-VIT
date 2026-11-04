import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useSite } from '../../context/SiteContext'
import { SETTINGS_FORMS } from '../../../shared/cms.js'
import { FieldForm } from '../fields'
import { PageTitle, Spinner, useToast } from '../ui'

const PREVIEW = { home: '/', pages: '/blogs', site: '/', seo: '/', appearance: '/', merch: '/merch', blogs: '/blogs', vlogs: '/vlogs', webteam: '/web-team', games: '/games' }

export default function SettingsEditor({ settingKey }) {
    const form = SETTINGS_FORMS[settingKey]
    const { refresh } = useSite()
    const toast = useToast()
    const [value, setValue] = useState(null)
    const [initial, setInitial] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        setValue(null)
        api.get('/admin/settings').then(r => { setValue(r.settings[settingKey]); setInitial(JSON.stringify(r.settings[settingKey])) }).catch(e => toast(e.message, 'error'))
    }, [settingKey, toast])

    const dirty = value && JSON.stringify(value) !== initial

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
                {settingKey === 'appearance' && <button className="adm-btn ghost" onClick={() => { sessionStorage.removeItem('ieee_its_intro_seen'); window.open('/', '_blank') }}>Replay intro ↗</button>}
                <a className="adm-btn ghost" href={PREVIEW[settingKey] || '/'} target="_blank" rel="noreferrer">Preview ↗</a>
                <button className="adm-btn primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
            </PageTitle>
            {!value ? <Spinner /> : (
                <div className="adm-panel">
                    <FieldForm fields={form.fields} value={value} onChange={setValue} />
                </div>
            )}
            {dirty && <div className="adm-savebar"><span>You have unsaved changes</span><button className="adm-btn primary" disabled={saving} onClick={save}>Save changes</button></div>}
        </>
    )
}
