import { useState } from 'react'
import { useSite } from '../context/SiteContext'
import SmartLink from './SmartLink'

export default function AnnouncementBar() {
    const { list } = useSite()
    const a = list('announcements')[0]
    const key = a ? `ieee_its_ann_${a.id}_${a._updated_at || ''}` : ''
    const [hidden, setHidden] = useState(() => { try { return !!sessionStorage.getItem(key) } catch { return false } })
    if (!a || hidden) return null
    return (
        <div className="announce" role="region" aria-label="Announcement">
            <div className="wrap">
                <span>{a.text}</span>
                {a.url && <SmartLink to={a.url}>{a.linkLabel || 'Learn more'}</SmartLink>}
                <button aria-label="Dismiss announcement" onClick={() => { setHidden(true); try { sessionStorage.setItem(key, '1') } catch { /* ignore */ } }}>✕</button>
            </div>
        </div>
    )
}
