import { Link, NavLink, useNavigate } from 'react-router-dom'
import { canWrite } from '../api.js'
import { useAuth } from '../AuthContext.jsx'

// The links change with the logged-in role
function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header>
      <Link className="site-title" to="/">
        <h1>Ateneo Times</h1>
        <p>A satirical campus blog</p>
      </Link>
      <nav aria-label="Main">
        <NavLink to="/" end>Blogs</NavLink>
        {user && <NavLink to="/my-blogs">My Blogs</NavLink>}
        <NavLink to="/about">About</NavLink>
        {canWrite(user) && <NavLink to="/posts/new">New Blog</NavLink>}
        {user ? (
          <button type="button" onClick={handleLogout}>Log Out</button>
        ) : (
          <NavLink to="/login">Log In</NavLink>
        )}
      </nav>
      {user && <p className="signed-in">Signed in as {user.username} ({user.role})</p>}
    </header>
  )
}

export default Header
