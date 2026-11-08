import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import Seo from '../components/Seo'

const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

/**
 * Timed recruitment test. Light proctoring: leaving the tab or full screen is counted and shown to
 * the admin; answers autosave; the test submits itself when time runs out.
 */
export default function RecruitmentTest() {
    const { domainId } = useParams()
    const [test, setTest] = useState(null)
    const [answers, setAnswers] = useState({})
    const [switches, setSwitches] = useState(0)
    const [deadline, setDeadline] = useState(0)
    const [now, setNow] = useState(0)
    const [state, setState] = useState('intro') // intro | running | done | error
    const [err, setErr] = useState('')
    const [warn, setWarn] = useState(false)
    const latest = useRef({ answers, switches })
    useEffect(() => { latest.current = { answers, switches } }, [answers, switches])

    const submit = useCallback(async () => {
        setState('submitting')
        try {
            await api.post(`/recruitment/test/${domainId}/submit`, { answers: latest.current.answers, tabSwitches: latest.current.switches })
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
            setState('done')
        } catch (e) { setErr(e.message); setState('running') }
    }, [domainId])

    const start = async () => {
        setErr('')
        try {
            await document.documentElement.requestFullscreen?.().catch(() => {})
            const t = await api.post(`/recruitment/test/${domainId}/start`)
            setTest(t); setAnswers(t.answers || {}); setSwitches(t.tabSwitches || 0)
            setNow(Date.now()); setDeadline(Date.now() + t.remainingMs); setState('running')
        } catch (e) { setErr(e.message); setState('error') }
    }

    // clock; submits by itself when time is up
    useEffect(() => {
        if (state !== 'running') return
        const t = setInterval(() => {
            const n = Date.now()
            setNow(n)
            if (deadline && n >= deadline) { clearInterval(t); submit() }
        }, 500)
        return () => clearInterval(t)
    }, [state, deadline, submit])

    // proctoring: count leaving the tab or full screen
    useEffect(() => {
        if (state !== 'running') return
        const flag = () => { setSwitches(n => n + 1); setWarn(true) }
        const onVis = () => { if (document.hidden) flag() }
        const onFs = () => { if (!document.fullscreenElement) flag() }
        document.addEventListener('visibilitychange', onVis)
        document.addEventListener('fullscreenchange', onFs)
        const block = e => e.preventDefault()
        document.addEventListener('copy', block)
        document.addEventListener('contextmenu', block)
        return () => {
            document.removeEventListener('visibilitychange', onVis); document.removeEventListener('fullscreenchange', onFs)
            document.removeEventListener('copy', block); document.removeEventListener('contextmenu', block)
        }
    }, [state])

    // autosave every 20 s
    useEffect(() => {
        if (state !== 'running') return
        const t = setInterval(() => api.post(`/recruitment/test/${domainId}/save`, { answers: latest.current.answers, tabSwitches: latest.current.switches }).catch(() => {}), 20_000)
        return () => clearInterval(t)
    }, [state, domainId])

    if (state === 'done') {
        return (
            <div className="auth-wrap"><Seo title="Test submitted" noindex />
                <div className="auth-card form">
                    <span className="label">Submitted</span>
                    <h1 className="display h-md">Thank you!</h1>
                    <p className="muted" style={{ margin: 0 }}>Your answers are in. Shortlisted candidates will be contacted for an interview.</p>
                    <Link to="/recruitment" className="btn solid">Back to recruitments <span className="arr">→</span></Link>
                </div>
            </div>
        )
    }

    if (state === 'intro' || state === 'error') {
        return (
            <div className="auth-wrap"><Seo title="Recruitment test" noindex />
                <div className="auth-card form">
                    <span className="label">Recruitment test</span>
                    <h1 className="display h-md">Before you start</h1>
                    <ul className="rec-rules">
                        <li>The timer starts when you press Start and keeps running if you close the page.</li>
                        <li>Stay on this tab in full screen. Leaving the tab or full screen is recorded.</li>
                        <li>Your answers save automatically. The test submits itself when time is up.</li>
                    </ul>
                    <button className="btn solid" onClick={start}>Start test <span className="arr">→</span></button>
                    {err && <p className="notice err" role="alert">{err}</p>}
                    <Link to="/recruitment" className="link-arrow">← Back</Link>
                </div>
            </div>
        )
    }

    const left = deadline - now
    const answered = test.questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== '').length
    return (
        <div className="rec-test">
            <Seo title={`${test.title} test`} noindex />
            <div className="rec-test-bar">
                <strong>{test.title}</strong>
                <span>{answered}/{test.questions.length} answered</span>
                <span className={`rec-timer${left < 60_000 ? ' low' : ''}`} aria-live="polite">{mmss(left)}</span>
            </div>
            {warn && <p className="notice err rec-warn" role="alert">You left the test window ({switches} time{switches === 1 ? '' : 's'}). This is recorded. <button className="link-btn" onClick={() => { setWarn(false); document.documentElement.requestFullscreen?.().catch(() => {}) }}>Return to full screen</button></p>}
            <div className="wrap rec-questions" style={{ userSelect: 'none' }}>
                {test.questions.map((q, i) => (
                    <fieldset key={q.id} className="boxed rec-q">
                        <legend><span className="label plain">Question {i + 1} · {q.points} pt{q.points > 1 ? 's' : ''}</span></legend>
                        <p className="rec-prompt">{q.prompt}</p>
                        {q.kind === 'mcq' ? (
                            <div className="rec-options">
                                {q.options.map((o, k) => (
                                    <label key={k} className={`rec-option${answers[q.id] === k ? ' on' : ''}`}>
                                        <input type="radio" name={q.id} checked={answers[q.id] === k} onChange={() => setAnswers(a => ({ ...a, [q.id]: k }))} />
                                        <span>{o}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <textarea className="input" rows={5} value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder="Your answer" style={{ userSelect: 'text' }} />
                        )}
                    </fieldset>
                ))}
                <button className="btn solid" disabled={state === 'submitting'} onClick={() => window.confirm('Submit your answers? You cannot change them afterwards.') && submit()} style={{ alignSelf: 'flex-start' }}>
                    {state === 'submitting' ? 'Submitting…' : 'Submit test'} <span className="arr">→</span>
                </button>
                {err && <p className="notice err" role="alert">{err}</p>}
            </div>
        </div>
    )
}
