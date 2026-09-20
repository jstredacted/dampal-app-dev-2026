# Dampal App Dev 2026

Applications Development and Emerging Technologies.

## Branches

- `main`: initial repository setup.
- [`Prelim-Exam`](https://github.com/jstredacted/dampal-app-dev-2026/tree/Prelim-Exam): To-Do List Application for the preliminary examination, branched from `main`.
- `rest-api-activity`: User Signup and Login Authentication System.

## Run the REST API activity

On the `rest-api-activity` branch, use Node.js 22 or newer and npm:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:3000** for signup. The signup page links to the login page.
Keep the server running while using both pages. Do not open the HTML files
directly or use a separate static-file server.

For automatic server restarts while editing, use `npm run dev` instead.

With Mise managing Node.js, prefix these commands with `mise exec --`,
for example `mise exec -- npm start`.

### API

Both endpoints use **POST** and a JSON request body with
`Content-Type: application/json`.

| Endpoint | Body fields | Result |
| --- | --- | --- |
| `/api/signup` | `email`, `username`, `password` | `201` created; `409` if the email or username exists; `400` for empty fields |
| `/api/login` | `username`, `password` | `200` for a matching user; `401` for incorrect credentials; `400` for empty fields |

Missing, whitespace-only, and non-string fields are also rejected with `400`.
Email and username have surrounding whitespace removed and are compared
case-sensitively. Passwords are compared exactly, including spaces and case.
No password is returned in an API response.

The frontend displays errors with their actual HTTP status codes and navigates
to `home.html` after successful signup or login. The homepage shows `201` or
`200` using a display-only URL fragment. This is not proof of an authenticated
session or an access-control mechanism.

Only the authentication APIs use POST. Normal page and asset loading uses GET.
Other methods on the authentication endpoints return `405`.

### Files

- `server.js`: Express setup, validation, and the two POST endpoints.
- `users.js`: the separate in-memory users array. Each item has an `id`.
- `public/index.html`: signup page.
- `public/login.html`: login page.
- `public/home.html`: simple public homepage.
- `public/auth.js`: form events, JSON request bodies, messages, and navigation.
- `public/styles.css`: shared plain CSS.
- `test/api.test.js`: API tests using Node.js's built-in test runner.

### Validation

```sh
npm run check
npm test
```

The tests start their own local server on an available port. They check
signup, duplicate users, required fields, login credentials, request-body
handling, unique IDs, HTTP methods, and public-file boundaries.

### Demo limitations

This is a local classroom activity, not production authentication. Use
made-up details and never reuse a real password. Users are stored as plain
objects in server memory, including plaintext demo passwords, and disappear
when the server restarts. There is no permanent database, cookie, token,
protected homepage, or persistent login session. The server listens only
on this computer (`127.0.0.1`).

## Run the preliminary examination project

Switch to `Prelim-Exam`, then open `index.html` in a browser with JavaScript
and Local Storage enabled. Keep `index.html`, `styles.css`, and `script.js`
in the same folder. No dependencies or build step are required.
