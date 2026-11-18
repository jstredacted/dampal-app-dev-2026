import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorText, requestJson } from '../api.js'
import { useAuth } from '../AuthContext.jsx'

const emptyRegister = { email: '', username: '', password: '', role: 'reader' }

// Log in (POST /auth/login) or create an account (POST /auth/register)
function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState(emptyRegister)
  const [message, setMessage] = useState({ text: '', ok: false })

  // One change handler per form: the input's name says which field to update
  function updateLogin(event) {
    setLoginForm({ ...loginForm, [event.target.name]: event.target.value })
  }
  function updateRegister(event) {
    setRegisterForm({ ...registerForm, [event.target.name]: event.target.value })
  }

  async function handleLogin(event) {
    event.preventDefault()
    try {
      const result = await login(loginForm.username, loginForm.password)
      if (result.ok) navigate('/')
      else setMessage({ text: errorText(result), ok: false })
    } catch {
      setMessage({ text: 'Could not connect to the Auth Server. Is it running on port 4000?', ok: false })
    }
  }

  async function handleRegister(event) {
    event.preventDefault()
    try {
      const result = await requestJson('/auth/register', { method: 'POST', body: registerForm })
      if (result.ok) {
        setMessage({ text: `${result.data.message} (${result.status})`, ok: true })
        setRegisterForm(emptyRegister)
      } else {
        setMessage({ text: errorText(result), ok: false })
      }
    } catch {
      setMessage({ text: 'Could not connect to the Auth Server. Is it running on port 4000?', ok: false })
    }
  }

  return (
    <>
      {message.text && (
        <p className={message.ok ? 'message ok' : 'message'} role="alert">{message.text}</p>
      )}
      <div className="columns">
        <section>
          <h2>Log In</h2>
          <form onSubmit={handleLogin}>
            <label htmlFor="login-username">Username</label>
            <input id="login-username" name="username" type="text" value={loginForm.username} onChange={updateLogin} required />
            <label htmlFor="login-password">Password</label>
            <input id="login-password" name="password" type="password" value={loginForm.password} onChange={updateLogin} required />
            <button className="button" type="submit">Log In</button>
          </form>
        </section>

        <section>
          <h2>Create Account</h2>
          <form onSubmit={handleRegister}>
            <label htmlFor="reg-email">Email</label>
            <input id="reg-email" name="email" type="email" value={registerForm.email} onChange={updateRegister} required />
            <label htmlFor="reg-username">Username</label>
            <input id="reg-username" name="username" type="text" maxLength={50} value={registerForm.username} onChange={updateRegister} required />
            <label htmlFor="reg-password">Password</label>
            <input id="reg-password" name="password" type="password" value={registerForm.password} onChange={updateRegister} required />
            <label htmlFor="reg-role">Role</label>
            <select id="reg-role" name="role" value={registerForm.role} onChange={updateRegister}>
              <option value="reader">Reader</option>
              <option value="author">Author</option>
              <option value="admin">Admin</option>
            </select>
            <button className="button" type="submit">Create Account</button>
          </form>
        </section>
      </div>
    </>
  )
}

export default Login
