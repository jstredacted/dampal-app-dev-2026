function About() {
  return (
    <>
      <h2>About</h2>
      <p>
        The Ateneo Times is a satirical campus blog, written somewhere between the last
        class and the next deadline. It is a class project and not a real newspaper.
      </p>
      <p>
        This site is built with ReactJS. It talks to two Express servers: the Auth Server
        creates accounts and gives out login tokens (JWTs), and the Blog Server stores the
        blogs and checks those tokens by itself. Both servers save their data in a MariaDB
        database.
      </p>
      <p>Anyone can read blogs without logging in.</p>
      <ul>
        <li><strong>Readers</strong> can read blogs and see their own (empty) blog list.</li>
        <li><strong>Authors</strong> can write blogs and edit their own.</li>
        <li><strong>Admins</strong> can write blogs, edit any blog, and delete blogs.</li>
      </ul>
    </>
  )
}

export default About
