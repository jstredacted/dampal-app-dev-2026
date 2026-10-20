# Blog Platform (Midterm Exam)

A mini blog platform backend built as **two Express servers**:

- **Auth Server** (port 4000) registers users and issues JWTs.
- **Blog API** (port 5000) verifies those JWTs with the same `JWT_SECRET`
  and never calls the Auth Server.

Roles are `reader`, `author`, and `admin`. Anyone can read posts; writing
needs a valid access token. Test the endpoints with Postman or the simple
frontend pages.

The earlier activities in this repository (`jwt-auth-demo/` and the REST API
activity at the repository root) are unchanged.

## Requirements

- Node.js 22.4 or newer (the project pins 22.22.0 in `.mise.toml`) and npm.
- Packages: `express`, `jsonwebtoken`, and `dotenv`. Passwords are hashed
  with Node's built-in `crypto` module.

## Setup

From this `blog-platform/` folder:

```sh
npm ci
```

Both servers read the one `.env` file in this folder through dotenv's `path`
option. For this classroom demo, `.env` is committed so a fresh clone runs
with the same `JWT_SECRET`. A real project would keep `.env` private and
commit only `.env.example`.

## Run

Use two terminals, both inside `blog-platform/`:

```sh
npm run start:auth   # http://127.0.0.1:4000
npm run start:blog   # http://127.0.0.1:5000
```

With Mise, prefix the commands with `mise exec --`.

Use `127.0.0.1` rather than `localhost`. On macOS, the AirPlay Receiver also
uses port 5000, and `localhost:5000` can reach it instead of the Blog API.

Node prints an `ExperimentalWarning` for Web Storage on startup. This is
expected.

## Frontend

With both servers running, open **http://127.0.0.1:5000**.

The site is branded **Ateneo Times**, with the tagline "A satirical campus
blog". The look follows the course's sample blog: a large uppercase title,
grey uppercase links on the right, a list of blog titles with short previews,
and a centered footer.

- `index.html`: **All Blogs**, open to everyone. With `?mine=1` it shows
  **My Blogs** for the logged-in user.
- `details.html?id=N`: one blog. The owner or an admin sees **Edit**; only an
  admin sees **Delete**.
- `create.html`: **New Blog** for authors and admins. With `?id=N` it edits
  that blog.
- `login.html`: log in, or create an account with a role.
- `about.html`: what each role can do.

Every page loads `styles.css` and `app.js`. `app.js` holds the shared code:
the Auth Server address, token helpers, and the navigation links, which change
with the logged-in role. Each page then has one inline script of its own. The
Blog API serves these files from `blog-api/public/`. They call the Auth
Server at `http://127.0.0.1:4000` and the Blog API's `/api` routes.

- Tokens are kept in the browser's `localStorage` and sent as
  `Authorization: Bearer <accessToken>`.
- When a Blog API request returns `401`, the page calls `/refresh` once and
  retries. If that fails, it returns to the login page.
- Buttons are hidden or shown from the role in the access token. This is
  only for convenience; the Blog API still checks every request.

Because the pages come from port 5000 and the Auth Server is on port 4000,
the browser needs permission to call it (CORS).
`auth-server/src/middleware/cors.js` allows requests only from
`http://127.0.0.1:<BLOG_PORT>`. It sets the CORS headers directly, without an
extra package.

## Persistence (localStorage)

Each server keeps its records in an in-memory array. On startup it reads the
array from `localStorage`; after every change it saves the array back.

This is Node's built-in `localStorage`, enabled by the
`--experimental-webstorage` and `--localstorage-file` flags in the npm
scripts. Each server has its own storage file in `data/`:

- `data/auth-storage.db`: users (Auth Server only)
- `data/blog-storage.db`: posts (Blog API only)

Data survives a server restart. Delete these files to start fresh. They are
unencrypted and Git-ignored, so use made-up demo accounts only.

## Auth Server (port 4000)

| Method | Endpoint | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| POST | `/register` | `username`, `password`, `role` | `201` | `400` missing field or invalid role, `409` username taken |
| POST | `/login` | `username`, `password` | `200` `{ accessToken, refreshToken }` | `400` missing field, `401` wrong credentials |
| POST | `/refresh` | `refreshToken` | `200` `{ accessToken }` | `400` missing token, `401` invalid, expired, or revoked |
| POST | `/logout` | `refreshToken` | `200` | `400` missing token |

User record:

```js
{ id, username, hashed_password, role, refresh_token, created_at, revoked_at }
```

- `hashed_password` is `salt:hash` from `crypto.scryptSync` with a random salt.
- **Access token:** `{ id, username, role }`, expires in 15 minutes.
- **Refresh token:** `{ id, type: "refresh" }`, expires in 7 days, signed with
  the same `JWT_SECRET`.
- **Login** saves the new refresh token in `refresh_token` and clears
  `revoked_at`. Logging in again replaces the previous refresh token.
- **Refresh** checks the signature and expiry, the `"refresh"` type, and that
  the token matches the saved `refresh_token`.
- **Logout** clears `refresh_token` and sets `revoked_at`.

Logout stops the refresh token from working. An access token that was already
issued stays valid until it expires (at most 15 minutes), because the Blog API
checks tokens on its own without asking the Auth Server.

## Blog API (port 5000)

| Method | Endpoint | Who can access | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/posts` | public | `200` | none |
| GET | `/api/posts/:id` | public | `200` | `404` |
| POST | `/api/posts` | author, admin | `201` | `400`, `401`, `403` |
| PUT | `/api/posts/:id` | post owner or admin | `200` | `400`, `401`, `403`, `404` |
| DELETE | `/api/posts/:id` | admin | `200` | `401`, `403`, `404` |
| GET | `/api/me/posts` | any logged-in user | `200` | `401` |

Post record:

```js
{ id, user_id, title, content }
```

`user_id` follows the exam's Posts Model and holds the author's user ID. As
the endpoint table says, it always comes from the access token, never from
the request body. `content` is added because creating a post requires it.

Protected requests send `Authorization: Bearer <accessToken>`.

- `middleware/authenticate.js` verifies the token, rejects any token with
  `type: "refresh"`, and sets `req.user`. Otherwise it returns `401`. It is
  added per route because the two `GET /api/posts` routes are public.
- `middleware/authorize.js` (`authorize(...roles)`) returns `403` when the
  user's role is not allowed.
- The ownership check (post author or admin) is in the update controller.
- `PUT` updates the `title` and/or `content` that are sent. Other fields stay
  the same.

All errors use the same JSON format: `{ "error": "message" }`.

## Folder structure

```text
blog-platform/
├── .env                     # shared by both servers (committed for the demo)
├── .env.example
├── package.json
├── auth-server/
│   ├── server.js
│   └── src/
│       ├── app.js
│       ├── routes/auth.routes.js
│       ├── controllers/auth.controller.js
│       ├── middleware/cors.js
│       ├── middleware/errorHandler.js
│       ├── models/user.model.js
│       └── utils/password.js
├── blog-api/
│   ├── server.js
│   ├── public/              # frontend: pages, styles.css, app.js
│   └── src/
│       ├── app.js
│       ├── routes/post.routes.js
│       ├── controllers/post.controller.js
│       ├── middleware/authenticate.js
│       ├── middleware/authorize.js
│       ├── middleware/errorHandler.js
│       └── models/post.model.js
├── data/                    # localStorage files (Git-ignored)
├── postman/blog-platform.postman_collection.json
└── test/blog-platform.test.js
```

## Postman

Import `postman/blog-platform.postman_collection.json`. Start both servers,
then run the requests from top to bottom. Each login saves its tokens into
collection variables, so later requests use them automatically. On a fresh
start, delete the `data/` storage files first so the demo usernames are free.

## Validate

```sh
npm run check
npm test
```

The tests start both real servers as separate processes with temporary
storage files, so your own demo data is not touched. They cover every
endpoint and status code, all three roles, token lifetimes and types,
refresh-token revocation, ownership, restarts, and the Blog API working while
the Auth Server is stopped. They also check that the pages are served (and
source files are not), that the page scripts are valid JavaScript, and that
CORS allows only the Blog API's page address.

## Demo limitations

This is a local classroom project, not production authentication. Anyone
can register as `admin` because the exam requires choosing the role at
registration. The servers listen only on this computer (`127.0.0.1`).
