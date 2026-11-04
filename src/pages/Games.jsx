import { useState, useEffect, useCallback } from 'react'
import { useSite } from '../context/SiteContext'
import PageHeader from '../components/PageHeader'
import Seo from '../components/Seo'

/* ─────────────────────────────────────────────
   GAME 1: Binary Decoder
   Convert the shown decimal number to binary
───────────────────────────────────────────────*/
function BinaryGame() {
    const [target, setTarget] = useState(0)
    const [input, setInput] = useState('')
    const [score, setScore] = useState(0)
    const [feedback, setFeedback] = useState('')
    const [streak, setStreak] = useState(0)

    const newRound = useCallback(() => {
        setTarget(Math.floor(Math.random() * 128) + 1)
        setInput('')
        setFeedback('')
    }, [])

    useEffect(() => { newRound() }, [])

    const check = () => {
        const correct = target.toString(2)
        if (input.trim() === correct) {
            setScore(s => s + 10 + streak * 2)
            setStreak(s => s + 1)
            setFeedback('✅ Correct! +' + (10 + streak * 2) + ' pts')
            setTimeout(newRound, 900)
        } else {
            setStreak(0)
            setFeedback(`❌ Wrong! Answer was ${correct}`)
        }
    }

    return (
        <div className="mini-game">
            <div className="game-header">
                <h3>Binary Decoder</h3>
                <span className="game-score">Score: {score}</span>
            </div>
            <p className="game-desc">Convert the decimal number to binary:</p>
            <div className="game-target">{target}</div>
            <div className="game-input-row">
                <input
                    className="game-input"
                    value={input}
                    onChange={e => setInput(e.target.value.replace(/[^01]/g, ''))}
                    placeholder="e.g. 1010101"
                    onKeyDown={e => e.key === 'Enter' && check()}
                    maxLength={8}
                />
                <button className="game-btn" onClick={check}>Submit</button>
            </div>
            {streak > 1 && <div className="streak-badge">🔥 {streak} streak!</div>}
            {feedback && <div className={`game-feedback ${feedback.startsWith('✅') ? 'ok' : 'err'}`}>{feedback}</div>}
        </div>
    )
}

/* ─────────────────────────────────────────────
   GAME 2: Logic Gate Quiz
   What is the output of this gate?
───────────────────────────────────────────────*/
const GATES = [
    { name: 'AND', fn: (a, b) => a & b },
    { name: 'OR', fn: (a, b) => a | b },
    { name: 'XOR', fn: (a, b) => a ^ b },
    { name: 'NAND', fn: (a, b) => +(!(a & b)) },
    { name: 'NOR', fn: (a, b) => +(!(a | b)) },
]

function LogicGame() {
    const [q, setQ] = useState(null)
    const [score, setScore] = useState(0)
    const [feedback, setFeedback] = useState('')

    const newQ = useCallback(() => {
        const gate = GATES[Math.floor(Math.random() * GATES.length)]
        const a = Math.round(Math.random())
        const b = Math.round(Math.random())
        setQ({ gate, a, b, ans: gate.fn(a, b) })
        setFeedback('')
    }, [])

    useEffect(() => { newQ() }, [])

    const answer = (val) => {
        if (!q) return
        if (val === q.ans) {
            setScore(s => s + 10)
            setFeedback('✅ Correct!')
        } else {
            setFeedback(`❌ Wrong! ${q.gate.name}(${q.a},${q.b}) = ${q.ans}`)
        }
        setTimeout(newQ, 1000)
    }

    if (!q) return null
    return (
        <div className="mini-game">
            <div className="game-header">
                <h3>Logic Gate Quiz</h3>
                <span className="game-score">Score: {score}</span>
            </div>
            <p className="game-desc">What is the output?</p>
            <div className="gate-display">
                <span className="gate-input">A = {q.a}</span>
                <div className="gate-box">{q.gate.name}</div>
                <span className="gate-input">B = {q.b}</span>
                <span className="gate-arrow">→ ?</span>
            </div>
            <div className="gate-choices">
                <button className="game-btn" onClick={() => answer(0)}>0</button>
                <button className="game-btn" onClick={() => answer(1)}>1</button>
            </div>
            {feedback && <div className={`game-feedback ${feedback.startsWith('✅') ? 'ok' : 'err'}`}>{feedback}</div>}
        </div>
    )
}

/* ─────────────────────────────────────────────
   GAME 3: Morse Code Decoder
   Decode the morse signal to a letter
───────────────────────────────────────────────*/
const MORSE = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
    '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
    '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
    '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
    '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
    '--..': 'Z',
}
const MORSE_ENTRIES = Object.entries(MORSE)

function MorseGame() {
    const [q, setQ] = useState(null)
    const [input, setInput] = useState('')
    const [score, setScore] = useState(0)
    const [feedback, setFeedback] = useState('')

    const newQ = useCallback(() => {
        const [code, letter] = MORSE_ENTRIES[Math.floor(Math.random() * MORSE_ENTRIES.length)]
        setQ({ code, letter })
        setInput('')
        setFeedback('')
    }, [])

    useEffect(() => { newQ() }, [])

    const check = () => {
        if (!q) return
        if (input.trim().toUpperCase() === q.letter) {
            setScore(s => s + 10)
            setFeedback('✅ Correct!')
            setTimeout(newQ, 800)
        } else {
            setFeedback(`❌ Wrong! It was "${q.letter}"`)
        }
    }

    if (!q) return null
    return (
        <div className="mini-game">
            <div className="game-header">
                <h3>Morse Decoder</h3>
                <span className="game-score">Score: {score}</span>
            </div>
            <p className="game-desc">Which letter does this Morse code represent?</p>
            <div className="game-target morse-code">{q.code}</div>
            <div className="game-input-row">
                <input
                    className="game-input"
                    value={input}
                    onChange={e => setInput(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1))}
                    placeholder="A–Z"
                    onKeyDown={e => e.key === 'Enter' && check()}
                    maxLength={1}
                />
                <button className="game-btn" onClick={check}>Submit</button>
            </div>
            {feedback && <div className={`game-feedback ${feedback.startsWith('✅') ? 'ok' : 'err'}`}>{feedback}</div>}
        </div>
    )
}

/* ─────────────────────────────────────────────
   GAME 4: Shannon Entropy Quiz
   Multiple-choice Shannon entropy concept Qs
───────────────────────────────────────────────*/
const ENTROPY_QS = [
    { q: 'A fair coin has Shannon entropy of:', choices: ['0 bits', '1 bit', '2 bits', '0.5 bits'], ans: 1 },
    { q: 'Higher entropy means:', choices: ['Less information', 'More randomness', 'More predictability', 'Less uncertainty'], ans: 1 },
    { q: 'Shannon entropy H(X) = 0 when:', choices: ['X is uniform', 'X is certain', 'X has many outcomes', 'X is noisy'], ans: 1 },
    { q: 'The unit of entropy in IT is:', choices: ['Watt', 'Byte', 'Bit', 'Nit'], ans: 2 },
    { q: 'Mutual information I(X;Y) is always:', choices: ['Negative', '≥ 0', '= H(X)', 'undefined'], ans: 1 },
    { q: 'Huffman coding achieves:', choices: ['Lossless compression', 'Lossy compression', 'Encryption', 'Modulation'], ans: 0 },
    { q: 'Channel capacity (Shannon) depends on:', choices: ['Bandwidth & SNR', 'Voltage & current', 'Packet size', 'Modulation scheme'], ans: 0 },
]

function EntropyQuiz() {
    const [idx, setIdx] = useState(0)
    const [score, setScore] = useState(0)
    const [feedback, setFeedback] = useState('')
    const [done, setDone] = useState(false)

    const cur = ENTROPY_QS[idx]

    const pick = (i) => {
        if (feedback) return
        if (i === cur.ans) {
            setScore(s => s + 15)
            setFeedback('✅ Correct!')
        } else {
            setFeedback(`❌ Wrong! Answer: "${cur.choices[cur.ans]}"`)
        }
        setTimeout(() => {
            setFeedback('')
            if (idx + 1 >= ENTROPY_QS.length) { setDone(true) }
            else { setIdx(i => i + 1) }
        }, 1100)
    }

    const restart = () => { setIdx(0); setScore(0); setFeedback(''); setDone(false) }

    return (
        <div className="mini-game">
            <div className="game-header">
                <h3>Entropy Quiz</h3>
                <span className="game-score">Score: {score}</span>
            </div>
            {done ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: '3rem' }}>🎉</div>
                    <h4 style={{ marginTop: '12px' }}>Quiz Complete!</h4>
                    <p style={{ color: 'var(--primary-light)', fontSize: '1.2rem', margin: '8px 0 20px' }}>
                        {score} / {ENTROPY_QS.length * 15} pts
                    </p>
                    <button className="game-btn" onClick={restart}>Play Again</button>
                </div>
            ) : (
                <>
                    <div className="entropy-progress">Q {idx + 1} / {ENTROPY_QS.length}</div>
                    <p className="entropy-q">{cur.q}</p>
                    <div className="entropy-choices">
                        {cur.choices.map((c, i) => (
                            <button key={i} className="entropy-choice-btn" onClick={() => pick(i)}>{c}</button>
                        ))}
                    </div>
                    {feedback && <div className={`game-feedback ${feedback.startsWith('✅') ? 'ok' : 'err'}`}>{feedback}</div>}
                </>
            )}
        </div>
    )
}

/* ─────────────────────────────────────────────
   MAIN GAMES PAGE
───────────────────────────────────────────────*/
const GAME_LIST = [
    { id: 'binary', label: '⚡ Binary Decoder', component: BinaryGame },
    { id: 'logic', label: '🔐 Logic Gate Quiz', component: LogicGame },
    { id: 'morse', label: '📡 Morse Decoder', component: MorseGame },
    { id: 'entropy', label: '🧠 Entropy Quiz', component: EntropyQuiz },
]

export default function Games() {
    const [active, setActive] = useState('binary')
    const { settings } = useSite()
    const ActiveGame = GAME_LIST.find(g => g.id === active)?.component || BinaryGame

    return (
        <>
            <Seo />
            <PageHeader page="games" />
            <section className="section" style={{ borderTop: 0 }}>
                <div className="wrap">
                    <div className="game-tabs">
                        {GAME_LIST.map(g => (
                            <button key={g.id} className={`game-tab${active === g.id ? ' active' : ''}`} onClick={() => setActive(g.id)}>{g.label.replace(/^\S+\s/, '')}</button>
                        ))}
                    </div>
                    <div className="game-stage"><ActiveGame key={active} /></div>
                    {settings.games?.tip && <p className="game-tip"><span className="label">Did you know</span><br />{settings.games.tip}</p>}
                </div>
            </section>
        </>
    )
}
