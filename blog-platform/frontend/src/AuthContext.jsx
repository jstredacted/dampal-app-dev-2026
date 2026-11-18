import { createContext, useContext, useEffect, useState } from 'react'
import { readTokenPayload, requestJson, requestNewAccessToken } from './api.js'

// Shares the logged-in user with every component (useContext), so no props are passed down
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // The access token is kept only in React state (memory), not in localStorage
  const [accessToken, setAccessToken] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  // On page load or refresh, try the refresh-token cookie to stay logged in
  useEffect(() => {
    requestNewAccessToken().then((token) => {
      setAccessToken(token)
      setCheckingSession(false)
    })
  }, [])

  const user = accessToken ? readTokenPayload(accessToken) : null

  async function login(username, password) {
    const result = await requestJson('/auth/login', { method: 'POST', body: { username, password } })
    if (result.ok) setAccessToken(result.data.accessToken)
    return result
  }

  async function logout() {
    try {
      await requestJson('/auth/logout', { method: 'POST' }) // the cookie tells the server which token to revoke
    } catch {
      // Still log out in this browser even if the Auth Server is down
    }
    setAccessToken(null)
  }

  // For protected Blog Server routes: sends the Bearer token, and if it has expired (401)
  // gets a new access token once and tries again
  async function authRequest(url, options = {}) {
    const first = await requestJson(url, { ...options, token: accessToken })
    if (first.status !== 401) return first

    const newToken = await requestNewAccessToken()
    setAccessToken(newToken)
    if (!newToken) return first
    return requestJson(url, { ...options, token: newToken })
  }

  const value = { user, checkingSession, login, logout, authRequest }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
