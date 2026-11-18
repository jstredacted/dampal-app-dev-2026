import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <>
      <h2>Page not found</h2>
      <p><Link to="/">Back to all blogs</Link></p>
    </>
  )
}

export default NotFound
