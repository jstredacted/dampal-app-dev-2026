# Frontend (ReactJS + Vite)

The Ateneo Times blog website. It was created with `npm create vite@latest` (React template)
and uses `react-router-dom` for the pages.

```sh
npm install
npm run dev     # http://127.0.0.1:5180
npm run build   # production build in dist/
```

Start the Auth Server and Blog Server first (see `../README.md`). The Vite proxy in
`vite.config.js` forwards `/auth/*` to the Auth Server (port 4000) and `/api/*` to the
Blog Server (port 5000).

- `src/main.jsx`: starts React with the router and the `AuthProvider`.
- `src/App.jsx`: the routes (one per page).
- `src/AuthContext.jsx`: the logged-in user, login, logout, and `authRequest` for protected routes.
- `src/api.js`: fetch helpers.
- `src/components/`: `Header`, `Footer`, `PostList`.
- `src/pages/`: `Home`, `MyBlogs`, `PostDetails`, `PostForm`, `Login`, `About`, `NotFound`.
