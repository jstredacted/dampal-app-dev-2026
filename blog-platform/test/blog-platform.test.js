// Starts the real Auth Server and Blog API as separate processes, each with its own
// temporary localStorage file, so persistence and server independence are tested too.
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { before, after, test } = require("node:test");
const jwt = require("jsonwebtoken");

const ROOT = path.join(__dirname, "..");
const PAGES = ["index.html", "details.html", "create.html", "login.html", "about.html"];
const SECRET = "midterm-test-secret";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blog-platform-test-"));
const authStorage = path.join(tempDir, "auth-storage.db");
const blogStorage = path.join(tempDir, "blog-storage.db");

let authUrl;
let blogUrl;
let authProcess;
let blogProcess;
const tokens = {};

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function startServer(script, storageFile, portEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "--experimental-webstorage",
      `--localstorage-file=${storageFile}`,
      script,
    ], {
      cwd: ROOT,
      env: { ...process.env, JWT_SECRET: SECRET, ...portEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (data) => {
      if (data.toString().includes("running at")) resolve(child);
    });
    child.on("exit", (code) => reject(new Error(`${script} exited with code ${code}`)));
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

async function startAuth() {
  const port = Number(new URL(authUrl).port);
  authProcess = await startServer("auth-server/server.js", authStorage, {
    AUTH_PORT: String(port),
    BLOG_PORT: new URL(blogUrl).port, // the Auth Server allows CORS from the Blog API's pages
  });
}

async function startBlog() {
  const port = Number(new URL(blogUrl).port);
  blogProcess = await startServer("blog-api/server.js", blogStorage, { BLOG_PORT: String(port) });
}

async function request(baseUrl, method, endpoint, { body, token, rawBody } = {}) {
  const headers = {};
  if (body !== undefined || rawBody !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

const auth = (method, endpoint, options) => request(authUrl, method, endpoint, options);
const blog = (method, endpoint, options) => request(blogUrl, method, endpoint, options);

function assertError(response, status) {
  assert.equal(response.status, status);
  assert.deepEqual(Object.keys(response.body), ["error"]);
  assert.equal(typeof response.body.error, "string");
}

before(async () => {
  authUrl = `http://127.0.0.1:${await freePort()}`;
  blogUrl = `http://127.0.0.1:${await freePort()}`;
  await startAuth();
  await startBlog();
});

after(async () => {
  await stopServer(authProcess);
  await stopServer(blogProcess);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("register creates reader, author and admin accounts without returning the password", async () => {
  for (const [username, role] of [
    ["rina", "reader"],
    ["arlo", "author"],
    ["bea", "author"],
    ["ada", "admin"],
  ]) {
    const response = await auth("POST", "/register", {
      body: { username, password: `${username}-password`, role },
    });
    assert.equal(response.status, 201, username);
    assert.equal(response.body.user.role, role);
    assert.equal("hashed_password" in response.body.user, false);
    assert.equal("password" in response.body.user, false);
  }
});

test("register returns 400 for missing fields or an invalid role, 409 for a taken username", async () => {
  for (const body of [
    {},
    { password: "pw", role: "reader" },
    { username: "x", role: "reader" },
    { username: "x", password: "pw" },
    { username: "  ", password: "pw", role: "reader" },
    { username: 5, password: "pw", role: "reader" },
    { username: "x", password: "pw", role: "superuser" },
  ]) {
    assertError(await auth("POST", "/register", { body }), 400);
  }
  assertError(await auth("POST", "/register", {
    body: { username: " arlo ", password: "another", role: "reader" },
  }), 409);
});

test("login returns access and refresh tokens with the required claims and lifetimes", async () => {
  for (const username of ["rina", "arlo", "bea", "ada"]) {
    const response = await auth("POST", "/login", {
      body: { username, password: `${username}-password` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), ["accessToken", "refreshToken"]);
    tokens[username] = response.body;
  }

  const access = jwt.verify(tokens.arlo.accessToken, SECRET);
  assert.equal(access.username, "arlo");
  assert.equal(access.role, "author");
  assert.equal(typeof access.id, "number");
  assert.equal(access.type, undefined);
  assert.equal(access.exp - access.iat, 15 * 60);

  const refresh = jwt.verify(tokens.arlo.refreshToken, SECRET);
  assert.equal(refresh.type, "refresh");
  assert.equal(refresh.id, access.id);
  assert.equal(refresh.exp - refresh.iat, 7 * 24 * 60 * 60);
});

test("login returns 400 for missing fields and 401 for wrong credentials", async () => {
  assertError(await auth("POST", "/login", { body: { username: "arlo" } }), 400);
  assertError(await auth("POST", "/login", { body: { password: "x" } }), 400);
  assertError(await auth("POST", "/login", { body: { username: "arlo", password: "wrong" } }), 401);
  assertError(await auth("POST", "/login", { body: { username: "nobody", password: "x" } }), 401);
});

test("refresh returns only a new access token for the saved refresh token", async () => {
  const response = await auth("POST", "/refresh", { body: { refreshToken: tokens.arlo.refreshToken } });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body), ["accessToken"]);
  assert.equal(jwt.verify(response.body.accessToken, SECRET).role, "author");
});

test("refresh returns 400 when missing and 401 for forged, expired, or access tokens", async () => {
  assertError(await auth("POST", "/refresh", { body: {} }), 400);
  const forged = jwt.sign({ id: 2, type: "refresh" }, "wrong-secret", { expiresIn: "7d" });
  const expired = jwt.sign({ id: 2, type: "refresh", exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
  for (const refreshToken of [forged, expired, tokens.arlo.accessToken, "not-a-jwt"]) {
    assertError(await auth("POST", "/refresh", { body: { refreshToken } }), 401);
  }
});

test("a valid refresh token that is no longer the saved one is rejected", async () => {
  const first = tokens.bea.refreshToken;
  const second = await auth("POST", "/login", { body: { username: "bea", password: "bea-password" } });
  assert.notEqual(second.body.refreshToken, first);
  assertError(await auth("POST", "/refresh", { body: { refreshToken: first } }), 401);
  tokens.bea = second.body;
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
  const forged = jwt.sign({ id: 2, username: "arlo", role: "admin" }, "wrong-secret");
  assertError(await blog("POST", "/api/posts", { body, token: forged }), 401);
  const expired = jwt.sign({ id: 2, username: "arlo", role: "author", exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
  assertError(await blog("POST", "/api/posts", { body, token: expired }), 401);
  assertError(await blog("POST", "/api/posts", { body, token: tokens.rina.accessToken }), 403);
});

test("Authorization headers that are not exactly 'Bearer <token>' are rejected", async () => {
  for (const header of [`Basic ${tokens.arlo.accessToken}`, `Bearer ${tokens.arlo.accessToken} extra`, "Bearer"]) {
    const response = await fetch(`${blogUrl}/api/me/posts`, { headers: { Authorization: header } });
    assert.equal(response.status, 401, header);
  }
});

test("create validates title and content and takes user_id from the token", async () => {
  for (const body of [{}, { title: "Only title" }, { title: " ", content: "x" }, { title: 1, content: "x" }]) {
    assertError(await blog("POST", "/api/posts", { body, token: tokens.arlo.accessToken }), 400);
  }

  const arloId = jwt.decode(tokens.arlo.accessToken).id;
  const created = await blog("POST", "/api/posts", {
    body: { title: "Arlo's post", content: "Written by Arlo", user_id: 999 },
    token: tokens.arlo.accessToken,
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body, { id: 1, user_id: arloId, title: "Arlo's post", content: "Written by Arlo" });

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
    body: { title: "Edited title", user_id: 999, id: 50 },
    token: tokens.arlo.accessToken,
  });
  assert.equal(titleOnly.status, 200);
  assert.equal(titleOnly.body.title, "Edited title");
  assert.equal(titleOnly.body.content, "Written by Arlo");
  assert.equal(titleOnly.body.id, 1);
  assert.equal(titleOnly.body.user_id, jwt.decode(tokens.arlo.accessToken).id);

  const byAdmin = await blog("PUT", "/api/posts/1", {
    body: { content: "Edited by admin" },
    token: tokens.ada.accessToken,
  });
  assert.equal(byAdmin.status, 200);
  assert.equal(byAdmin.body.title, "Edited title");
  assert.equal(byAdmin.body.content, "Edited by admin");
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
});

test("logout clears the refresh token so it can no longer be used", async () => {
  assertError(await auth("POST", "/logout", { body: {} }), 400);

  const loggedOut = await auth("POST", "/logout", { body: { refreshToken: tokens.rina.refreshToken } });
  assert.equal(loggedOut.status, 200);
  assertError(await auth("POST", "/refresh", { body: { refreshToken: tokens.rina.refreshToken } }), 401);

  // Logging out twice still succeeds and does not affect anyone else
  assert.equal((await auth("POST", "/logout", { body: { refreshToken: tokens.rina.refreshToken } })).status, 200);
  assert.equal((await auth("POST", "/refresh", { body: { refreshToken: tokens.arlo.refreshToken } })).status, 200);
});

test("malformed JSON and unknown routes also use the { error } format", async () => {
  assertError(await auth("POST", "/login", { rawBody: "{bad json" }), 400);
  assertError(await blog("POST", "/api/posts", { rawBody: "{bad json", token: tokens.arlo.accessToken }), 400);
  assertError(await auth("GET", "/nowhere"), 404);
  assertError(await blog("GET", "/nowhere"), 404);
});

test("the Blog API serves the frontend pages but not its source or configuration", async () => {
  for (const page of PAGES.map((file) => `/${file}`).concat("/")) {
    const response = await fetch(`${blogUrl}${page}`);
    assert.equal(response.status, 200, page);
    assert.match(await response.text(), /<!DOCTYPE html>/i);
  }
  for (const asset of ["/app.js", "/styles.css"]) {
    assert.equal((await fetch(`${blogUrl}${asset}`)).status, 200, asset);
  }
  for (const file of ["/server.js", "/src/app.js", "/.env", "/../.env", "/package.json"]) {
    const response = await fetch(`${blogUrl}${file}`);
    assert.equal(response.status, 404, file);
  }
});

test("frontend page scripts have valid JavaScript syntax", () => {
  const publicDir = path.join(ROOT, "blog-api", "public");
  const shared = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");
  assert.doesNotThrow(() => new vm.Script(shared, { filename: "app.js" }));
  for (const file of PAGES) {
    const html = fs.readFileSync(path.join(publicDir, file), "utf8");
    assert.match(html, /<script src="\/app.js"><\/script>/, file);
    assert.match(html, /<link rel="stylesheet" href="\/styles.css"/, file);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1, file);
    // Pages share one global scope with app.js, so check them together
    assert.doesNotThrow(() => new vm.Script(`${shared}\n${scripts[0][1]}`, { filename: file }));
  }
});

test("the Auth Server allows CORS only from the Blog API's page address", async () => {
  const pageOrigin = blogUrl;
  const preflight = await fetch(`${authUrl}/login`, {
    method: "OPTIONS",
    headers: {
      Origin: pageOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), pageOrigin);
  assert.match(preflight.headers.get("access-control-allow-headers"), /Content-Type/i);

  const login = await fetch(`${authUrl}/login`, {
    method: "POST",
    headers: { Origin: pageOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "arlo", password: "wrong" }),
  });
  assert.equal(login.status, 401);
  assert.equal(login.headers.get("access-control-allow-origin"), pageOrigin);

  const other = await fetch(`${authUrl}/login`, {
    method: "OPTIONS",
    headers: { Origin: "http://evil.example", "Access-Control-Request-Method": "POST" },
  });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
});

test("the Blog API keeps working with an access token while the Auth Server is stopped", async () => {
  await stopServer(authProcess);
  const created = await blog("POST", "/api/posts", {
    body: { title: "Auth is down", content: "Still works" },
    token: tokens.bea.accessToken,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.id, 3); // id 1 was deleted, but ids are never reused
});

test("users, posts, refresh tokens and revocation survive a restart of both servers", async () => {
  await stopServer(blogProcess);
  await startAuth();
  await startBlog();

  const posts = await blog("GET", "/api/posts");
  assert.deepEqual(posts.body.map((p) => p.id), [2, 3]);

  // Saved refresh token still works; the logged-out one stays revoked
  assert.equal((await auth("POST", "/refresh", { body: { refreshToken: tokens.arlo.refreshToken } })).status, 200);
  assertError(await auth("POST", "/refresh", { body: { refreshToken: tokens.rina.refreshToken } }), 401);
  assertError(await auth("POST", "/register", {
    body: { username: "arlo", password: "x", role: "reader" },
  }), 409);

  const created = await blog("POST", "/api/posts", {
    body: { title: "After restart", content: "New id" },
    token: tokens.ada.accessToken,
  });
  assert.equal(created.body.id, 4);

  // Logging in again sets a new refresh token and clears revoked_at
  const relogin = await auth("POST", "/login", { body: { username: "rina", password: "rina-password" } });
  assert.equal(relogin.status, 200);
  assert.equal((await auth("POST", "/refresh", { body: { refreshToken: relogin.body.refreshToken } })).status, 200);
  tokens.rina = relogin.body;
  await auth("POST", "/logout", { body: { refreshToken: tokens.arlo.refreshToken } });
});

test("saved users follow the required schema with hashed passwords", async () => {
  await stopServer(authProcess);
  const saved = execFileSync(process.execPath, [
    "--experimental-webstorage",
    "--no-warnings",
    `--localstorage-file=${authStorage}`,
    "-e",
    "process.stdout.write(localStorage.getItem('users'))",
  ]).toString();
  const users = JSON.parse(saved);
  assert.equal(users.length, 4);
  for (const user of users) {
    assert.deepEqual(Object.keys(user).sort(), [
      "created_at", "hashed_password", "id", "refresh_token", "revoked_at", "role", "username",
    ]);
    assert.doesNotMatch(user.hashed_password, /password/);
    assert.match(user.hashed_password, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  }
  const rina = users.find((u) => u.username === "rina");
  assert.equal(rina.refresh_token, tokens.rina.refreshToken);
  assert.equal(rina.revoked_at, null);
  const arlo = users.find((u) => u.username === "arlo");
  assert.equal(arlo.refresh_token, null);
  assert.equal(typeof arlo.revoked_at, "string");
});
