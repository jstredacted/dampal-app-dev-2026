import { Route, Routes } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import MyBlogs from './pages/MyBlogs.jsx'
import PostDetails from './pages/PostDetails.jsx'
import PostForm from './pages/PostForm.jsx'
import Login from './pages/Login.jsx'
import About from './pages/About.jsx'
import NotFound from './pages/NotFound.jsx'

// The root component: the same Header and Footer on every page, and the page in between
// is chosen by the address in the browser.
function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/my-blogs" element={<MyBlogs />} />
          <Route path="/posts/new" element={<PostForm />} />
          <Route path="/posts/:id" element={<PostDetails />} />
          <Route path="/posts/:id/edit" element={<PostForm />} />
          <Route path="/login" element={<Login />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

export default App
