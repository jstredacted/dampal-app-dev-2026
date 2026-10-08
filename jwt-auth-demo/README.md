# JWT Auth Activity

This activity extends the instructor's
[JWT starter](https://github.com/louith/jwt-auth-demo), revision
`e5243a3c3212694612633a78a57fb623f86d3149`.

The app stays in its own `jwt-auth-demo/` folder on the `jwt-auth-routes`
branch. The earlier REST API activity at the repository root is unchanged.

## Run

From this folder:

```sh
npm ci
cp .env.example .env
```

Replace the placeholder `JWT_SECRET` in `.env` with your own random value.
Keep `.env` private. `JWT_EXPIRES_IN=1h` gives login tokens a one-hour lifetime.

```sh
npm start
```

Open `http://127.0.0.1:3000/index.html`. Create an account, then log in.
Registration accepts a username, email, password of at least eight characters,
and an optional short bio.

## Pages and routes

| Page | API request | Access |
| --- | --- | --- |
| Log in / Create account | `POST /api/auth/login`, `POST /api/auth/register` | Public |
| Dashboard | `GET /api/users/me` | JWT required |
| About Me | `GET /api/users/me` | JWT required |
| Users | `GET /api/users` | JWT required |

About Me shows the logged-in user's username, email, and bio. Users shows all
registered users. Both API routes run the existing JWT authentication
middleware before their controllers. Responses exclude password hashes.

As in the starter, HTML page shells are public static files. Protected data
comes only from the authenticated APIs; without a token the page redirects to
login, and invalid or expired tokens receive HTTP 401.

Passwords are hashed with the starter's `bcryptjs` dependency. Tokens are
stored in `localStorage` and sent as `Authorization: Bearer <token>`.
Logging out removes the browser's token.

User data is stored in an in-memory array, not a persistent database. It resets
when the server restarts. This is a local classroom demo.

## Validate

```sh
npm run check
npm test
```

The activity specifies this submission branch:
`https://github.com/jstredacted/dampal-app-dev-2026/tree/jwt-auth-routes`.
