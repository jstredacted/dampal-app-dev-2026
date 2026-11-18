# Blog Platform (Final Exam)

The midterm blog platform, now connected to **MariaDB (through XAMPP)** and given a
**ReactJS** frontend:

- **Auth Server** (port 4000) registers users and issues JWTs.
- **Blog Server** (port 5000) verifies those JWTs with the same `JWT_SECRET`
  and never calls the Auth Server.
- **Frontend** (port 5180) is a React app made with Vite.
- **MariaDB** (XAMPP, port 3306) stores users, roles, refresh tokens and posts in the
  `blog_platform` database. Nothing is kept in in-memory arrays anymore.

Roles are `reader`, `author`, and `admin`. Anyone can read posts; writing needs a valid
access token.

## Requirements

- XAMPP with **MySQL** (MariaDB) started in the XAMPP control panel. Start **Apache** too
  if you want phpMyAdmin at http://localhost/phpmyadmin.
- Node.js 22.12 or newer (the project pins 22.22.0 in `.mise.toml`) and npm.
- Backend packages: `express`, `jsonwebtoken`, `dotenv`, plus the packages the exam
  requires: `mysql2`, `express-rate-limit`, `cookie-parser`, and `helmet`.
- Frontend packages: `react`, `react-dom`, `react-router-dom` (and `vite` for development).

## Setup

From this `blog-platform/` folder:

```sh
npm install
npm --prefix frontend install
npm run db:setup
```

`npm run db:setup` runs `database/schema.sql`. It creates the `blog_platform` database,
the four tables, and the three roles. It can also be imported in phpMyAdmin
(**Import** tab). Running it again is safe: it never drops or empties a table.

Both servers read the one `.env` file in this folder. The database settings match a
fresh XAMPP install (user `root`, no password). For this classroom demo, `.env` is
committed so a fresh clone runs with the same `JWT_SECRET`; a real project would keep
`.env` private and commit only `.env.example`.

## Run

Use three terminals, all inside `blog-platform/`:

```sh
npm run start:auth     # http://127.0.0.1:4000
npm run start:blog     # http://127.0.0.1:5000
npm run dev:frontend   # http://127.0.0.1:5180  <- open this in the browser
```

With Mise, prefix the commands with `mise exec --`. Each server checks the database
connection first and stops with a clear message if MySQL is not running.

Use `127.0.0.1` rather than `localhost`. On macOS, the AirPlay Receiver also uses
port 5000.

## Database

Tables follow the exam schema (`database/schema.sql`):

| Table | Columns | Links |
| --- | --- | --- |
| `roles` | `id`, `role` (unique), `created_at`, `updated_at`, `encoder_id` | |
| `users` | `id`, `email` (unique), `username` (unique), `password_hash`, `role_id`, `is_active`, `created_at`, `updated_at` | `role_id` → `roles.id` (1:N) |
| `refresh_tokens` | `id`, `user_id`, `token_hash` (unique), `expires_at`, `revoked_at`, `created_at` | `user_id` → `users.id` (1:N) |
| `posts` | `id`, `author_id`, `title`, `content`, `created_at`, `updated_at` | `author_id` → `users.id` (1:N) |

- The schema note says `roles.id` is `INT` while the cheatsheet's `users.role_id` is
  `INT UNSIGNED`. A foreign key needs matching types, so `users.role_id` is `INT`.
- `password_hash` is `salt:hash` from Node's built-in `crypto.scryptSync`.
- `token_hash` is the SHA-256 hash of the refresh token (64 hex characters). The real
  token is never saved.
- Each server has its own `db.js`, a `mysql2` connection pool. Every query uses `?`
  placeholders, so user input is never pasted into SQL.

## Auth Server (port 4000)

| Method | Endpoint | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| POST | `/register` | `email`, `username`, `password`, `role` | `201` | `400` missing field, invalid email or invalid role, `409` username or email taken |
| POST | `/login` | `username`, `password` | `200` `{ accessToken, refreshToken }` | `400` missing field, `401` wrong credentials |
| POST | `/refresh` | `refreshToken` | `200` `{ accessToken }` | `400` missing token, `401` invalid, expired, or revoked |
| POST | `/logout` | `refreshToken` | `200` | `400` missing token |

- `email` is required because the exam schema has `users.email VARCHAR(255) UNIQUE NOT NULL`.
- **Access token:** `{ id, username, role }`, expires in 15 minutes.
- **Refresh token:** `{ id, type: "refresh" }`, expires in 7 days, signed with the same
  `JWT_SECRET`.
- **Login** inserts a `refresh_tokens` row (`token_hash`, `expires_at` = 7 days). A user
  can be logged in on several devices; each login has its own row. Disabled users
  (`is_active = 0`) cannot log in.
- **Refresh** checks the signature and expiry, the `"refresh"` type, and that the
  token's row exists with `revoked_at` empty and `expires_at` in the future.
- **Logout** sets `revoked_at`, so that refresh token stops working, and clears the
  cookie. An access token that was already issued stays valid until it expires (at most
  15 minutes), because the Blog Server checks tokens without asking the Auth Server.
- **helmet** adds security headers. **express-rate-limit** allows `AUTH_RATE_LIMIT`
  requests (default 100) per address every 15 minutes, then answers `429`.
- **cookie-parser:** login also sends the refresh token as an `httpOnly` cookie. The
  React app uses that cookie, so page JavaScript never handles the refresh token.
  `/refresh` and `/logout` read `refreshToken` from the body first (Postman), then from
  the cookie (browser).

## Blog Server (port 5000)

| Method | Endpoint | Who can access | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/posts` | public | `200` | none |
| GET | `/api/posts/:id` | public | `200` | `404` |
| POST | `/api/posts` | author, admin | `201` | `400`, `401`, `403` |
| PUT | `/api/posts/:id` | post owner or admin | `200` | `400`, `401`, `403`, `404` |
| DELETE | `/api/posts/:id` | admin | `200` | `401`, `403`, `404` |
| GET | `/api/me/posts` | any logged-in user | `200` | `401` |

Post response:

```js
{ id, author_id, author, title, content, created_at, updated_at }
```

`author` is the author's username, joined from `users`. `author_id` always comes from
the access token, never from the request body.

- `middleware/authenticate.js` reads `Authorization: Bearer <token>`, verifies it,
  rejects any token with `type: "refresh"`, and sets `req.user`. Otherwise it returns
  `401`. It is added per route because the two `GET /api/posts` routes are public.
- `middleware/authorize.js` (`authorize(...roles)`) returns `403` when the user's role
  is not allowed.
- The ownership check (post author or admin) is in the update controller.
- `PUT` updates the `title` and/or `content` that are sent. Other fields stay the same.

All errors use the same JSON format: `{ "error": "message" }`.

## Frontend (ReactJS)

Open **http://127.0.0.1:5180**. The site keeps the midterm's **Ateneo Times** look.

| Address | Page | Who |
| --- | --- | --- |
| `/` | All Blogs | everyone |
| `/posts/:id` | One blog. Owner or admin sees **Edit**; only admin sees **Delete** | everyone |
| `/posts/new` | New Blog | author, admin |
| `/posts/:id/edit` | Edit Blog | owner, admin |
| `/my-blogs` | My Blogs | any logged-in user |
| `/login` | Log in, or create an account with email and role | everyone |
| `/about` | What each role can do | everyone |

- Vite's proxy (`frontend/vite.config.js`) sends `/auth/*` to the Auth Server and
  `/api/*` to the Blog Server, so the browser only talks to one address and no CORS
  setup is needed.
- The access token is kept in React state (memory). When the page reloads, the app asks
  `/auth/refresh` for a new one using the httpOnly cookie.
- When a Blog Server request returns `401`, the app refreshes once and retries.
- Buttons are shown from the role in the access token. This is only for convenience;
  the Blog Server still checks every request.

## Folder structure

```text
blog-platform/
├── .env                     # shared by both servers (committed for the demo)
├── .env.example
├── package.json
├── database/
│   ├── schema.sql           # tables + roles (exam schema)
│   └── setup.js             # npm run db:setup
├── auth-server/
│   ├── server.js
│   ├── db.js
│   └── src/
│       ├── app.js
│       ├── routes/auth.routes.js
│       ├── controllers/auth.controller.js
│       ├── middleware/errorHandler.js
│       └── utils/password.js
├── blog-server/
│   ├── server.js
│   ├── db.js
│   └── src/
│       ├── app.js
│       ├── routes/post.routes.js
│       ├── controllers/post.controller.js
│       └── middleware/ (authenticate.js, authorize.js, errorHandler.js)
├── frontend/                # React (Vite)
│   ├── vite.config.js
│   └── src/ (main.jsx, App.jsx, AuthContext.jsx, api.js, components/, pages/)
├── postman/blog-platform.postman_collection.json
└── test/blog-platform.test.js
```

## Postman

Import `postman/blog-platform.postman_collection.json`. Start both servers, then run the
requests from top to bottom. Each login saves its tokens into collection variables.
Data now stays in MariaDB, so on a second run the demo usernames are already taken;
delete those users in phpMyAdmin (their posts and tokens are removed too, by
`ON DELETE CASCADE`) or change the names.

## Validate

```sh
npm run check
npm test
npm --prefix frontend run lint
npm --prefix frontend run build
```

`npm test` needs MySQL running. It creates a separate `blog_platform_test` database from
`schema.sql`, starts both real servers against it, and drops it at the end, so your
`blog_platform` data is not touched. It covers every endpoint and status code, all three
roles, the database rows (hashed passwords and tokens, `revoked_at`, `expires_at`,
`author_id`), the refresh cookie, helmet headers, rate limiting, restarts, and the Blog
Server working while the Auth Server is stopped.

## Demo limitations

This is a local classroom project, not production authentication. Anyone can register
as `admin` because the exam requires choosing the role at registration. The servers
listen only on this computer (`127.0.0.1`).
