import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { canWrite, errorText, requestJson } from '../api.js'
import { useAuth } from '../AuthContext.jsx'

// /posts/new creates a blog (POST); /posts/:id/edit updates one (PUT)
function PostForm() {
  const { id } = useParams()
  const editing = id !== undefined
  const navigate = useNavigate()
  const { user, checkingSession, authRequest } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [message, setMessage] = useState('')
  const [loaded, setLoaded] = useState(!editing)

  // When editing, fill the form with the current title and content
  useEffect(() => {
    if (!editing) return
    requestJson(`/api/posts/${id}`)
      .then((result) => {
        if (!result.ok) return setMessage(errorText(result))
        setTitle(result.data.title)
        setContent(result.data.content)
        setLoaded(true)
      })
      .catch(() => setMessage('Could not connect to the Blog Server.'))
  }, [editing, id])

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    try {
      const result = editing
        ? await authRequest(`/api/posts/${id}`, { method: 'PUT', body: { title, content } })
        : await authRequest('/api/posts', { method: 'POST', body: { title, content } })
      if (result.ok) navigate(`/posts/${result.data.id}`)
      else setMessage(errorText(result))
    } catch {
      setMessage('Could not connect to the Blog Server.')
    }
  }

  if (checkingSession) return <p>Loading...</p>
  if (!user) return <Navigate to="/login" replace />
  if (!canWrite(user)) return <p className="message">Only authors and admins can write blogs.</p>

  return (
    <>
      <h2>{editing ? 'Edit Blog' : 'Create a New Blog'}</h2>
      {message && <p className="message" role="alert">{message}</p>}
      {loaded && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="title">Blog title</label>
          <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label htmlFor="content">Blog body</label>
          <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} required />
          <button className="button" type="submit">{editing ? 'Save Changes' : 'Submit'}</button>
          <Link className="button secondary" to={editing ? `/posts/${id}` : '/'}>Cancel</Link>
        </form>
      )}
    </>
  )
}

export default PostForm
