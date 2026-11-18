// Small helpers for talking to the two servers through the Vite proxy.
// /auth/... goes to the Auth Server (port 4000), /api/... goes to the Blog Server (port 5000).

// Sends a JSON request and returns { ok, status, data } so pages can show the result
export async function requestJson(url, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// Asks the Auth Server for a new access token. The refresh token is not sent from
// JavaScript: the browser adds the httpOnly cookie that /login set.
export async function requestNewAccessToken() {
  try {
    const { ok, data } = await requestJson('/auth/refresh', { method: 'POST' })
    return ok ? data.accessToken : null
  } catch {
    return null
  }
}

// Reads { id, username, role } from the middle part (payload) of a JWT.
// This is only for showing the right links and buttons; the Blog Server still checks every request.
export function readTokenPayload(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

// Only authors and admins can create blogs
export function canWrite(user) {
  return !!user && (user.role === 'author' || user.role === 'admin')
}

export function errorText({ status, data }) {
  return `${data.error || 'Something went wrong'} (${status})`
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
