const express = require("express");
const path = require("path");
const users = require("./users");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function isEmpty(value) {
  return typeof value !== "string" || value.trim() === "";
}

app.post("/api/signup", (req, res) => {
  const { email, username, password } = req.body || {};

  if (isEmpty(email) || isEmpty(username) || isEmpty(password)) {
    return res.status(400).json({
      message: "Email, username, and password are required."
    });
  }

  const existingUser = users.find((user) =>
    user.email === email.trim() || user.username === username.trim()
  );

  if (existingUser) {
    return res.status(409).json({
      message: "A user with that email or username already exists."
    });
  }

  const newUser = {
    id: users.length + 1,
    email: email.trim(),
    username: username.trim(),
    password
  };

  users.push(newUser);

  // Do not send the password back to the browser.
  return res.status(201).json({
    message: "Signup successful.",
    user: {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username
    }
  });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (isEmpty(username) || isEmpty(password)) {
    return res.status(400).json({
      message: "Username and password are required."
    });
  }

  const user = users.find((user) =>
    user.username === username.trim() && user.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: "Invalid username or password."
    });
  }

  return res.status(200).json({
    message: "Login successful.",
    user: {
      id: user.id,
      email: user.email,
      username: user.username
    }
  });
});

// The authentication API accepts POST only.
app.use(["/api/signup", "/api/login"], (req, res) => {
  res.set("Allow", "POST");
  return res.status(405).json({
    message: "Method not allowed. Use POST with a JSON request body."
  });
});

// Only frontend files are public, never server.js or users.js.
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => {
  return res.status(404).json({ message: "Page or endpoint not found." });
});

app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body must be valid JSON." });
  }

  if (error.status && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ message: "Invalid request body." });
  }

  return res.status(500).json({ message: "An unexpected server error occurred." });
});

if (require.main === module) {
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Server running at http://127.0.0.1:${PORT}`);
  });
}

module.exports = app;
