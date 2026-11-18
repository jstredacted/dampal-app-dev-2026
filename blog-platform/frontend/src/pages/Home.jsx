import { useEffect, useState } from 'react'
import PostList from '../components/PostList.jsx'
import { errorText, requestJson } from '../api.js'

// All Blogs: public, no token needed (GET /api/posts)
function Home() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    requestJson('/api/posts')
      .then((result) => {
        if (result.ok) setPosts(result.data)
        else setMessage(errorText(result))
      })
      .catch(() => setMessage('Could not connect to the Blog Server.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <h2>All Blogs</h2>
      {message && <p className="message" role="alert">{message}</p>}
      {loading ? <p>Loading blogs...</p> : !message && <PostList posts={posts} emptyText="There are no blogs to display." />}
    </>
  )
}

export default Home
