import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

/** Asks for the registration number and mobile number that recruitment and events require. */
export default function ProfileGate({ needRegNo = true, title = 'Complete your profile', text = 'Your registration number and mobile number are needed before you can continue.' }) {
    const { user, updateProfile } = useAuth()
    const [p, setP] = useState({ mobile: user?.mobile || '', regNo: user?.regNo || '' })
    const [st, setSt] = useState({ busy: false, err: '' })
    const save = async e => {
        e.preventDefault()
        if (p.mobile.length !== 10) return setSt({ busy: false, err: 'Mobile number must be 10 digits.' })
        if (needRegNo && p.regNo.length < 6) return setSt({ busy: false, err: 'Enter your full registration number.' })
        setSt({ busy: true, err: '' })
        try { await updateProfile({ name: user.name, ...p }) } catch (err) { setSt({ busy: false, err: err.message }) }
    }
    return (
        <form className="form boxed" onSubmit={save} style={{ maxWidth: 560 }}>
            <span className="label">{title}</span>
            <p className="muted" style={{ margin: 0 }}>{text}</p>
            <div className="row-2">
                <label className="field"><span>Registration no.</span><input value={p.regNo} onChange={e => setP(x => ({ ...x, regNo: e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 12) }))} placeholder="23BCE0001" required={needRegNo} /></label>
                <label className="field"><span>Mobile</span><input type="tel" inputMode="numeric" value={p.mobile} onChange={e => setP(x => ({ ...x, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10 digits" required /></label>
            </div>
            <button className="btn solid" disabled={st.busy} style={{ alignSelf: 'flex-start' }}>{st.busy ? 'Saving…' : 'Save and continue'} <span className="arr">→</span></button>
            {st.err && <p className="notice err" role="alert">{st.err}</p>}
        </form>
    )
}
