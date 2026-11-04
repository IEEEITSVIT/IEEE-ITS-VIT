import { useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { PageTitle, Badge, Spinner, useToast, useConfirm, useLoader, fmtDate, Modal, Switch, downloadCsv } from '../ui'

const ROLES = { member: 'Member', editor: 'Editor — manages content, events, media, orders & queries', admin: 'Admin — everything incl. users, email & audit log' }

export default function Users() {
    const { user: me } = useAuth()
    const toast = useToast()
    const confirm = useConfirm()
    const { data, loading, setData } = useLoader(() => api.get('/admin/users').then(r => r.items), [])
    const [q, setQ] = useState('')
    const [role, setRole] = useState('')
    const [creating, setCreating] = useState(null)
    const [resetFor, setResetFor] = useState(null)
    const [pw, setPw] = useState('')

    const rows = (data || []).filter(u => (!role || u.role === role) && (!q || `${u.name} ${u.email} ${u.regNo}`.toLowerCase().includes(q.toLowerCase())))

    const patch = async (u, body, msg = 'Updated') => {
        try {
            const { item } = await api.patch(`/admin/users/${u.id}`, body)
            setData(list => list.map(x => (x.id === u.id ? item : x)))
            toast(msg)
            return true
        } catch (e) { toast(e.message, 'error'); return false }
    }

    const create = async e => {
        e.preventDefault()
        try {
            const { item } = await api.post('/admin/users', creating)
            setData(list => [item, ...list])
            setCreating(null)
            toast('User created')
        } catch (err) { toast(err.message, 'error') }
    }

    const remove = async u => {
        if (!await confirm(`Delete ${u.email}? Their orders and queries are kept.`)) return
        try { await api.del(`/admin/users/${u.id}`); setData(list => list.filter(x => x.id !== u.id)); toast('User deleted') }
        catch (e) { toast(e.message, 'error') }
    }

    return (
        <>
            <PageTitle title="Users & Roles" subtitle="Members sign up on the website. Promote trusted members to Editor or Admin here.">
                <input className="adm-input search" placeholder="Search name, email, reg no…" value={q} onChange={e => setQ(e.target.value)} />
                <select className="adm-input" value={role} onChange={e => setRole(e.target.value)} style={{ maxWidth: 140 }}>
                    <option value="">All roles</option><option value="member">Members</option><option value="editor">Editors</option><option value="admin">Admins</option>
                </select>
                <button className="adm-btn" disabled={!rows.length} onClick={() => downloadCsv('ieee-its-members.csv', rows)}>⬇ CSV</button>
                <button className="adm-btn primary" onClick={() => setCreating({ name: '', email: '', password: '', role: 'editor' })}>＋ Add user</button>
            </PageTitle>
            {loading ? <Spinner /> : (
                <div className="adm-table-wrap">
                    <table className="adm-table">
                        <thead><tr><th>Name</th><th>Mobile / Reg no</th><th>Type</th><th>Role</th><th>Active</th><th>Last login</th><th /></tr></thead>
                        <tbody>
                            {rows.map(u => (
                                <tr key={u.id}>
                                    <td><strong>{u.name}</strong>{u.id === me.id && <Badge tone="accent">You</Badge>}<br /><small>{u.email}</small></td>
                                    <td>{u.mobile || '—'}<br /><small>{u.regNo || ''}</small></td>
                                    <td><small>{u.memberType}</small></td>
                                    <td>
                                        <select className="adm-input" value={u.role} disabled={u.id === me.id} onChange={e => patch(u, { role: e.target.value }, `Role changed to ${e.target.value}`)}>
                                            <option value="member">Member</option><option value="editor">Editor</option><option value="admin">Admin</option>
                                        </select>
                                    </td>
                                    <td><Switch checked={u.active} onChange={v => u.id !== me.id && patch(u, { active: v }, v ? 'Activated' : 'Deactivated')} /></td>
                                    <td className="nowrap"><small>{fmtDate(u.lastLoginAt)}</small></td>
                                    <td className="nowrap">
                                        <button className="adm-btn small" onClick={() => { setResetFor(u); setPw('') }}>Reset password</button>
                                        {u.id !== me.id && <button className="adm-btn small ghost danger-text" onClick={() => remove(u)}>🗑</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Modal open={!!creating} onClose={() => setCreating(null)} title="Add user">
                {creating && (
                    <form className="adm-form" onSubmit={create}>
                        <label className="adm-field"><span>Name</span><input className="adm-input" value={creating.name} onChange={e => setCreating(c => ({ ...c, name: e.target.value }))} required /></label>
                        <label className="adm-field"><span>Email</span><input className="adm-input" type="email" value={creating.email} onChange={e => setCreating(c => ({ ...c, email: e.target.value }))} required /></label>
                        <label className="adm-field"><span>Temporary password</span><input className="adm-input" type="text" value={creating.password} onChange={e => setCreating(c => ({ ...c, password: e.target.value }))} required minLength={8} placeholder="8+ chars, letters + numbers" /></label>
                        <label className="adm-field"><span>Role</span>
                            <select className="adm-input" value={creating.role} onChange={e => setCreating(c => ({ ...c, role: e.target.value }))}>
                                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </label>
                        <div className="adm-row end"><button className="adm-btn primary" type="submit">Create user</button></div>
                    </form>
                )}
            </Modal>
            <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset password · ${resetFor?.email}`}>
                <form className="adm-form" onSubmit={async e => { e.preventDefault(); if (await patch(resetFor, { newPassword: pw }, 'Password reset — existing sessions signed out')) setResetFor(null) }}>
                    <label className="adm-field"><span>New password</span><input className="adm-input" type="text" value={pw} onChange={e => setPw(e.target.value)} required minLength={8} /></label>
                    <p className="adm-hint">Share it with the user privately and ask them to change it from their profile.</p>
                    <div className="adm-row end"><button className="adm-btn primary" type="submit">Reset password</button></div>
                </form>
            </Modal>
        </>
    )
}
