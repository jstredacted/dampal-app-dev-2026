import { Link } from 'react-router-dom'
import { formatDate } from '../api.js'

function snippet(text) {
  return text.length > 120 ? `${text.slice(0, 120)}...` : text
}

// Reused by All Blogs and My Blogs. The parent page loads the posts and passes them in as props.
function PostList({ posts, emptyText }) {
  if (posts.length === 0) return <p>{emptyText}</p>

  return (
    <div className="blogs">
      {posts.map((post) => (
        <Link key={post.id} to={`/posts/${post.id}`}>
          <h3>{post.title}</h3>
          <p className="meta">By {post.author} · {formatDate(post.created_at)}</p>
          <p>{snippet(post.content)}</p>
        </Link>
      ))}
    </div>
  )
}

export default PostList
