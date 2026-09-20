const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const app = require("../server");
const users = require("../users");

let server;
let baseUrl;

before(async () => {
  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function post(endpoint, body) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

test("signup returns 201 and stores the user with a backend-generated id", async () => {
  const result = await post("/api/signup", {
    id: 999,
    email: "student@example.test",
    username: "student",
    password: "demo-password"
  });

  assert.equal(result.status, 201);
  assert.deepEqual(result.body.user, {
    id: 1,
    email: "student@example.test",
    username: "student"
  });
  assert.equal(users.length, 1);
  assert.equal(users[0].password, "demo-password");
  assert.equal("password" in result.body.user, false);
});

test("signup rejects either an existing username or email with 409", async () => {
  const initialLength = users.length;
  const duplicateUsername = await post("/api/signup", {
    email: "another@example.test",
    username: " student ",
    password: "another-password"
  });
  const duplicateEmail = await post("/api/signup", {
    email: " student@example.test ",
    username: "another",
    password: "another-password"
  });

  assert.equal(duplicateUsername.status, 409);
  assert.equal(duplicateEmail.status, 409);
  assert.equal(users.length, initialLength);
});

test("signup rejects every missing, empty, whitespace-only, or non-text field with 400", async () => {
  const initialLength = users.length;

  for (const field of ["email", "username", "password"]) {
    for (const invalidValue of [undefined, "", " \t ", null, 7, false, [], {}]) {
      const body = {
        email: "invalid@example.test",
        username: "invalid",
        password: "demo-password"
      };
      body[field] = invalidValue;
      const result = await post("/api/signup", body);
      assert.equal(result.status, 400, `${field}: ${JSON.stringify(invalidValue)}`);
      assert.match(result.body.message, /required/);
    }
  }

  assert.equal(users.length, initialLength);
});

test("a second successful signup gets its own id and preserves password spaces", async () => {
  const result = await post("/api/signup", {
    email: " second@example.test ",
    username: " second ",
    password: " spaced-password "
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.user.id, 2);
  assert.equal(users[1].email, "second@example.test");
  assert.equal(users[1].username, "second");
  assert.equal(users[1].password, " spaced-password ");
});

test("login checks username AND password in the JSON body and returns 200", async () => {
  const initialLength = users.length;
  const result = await post("/api/login", {
    username: " student ",
    password: "demo-password"
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.id, 1);
  assert.equal("password" in result.body.user, false);
  assert.equal(users.length, initialLength);
});

test("login rejects an unknown username or wrong password with 401", async () => {
  for (const body of [
    { username: "unknown", password: "demo-password" },
    { username: "student", password: "wrong-password" },
    { username: "student", password: "Demo-password" },
    { username: "second", password: "spaced-password" }
  ]) {
    const result = await post("/api/login", body);
    assert.equal(result.status, 401);
    assert.equal(result.body.message, "Invalid username or password.");
    assert.equal("user" in result.body, false);
  }

  const exactPassword = await post("/api/login", {
    username: "second",
    password: " spaced-password "
  });
  assert.equal(exactPassword.status, 200);
});

test("login rejects every missing, empty, whitespace-only, or non-text field with 400", async () => {
  for (const field of ["username", "password"]) {
    for (const invalidValue of [undefined, "", " \t ", null, 7, false, [], {}]) {
      const body = { username: "student", password: "demo-password" };
      body[field] = invalidValue;
      const result = await post("/api/login", body);
      assert.equal(result.status, 400, `${field}: ${JSON.stringify(invalidValue)}`);
      assert.match(result.body.message, /required/);
    }
  }
});

test("credentials in query or path parameters do not authenticate a user", async () => {
  const queryOnly = await post("/api/login?username=student&password=demo-password", {});
  assert.equal(queryOnly.status, 400);

  const queryCannotOverride = await post("/api/login?username=student&password=demo-password", {
    username: "student",
    password: "wrong-password"
  });
  assert.equal(queryCannotOverride.status, 401);

  const pathOnly = await post("/api/login/student/demo-password", {});
  assert.notEqual(pathOnly.status, 200);
});

test("empty or malformed request bodies produce JSON errors, not server crashes", async () => {
  for (const endpoint of ["/api/signup", "/api/login"]) {
    for (const body of [undefined, "{broken-json", "null", "[]"]) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).message, "string");
    }
  }
});

test("non-POST authentication requests are rejected with 405", async () => {
  for (const endpoint of ["/api/signup", "/api/login"]) {
    for (const method of ["GET", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) {
      const response = await fetch(`${baseUrl}${endpoint}`, { method });
      assert.equal(response.status, 405, `${method} ${endpoint}`);
      assert.equal(response.headers.get("allow"), "POST");
    }
  }
});

test("HTML pages and frontend assets load without exposing backend files", async () => {
  for (const file of ["/", "/index.html", "/login.html", "/home.html", "/auth.js", "/styles.css"]) {
    const response = await fetch(`${baseUrl}${file}`);
    assert.equal(response.status, 200, file);
    assert.ok((await response.text()).length > 0);
  }

  for (const file of ["/users.js", "/server.js", "/package.json", "/.git/config"]) {
    const response = await fetch(`${baseUrl}${file}`);
    assert.equal(response.status, 404, file);
  }
});
