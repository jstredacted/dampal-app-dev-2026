import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorText, formatDate, requestJson } from '../api.js'
import { useAuth } from '../AuthContext.jsx'

// One blog (public). The owner or an admin sees Edit; only an admin sees Delete.
function PostDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, authRequest } = useAuth()
  const [post, setPost] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    requestJson(`/api/posts/${id}`)
      .then((result) => {
        if (result.ok) setPost(result.data)
        else setMessage(errorText(result))
      })
      .catch(() => setMessage('Could not connect to the Blog Server.'))
  }, [id])

  async function handleDelete() {
    if (!window.confirm('Delete this blog?')) return
    try {
      const result = await authRequest(`/api/posts/${id}`, { method: 'DELETE' })
      if (result.ok) navigate('/')
      else setMessage(errorText(result))
    } catch {
      setMessage('Could not connect to the Blog Server.')
    }
  }

  if (!post) {
    return message ? <p className="message" role="alert">{message}</p> : <p>Loading...</p>
  }

  const isAdmin = !!user && user.role === 'admin'
  const isOwner = !!user && user.id === post.author_id

  return (
    <article className="details">
      <h2>{post.title}</h2>
      <p className="meta">By {post.author} · {formatDate(post.created_at)}</p>
      <div className="content">{post.content}</div>
      {message && <p className="message" role="alert">{message}</p>}
      {(isOwner || isAdmin) && <Link className="button" to={`/posts/${post.id}/edit`}>Edit</Link>}
      {isAdmin && <button className="button danger" type="button" onClick={handleDelete}>Delete</button>}
    </article>
  )
}

export default PostDetails
