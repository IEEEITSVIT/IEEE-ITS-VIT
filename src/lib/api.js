/* Thin fetch wrapper for the IEEE ITS API (same origin; session travels in an HttpOnly cookie). */
export class ApiError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
    const res = await fetch(`/api${path}`, {
        method,
        signal,
        credentials: 'same-origin',
        headers: {
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(method !== 'GET' ? { 'X-Requested-With': 'its-web' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`)
    return data
}

api.get = (p, o) => api(p, { ...o, method: 'GET' })
api.post = (p, body) => api(p, { method: 'POST', body: body ?? {} })
api.put = (p, body) => api(p, { method: 'PUT', body: body ?? {} })
api.patch = (p, body) => api(p, { method: 'PATCH', body: body ?? {} })
api.del = p => api(p, { method: 'DELETE', body: {} })
