import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import PostList from '../components/PostList.jsx'
import { errorText } from '../api.js'
import { useAuth } from '../AuthContext.jsx'

// My Blogs: any logged-in user (GET /api/me/posts with the Bearer token)
function MyBlogs() {
  const { user, checkingSession, authRequest } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const userId = user && user.id

  useEffect(() => {
    if (!userId) return
    authRequest('/api/me/posts')
      .then((result) => {
        if (result.ok) setPosts(result.data)
        else setMessage(errorText(result))
      })
      .catch(() => setMessage('Could not connect to the Blog Server.'))
      .finally(() => setLoading(false))
    // Load again only when a different user logs in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (checkingSession) return <p>Loading...</p>
  if (!user) return <Navigate to="/login" replace />

  return (
    <>
      <h2>My Blogs</h2>
      {message && <p className="message" role="alert">{message}</p>}
      {loading ? <p>Loading blogs...</p> : !message && <PostList posts={posts} emptyText="You have no blogs yet." />}
    </>
  )
}

export default MyBlogs
