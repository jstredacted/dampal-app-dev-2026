// Starts the real Auth Server and Blog Server as separate processes against a separate
// MariaDB database (blog_platform_test), so your own blog_platform data is never touched.
// Requires MySQL running in XAMPP.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { before, after, test } = require("node:test");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const ROOT = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(ROOT, ".env"), quiet: true });

const SECRET = "final-exam-test-secret";
const TEST_DB = "blog_platform_test";
const DB_ENV = {
  DB_HOST: process.env.DB_HOST || "127.0.0.1",
  DB_PORT: process.env.DB_PORT || "3306",
  DB_USER: process.env.DB_USER || "root",
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: TEST_DB,
};

let authUrl;
let blogUrl;
let authProcess;
let blogProcess;
let db;
const tokens = {};
const ids = {};

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function startServer(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: ROOT,
      env: { ...process.env, ...DB_ENV, JWT_SECRET: SECRET, AUTH_RATE_LIMIT: "1000", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let errors = "";
    child.stderr.on("data", (data) => { errors += data; });
    child.stdout.on("data", (data) => {
      if (data.toString().includes("running at")) resolve(child);
    });
    child.on("exit", (code) => reject(new Error(`${script} exited with code ${code}: ${errors}`)));
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    // A process stopped by kill() has a signalCode instead of an exitCode
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    child.removeAllListeners("exit");
    child.on("exit", resolve);
    child.kill();
  });
}

const startAuth = async () => {
  authProcess = await startServer("auth-server/server.js", { AUTH_PORT: new URL(authUrl).port });
};
const startBlog = async () => {
  blogProcess = await startServer("blog-server/server.js", { BLOG_PORT: new URL(blogUrl).port });
};

async function request(baseUrl, method, endpoint, { body, token, rawBody, cookie } = {}) {
  const headers = {};
  if (body !== undefined || rawBody !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}

const auth = (method, endpoint, options) => request(authUrl, method, endpoint, options);
const blog = (method, endpoint, options) => request(blogUrl, method, endpoint, options);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function assertError(response, status) {
  assert.equal(response.status, status);
  assert.deepEqual(Object.keys(response.body), ["error"]);
  assert.equal(typeof response.body.error, "string");
}

async function createTestDatabase() {
  const connection = await mysql.createConnection({
    host: DB_ENV.DB_HOST,
    port: Number(DB_ENV.DB_PORT),
    user: DB_ENV.DB_USER,
    password: DB_ENV.DB_PASSWORD,
    multipleStatements: true,
  });
  const schema = fs
    .readFileSync(path.join(ROOT, "database", "schema.sql"), "utf8")
    .replaceAll("blog_platform", TEST_DB);
  await connection.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await connection.query(schema);
  await connection.end();
}

before(async () => {
  await createTestDatabase();
  db = mysql.createPool({
    host: DB_ENV.DB_HOST,
    port: Number(DB_ENV.DB_PORT),
    user: DB_ENV.DB_USER,
    password: DB_ENV.DB_PASSWORD,
    database: TEST_DB,
  });
  authUrl = `http://127.0.0.1:${await freePort()}`;
  blogUrl = `http://127.0.0.1:${await freePort()}`;
  await startAuth();
  await startBlog();
});

after(async () => {
  await stopServer(authProcess);
  await stopServer(blogProcess);
  if (db) {
    await db.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await db.end();
  }
});

test("schema.sql creates the four tables and the three roles", async () => {
  const [tables] = await db.query("SHOW TABLES");
  assert.deepEqual(tables.map((row) => Object.values(row)[0]).sort(), ["posts", "refresh_tokens", "roles", "users"]);
  const [roles] = await db.query("SELECT role FROM roles ORDER BY id");
  assert.deepEqual(roles.map((r) => r.role), ["reader", "author", "admin"]);
});

test("register creates reader, author and admin accounts without returning the password", async () => {
  for (const [username, role] of [
    ["rina", "reader"],
    ["arlo", "author"],
    ["bea", "author"],
    ["ada", "admin"],
    ["ivy", "reader"],
  ]) {
    const response = await auth("POST", "/register", {
      body: { email: `${username}@school.test`, username, password: `${username}-password`, role },
    });
    assert.equal(response.status, 201, username);
    assert.deepEqual(Object.keys(response.body.user).sort(), ["email", "id", "role", "username"]);
    assert.equal(response.body.user.role, role);
    ids[username] = response.body.user.id;
  }

  const [rows] = await db.query(
    "SELECT users.*, roles.role FROM users JOIN roles ON roles.id = users.role_id WHERE username = 'arlo'"
  );
  assert.equal(rows[0].role, "author");
  assert.equal(rows[0].email, "arlo@school.test");
  assert.equal(rows[0].is_active, 1);
  assert.match(rows[0].password_hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.doesNotMatch(rows[0].password_hash, /password/);
});

test("register returns 400 for missing fields, a bad email or an invalid role, 409 when taken", async () => {
  for (const body of [
    {},
    { username: "x", password: "pw", role: "reader" },
    { email: "x@school.test", password: "pw", role: "reader" },
    { email: "x@school.test", username: "x", role: "reader" },
    { email: "x@school.test", username: "x", password: "pw" },
    { email: "x@school.test", username: "  ", password: "pw", role: "reader" },
    { email: "x@school.test", username: 5, password: "pw", role: "reader" },
    { email: "not-an-email", username: "x", password: "pw", role: "reader" },
    { email: "x@school.test", username: "x", password: "pw", role: "superuser" },
  ]) {
    assertError(await auth("POST", "/register", { body }), 400);
  }
  assertError(await auth("POST", "/register", {
    body: { email: "new@school.test", username: " arlo ", password: "another", role: "reader" },
  }), 409);
  assertError(await auth("POST", "/register", {
    body: { email: "ARLO@school.test", username: "arlo2", password: "another", role: "reader" },
  }), 409);
});

test("login returns access and refresh tokens with the required claims and lifetimes", async () => {
  for (const username of ["rina", "arlo", "bea", "ada", "ivy"]) {
    const response = await auth("POST", "/login", {
      body: { username, password: `${username}-password` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), ["accessToken", "refreshToken"]);
    tokens[username] = response.body;
  }

  const access = jwt.verify(tokens.arlo.accessToken, SECRET);
  assert.equal(access.id, ids.arlo);
  assert.equal(access.username, "arlo");
  assert.equal(access.role, "author");
  assert.equal(access.type, undefined);
  assert.equal(access.exp - access.iat, 15 * 60);

  const refresh = jwt.verify(tokens.arlo.refreshToken, SECRET);
  assert.equal(refresh.type, "refresh");
  assert.equal(refresh.id, ids.arlo);
  assert.equal(refresh.exp - refresh.iat, 7 * 24 * 60 * 60);
});

test("login stores only a hash of the refresh token, valid for 7 days, in refresh_tokens", async () => {
  const [rows] = await db.query(
    `SELECT token_hash, revoked_at, TIMESTAMPDIFF(HOUR, NOW(), expires_at) AS hours_left
     FROM refresh_tokens WHERE user_id = ?`,
    [ids.arlo]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, sha256(tokens.arlo.refreshToken));
  assert.equal(rows[0].revoked_at, null);
  assert.ok(rows[0].hours_left >= 7 * 24 - 1 && rows[0].hours_left <= 7 * 24);

  const [raw] = await db.query("SELECT COUNT(*) AS n FROM refresh_tokens WHERE token_hash = ?", [tokens.arlo.refreshToken]);
  assert.equal(raw[0].n, 0);
});

test("login also sets the refresh token as an httpOnly cookie", async () => {
  const response = await auth("POST", "/login", { body: { username: "bea", password: "bea-password" } });
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, new RegExp(`^refreshToken=${response.body.refreshToken};`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  tokens.bea = response.body;
});

test("login returns 400 for missing fields and 401 for wrong credentials or a disabled account", async () => {
  assertError(await auth("POST", "/login", { body: { username: "arlo" } }), 400);
  assertError(await auth("POST", "/login", { body: { password: "x" } }), 400);
  assertError(await auth("POST", "/login", { body: { username: "arlo", password: "wrong" } }), 401);
  assertError(await auth("POST", "/login", { body: { username: "nobody", password: "x" } }), 401);

  await db.query("UPDATE users SET is_active = 0 WHERE id = ?", [ids.ivy]);
  assertError(await auth("POST", "/login", { body: { username: "ivy", password: "ivy-password" } }), 401);
  assertError(await auth("POST", "/refresh", { body: { refreshToken: tokens.ivy.refreshToken } }), 401);
});

test("refresh returns only a new access token, from the body or the cookie", async () => {
  const response = await auth("POST", "/refresh", { body: { refreshToken: tokens.arlo.refreshToken } });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body), ["accessToken"]);
  assert.equal(jwt.verify(response.body.accessToken, SECRET).role, "author");

  const fromCookie = await auth("POST", "/refresh", { cookie: `refreshToken=${tokens.arlo.refreshToken}` });
  assert.equal(fromCookie.status, 200);
  assert.deepEqual(Object.keys(fromCookie.body), ["accessToken"]);
});

test("refresh returns 400 when missing and 401 for forged, expired, unknown or access tokens", async () => {
  assertError(await auth("POST", "/refresh", { body: {} }), 400);
  assertError(await auth("POST", "/refresh"), 400);
  const forged = jwt.sign({ id: ids.arlo, type: "refresh" }, "wrong-secret", { expiresIn: "7d" });
  const expired = jwt.sign({ id: ids.arlo, type: "refresh", exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
  const neverSaved = jwt.sign({ id: ids.arlo, type: "refresh" }, SECRET, { expiresIn: "7d", jwtid: "x" });
  for (const refreshToken of [forged, expired, neverSaved, tokens.arlo.accessToken, "not-a-jwt"]) {
    assertError(await auth("POST", "/refresh", { body: { refreshToken } }), 401);
  }
});

test("refresh returns 401 when the saved row has passed expires_at", async () => {
  const login = await auth("POST", "/login", { body: { username: "rina", password: "rina-password" } });
  await db.query(
    "UPDATE refresh_tokens SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE token_hash = ?",
    [sha256(login.body.refreshToken)]
  );
  assertError(await auth("POST", "/refresh", { body: { refreshToken: login.body.refreshToken } }), 401);
});

test("anyone can list posts and view one post without a token", async () => {
  const list = await blog("GET", "/api/posts");
  assert.equal(list.status, 200);
  assert.deepEqual(list.body, []);
  assertError(await blog("GET", "/api/posts/999"), 404);
  assertError(await blog("GET", "/api/posts/abc"), 404);
});

test("creating a post requires an author or admin access token", async () => {
  const body = { title: "Hello", content: "First post" };
  assertError(await blog("POST", "/api/posts", { body }), 401);
  assertError(await blog("POST", "/api/posts", { body, token: tokens.arlo.refreshToken }), 401);
  assertError(await blog("POST", "/api/posts", { body, token: "broken" }), 401);
  const forged = jwt.sign({ id: ids.arlo, username: "arlo", role: "admin" }, "wrong-secret");
  assertError(await blog("POST", "/api/posts", { body, token: forged }), 401);
  const expired = jwt.sign({ id: ids.arlo, username: "arlo", role: "author", exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
  assertError(await blog("POST", "/api/posts", { body, token: expired }), 401);
  assertError(await blog("POST", "/api/posts", { body, token: tokens.rina.accessToken }), 403);
});

test("Authorization headers that are not exactly 'Bearer <token>' are rejected", async () => {
  for (const header of [`Basic ${tokens.arlo.accessToken}`, `Bearer ${tokens.arlo.accessToken} extra`, "Bearer"]) {
    const response = await fetch(`${blogUrl}/api/me/posts`, { headers: { Authorization: header } });
    assert.equal(response.status, 401, header);
  }
});

test("create validates title and content and takes author_id from the token", async () => {
  for (const body of [{}, { title: "Only title" }, { title: " ", content: "x" }, { title: 1, content: "x" }]) {
    assertError(await blog("POST", "/api/posts", { body, token: tokens.arlo.accessToken }), 400);
  }

  const created = await blog("POST", "/api/posts", {
    body: { title: "Arlo's post", content: "Written by Arlo", author_id: ids.ada },
    token: tokens.arlo.accessToken,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.id, 1);
  assert.equal(created.body.author_id, ids.arlo);
  assert.equal(created.body.author, "arlo");
  assert.equal(created.body.title, "Arlo's post");
  assert.equal(created.body.content, "Written by Arlo");
  assert.ok(created.body.created_at && created.body.updated_at);

  const [rows] = await db.query("SELECT author_id FROM posts WHERE id = 1");
  assert.equal(rows[0].author_id, ids.arlo);

  const adminPost = await blog("POST", "/api/posts", {
    body: { title: "Admin note", content: "From the admin" },
    token: tokens.ada.accessToken,
  });
  assert.equal(adminPost.status, 201);
  assert.equal(adminPost.body.id, 2);

  const one = await blog("GET", "/api/posts/1");
  assert.equal(one.status, 200);
  assert.equal(one.body.title, "Arlo's post");
});

test("only the post owner or an admin can update, and only the given fields change", async () => {
  assertError(await blog("PUT", "/api/posts/1", { body: { title: "x" } }), 401);
  assertError(await blog("PUT", "/api/posts/1", { body: { title: "x" }, token: tokens.rina.accessToken }), 403);
  assertError(await blog("PUT", "/api/posts/1", { body: { title: "x" }, token: tokens.bea.accessToken }), 403);
  assertError(await blog("PUT", "/api/posts/999", { body: { title: "x" }, token: tokens.arlo.accessToken }), 404);
  assertError(await blog("PUT", "/api/posts/1", { body: {}, token: tokens.arlo.accessToken }), 400);
  assertError(await blog("PUT", "/api/posts/1", { body: { title: "" }, token: tokens.arlo.accessToken }), 400);

  const titleOnly = await blog("PUT", "/api/posts/1", {
    body: { title: "Edited title", author_id: ids.ada, id: 50 },
    token: tokens.arlo.accessToken,
  });
  assert.equal(titleOnly.status, 200);
  assert.equal(titleOnly.body.title, "Edited title");
  assert.equal(titleOnly.body.content, "Written by Arlo");
  assert.equal(titleOnly.body.id, 1);
  assert.equal(titleOnly.body.author_id, ids.arlo);

  const byAdmin = await blog("PUT", "/api/posts/1", {
    body: { content: "Edited by admin" },
    token: tokens.ada.accessToken,
  });
  assert.equal(byAdmin.status, 200);
  assert.equal(byAdmin.body.title, "Edited title");
  assert.equal(byAdmin.body.content, "Edited by admin");
  assert.equal(byAdmin.body.author_id, ids.arlo);
});

test("GET /api/me/posts lists only the logged-in user's posts", async () => {
  assertError(await blog("GET", "/api/me/posts"), 401);
  assert.deepEqual((await blog("GET", "/api/me/posts", { token: tokens.rina.accessToken })).body, []);
  const mine = await blog("GET", "/api/me/posts", { token: tokens.arlo.accessToken });
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.map((p) => p.id), [1]);
});

test("only an admin can delete, even when an author owns the post", async () => {
  assertError(await blog("DELETE", "/api/posts/1"), 401);
  assertError(await blog("DELETE", "/api/posts/1", { token: tokens.arlo.accessToken }), 403);
  assertError(await blog("DELETE", "/api/posts/1", { token: tokens.rina.accessToken }), 403);
  assertError(await blog("DELETE", "/api/posts/999", { token: tokens.ada.accessToken }), 404);

  const deleted = await blog("DELETE", "/api/posts/1", { token: tokens.ada.accessToken });
  assert.equal(deleted.status, 200);
  assertError(await blog("GET", "/api/posts/1"), 404);
  const [rows] = await db.query("SELECT COUNT(*) AS n FROM posts WHERE id = 1");
  assert.equal(rows[0].n, 0);
});

test("logout sets revoked_at so the refresh token can no longer be used", async () => {
  assertError(await auth("POST", "/logout", { body: {} }), 400);

  const loggedOut = await auth("POST", "/logout", { body: { refreshToken: tokens.rina.refreshToken } });
  assert.equal(loggedOut.status, 200);
  const [rows] = await db.query("SELECT revoked_at FROM refresh_tokens WHERE token_hash = ?", [sha256(tokens.rina.refreshToken)]);
  assert.ok(rows[0].revoked_at instanceof Date);
  assertError(await auth("POST", "/refresh", { body: { refreshToken: tokens.rina.refreshToken } }), 401);

  // Logging out twice still succeeds and does not affect anyone else
  assert.equal((await auth("POST", "/logout", { body: { refreshToken: tokens.rina.refreshToken } })).status, 200);
  assert.equal((await auth("POST", "/refresh", { body: { refreshToken: tokens.arlo.refreshToken } })).status, 200);
});

test("logout with the cookie revokes it and clears the cookie", async () => {
  const login = await auth("POST", "/login", { body: { username: "rina", password: "rina-password" } });
  const response = await auth("POST", "/logout", { cookie: `refreshToken=${login.body.refreshToken}` });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /^refreshToken=;.*Expires=Thu, 01 Jan 1970/);
  assertError(await auth("POST", "/refresh", { body: { refreshToken: login.body.refreshToken } }), 401);
});

test("malformed JSON and unknown routes also use the { error } format", async () => {
  assertError(await auth("POST", "/login", { rawBody: "{bad json" }), 400);
  assertError(await blog("POST", "/api/posts", { rawBody: "{bad json", token: tokens.arlo.accessToken }), 400);
  assertError(await auth("GET", "/nowhere"), 404);
  assertError(await blog("GET", "/nowhere"), 404);
});

test("helmet sets security headers on both servers", async () => {
  for (const url of [`${authUrl}/nowhere`, `${blogUrl}/api/posts`]) {
    const response = await fetch(url);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", url);
    assert.equal(response.headers.get("x-powered-by"), null, url);
  }
});

test("the Blog Server does not serve its source or configuration files", async () => {
  for (const file of ["/server.js", "/db.js", "/src/app.js", "/.env", "/../.env", "/package.json"]) {
    assert.equal((await fetch(`${blogUrl}${file}`)).status, 404, file);
  }
});

test("express-rate-limit returns 429 after too many Auth Server requests", async () => {
  const port = await freePort();
  const limited = await startServer("auth-server/server.js", { AUTH_PORT: String(port), AUTH_RATE_LIMIT: "3" });
  try {
    const url = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 3; i++) {
      assert.equal((await request(url, "POST", "/login", { body: {} })).status, 400);
    }
    assertError(await request(url, "POST", "/login", { body: {} }), 429);
  } finally {
    await stopServer(limited);
  }
});

test("the Blog Server keeps working with an access token while the Auth Server is stopped", async () => {
  await stopServer(authProcess);
  const created = await blog("POST", "/api/posts", {
    body: { title: "Auth is down", content: "Still works" },
    token: tokens.bea.accessToken,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.id, 3); // id 1 was deleted, but AUTO_INCREMENT never reuses ids
});

test("users, posts and refresh tokens survive a restart of both servers", async () => {
  await stopServer(blogProcess);
  await startAuth();
  await startBlog();

  const posts = await blog("GET", "/api/posts");
  assert.deepEqual(posts.body.map((p) => p.id).sort(), [2, 3]);

  assert.equal((await auth("POST", "/refresh", { body: { refreshToken: tokens.arlo.refreshToken } })).status, 200);
  assertError(await auth("POST", "/refresh", { body: { refreshToken: tokens.rina.refreshToken } }), 401);
  assertError(await auth("POST", "/register", {
    body: { email: "other@school.test", username: "arlo", password: "x", role: "reader" },
  }), 409);
});
