const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { before, after, test } = require("node:test");

process.env.JWT_SECRET = "activity-test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const jwt = require("jsonwebtoken");
const app = require("../src/app");

let server;
let baseUrl;
let token;

before(async () => {
  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "student",
      email: "student@example.test",
      bio: "I am learning JWT authentication.",
      password: "demo-password",
    }),
  });

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "student@example.test",
      password: "demo-password",
    }),
  });
  ({ token } = await loginResponse.json());
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function authenticatedFetch(endpoint, options = {}) {
  return fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

test("login token includes an expiration value", () => {
  const decoded = jwt.decode(token);
  assert.equal(typeof decoded.exp, "number");
  assert.ok(decoded.exp > decoded.iat);
});

test("About Me returns username, email, and bio for the logged-in user", async () => {
  const response = await authenticatedFetch("/api/users/me");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: 1,
    username: "student",
    email: "student@example.test",
    bio: "I am learning JWT authentication.",
  });
});

test("Users returns all registered users without password hashes", async () => {
  const response = await authenticatedFetch("/api/users");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{
    id: 1,
    username: "student",
    email: "student@example.test",
    bio: "I am learning JWT authentication.",
  }]);
});

test("About Me and Users reject requests without a token", async () => {
  for (const endpoint of ["/api/users/me", "/api/users"]) {
    const response = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(response.status, 401, endpoint);
  }
});

test("protected routes reject an expired token", async () => {
  const expiredToken = jwt.sign(
    { userId: 1, exp: Math.floor(Date.now() / 1000) - 1 },
    process.env.JWT_SECRET
  );

  for (const endpoint of ["/api/users/me", "/api/users"]) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(response.status, 401);
  }
});

test("About Me and Users pages are served by the application", async () => {
  for (const page of ["/about-me.html", "/users.html"]) {
    const response = await fetch(`${baseUrl}${page}`);
    assert.equal(response.status, 200, page);
    assert.match(await response.text(), /<!DOCTYPE html>/i);
  }
});

test("all page scripts have valid JavaScript syntax", () => {
  for (const file of ["index.html", "dashboard.html", "about-me.html", "users.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", "public", file), "utf8");
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1, file);
    assert.doesNotThrow(() => new vm.Script(scripts[0][1], { filename: file }));
  }
});

async function post(endpoint, body) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("registration rejects missing, blank, and non-text required fields", async () => {
  for (const field of ["username", "email", "password"]) {
    for (const invalid of [undefined, "", null, 123, {}, []]) {
      const body = {
        username: "invalid",
        email: "invalid@example.test",
        password: "demo-password",
      };
      body[field] = invalid;
      const response = await post("/api/auth/register", body);
      assert.equal(response.status, 400, `${field}: ${JSON.stringify(invalid)}`);
    }
  }
  const response = await post("/api/auth/register", {
    username: "  ",
    email: "blank@example.test",
    password: "demo-password",
  });
  assert.equal(response.status, 400);
});

test("registration rejects passwords shorter than eight characters", async () => {
  const response = await post("/api/auth/register", {
    username: "short",
    email: "short@example.test",
    password: "1234567",
  });
  assert.equal(response.status, 400);
});

test("duplicate email remains rejected after surrounding whitespace is removed", async () => {
  const response = await post("/api/auth/register", {
    username: "duplicate",
    email: " student@example.test ",
    password: "demo-password",
  });
  assert.equal(response.status, 409);
});

test("login rejects wrong, missing, or non-text credentials", async () => {
  for (const body of [
    { email: "student@example.test", password: "wrong-password" },
    { email: "missing@example.test", password: "demo-password" },
    {},
    { email: {}, password: "demo-password" },
    { email: "student@example.test", password: [] },
  ]) {
    const response = await post("/api/auth/login", body);
    assert.equal(response.status, 401);
    assert.equal("token" in response.body, false);
  }
});

test("both protected routes reject forged tokens and non-Bearer headers", async () => {
  const forgedToken = jwt.sign({ userId: 1 }, "not-the-server-secret");
  for (const endpoint of ["/api/users/me", "/api/users"]) {
    for (const authorization of [
      `Bearer ${forgedToken}`,
      `Basic ${token}`,
      `Bearer ${token} extra`,
      "Bearer broken-token",
    ]) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: { Authorization: authorization },
      });
      assert.equal(response.status, 401, endpoint);
    }
  }
});

test("Users includes a second account while About Me stays specific to its token", async () => {
  const registration = await post("/api/auth/register", {
    username: " second ",
    email: " second@example.test ",
    password: "second-password",
  });
  assert.equal(registration.status, 201);
  const login = await post("/api/auth/login", {
    email: " second@example.test ",
    password: "second-password",
  });
  assert.equal(login.status, 200);
  const profileResponse = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${login.body.token}` },
  });
  assert.deepEqual(await profileResponse.json(), {
    id: 2,
    username: "second",
    email: "second@example.test",
    bio: "",
  });

  const usersResponse = await authenticatedFetch("/api/users");
  const users = await usersResponse.json();
  assert.equal(users.length, 2);
  assert.equal(users[0].username, "student");
  assert.equal(users[1].username, "second");
  for (const user of users) {
    assert.equal("password" in user, false);
    assert.equal("passwordHash" in user, false);
  }
});

test("an issued one-second token becomes unusable after its configured lifetime", async () => {
  process.env.JWT_EXPIRES_IN = "1s";
  const login = await post("/api/auth/login", {
    email: "student@example.test",
    password: "demo-password",
  });
  process.env.JWT_EXPIRES_IN = "1h";
  assert.equal(login.status, 200);
  const decoded = jwt.decode(login.body.token);
  assert.equal(decoded.exp - decoded.iat, 1);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  for (const endpoint of ["/api/users/me", "/api/users"]) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: { Authorization: `Bearer ${login.body.token}` },
    });
    assert.equal(response.status, 401);
  }
});

test("malformed JSON returns a clear 400 response", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid-json",
  });
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).error, "string");
});

test("backend source, configuration, and dependencies are not public files", async () => {
  for (const file of ["/src/models/user.model.js", "/package.json", "/.env", "/.git/config"]) {
    const response = await fetch(`${baseUrl}${file}`);
    assert.equal(response.status, 404, file);
  }
});
